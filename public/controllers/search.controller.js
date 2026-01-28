import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { getErrorMessage } from '../api/api-client.js';
import { loadViewInto } from '../view-loader.js';
import {
    searchLocal,
    startExternalSearch,
    getExternalProviders,
    getExternalSearchStatus,
    cancelExternalSearch
} from '../services/search.service.js';

let rootElement = null;
let disposables = null;
let sessionId = null;
let externalSearchId = null;
let externalSearchPoll = null;
let itemsById = new Map();
let itemIndexById = new Map();
let allItems = [];
let cachedLists = [];
let lastSearchTitle = '';
let activeModal = null;
let isExternalSearchRunning = false;
let filterText = '';
let filterDebounceTimer = null;
let filteredItemsCache = [];
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORT = { key: 'title', dir: 'asc' };
let sortState = { ...DEFAULT_SORT };
let paging = { pageSize: DEFAULT_PAGE_SIZE, page: 1 };
const FILTER_DEBOUNCE_MS = 200;

export async function mount(ctx) {
    rootElement = ctx.root || ctx;
    disposables = createDisposables();
    sessionId = null;
    itemsById = new Map();
    itemIndexById = new Map();
    allItems = [];
    cachedLists = [];
    sortState = { ...DEFAULT_SORT };
    paging = { pageSize: DEFAULT_PAGE_SIZE, page: 1 };
    lastSearchTitle = '';
    filterText = '';
    filteredItemsCache = [];

    const titleInput = rootElement.querySelector('#searchTitle');
    const localButton = rootElement.querySelector('[data-search-action="local"]');
    const externalButton = rootElement.querySelector('[data-search-action="external"]');
    const cancelButton = rootElement.querySelector('[data-search-action="cancel-external"]');
    const pageSizeSelect = rootElement.querySelector('[data-page-size]');
    const filterInput = rootElement.querySelector('[data-search-filter-input]');
    const filterClearButton = rootElement.querySelector('[data-search-filter-clear]');

    disposables.add(addEvent(localButton, 'click', () => handleLocalSearch()));
    disposables.add(addEvent(externalButton, 'click', () => handleExternalSearch()));
    disposables.add(addEvent(cancelButton, 'click', () => handleCancelExternalSearch()));
    disposables.add(addEvent(rootElement, 'click', handleRootClick));
    disposables.add(addEvent(titleInput, 'keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleLocalSearch();
        }
    }));
    if (pageSizeSelect) {
        pageSizeSelect.value = String(paging.pageSize);
        disposables.add(addEvent(pageSizeSelect, 'change', (event) => handlePageSizeChange(event)));
    }
    if (filterInput) {
        filterInput.value = filterText;
        disposables.add(addEvent(filterInput, 'input', handleFilterInput));
        disposables.add(addEvent(filterInput, 'keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
            }
        }));
    }
    if (filterClearButton) {
        disposables.add(addEvent(filterClearButton, 'click', () => handleFilterClear()));
    }

    setStatus('Bitte Titel eingeben.');
    setLog('Noch keine externe Suche gestartet.');
    setExternalSearchState(false);
    updateFilterControls();
    updateResultsView();
}

export function unmount() {
    closeActiveModal();
    if (disposables) {
        disposables.disposeAll();
    }
    disposables = null;
    rootElement = null;
    sessionId = null;
    externalSearchId = null;
    stopExternalPolling();
    itemsById = new Map();
    itemIndexById = new Map();
    allItems = [];
    filterText = '';
    filteredItemsCache = [];
    if (filterDebounceTimer) {
        clearTimeout(filterDebounceTimer);
        filterDebounceTimer = null;
    }
}

function setStatus(message, { isError = false } = {}) {
    const statusElement = rootElement?.querySelector('[data-search-status]');
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.classList.toggle('is-error', isError);
}

function setLog(message) {
    const logElement = rootElement?.querySelector('[data-search-log]');
    if (!logElement) return;
    logElement.textContent = message;
}

