import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { getErrorMessage } from '../api/api-client.js';
import { createSearchImportModalManager } from './search-import-modal.js';
import { createSearchResultsTable, mapSourceLabel, normalizeTitle } from './search-results-table.js';
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
let lastSearchTitle = '';
let modalManager = null;
let resultsTable = null;
let isExternalSearchRunning = false;

export async function mount(ctx) {
    rootElement = ctx.root || ctx;
    disposables = createDisposables();
    sessionId = null;
    externalSearchId = null;
    lastSearchTitle = '';
    isExternalSearchRunning = false;

    const titleInput = rootElement.querySelector('#searchTitle');
    const localButton = rootElement.querySelector('[data-search-action="local"]');
    const externalButton = rootElement.querySelector('[data-search-action="external"]');
    const cancelButton = rootElement.querySelector('[data-search-action="cancel-external"]');

    disposables.add(addEvent(localButton, 'click', () => handleLocalSearch()));
    disposables.add(addEvent(externalButton, 'click', () => handleExternalSearch()));
    disposables.add(addEvent(cancelButton, 'click', () => handleCancelExternalSearch()));
    disposables.add(addEvent(titleInput, 'keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleLocalSearch();
        }
    }));

    modalManager = createSearchImportModalManager();
    resultsTable = createSearchResultsTable({
        rootElement,
        onImportAuthor: handleImportAuthor,
        onImportBook: handleImportBook
    });
    resultsTable.init();

    setStatus('Bitte Titel eingeben.');
    setLog('Noch keine externe Suche gestartet.');
    setExternalSearchState(false);
}

export function unmount() {
    if (modalManager) {
        modalManager.close();
    }
    if (resultsTable) {
        resultsTable.dispose();
    }
    if (disposables) {
        disposables.disposeAll();
    }
    disposables = null;
    rootElement = null;
    sessionId = null;
    externalSearchId = null;
    stopExternalPolling();
    lastSearchTitle = '';
    isExternalSearchRunning = false;
    modalManager = null;
    resultsTable = null;
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
    if (resultsTable) {
        resultsTable.setLoading(isRunning);
    }
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

function updateItems(items = [], options) {
    if (resultsTable) {
        resultsTable.updateItems(items, options);
    }
}

function updateResultsView(items) {
    if (resultsTable) {
        resultsTable.updateResultsView(items);
    }
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
        updateItems(result.items, { replace: true });
        lastSearchTitle = result.query?.title || title;
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

async function handleImportAuthor(item, triggerEl) {
    if (!item) return;
    await modalManager?.openImportModal({
        childViewName: 'search-import-author',
        title: 'Autor importieren',
        triggerEl,
        context: {
            itemId: item.itemId,
            sessionId,
            item,
            setStatus
        }
    });
}

async function handleImportBook(item, triggerEl) {
    if (!item) return;
    await modalManager?.openImportModal({
        childViewName: 'search-import-book',
        title: 'Buch importieren',
        triggerEl,
        context: {
            itemId: item.itemId,
            sessionId,
            item,
            searchId: externalSearchId,
            setStatus
        }
    });
}

function restoreListFromCache() {
    updateResultsView(resultsTable?.getCachedItems() ?? []);
}

export function onSearchTitleInputChange() {
    const titleInput = rootElement?.querySelector('#searchTitle');
    const title = titleInput?.value || '';
    const normalizedTitle = normalizeTitle(title);
    if (!normalizedTitle) {
        restoreListFromCache();
        return;
    }
    const cachedItems = resultsTable?.getCachedItems() ?? [];
    const filteredItems = cachedItems.filter((item) => normalizeTitle(item.title).includes(normalizedTitle));
    updateResultsView(filteredItems);
}
