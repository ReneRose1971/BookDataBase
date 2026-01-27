import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { openEditor, closeEditor } from '../editor-runtime/editor-composer.js';
import { getJson, getErrorMessage } from '../api/api-client.js';
import {
    searchLocal,
    searchExternal,
    importAuthor,
    importBook
} from '../services/search.service.js';

let rootElement = null;
let disposables = null;
let editorDisposables = null;
let sessionId = null;
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

    disposables.add(addEvent(localButton, 'click', () => handleLocalSearch()));
    disposables.add(addEvent(externalButton, 'click', () => handleExternalSearch()));
    disposables.add(addEvent(rootElement, 'click', handleResultActions));
    disposables.add(addEvent(titleInput, 'keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleLocalSearch();
        }
    }));

    setStatus('Bitte Titel eingeben.');
    setLog('Noch keine externe Suche gestartet.');
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
            const meta = [state, limitLabel, httpLabel].filter(Boolean).join(', ');
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

function renderResults(items = []) {
    const tbody = rootElement?.querySelector('[data-search-results-body]');
    if (!tbody) return;

    itemsById = new Map();
    if (!Array.isArray(items) || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Keine Treffer.</td></tr>';
        return;
    }

    const rows = items.map((item) => {
        itemsById.set(item.itemId, item);
        const authors = formatAuthors(item.authors);
        const hasAuthors = Array.isArray(item.authors) && item.authors.length > 0;
        const canImport = item.source !== 'local';
        const authorAction = canImport && hasAuthors
            ? `<button class=\"func-button\" data-search-action=\"import-author\" data-item-id=\"${item.itemId}\">Autor übernehmen</button>`
            : '<span>-</span>';
        const bookAction = canImport && item.title && hasAuthors
            ? `<button class=\"func-button\" data-search-action=\"import-book\" data-item-id=\"${item.itemId}\">Buch übernehmen</button>`
            : '<span>-</span>';

        return `
            <tr data-item-id="${item.itemId}">
                <td>${escapeHtml(mapSourceLabel(item.source))}</td>
                <td>${escapeHtml(item.title || '')}</td>
                <td>${escapeHtml(authors)}</td>
                <td>${escapeHtml(item.isbn || '')}</td>
                <td>
                    <div class="search-actions-cell">
                        ${authorAction}
                        ${bookAction}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = rows.join('');
}

function handleEndpointError(error, endpoint) {
    if (error && error.status === 404) {
        setStatus(`Backend-Endpoint fehlt: ${endpoint}`, { isError: true });
        return true;
    }
    return false;
}

function clearResults() {
    const tbody = rootElement?.querySelector('[data-search-results-body]');
    if (tbody) {
        tbody.innerHTML = '';
    }
}

function logSearchDetails(title, sessionId, items) {
    console.log('Search Title:', title);
    console.log('Session ID:', sessionId);
    console.log('Search Results:', items);
}

async function handleLocalSearch() {
    clearResults();
    const titleInput = rootElement.querySelector('#searchTitle');
    const title = titleInput?.value?.trim();
    if (!title) {
        setStatus('Bitte Titel eingeben.', { isError: true });
        return;
    }

    setStatus('Suche läuft...');
    setLog('Lokale Suche gestartet, Ergebnisse werden geladen...');
    try {
        const result = await searchLocal(title);
        sessionId = result.sessionId;
        lastSearchTitle = title;
        renderResults(result.items);
        logSearchDetails(title, sessionId, result.items);
        const counts = { ...(result.counts || {}) };
        if (typeof counts.total !== 'number') {
            counts.total = Array.isArray(result.items) ? result.items.length : 0;
        }
        setLog(buildLogMessage({ title, counts, providerStatus: result.providerStatus }));
        setStatus('Suche abgeschlossen.');
    } catch (error) {
        setStatus(getErrorMessage(error), { isError: true });
    }
}

async function handleExternalSearch() {
    clearResults();
    const titleInput = rootElement.querySelector('#searchTitle');
    const title = titleInput?.value?.trim();
    if (!title) {
        setStatus('Bitte Titel eingeben.', { isError: true });
        return;
    }

    setStatus('Externe Suche läuft...');
    setLog('Externe Suche gestartet, Ergebnisse werden geladen...');
    try {
        const normalizedTitle = normalizeTitle(title);
        if (normalizedTitle && normalizedTitle !== normalizeTitle(lastSearchTitle)) {
            sessionId = null;
        }
        const result = await searchExternal({ sessionId, title });
        sessionId = result.sessionId;
        lastSearchTitle = title;
        renderResults(result.items);
        logSearchDetails(title, sessionId, result.items);
        const counts = { ...(result.counts || {}) };
        if (typeof counts.total !== 'number') {
            counts.total = Array.isArray(result.items) ? result.items.length : 0;
        }
        setLog(buildLogMessage({ title, counts, providerStatus: result.providerStatus }));
        setStatus('Externe Suche abgeschlossen.');
    } catch (error) {
        setStatus(getErrorMessage(error), { isError: true });
    }
}

function handleResultActions(event) {
    const actionButton = event.target.closest('[data-search-action]');
    if (!actionButton) return;

    const action = actionButton.dataset.searchAction;
    const itemId = actionButton.dataset.itemId;

    if (action === 'import-author' || action === 'import-book') {
        const item = itemsById.get(itemId);
        if (!item) {
            setStatus('Suchtreffer nicht gefunden.', { isError: true });
            return;
        }
        if (action === 'import-author') {
            openAuthorEditor(item);
        } else if (action === 'import-book') {
            openBookEditor(item);
        }
    }
}

function setEditorStatus(root, message, { isError = false } = {}) {
    const statusElement = root.querySelector('[data-search-import-status]');
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.classList.toggle('is-error', isError);
}

async function openAuthorEditor(item) {
    const slot = rootElement?.querySelector('.search-editor-slot');
    if (!slot) return;
    if (!Array.isArray(item.authors) || item.authors.length === 0) {
        setStatus('Keine Autorendaten im Treffer vorhanden.', { isError: true });
        return;
    }

    closeEditor();
    clearEditorDisposables();

    await openEditor({
        host: slot,
        manifestPath: '/editors/search-import-author.editor.json',
        mode: 'create',
        dataContext: { itemId: item.itemId },
        actions: {
            confirm: async (event) => {
                event.preventDefault();
                const editorRoot = slot.querySelector('.search-import-editor');
                if (!editorRoot) return;
                const firstNameInput = editorRoot.querySelector('#searchImportAuthorFirstName');
                const lastNameInput = editorRoot.querySelector('#searchImportAuthorLastName');
                const firstName = firstNameInput ? firstNameInput.value.trim() : '';
                const lastName = lastNameInput ? lastNameInput.value.trim() : '';

                if (!firstName || !lastName) {
                    setEditorStatus(editorRoot, 'Vor- und Nachname sind erforderlich.', { isError: true });
                    return;
                }

                try {
                    await importAuthor({
                        author: { firstName, lastName, fullName: `${firstName} ${lastName}`.trim() },
                        confirm: true
                    });
                    closeEditor();
                    clearEditorDisposables();
                    setStatus('Autor wurde übernommen.');
                } catch (error) {
                    if (handleEndpointError(error, '/api/search/import/author')) return;
                    setEditorStatus(editorRoot, getErrorMessage(error, 'Fehler beim Übernehmen des Autors.'), { isError: true });
                }
            },
            cancel: async (event) => {
                event.preventDefault();
                closeEditor();
                clearEditorDisposables();
            }
        }
    });

    const editorRoot = slot.querySelector('.search-import-editor');
    if (!editorRoot) return;

    editorDisposables = createDisposables();

    const select = editorRoot.querySelector('#searchImportAuthorSelect');
    const firstNameInput = editorRoot.querySelector('#searchImportAuthorFirstName');
    const lastNameInput = editorRoot.querySelector('#searchImportAuthorLastName');

    const applyAuthor = (index) => {
        const author = item.authors[index] || item.authors[0];
        if (!author) return;
        if (author.firstName && author.lastName) {
            firstNameInput.value = author.firstName;
            lastNameInput.value = author.lastName;
        }
    };

    if (select) {
        select.innerHTML = item.authors.map((author, index) => {
            return `<option value="${index}">${escapeHtml(formatAuthor(author))}</option>`;
        }).join('');
        select.value = 0;

        editorDisposables.add(addEvent(select, 'change', (event) => {
            const index = parseInt(event.target.value, 10);
            if (!isNaN(index)) {
                applyAuthor(index);
            }
        }));

        applyAuthor(0);
    }
}

async function openBookEditor(item) {
    const slot = rootElement?.querySelector('.search-editor-slot');
    if (!slot) return;

    closeEditor();
    clearEditorDisposables();

    await openEditor({
        host: slot,
        manifestPath: '/editors/search-import-book.editor.json',
        mode: 'create',
        dataContext: { itemId: item.itemId },
        actions: {
            confirm: async (event) => {
                event.preventDefault();
                const editorRoot = slot.querySelector('.search-import-editor');
                if (!editorRoot) return;
                const form = editorRoot.querySelector('form');
                if (!form) return;
                const formData = new FormData(form);

                const authors = formData.getAll('author[]').filter(Boolean).map((name) => {
                    const [firstName, lastName] = name.split(',').map(part => part.trim());
                    return { firstName, lastName, fullName: `${firstName} ${lastName}`.trim() };
                });

                try {
                    await importBook({
                        itemId: item.itemId,
                        title: formData.get('title')?.trim(),
                        authors,
                        isbn: formData.get('isbn')?.trim(),
                        confirm: true
                    });
                    closeEditor();
                    clearEditorDisposables();
                    setStatus('Buch wurde übernommen.');
                } catch (error) {
                    if (handleEndpointError(error, '/api/search/import/book')) return;
                    setEditorStatus(editorRoot, getErrorMessage(error, 'Fehler beim Übernehmen des Buchs.'), { isError: true });
                }
            },
            cancel: async (event) => {
                event.preventDefault();
                closeEditor();
                clearEditorDisposables();
            }
        }
    });

    const editorRoot = slot.querySelector('.search-import-editor');
    if (!editorRoot) return;

    editorDisposables = createDisposables();

    const titleInput = editorRoot.querySelector('#searchImportBookTitle');
    const isbnInput = editorRoot.querySelector('#searchImportBookIsbn');
    const authorSelect = editorRoot.querySelector('#searchImportBookAuthorSelect');

    titleInput.value = item.title || '';
    isbnInput.value = item.isbn || '';

    if (authorSelect) {
        authorSelect.innerHTML = item.authors.map((author, index) => {
            return `<option value="${index}">${escapeHtml(formatAuthor(author))}</option>`;
        }).join('');
        authorSelect.value = 0;

        editorDisposables.add(addEvent(authorSelect, 'change', (event) => {
            const index = parseInt(event.target.value, 10);
            if (!isNaN(index)) {
                const author = item.authors[index] || item.authors[0];
                if (author.firstName && author.lastName) {
                    firstNameInput.value = author.firstName;
                    lastNameInput.value = author.lastName;
                }
            }
        }));

        const firstAuthor = item.authors[0];
        if (firstAuthor && firstAuthor.firstName && firstAuthor.lastName) {
            firstNameInput.value = firstAuthor.firstName;
            lastNameInput.value = firstAuthor.lastName;
        }
    }
}