function setExternalSearchState(isRunning) {
    const externalButton = rootElement?.querySelector('[data-search-action="external"]');
    const cancelButton = rootElement?.querySelector('[data-search-action="cancel-external"]');
    isExternalSearchRunning = isRunning;
    if (externalButton) {
        externalButton.disabled = isRunning;
    }
    if (cancelButton) {
        cancelButton.disabled = !isRunning;
    }
    updateResultsView();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatAuthor(author) {
    if (!author) return '';
    if (author.fullName) return author.fullName;
    return [author.firstName, author.lastName].filter(Boolean).join(' ');
}

function formatAuthors(authors = []) {
    if (!Array.isArray(authors) || authors.length === 0) return '';
    return authors.map(formatAuthor).filter(Boolean).join(', ');
}

function mapSourceLabel(source) {
    switch (source) {
        case 'local':
            return 'Lokal';
        case 'google_books':
            return 'Google Books';
        case 'open_library':
            return 'Open Library';
        case 'dnb':
            return 'DNB';
        default:
            console.warn('Unknown provider/source:', source);
            return source ? `Unbekannt: ${source}` : 'Unbekannt';
    }
}

function normalizeTitle(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeSortValue(value) {
    return String(value ?? '')
        .trim()
        .toLocaleLowerCase('de-DE')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeFilterText(value) {
    return String(value ?? '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .trim();
}

function buildFilterHaystack(item) {
    if (!item) return '';
    const authorText = formatAuthors(item.authors);
    const parts = [
        item.title,
        authorText,
        item.isbn,
        item.publisher,
        item.year,
        item.externalId
    ].filter(Boolean);
    return normalizeFilterText(parts.join(' '));
}

function getFilteredItems(items, activeFilterText) {
    const needle = normalizeFilterText(activeFilterText);
    if (!needle) {
        return { filteredItems: [...items], isFilterActive: false };
    }
    return {
        filteredItems: items.filter((item) => buildFilterHaystack(item).includes(needle)),
        isFilterActive: true
    };
}

function getAuthorSortValue(authors) {
    if (Array.isArray(authors) && authors.length > 0) {
        const firstAuthor = authors[0];
        if (typeof firstAuthor === 'string') {
            return firstAuthor;
        }
        return formatAuthor(firstAuthor);
    }
    if (typeof authors === 'string') {
        return authors;
    }
    return '';
}

function getSortKey(item) {
    if (sortState?.key === 'author') {
        return normalizeSortValue(getAuthorSortValue(item.authors));
    }
    return normalizeSortValue(item.title);
}

function getSortedItems(items) {
    if (!sortState?.key) {
        return [...items];
    }
    const direction = sortState.dir === 'desc' ? -1 : 1;
    return items
        .map((item, idx) => ({ item, idx, key: getSortKey(item) }))
        .sort((a, b) => {
            const primary = a.key.localeCompare(b.key, 'de', { sensitivity: 'base' });
            if (primary !== 0) {
                return primary * direction;
            }
            return (a.idx - b.idx) * direction;
        })
        .map((entry) => entry.item);
}

function getTotalPages(totalCount) {
    if (totalCount === 0) {
        return 0;
    }
    return Math.ceil(totalCount / paging.pageSize);
}

function clampPage(page, totalPages) {
    if (totalPages === 0) {
        return 1;
    }
    return Math.min(Math.max(page, 1), totalPages);
}

function getPagedItems(items) {
    const totalCount = items.length;
    const totalPages = getTotalPages(totalCount);
    paging.page = clampPage(paging.page, totalPages);
    if (totalPages === 0) {
        return { pagedItems: [], totalCount, totalPages };
    }
    const startIndex = (paging.page - 1) * paging.pageSize;
    const endIndex = startIndex + paging.pageSize;
    return {
        pagedItems: items.slice(startIndex, endIndex),
        totalCount,
        totalPages
    };
}

function formatProviderStatus(providerStatus = {}) {
    const entries = Object.entries(providerStatus);
    if (entries.length === 0) {
        return 'Keine Provider-Details vorhanden.';
    }
    return entries
        .map(([provider, status]) => {
            const count = typeof status?.count === 'number' ? status.count : 0;
            const total = typeof status?.total === 'number' ? status.total : null;
            const limit = typeof status?.limit === 'number' ? status.limit : null;
            const label = mapSourceLabel(provider);
            const state = status?.status === 'ok' ? 'ok' : 'Fehler';
            const totalLabel = total !== null ? `${count}/${total}` : `${count}`;
            const limitLabel = limit ? `Limit ${limit}` : null;
            const httpLabel = status?.statusCode ? `HTTP ${status.statusCode}` : null;
            const metaDetails = status?.providerMeta || null;
            const metaParts = [];
            if (metaDetails?.indexUsed) {
                metaParts.push(`Index ${metaDetails.indexUsed}`);
            }
            if (metaDetails?.queryMode) {
                metaParts.push(`Modus ${metaDetails.queryMode}`);
            }
            if (typeof metaDetails?.pagesFetched === 'number') {
                metaParts.push(`Seiten ${metaDetails.pagesFetched}`);
            }
            if (typeof metaDetails?.recordsTotal === 'number') {
                metaParts.push(`Total ${metaDetails.recordsTotal}`);
            }
            const metaLabel = metaParts.length > 0 ? `Meta ${metaParts.join(', ')}` : null;
            const meta = [state, limitLabel, httpLabel, metaLabel].filter(Boolean).join(', ');
            return `${label}: ${totalLabel} (${meta})`;
        })
        .join(' | ');
}

function buildLogMessage({ title, counts, providerStatus }) {
    const totalCount = counts?.total ?? null;
    const sourceEntries = counts && typeof counts === 'object'
        ? Object.entries(counts).filter(([key]) => key !== 'total')
        : [];
    const sourceSummary = sourceEntries.length > 0
        ? sourceEntries.map(([source, count]) => `${mapSourceLabel(source)}: ${count}`).join(' | ')
        : 'Keine Trefferstatistik vorhanden.';
    const totalText = typeof totalCount === 'number' ? `Angezeigt: ${totalCount}` : '';
    const providerSummary = formatProviderStatus(providerStatus);

    return [
        `Suche: "${title || '-'}"`,
        totalText,
        `Trefferverteilung: ${sourceSummary}`,
        `Provider: ${providerSummary}`
    ]
        .filter(Boolean)
        .join(' • ');
}

function formatProviderProgress(providerProgress = {}) {
    const entries = Object.entries(providerProgress);
    if (entries.length === 0) {
        return 'Keine Provider-Details vorhanden.';
    }
    return entries
        .map(([provider, progress]) => {
            const label = mapSourceLabel(provider);
            const page = progress?.page ? `Seite ${progress.page}` : 'Seite ?';
            const matched = typeof progress?.matchedItems === 'number' ? `Treffer ${progress.matchedItems}` : null;
            const total = typeof progress?.total === 'number' ? `Total ${progress.total}` : null;
            const status = progress?.status || 'running';
            return `${label}: ${page}${matched ? `, ${matched}` : ''}${total ? `, ${total}` : ''} (${status})`;
        })
        .join(' | ');
}

function buildExternalLogMessage({ title, items, providerProgress, state }) {
    const totalLoaded = Array.isArray(items) ? items.length : 0;
    const providerSummary = formatProviderProgress(providerProgress);
    const stateLabel = state === 'done' ? 'Abgeschlossen' : state === 'cancelled' ? 'Abgebrochen' : 'Läuft';
    return [
        `Suche: "${title || '-'}"`,
        `Geladen: ${totalLoaded}`,
        `Status: ${stateLabel}`,
        `Provider: ${providerSummary}`
    ]
        .filter(Boolean)
        .join(' • ');
}

function updateItems(items = [], { replace = false } = {}) {
    if (replace) {
        allItems = [];
        itemsById = new Map();
        itemIndexById = new Map();
    }
    if (!Array.isArray(items)) {
        cachedLists = [...allItems];
        return;
    }
    items.forEach((item) => {
        if (!item?.itemId) return;
        if (itemIndexById.has(item.itemId)) {
            const index = itemIndexById.get(item.itemId);
            allItems[index] = item;
            itemsById.set(item.itemId, item);
        } else {
            itemIndexById.set(item.itemId, allItems.length);
            allItems.push(item);
            itemsById.set(item.itemId, item);
        }
    });
    cachedLists = [...allItems];
}

function updateResultsView(items = allItems) {
    const { filteredItems, isFilterActive } = getFilteredItems(items, filterText);
    filteredItemsCache = filteredItems;
    const sortedItems = getSortedItems(filteredItems);
    const { pagedItems, totalCount, totalPages } = getPagedItems(sortedItems);
    renderResultsSummary(allItems.length, totalCount, isFilterActive);
    renderPagination(totalPages);
    renderSortIndicators();
    renderItems(pagedItems, totalCount);
}

function renderResultsSummary(totalCount, filteredCount, isFilterActive) {
    const summaryElement = rootElement?.querySelector('[data-search-results-summary]');
    if (!summaryElement) return;
    const loadingSuffix = isExternalSearchRunning ? ' (lädt …)' : '';
    if (isFilterActive) {
        summaryElement.textContent = `Treffer: ${totalCount}${loadingSuffix} — Gefiltert: ${filteredCount}`;
    } else {
        summaryElement.textContent = `Treffer: ${totalCount}${loadingSuffix}`;
    }
}

function renderPagination(totalPages) {
    const paginationElement = rootElement?.querySelector('[data-search-pagination]');
    const infoElement = rootElement?.querySelector('[data-search-pagination-info]');
    if (!paginationElement || !infoElement) return;
    if (totalPages === 0) {
        paginationElement.style.display = 'none';
        return;
    }
    paginationElement.style.display = '';
    infoElement.textContent = `Seite ${paging.page} von ${totalPages}`;
    const disableFirst = paging.page <= 1;
    const disableLast = paging.page >= totalPages;
    setPaginationButtonState('first', disableFirst);
    setPaginationButtonState('prev', disableFirst);
    setPaginationButtonState('next', disableLast);
    setPaginationButtonState('last', disableLast);
}

function setPaginationButtonState(action, disabled) {
    const button = rootElement?.querySelector(`[data-page-action="${action}"]`);
    if (button) {
        button.disabled = disabled;
    }
}

function renderSortIndicators() {
    const headers = rootElement?.querySelectorAll('[data-sort-key]') || [];
    headers.forEach((header) => {
        const key = header.getAttribute('data-sort-key');
        const indicator = header.querySelector('[data-sort-indicator]');
        if (!indicator) return;
        if (sortState?.key === key) {
            indicator.textContent = sortState.dir === 'desc' ? '▼' : '▲';
        } else {
            indicator.textContent = '';
        }
    });
}

function stopExternalPolling() {
    if (externalSearchPoll) {
        clearTimeout(externalSearchPoll);
        externalSearchPoll = null;
    }
}

function scheduleExternalPolling() {
    if (!externalSearchId) return;
    stopExternalPolling();
    externalSearchPoll = setTimeout(() => {
        handlePollExternalSearch();
    }, 1200);
}

async function handlePollExternalSearch() {
    if (!externalSearchId) return;
    try {
        const result = await getExternalSearchStatus(externalSearchId);
        if (!result) {
            stopExternalPolling();
            setExternalSearchState(false);
            setStatus('Externe Suche nicht gefunden.', { isError: true });
            return;
        }
        // Robust definition of items for all following usages
        const items = Array.isArray(result.items) ? result.items : [];
        updateItems(items);
        updateResultsView();
        setLog(buildExternalLogMessage({
            title: lastSearchTitle,
            items,
            providerProgress: result.providerProgress,
            state: result.state
        }));
        if (result.state === 'running') {
            setStatus(`Externe Suche läuft... Treffer: ${items.length}`);
            scheduleExternalPolling();
        } else {
            setExternalSearchState(false);
            if (result.state === 'done') {
                setStatus(`Externe Suche abgeschlossen. Treffer: ${items.length}`);
            } else if (result.state === 'cancelled') {
                setStatus('Externe Suche abgebrochen.', { isError: true });
            }
        }
    } catch (error) {
        setExternalSearchState(false);
        setStatus(getErrorMessage(error, 'Externe Suche fehlgeschlagen.'), { isError: true });
    }
}

async function handleCancelExternalSearch() {
    if (!externalSearchId) return;
    stopExternalPolling();
    try {
        await cancelExternalSearch(externalSearchId);
        setExternalSearchState(false);
        externalSearchId = null;
        setStatus('Externe Suche abgebrochen.', { isError: true });
    } catch (error) {
        setExternalSearchState(false);
        setStatus(getErrorMessage(error, 'Abbruch fehlgeschlagen.'), { isError: true });
    }
}

async function handleLocalSearch() {
    const titleInput = rootElement?.querySelector('#searchTitle');
    const title = titleInput?.value || '';
    setStatus('Suche läuft...');
    setLog('Lokale Suche läuft...');
    stopExternalPolling();
    setExternalSearchState(false);
    externalSearchId = null;
    try {
        const result = await searchLocal(title);
        sessionId = result.sessionId;
        externalSearchId = null;
        updateItems(result.items, { replace: true });
        lastSearchTitle = result.query?.title || title;
        paging.page = 1;
        updateResultsView();
        setStatus(`Lokale Suche abgeschlossen. Treffer: ${result.items.length}`);
        setLog(buildLogMessage({ title: lastSearchTitle, counts: result.counts, providerStatus: result.providerStatus }));
    } catch (error) {
        setStatus(getErrorMessage(error, 'Suche fehlgeschlagen.'), { isError: true });
    }
}

async function handleExternalSearch() {
    const titleInput = rootElement?.querySelector('#searchTitle');
    const title = titleInput?.value || '';
    if (!title.trim()) {
        setStatus('Bitte einen Titel eingeben.', { isError: true });
        return;
    }
    try {
        setExternalSearchState(true);
        setStatus('Lade externe Suchprovider...');
        const providerInfo = await getExternalProviders();
        const providers = Array.isArray(providerInfo?.enabledProviders) ? providerInfo.enabledProviders : [];
        if (providers.length === 0) {
            setExternalSearchState(false);
            setStatus('Keine externen Suchprovider verfügbar. Bitte Konfiguration prüfen.', { isError: true });
            return;
        }
        setStatus('Externe Suche gestartet...');
        const result = await startExternalSearch(title, providers);
        if (!result || !result.id) {
            setExternalSearchState(false);
            setStatus('Externe Suche konnte nicht gestartet werden.', { isError: true });
            return;
        }
        externalSearchId = result.id;
        // Robust definition of items for all following usages
        const items = Array.isArray(result.items) ? result.items : [];
        if (items.length > 0) {
            updateItems(items);
            updateResultsView();
        }
        scheduleExternalPolling();
    } catch (error) {
        setExternalSearchState(false);
        setStatus(getErrorMessage(error, 'Externe Suche konnte nicht gestartet werden.'), { isError: true });
    }
}

function renderItems(items = [], totalCount = 0) {
    const listElement = rootElement?.querySelector('[data-search-results-body]');
    if (!listElement) return;
    if (!Array.isArray(items) || items.length === 0) {
        const emptyText = totalCount === 0 ? 'Keine Ergebnisse geladen.' : 'Keine Treffer auf dieser Seite.';
        listElement.innerHTML = `
            <tr>
                <td colspan="5">${emptyText}</td>
            </tr>
        `;
        return;
    }

    listElement.innerHTML = items.map((item) => {
        const authorText = formatAuthors(item.authors);
        const sourceText = mapSourceLabel(item.source);
        return `
            <tr data-result-id="${escapeHtml(item.itemId)}">
                <td>${escapeHtml(sourceText)}</td>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(authorText)}</td>
                <td>${item.isbn ? escapeHtml(item.isbn) : ''}</td>
                <td class="search-actions-cell">
                    <button class="btn" data-action="import-book" data-item-id="${escapeHtml(item.itemId)}">Buch importieren</button>
                    <button class="btn" data-action="import-author" data-item-id="${escapeHtml(item.itemId)}">Autor importieren</button>
                </td>
            </tr>
        `;
    }).join('');
}

function handleRootClick(event) {
    const sortTarget = event.target?.closest?.('[data-sort-key]');
    if (sortTarget) {
        const sortKey = sortTarget.getAttribute('data-sort-key');
        if (sortKey) {
            handleSortChange(sortKey);
            return;
        }
    }

    const pageAction = event.target?.getAttribute('data-page-action');
    if (pageAction) {
        handlePageAction(pageAction);
        return;
    }

    const actionButton = event.target?.closest?.('[data-action]');
    if (!actionButton) return;
    const action = actionButton.getAttribute('data-action');
    const itemId = actionButton.getAttribute('data-item-id');
    if (!action || !itemId) return;
    if (action === 'import-author') {
        handleImportAuthor(itemId, actionButton);
    } else if (action === 'import-book') {
        handleImportBook(itemId, actionButton);
    }
}

function handleSortChange(key) {
    if (sortState.key !== key) {
        sortState = { key, dir: 'asc' };
    } else {
        sortState = { key, dir: sortState.dir === 'asc' ? 'desc' : 'asc' };
    }
    updateResultsView();
}

function handlePageAction(action) {
    const totalPages = getTotalPages(filteredItemsCache.length);
    if (totalPages === 0) return;
    switch (action) {
        case 'first':
            paging.page = 1;
            break;
        case 'prev':
            paging.page = Math.max(1, paging.page - 1);
            break;
        case 'next':
            paging.page = Math.min(totalPages, paging.page + 1);
            break;
        case 'last':
            paging.page = totalPages;
            break;
        default:
            return;
    }
    updateResultsView();
}

function handlePageSizeChange(event) {
    const nextSize = Number(event.target?.value || DEFAULT_PAGE_SIZE);
    paging.pageSize = Number.isNaN(nextSize) ? DEFAULT_PAGE_SIZE : nextSize;
    paging.page = clampPage(paging.page, getTotalPages(filteredItemsCache.length));
    updateResultsView();
}

function updateFilterControls() {
    const filterInput = rootElement?.querySelector('[data-search-filter-input]');
    const clearButton = rootElement?.querySelector('[data-search-filter-clear]');
    const normalizedFilter = normalizeFilterText(filterText);
    const hasFilter = Boolean(normalizedFilter);
    if (clearButton) {
        clearButton.disabled = !hasFilter;
    }
    if (filterInput && filterInput.value !== filterText) {
        filterInput.value = filterText;
    }
}

function applyFilterText(nextText) {
    filterText = nextText;
    paging.page = 1;
    updateFilterControls();
    updateResultsView();
}

function handleFilterInput(event) {
    const nextText = event.target?.value ?? '';
    if (filterDebounceTimer) {
        clearTimeout(filterDebounceTimer);
    }
    filterDebounceTimer = setTimeout(() => {
        applyFilterText(nextText);
    }, FILTER_DEBOUNCE_MS);
}

function handleFilterClear() {
    if (filterDebounceTimer) {
        clearTimeout(filterDebounceTimer);
        filterDebounceTimer = null;
    }
    applyFilterText('');
    const filterInput = rootElement?.querySelector('[data-search-filter-input]');
    if (filterInput) {
        filterInput.focus();
    }
}

async function handleImportAuthor(itemId, triggerEl) {
    const item = itemsById.get(itemId);
    if (!item) return;
    setStatus('Importiere Autor...');
    try {
        await importAuthor(item.itemId, { sessionId });
        setStatus('Autor importiert.');
    } catch (error) {
        setStatus(getErrorMessage(error, 'Autorimport fehlgeschlagen.'), { isError: true });
    }
}

async function handleImportBook(itemId, triggerEl) {
    const item = itemsById.get(itemId);
    if (!item) return;
    setStatus('Importiere Buch...');
    try {
        await importBook(item.itemId, { sessionId });
        setStatus('Buch importiert.');
    } catch (error) {
        setStatus(getErrorMessage(error, 'Buchimport fehlgeschlagen.'), { isError: true });
    }
}

function restoreListFromCache() {
    updateResultsView(cachedLists);
}

export function onSearchTitleInputChange() {
    const titleInput = rootElement?.querySelector('#searchTitle');
    const title = titleInput?.value || '';
    const normalizedTitle = normalizeTitle(title);
    if (!normalizedTitle) {
        restoreListFromCache();
        return;
    }
    const filteredItems = cachedLists.filter((item) => normalizeTitle(item.title).includes(normalizedTitle));
    updateResultsView(filteredItems);
}
