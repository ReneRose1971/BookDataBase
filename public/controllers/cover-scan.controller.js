import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { getErrorMessage } from '../api/api-client.js';
import { notify } from '../services/notify.service.js';
import { fetchBookLists } from '../services/books-api.service.js';
import {
    extractCoverScan,
    fetchCoverScanConfig,
    importCoverScan
} from '../services/cover-scan.service.js';

let rootElement = null;
let disposables = null;
let config = {
    maxFiles: 12,
    maxFileSizeBytes: 6 * 1024 * 1024,
    supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
};
let selectedFiles = [];
let results = [];
let cachedLists = [];
let previewUrls = [];

export async function mount(ctx) {
    rootElement = ctx.root || ctx;
    disposables = createDisposables();
    selectedFiles = [];
    results = [];
    cachedLists = [];
    previewUrls = [];

    try {
        const fetchedConfig = await fetchCoverScanConfig();
        if (fetchedConfig) {
            config = { ...config, ...fetchedConfig };
        }
    } catch (error) {
        console.warn('Cover-Scan Config konnte nicht geladen werden.', error);
    }

    cachedLists = await fetchBookLists();

    const fileInput = rootElement.querySelector('#coverScanFiles');
    const scanButton = rootElement.querySelector('[data-cover-scan-action="scan"]');

    disposables.add(addEvent(fileInput, 'change', handleFileChange));
    disposables.add(addEvent(scanButton, 'click', handleScan));
    disposables.add(addEvent(rootElement, 'input', handleInputChange));
    disposables.add(addEvent(rootElement, 'click', handleClick));
    disposables.add(addEvent(rootElement, 'change', handleListToggle));

    updateHint();
    setStatus('Bitte Cover-Dateien auswählen.');
    setLog('');
    renderResults();
}

export function unmount() {
    if (disposables) {
        disposables.disposeAll();
    }
    clearPreviews();
    rootElement = null;
    disposables = null;
    selectedFiles = [];
    results = [];
    cachedLists = [];
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
    clearPreviews();

    if (files.length > config.maxFiles) {
        selectedFiles = files.slice(0, config.maxFiles);
        setStatus(`Es sind maximal ${config.maxFiles} Dateien erlaubt. ${files.length - config.maxFiles} Datei(en) wurden ignoriert.`, { isError: true });
    } else {
        selectedFiles = files;
        setStatus(`${selectedFiles.length} Datei(en) ausgewählt.`);
    }

    results = [];
    setLog('');
    renderResults();
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
        buildResults(responseResults);
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

    renderResults();
}

function buildResults(responseResults) {
    results = selectedFiles.map((file, index) => {
        const match = responseResults.find((item) => item.fileIndex === index);
        const previewUrl = URL.createObjectURL(file);
        previewUrls.push(previewUrl);
        const authors = Array.isArray(match?.authors) ? match.authors : [];
        const defaultList = cachedLists.find((list) => list.name === 'Gelesene Bücher');
        return {
            fileIndex: index,
            fileName: file.name,
            previewUrl,
            title: match?.title || '',
            authorsText: authors.join(', '),
            isbn: match?.isbn || '',
            status: match?.status || 'failed',
            errors: Array.isArray(match?.errors) ? match.errors : (match ? [] : ['Kein Ergebnis zurückgegeben.']),
            ambiguous: Boolean(match?.ambiguous),
            selectedListIds: defaultList ? [defaultList.book_list_id] : []
        };
    });
}

function handleInputChange(event) {
    const target = event.target;
    if (!target) return;
    const rowIndex = Number(target.getAttribute('data-result-index'));
    if (!Number.isInteger(rowIndex)) return;
    const result = results[rowIndex];
    if (!result) return;

    const field = target.getAttribute('data-cover-scan-field');
    if (field === 'title') {
        result.title = target.value;
    } else if (field === 'authors') {
        result.authorsText = target.value;
    } else if (field === 'isbn') {
        result.isbn = target.value;
    }
}

function handleClick(event) {
    const actionButton = event.target?.closest?.('[data-cover-scan-action]');
    if (!actionButton) return;

    const action = actionButton.getAttribute('data-cover-scan-action');
    const rowIndex = Number(actionButton.getAttribute('data-result-index'));
    const result = results[rowIndex];
    if (!result) return;

    if (action === 'import') {
        handleImport(result);
    }
    if (action === 'discard') {
        result.status = 'ignored';
        renderResults();
    }
}

