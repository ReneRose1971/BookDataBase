import { openEditor, closeEditor } from '../editor-runtime/editor-composer.js';
import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { importAuthor } from '../services/search.service.js';
import { getErrorMessage } from '../api/api-client.js';

let rootElement = null;
let hostElement = null;
let editorDisposables = null;
let item = null;
let modalApi = null;
let setStatus = null;

export async function mount(ctx) {
    rootElement = ctx.root || ctx;
    hostElement = rootElement.querySelector('[data-search-import-host]') || rootElement;
    item = ctx.item || null;
    modalApi = ctx.modal || null;
    setStatus = typeof ctx.setStatus === 'function' ? ctx.setStatus : null;

    await openEditor({
        host: hostElement,
        manifestPath: '/editors/search-import-author.editor.json',
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

    const select = editorRoot.querySelector('#searchImportAuthorSelect');
    const firstNameInput = editorRoot.querySelector('#searchImportAuthorFirstName');
    const lastNameInput = editorRoot.querySelector('#searchImportAuthorLastName');

    if (!Array.isArray(item?.authors) || item.authors.length === 0) {
        setEditorStatus(editorRoot, 'Keine Autorendaten im Treffer vorhanden.', { isError: true });
        return;
    }

    const applyAuthor = (index) => {
        const author = item.authors[index] || item.authors[0];
        if (!author || !firstNameInput || !lastNameInput) return;
        firstNameInput.value = String(author.firstName || '').trim();
        lastNameInput.value = String(author.lastName || '').trim();
    };

    if (select) {
        select.innerHTML = item.authors.map((author, index) => {
            const fullName = author.fullName || [author.firstName, author.lastName].filter(Boolean).join(' ');
            return `<option value="${index}">${escapeHtml(fullName)}</option>`;
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

export function unmount() {
    closeEditor();
    clearEditorDisposables();
    rootElement = null;
    hostElement = null;
    item = null;
    modalApi = null;
    setStatus = null;
}

async function handleConfirm(event) {
    event.preventDefault();
    if (!hostElement) return;

    const editorRoot = hostElement.querySelector('.search-import-editor');
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
        if (setStatus) {
            setStatus('Autor wurde übernommen.');
        }
        if (modalApi && typeof modalApi.close === 'function') {
            modalApi.close();
        }
    } catch (error) {
        setEditorStatus(editorRoot, getErrorMessage(error, 'Fehler beim Übernehmen des Autors.'), { isError: true });
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
