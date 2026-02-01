import { openEditor, closeEditor } from '../editor-runtime/editor-composer.js';
import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { importBook } from '../services/search.service.js';
import { getErrorMessage } from '../api/api-client.js';

let rootElement = null;
let hostElement = null;
let editorDisposables = null;
let item = null;
let modalApi = null;
let setStatus = null;
let searchId = null;
let sessionId = null;

export async function mount(ctx) {
    rootElement = ctx.root || ctx;
    hostElement = rootElement.querySelector('[data-search-import-host]') || rootElement;
    item = ctx.item || null;
    modalApi = ctx.modal || null;
    setStatus = typeof ctx.setStatus === 'function' ? ctx.setStatus : null;
    searchId = ctx.searchId || null;
    sessionId = ctx.sessionId || null;

    await openEditor({
        host: hostElement,
        manifestPath: '/editors/search-import-book.editor.json',
        mode: 'create',
        dataContext: { itemId: item?.itemId },
        actions: {
            confirm: handleConfirm,
            cancel: handleCancel
        }
    });

    const editorRoot = hostElement.querySelector('.search-import-editor');
    if (!editorRoot) return;

    editorDisposables = createDisposables();

    const titleInput = editorRoot.querySelector('#searchImportBookTitle');
    const isbnInput = editorRoot.querySelector('#searchImportBookIsbn');
    const authorSelect = editorRoot.querySelector('#searchImportBookAuthorSelect');

    if (titleInput) {
        const rawTitle = item?.title || '';
        titleInput.value = item?.source === 'cover_scan' ? decodeHtmlEntities(rawTitle) : rawTitle;
    }
    if (isbnInput) {
        isbnInput.value = item?.isbn || '';
    }

    if (authorSelect && Array.isArray(item?.authors) && item.authors.length > 0) {
        authorSelect.innerHTML = item.authors.map((author, index) => {
            const fullName = author.fullName || [author.firstName, author.lastName].filter(Boolean).join(' ');
            return `<option value="${index}">${escapeHtml(fullName)}</option>`;
        }).join('');
        authorSelect.value = 0;

        editorDisposables.add(addEvent(authorSelect, 'change', (event) => {
            const index = parseInt(event.target.value, 10);
            if (!isNaN(index)) {
                const author = item.authors[index] || item.authors[0];
                if (author) {
                    const firstNameInput = editorRoot.querySelector('#searchImportBookAuthorFirstName');
                    const lastNameInput = editorRoot.querySelector('#searchImportBookAuthorLastName');
                    if (firstNameInput) {
                        firstNameInput.value = String(author.firstName || '').trim();
                    }
                    if (lastNameInput) {
                        lastNameInput.value = String(author.lastName || '').trim();
                    }
                }
            }
        }));

        const firstAuthor = item.authors[0];
        if (firstAuthor) {
            const firstNameInput = editorRoot.querySelector('#searchImportBookAuthorFirstName');
            const lastNameInput = editorRoot.querySelector('#searchImportBookAuthorLastName');
            if (firstNameInput) {
                firstNameInput.value = String(firstAuthor.firstName || '').trim();
            }
            if (lastNameInput) {
                lastNameInput.value = String(firstAuthor.lastName || '').trim();
            }
        }
    }
}

export function unmount() {
    closeEditor();
    clearEditorDisposables();
    rootElement = null;
    hostElement = null;
    item = null;
    modalApi = null;
    setStatus = null;
    searchId = null;
    sessionId = null;
}

async function handleConfirm(event) {
    event.preventDefault();
    if (!hostElement) return;

    const editorRoot = hostElement.querySelector('.search-import-editor');
    if (!editorRoot) return;
    const form = editorRoot.querySelector('form');
    if (!form) return;
    const formData = new FormData(form);

    const authors = formData.getAll('author[]').filter(Boolean).map((name) => {
        const [firstName, lastName] = name.split(',').map(part => part.trim());
        return { firstName, lastName, fullName: `${firstName} ${lastName}`.trim() };
    });
    const title = formData.get('title')?.trim();
    const isbn = formData.get('isbn')?.trim();
    const listIds = formData.getAll('listIds[]').filter(Boolean);
    const bookPayload = { title, authors, isbn };

    try {
        const payload = {
            itemId: item?.itemId,
            searchId,
            sessionId,
            title,
            authors,
            isbn,
            confirm: true
        };
        if (listIds.length > 0) {
            payload.listIds = listIds;
        }
        if (item?.source === 'cover_scan') {
            payload.book = bookPayload;
        }
        await importBook(payload);
        closeEditor();
        clearEditorDisposables();
        if (setStatus) {
            setStatus('Buch wurde übernommen.');
        }
        if (modalApi && typeof modalApi.close === 'function') {
            modalApi.close();
        }
    } catch (error) {
        setEditorStatus(editorRoot, getErrorMessage(error, 'Fehler beim Übernehmen des Buchs.'), { isError: true });
    }
}

async function handleCancel(event) {
    event.preventDefault();
    closeEditor();
    clearEditorDisposables();
    if (modalApi && typeof modalApi.close === 'function') {
        modalApi.close();
    }
}

function clearEditorDisposables() {
    if (editorDisposables) {
        editorDisposables.disposeAll();
        editorDisposables = null;
    }
}

function setEditorStatus(root, message, { isError = false } = {}) {
    if (!root) return;
    const statusElement = root.querySelector('[data-search-import-status]');
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

function decodeHtmlEntities(value) {
    if (!value) return '';
    const doc = new DOMParser().parseFromString(String(value), 'text/html');
    return doc.documentElement.textContent || '';
}