function handleListToggle(event) {
    const checkbox = event.target;
    if (!checkbox || checkbox.type !== 'checkbox') return;
    const listId = checkbox.getAttribute('data-list-id');
    if (!listId) return;
    const rowIndex = Number(checkbox.getAttribute('data-result-index'));
    const listIdValue = Number(listId);
    if (!Number.isInteger(rowIndex) || !Number.isInteger(listIdValue)) return;
    const result = results[rowIndex];
    if (!result) return;

    if (checkbox.checked) {
        if (!result.selectedListIds.includes(listIdValue)) {
            result.selectedListIds.push(listIdValue);
        }
    } else {
        result.selectedListIds = result.selectedListIds.filter((id) => id !== listIdValue);
    }
}

async function handleImport(result) {
    const title = result.title.trim();
    const authors = parseAuthors(result.authorsText);
    const listIds = result.selectedListIds;

    if (!title) {
        notify('Titel ist erforderlich.');
        return;
    }
    if (!authors.length) {
        notify('Mindestens ein Autor ist erforderlich.');
        return;
    }
    if (!listIds.length) {
        notify('Bitte mindestens eine Liste auswählen.');
        return;
    }

    result.status = 'importing';
    renderResults();

    try {
        await importCoverScan({
            title,
            authors,
            isbn: result.isbn,
            listIds
        });
        result.status = 'imported';
        notify('Buch wurde übernommen.');
    } catch (error) {
        result.status = 'failed';
        result.errors = [getErrorMessage(error, 'Import fehlgeschlagen.')];
    }

    renderResults();
}

function parseAuthors(value) {
    return String(value || '')
        .split(',')
        .map((chunk) => chunk.trim())
        .filter(Boolean);
}

function renderResults() {
    const body = rootElement?.querySelector('[data-cover-scan-results-body]');
    const summary = rootElement?.querySelector('[data-cover-scan-results-summary]');
    if (!body || !summary) return;

    summary.textContent = `Ergebnisse: ${results.length}`;

    if (!results.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7">Noch keine Scan-Ergebnisse.</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = results.map((result, index) => {
        const statusText = getStatusLabel(result);
        const errorText = result.errors.length ? ` (${result.errors.join(' ')})` : '';
        const disabled = ['invalid', 'failed', 'imported', 'ignored'].includes(result.status);
        const importDisabled = disabled || result.status === 'importing';
        return `
            <tr>
                <td class="cover-scan-status-cell">
                    ${statusText}${errorText}
                </td>
                <td>
                    ${result.previewUrl ? `<img class="cover-scan-thumb" src="${result.previewUrl}" alt="Cover ${escapeHtml(result.fileName)}">` : ''}
                    <div class="cover-scan-filename">${escapeHtml(result.fileName)}</div>
                </td>
                <td>
                    <input type="text" class="editor-input-full" data-cover-scan-field="title" data-result-index="${index}" value="${escapeHtml(result.title)}" ${disabled ? 'disabled' : ''}>
                </td>
                <td>
                    <input type="text" class="editor-input-full" data-cover-scan-field="authors" data-result-index="${index}" value="${escapeHtml(result.authorsText)}" ${disabled ? 'disabled' : ''}>
                </td>
                <td>
                    <input type="text" class="editor-input-full" data-cover-scan-field="isbn" data-result-index="${index}" value="${escapeHtml(result.isbn)}" ${disabled ? 'disabled' : ''}>
                </td>
                <td>
                    <div class="cover-scan-lists" data-cover-scan-lists data-result-index="${index}">
                        ${renderLists(result, index, disabled)}
                    </div>
                </td>
                <td>
                    <button class="func-button" data-cover-scan-action="import" data-result-index="${index}" ${importDisabled ? 'disabled' : ''}>Importieren</button>
                    <button class="func-button" data-cover-scan-action="discard" data-result-index="${index}" ${disabled ? 'disabled' : ''}>Verwerfen</button>
                </td>
            </tr>
        `;
    }).join('');

}

function renderLists(result, index, disabled) {
    if (!cachedLists.length) {
        return '<span>Keine Listen geladen.</span>';
    }
    return cachedLists.map((list) => {
        const checked = result.selectedListIds.includes(list.book_list_id);
        return `
            <label class="search-import-list-option">
                <input type="checkbox" data-list-id="${list.book_list_id}" data-result-index="${index}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                ${escapeHtml(list.name)}
            </label>
        `;
    }).join('');
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

function getStatusLabel(result) {
    switch (result.status) {
        case 'scanned':
            return result.ambiguous ? 'Unklar' : 'Erkannt';
        case 'ambiguous':
            return 'Unklar';
        case 'invalid':
            return 'Ungültig';
        case 'failed':
            return 'Fehler';
        case 'importing':
            return 'Import läuft';
        case 'imported':
            return 'Importiert';
        case 'ignored':
            return 'Verworfen';
        default:
            return 'Ausstehend';
    }
}

function clearPreviews() {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
