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
let localSearchCompleted = false;
let itemsById = new Map();
let cachedLists = [];

export async function mount(ctx) {
    rootElement = ctx.root || ctx;
    disposables = createDisposables();
    sessionId = null;
    localSearchCompleted = false;
    itemsById = new Map();

    const titleInput = rootElement.querySelector('#searchTitle');
    const localButton = rootElement.querySelector('[data-search-action="local"]');
    const externalButton = rootElement.querySelector('[data-search-action="external"]');

    if (externalButton) {
        externalButton.disabled = true;
    }

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
    localSearchCompleted = false;
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
        const authorAction = hasAuthors
            ? `<button class=\"func-button\" data-search-action=\"import-author\" data-item-id=\"${item.itemId}\">Autor übernehmen</button>`
            : '<span>-</span>';
        const bookAction = item.title && hasAuthors
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

function setExternalEnabled(enabled) {
    const externalButton = rootElement?.querySelector('[data-search-action="external"]');
    if (externalButton) {
        externalButton.disabled = !enabled;
    }
}

function handleEndpointError(error, endpoint) {
    if (error && error.status === 404) {
        setStatus(`Backend-Endpoint fehlt: ${endpoint}`, { isError: true });
        return true;
    }
    return false;
}

async function handleLocalSearch() {
    const titleInput = rootElement?.querySelector('#searchTitle');
    const title = titleInput ? titleInput.value.trim() : '';
    if (!title) {
        setStatus('Bitte einen Titel eingeben.', { isError: true });
        return;
    }

    setStatus('Lokale Suche läuft...');
    setExternalEnabled(false);

    try {
        const result = await searchLocal(title);
        sessionId = result.sessionId;
        localSearchCompleted = true;
        renderResults(result.items || []);
        setExternalEnabled(true);

        if (!result.items || result.items.length === 0) {
            setStatus('Keine lokalen Treffer.');
        } else {
            setStatus(`Lokale Treffer: ${result.items.length}.`);
        }
    } catch (error) {
        if (handleEndpointError(error, '/api/search/local')) return;
        setStatus(getErrorMessage(error, 'Fehler bei der lokalen Suche.'), { isError: true });
    }
}

function buildExternalStatus(result) {
    const itemsCount = Array.isArray(result.items) ? result.items.length : 0;
    const providerStatus = result.providerStatus || {};
    const providerLabels = Object.entries(providerStatus).map(([provider, status]) => {
        const count = status?.count !== undefined ? ` (${status.count})` : '';
        const statusLabel = status?.status || 'unknown';
        return `${mapSourceLabel(provider)}: ${statusLabel}${count}`;
    });
    if (providerLabels.length > 0) {
        return `Externe Suche abgeschlossen. Treffer gesamt: ${itemsCount}. Quellen: ${providerLabels.join(', ')}.`;
    }
    return `Externe Suche abgeschlossen. Treffer gesamt: ${itemsCount}.`;
}

async function handleExternalSearch() {
    if (!localSearchCompleted) {
        setStatus('Bitte zuerst eine lokale Suche durchführen.', { isError: true });
        return;
    }
    if (!sessionId) {
        setStatus('Keine Such-Session vorhanden. Bitte erneut lokal suchen.', { isError: true });
        return;
    }

    setStatus('Externe Suche läuft...');

    try {
        const result = await searchExternal({ sessionId });
        renderResults(result.items || []);
        setStatus(buildExternalStatus(result));
    } catch (error) {
        if (handleEndpointError(error, '/api/search/external')) return;
        setStatus(getErrorMessage(error, 'Fehler bei der externen Suche.'), { isError: true });
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
        if (firstNameInput) firstNameInput.value = author.firstName || '';
        if (lastNameInput) lastNameInput.value = author.lastName || '';
    };

    if (select) {
        select.innerHTML = item.authors
            .map((author, index) => `<option value="${index}">${escapeHtml(formatAuthor(author) || `Autor ${index + 1}`)}</option>`)
            .join('');
        select.disabled = item.authors.length <= 1;
        applyAuthor(0);
        editorDisposables.add(addEvent(select, 'change', () => {
            const index = Number(select.value);
            applyAuthor(Number.isNaN(index) ? 0 : index);
        }));
    }
}

async function ensureListsLoaded() {
    if (cachedLists.length > 0) {
        return cachedLists;
    }
    try {
        const data = await getJson('/api/book-lists');
        cachedLists = data.items || [];
    } catch (error) {
        console.error(error);
        cachedLists = [];
    }
    return cachedLists;
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

                const titleInput = editorRoot.querySelector('#searchImportBookTitle');
                const title = titleInput ? titleInput.value.trim() : '';
                if (!title) {
                    setEditorStatus(editorRoot, 'Titel ist erforderlich.', { isError: true });
                    return;
                }

                const authorRows = editorRoot.querySelectorAll('.search-import-author-row');
                const authors = Array.from(authorRows).map((row) => {
                    const firstInput = row.querySelector('.search-import-author-first');
                    const lastInput = row.querySelector('.search-import-author-last');
                    const firstName = firstInput ? firstInput.value.trim() : '';
                    const lastName = lastInput ? lastInput.value.trim() : '';
                    return { firstName, lastName, fullName: `${firstName} ${lastName}`.trim() };
                });

                if (authors.length === 0 || authors.some((author) => !author.firstName || !author.lastName)) {
                    setEditorStatus(editorRoot, 'Mindestens ein Autor mit Vor- und Nachname ist erforderlich.', { isError: true });
                    return;
                }

                const listChecks = editorRoot.querySelectorAll('[data-search-import-lists] input[type=\"checkbox\"]:checked');
                const listIds = Array.from(listChecks).map((checkbox) => Number(checkbox.value)).filter((id) => Number.isFinite(id));

                if (listIds.length === 0) {
                    setEditorStatus(editorRoot, 'Bitte mindestens eine Bücherliste auswählen.', { isError: true });
                    return;
                }

                try {
                    await importBook({
                        book: {
                            title,
                            authors,
                            isbn: item.isbn || null
                        },
                        listIds,
                        confirm: true
                    });
                    closeEditor();
                    clearEditorDisposables();
                    setStatus('Buch wurde übernommen.');
                } catch (error) {
                    if (handleEndpointError(error, '/api/search/import/book')) return;
                    setEditorStatus(editorRoot, getErrorMessage(error, 'Fehler beim Übernehmen des Buches.'), { isError: true });
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
    if (titleInput) {
        titleInput.value = item.title || '';
    }

    const authorsContainer = editorRoot.querySelector('[data-search-import-authors]');
    const listsContainer = editorRoot.querySelector('[data-search-import-lists]');
    let workingAuthors = Array.isArray(item.authors) && item.authors.length > 0
        ? item.authors.map((author) => ({
            firstName: author.firstName || '',
            lastName: author.lastName || ''
        }))
        : [];

    const renderAuthors = () => {
        if (!authorsContainer) return;
        authorsContainer.innerHTML = workingAuthors.map((author, index) => `
            <div class=\"search-import-author-row\" data-author-index=\"${index}\">\n                <input type=\"text\" class=\"search-import-author-first\" placeholder=\"Vorname\" value=\"${escapeHtml(author.firstName)}\">\n                <input type=\"text\" class=\"search-import-author-last\" placeholder=\"Nachname\" value=\"${escapeHtml(author.lastName)}\">\n                <button type=\"button\" class=\"func-button\" data-search-import-action=\"remove-author\" data-author-index=\"${index}\">Entfernen</button>\n            </div>\n        `).join('');
    };

    renderAuthors();

    if (listsContainer) {
        const lists = await ensureListsLoaded();
        if (lists.length === 0) {
            listsContainer.innerHTML = '<div>Keine Bücherlisten verfügbar.</div>';
        } else {
            listsContainer.innerHTML = lists.map((list) => `
                <label class=\"search-import-list-option\">\n                    <input type=\"checkbox\" value=\"${list.book_list_id}\">\n                    ${escapeHtml(list.name)}\n                </label>\n            `).join('');
        }
    }

    editorDisposables.add(addEvent(editorRoot, 'click', (event) => {
        const actionButton = event.target.closest('[data-search-import-action]');
        if (!actionButton) return;
        const action = actionButton.dataset.searchImportAction;
        if (action === 'add-author') {
            workingAuthors = [...workingAuthors, { firstName: '', lastName: '' }];
            renderAuthors();
        }
        if (action === 'remove-author') {
            const index = Number(actionButton.dataset.authorIndex);
            if (!Number.isNaN(index)) {
                workingAuthors = workingAuthors.filter((_, idx) => idx !== index);
                renderAuthors();
            }
        }
    }));
}
