import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { openEditor, closeEditor } from '../editor-runtime/editor-composer.js';
import { getErrorMessage } from '../api/api-client.js';
import {
    searchLocal,
    startExternalSearch,
    getExternalSearchStatus,
    cancelExternalSearch,
    importAuthor,
    importBook
} from '../services/search.service.js';

let rootElement = null;
let disposables = null;
let editorDisposables = null;
let sessionId = null;
let externalSearchId = null;
let externalSearchPoll = null;
let itemsById = new Map();
let cachedLists = [];
let lastSearchTitle = '';

export async function mount(ctx) {
    rootElement = ctx.root || ctx;
    disposables = createDisposables();
    sessionId = null;
    itemsById = new Map();
    lastSearchTitle = '';

    const titleInput = rootElement.querySelector('#searchTitle');
    const localButton = rootElement.querySelector('[data-search-action="local"]');
    const externalButton = rootElement.querySelector('[data-search-action="external"]');
    const cancelButton = rootElement.querySelector('[data-search-action="cancel-external"]');

    disposables.add(addEvent(localButton, 'click', () => handleLocalSearch()));
    disposables.add(addEvent(externalButton, 'click', () => handleExternalSearch()));
    disposables.add(addEvent(cancelButton, 'click', () => handleCancelExternalSearch()));
    disposables.add(addEvent(rootElement, 'click', handleResultActions));
    disposables.add(addEvent(titleInput, 'keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleLocalSearch();
        }
    }));

    setStatus('Bitte Titel eingeben.');
    setLog('Noch keine externe Suche gestartet.');
    setExternalSearchState(false);
}

export function unmount() {
    closeEditor();
    clearEditorDisposables();
    if (disposables) {
        disposables.disposeAll();
    }
    disposables = null;
    rootElement = null;
    sessionId = null;
    externalSearchId = null;
    stopExternalPolling();
    itemsById = new Map();
}

function clearEditorDisposables() {
    if (editorDisposables) {
        editorDisposables.disposeAll();
        editorDisposables = null;
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
    if (externalButton) {
        externalButton.disabled = isRunning;
    }
    if (cancelButton) {
        cancelButton.disabled = !isRunning;
    }
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
            return source || 'Unbekannt';
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
        setLog(buildExternalLogMessage({
            title: lastSearchTitle,
            items: result.items,
            providerProgress: result.providerProgress,
            state: result.state
        }));
        if (result.state === 'running') {
            scheduleExternalPolling();
        } else {
            setExternalSearchState(false);
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
    try {
        const result = await searchLocal(title);
        sessionId = result.sessionId;
        itemsById = new Map(result.items.map((item) => [item.itemId, item]));
        cachedLists = result.items;
        lastSearchTitle = result.query?.title || title;
        renderItems(result.items);
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
    setStatus('Externe Suche läuft...');
    setLog('Externe Suche gestartet...');
    setExternalSearchState(true);
    stopExternalPolling();
    try {
        const result = await startExternalSearch({ sessionId, title });
        sessionId = result.sessionId;
        itemsById = new Map(result.items.map((item) => [item.itemId, item]));
        cachedLists = result.items;
        lastSearchTitle = result.query?.title || title;
        renderItems(result.items);
        setStatus(`Externe Suche abgeschlossen. Treffer: ${result.items.length}`);
        setLog(buildLogMessage({ title: lastSearchTitle, counts: result.counts, providerStatus: result.providerStatus }));
    } catch (error) {
        setExternalSearchState(false);
        setStatus(getErrorMessage(error, 'Externe Suche fehlgeschlagen.'), { isError: true });
    }
}

function renderItems(items = []) {
    const listElement = rootElement?.querySelector('[data-search-results]');
    if (!listElement) return;
    if (!Array.isArray(items) || items.length === 0) {
        listElement.innerHTML = '<div class="search-empty">Keine Treffer gefunden.</div>';
        return;
    }

    listElement.innerHTML = items.map((item) => {
        const authorText = formatAuthors(item.authors);
        const isbnText = item.isbn ? `ISBN: ${escapeHtml(item.isbn)}` : '';
        const yearText = item.year ? `Jahr: ${escapeHtml(item.year)}` : '';
        const publisherText = item.publisher ? `Verlag: ${escapeHtml(item.publisher)}` : '';
        const sourceText = mapSourceLabel(item.source);
        return `
            <div class="search-result" data-result-id="${escapeHtml(item.itemId)}">
                <div class="search-result__title">${escapeHtml(item.title)}</div>
                ${authorText ? `<div class="search-result__authors">${escapeHtml(authorText)}</div>` : ''}
                <div class="search-result__meta">
                    ${isbnText ? `<span>${isbnText}</span>` : ''}
                    ${yearText ? `<span>${yearText}</span>` : ''}
                    ${publisherText ? `<span>${publisherText}</span>` : ''}
                    <span>Quelle: ${escapeHtml(sourceText)}</span>
                </div>
                <div class="search-result__actions">
                    <button class="btn" data-action="import-book" data-item-id="${escapeHtml(item.itemId)}">Buch importieren</button>
                    <button class="btn" data-action="import-author" data-item-id="${escapeHtml(item.itemId)}">Autor importieren</button>
                </div>
            </div>
        `;
    }).join('');
}

function handleResultActions(event) {
    const action = event.target?.getAttribute('data-action');
    if (!action) return;
    const itemId = event.target?.getAttribute('data-item-id');
    if (!itemId) return;
    const item = itemsById.get(itemId);
    if (!item) return;
    if (action === 'import-author') {
        handleImportAuthor(item);
    } else if (action === 'import-book') {
        handleImportBook(item);
    }
}

async function handleImportAuthor(item) {
    setStatus('Importiere Autor...');
    try {
        await importAuthor(item.itemId, { sessionId });
        setStatus('Autor importiert.');
    } catch (error) {
        setStatus(getErrorMessage(error, 'Autorimport fehlgeschlagen.'), { isError: true });
    }
}

async function handleImportBook(item) {
    setStatus('Importiere Buch...');
    try {
        await importBook(item.itemId, { sessionId });
        setStatus('Buch importiert.');
    } catch (error) {
        setStatus(getErrorMessage(error, 'Buchimport fehlgeschlagen.'), { isError: true });
    }
}

function restoreListFromCache() {
    renderItems(cachedLists);
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
    renderItems(filteredItems);
}
