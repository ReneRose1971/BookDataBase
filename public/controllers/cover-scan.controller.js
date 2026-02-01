import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { getErrorMessage } from '../api/api-client.js';
import { createSearchImportModalManager } from './search-import-modal.js';
import { createSearchResultsTable } from './search-results-table.js';
import {
    extractCoverScan,
    fetchCoverScanConfig
} from '../services/cover-scan.service.js';

let rootElement = null;
let disposables = null;
let resultsTable = null;
let modalManager = null;
let config = {
    maxFiles: 12,
    maxFileSizeBytes: 6 * 1024 * 1024,
    supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
};
let selectedFiles = [];
let results = [];

export async function mount(ctx) {
    rootElement = ctx.root || ctx;
    disposables = createDisposables();
    selectedFiles = [];
    results = [];

    try {
        const fetchedConfig = await fetchCoverScanConfig();
        if (fetchedConfig) {
            config = { ...config, ...fetchedConfig };
        }
    } catch (error) {
        console.warn('Cover-Scan Config konnte nicht geladen werden.', error);
    }

    const fileInput = rootElement.querySelector('#coverScanFiles');
    const scanButton = rootElement.querySelector('[data-cover-scan-action="scan"]');

    disposables.add(addEvent(fileInput, 'change', handleFileChange));
    disposables.add(addEvent(scanButton, 'click', handleScan));

    modalManager = createSearchImportModalManager();
    resultsTable = createSearchResultsTable({
        rootElement,
        onImportAuthor: handleImportAuthor,
        onImportBook: handleImportBook
    });
    resultsTable.init();

    updateHint();
    setStatus('Bitte Cover-Dateien auswählen.');
    setLog('');
    resetResults();
}

export function unmount() {
    if (resultsTable) {
        resultsTable.dispose();
    }
    if (modalManager) {
        modalManager.close();
    }
    if (disposables) {
        disposables.disposeAll();
    }
    rootElement = null;
    disposables = null;
    resultsTable = null;
    modalManager = null;
    selectedFiles = [];
    results = [];
}

function updateHint() {
    const hintElement = rootElement?.querySelector('[data-cover-scan-hint]');
    if (!hintElement) return;
    const maxFiles = config.maxFiles;
    const maxSizeMb = (config.maxFileSizeBytes / (1024 * 1024)).toFixed(1);
    hintElement.textContent = `Maximal ${maxFiles} Dateien, je Datei bis ${maxSizeMb} MB (JPG, PNG, WebP).`;
}

function handleFileChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length > config.maxFiles) {
        selectedFiles = files.slice(0, config.maxFiles);
        setStatus(`Es sind maximal ${config.maxFiles} Dateien erlaubt. ${files.length - config.maxFiles} Datei(en) wurden ignoriert.`, { isError: true });
    } else {
        selectedFiles = files;
        setStatus(`${selectedFiles.length} Datei(en) ausgewählt.`);
    }

    results = [];
    setLog('');
    resetResults();
}

async function handleScan() {
    if (!selectedFiles.length) {
        setStatus('Bitte zuerst mindestens eine Datei auswählen.', { isError: true });
        return;
    }

    const scanButton = rootElement?.querySelector('[data-cover-scan-action="scan"]');
    if (scanButton) {
        scanButton.disabled = true;
    }

    setStatus('Scan läuft ...');
    setLog(`Sende ${selectedFiles.length} Datei(en) an OpenAI.`);

    try {
        const response = await extractCoverScan(selectedFiles);
        const responseResults = Array.isArray(response?.results) ? response.results : [];
        results = buildResults(responseResults, selectedFiles);
        if (response?.error) {
            setStatus(response.error, { isError: true });
        } else {
            setStatus('Scan abgeschlossen.');
        }
        setLog(`Ergebnisse: ${results.length} Datei(en) verarbeitet.`);
    } catch (error) {
        setStatus(getErrorMessage(error, 'Fehler beim Scan.'), { isError: true });
        setLog('OpenAI-Scan fehlgeschlagen.');
    } finally {
        if (scanButton) {
            scanButton.disabled = false;
        }
    }

    updateResultsTable();
}

function buildResults(responseResults, files) {
    const matches = Array.isArray(responseResults) ? responseResults : [];
    return matches.map((match, index) => {
        const fileIndex = Number.isInteger(match?.fileIndex) ? match.fileIndex : index;
        const fileName = files[fileIndex]?.name || match?.fileName || `Cover ${fileIndex + 1}`;
        const authors = Array.isArray(match?.authors) ? match.authors : [];
        return {
            itemId: `cover-scan-${fileIndex}-${fileName}`,
            source: 'cover_scan',
            title: decodeHtmlEntities(match?.title || ''),
            authors: authors.map(parseAuthorName).filter(Boolean),
            isbn: match?.isbn || '',
            fileIndex,
            fileName
        };
    });
}

function parseAuthorName(value) {
    if (!value) return null;
    if (typeof value === 'object') {
        const firstName = String(value.firstName || '').trim();
        const lastName = String(value.lastName || '').trim();
        const fullName = String(value.fullName || '').trim();
        if (firstName || lastName) {
            return {
                firstName,
                lastName,
                fullName: fullName || [firstName, lastName].filter(Boolean).join(' ').trim()
            };
        }
        if (fullName) {
            return parseAuthorName(fullName);
        }
        return null;
    }
    const name = String(value).trim();
    if (!name) return null;
    if (name.includes(',')) {
        const parts = name.split(',');
        const lastName = parts.shift()?.trim() || '';
        const firstName = parts.join(',').trim();
        return {
            firstName,
            lastName,
            fullName: [firstName, lastName].filter(Boolean).join(' ').trim() || name.replace(/,+/g, '').trim()
        };
    }
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return { firstName: '', lastName: parts[0], fullName: name };
    }
    const lastName = parts.pop();
    const firstName = parts.join(' ');
    return { firstName, lastName, fullName: `${firstName} ${lastName}`.trim() };
}

function decodeHtmlEntities(value) {
    if (!value) return '';
    const doc = new DOMParser().parseFromString(String(value), 'text/html');
    return doc.documentElement.textContent || '';
}

function updateResultsTable() {
    if (!resultsTable) return;
    resultsTable.updateItems(results, { replace: true });
    resultsTable.updateResultsView();
}

function resetResults() {
    if (!resultsTable) return;
    resultsTable.updateItems([], { replace: true });
    resultsTable.updateResultsView();
}

async function handleImportAuthor(item, triggerEl) {
    if (!item) return;
    await modalManager?.openImportModal({
        childViewName: 'search-import-author',
        title: 'Autor importieren',
        triggerEl,
        context: {
            itemId: item.itemId,
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
            item,
            setStatus
        }
    });
}

function setStatus(message, { isError = false } = {}) {
    const status = rootElement?.querySelector('[data-cover-scan-status]');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', isError);
}

function setLog(message) {
    const log = rootElement?.querySelector('[data-cover-scan-log]');
    if (!log) return;
    log.textContent = message;
}
