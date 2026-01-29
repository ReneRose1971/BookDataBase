import { enableSingleRowSelection, confirmDanger } from '../ui-helpers.js';
import { openEditor, closeEditor } from '../editor-runtime/editor-composer.js';
import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { getJson, postJson, putJson, deleteJson, getErrorMessage } from '../api/api-client.js';
import { notify, notifySelectionRequired, notifyNotFound } from '../services/notify.service.js';

let selectedAuthorId = null;
let cachedAuthors = [];
let editorMode = 'create';
let rootElement = null;
let disposables = null;

export async function mount(ctx) {
    rootElement = ctx.root || ctx;
    disposables = createDisposables();

    cachedAuthors = await fetchAuthors();
    renderAuthorsTable(rootElement, cachedAuthors);
    removeEditor();

    disposables.add(addEvent(rootElement, 'click', handleAuthorActions));

    const tbody = rootElement.querySelector('tbody');
    disposables.add(enableSingleRowSelection(tbody, (id) => {
        selectedAuthorId = Number(id);
    }));
    disposables.add(addEvent(tbody, 'dblclick', handleAuthorRowDoubleClick));
}

export function unmount() {
    closeEditor();
    if (disposables) {
        disposables.disposeAll();
    }
    rootElement = null;
    selectedAuthorId = null;
}

async function fetchAuthors() {
    try {
        return await getJson('/api/authors');
    } catch (error) {
        console.error('Error fetching authors:', error);
        return [];
    }
}

function renderAuthorsTable(rootElement, authors) {
    const tbody = rootElement.querySelector('tbody');
    if (!tbody) {
        console.error('Table body not found');
        return;
    }

    tbody.innerHTML = '';
    selectedAuthorId = null;

    authors.forEach(author => {
        const row = document.createElement('tr');
        row.dataset.id = String(author.author_id);
        row.innerHTML = `
            <td>${author.last_name}</td>
            <td>${author.first_name}</td>
            <td>${author.book_count || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

async function setEditorMode(mode) {
    if (mode === 'edit') {
        if (!selectedAuthorId) {
            notifySelectionRequired('Bitte zuerst einen Autor auswählen.');
            return;
        }
        const selectedAuthor = cachedAuthors.find((author) => Number(author.author_id) === selectedAuthorId);
        if (!selectedAuthor) {
            notifyNotFound('Ausgewählter Autor nicht gefunden.');
            return;
        }
        editorMode = mode;
        await renderEditor(selectedAuthor.first_name, selectedAuthor.last_name);
    } else {
        editorMode = mode;
        await renderEditor('', '');
    }
}

function removeEditor() {
    closeEditor();
    editorMode = 'create';
}

function isDuplicateAuthor(firstName, lastName, excludeAuthorId = null) {
    const normalizedFirst = firstName.trim().toLowerCase();
    const normalizedLast = lastName.trim().toLowerCase();
    return cachedAuthors.some((author) => {
        if (excludeAuthorId && Number(author.author_id) === excludeAuthorId) {
            return false;
        }
        return author.first_name.trim().toLowerCase() === normalizedFirst
            && author.last_name.trim().toLowerCase() === normalizedLast;
    });
}

async function renderEditor(firstNameValue, lastNameValue) {
    const slot = rootElement.querySelector('.author-editor-slot');
    if (!slot) return;

    await openEditor({
        host: slot,
        manifestPath: '/editors/authors.editor.json',
        mode: editorMode,
        dataContext: { authorId: selectedAuthorId },
        actions: {
            confirm: (event) => handleConfirm(event),
            cancel: (event) => handleCancel(event)
        }
    });

    const firstNameInput = rootElement.querySelector('#authorFirstNameInput');
    const lastNameInput = rootElement.querySelector('#authorLastNameInput');
    if (firstNameInput) firstNameInput.value = firstNameValue;
    if (lastNameInput) lastNameInput.value = lastNameValue;
    if (lastNameInput) lastNameInput.focus();
}

async function createAuthor(firstName, lastName) {
    try {
        await postJson('/api/authors', { firstName, lastName });

        cachedAuthors = await fetchAuthors();
        renderAuthorsTable(rootElement, cachedAuthors);
        removeEditor();
    } catch (error) {
        notify(getErrorMessage(error, 'Failed to create author'));
        console.error('Error creating author:', error);
    }
}

async function updateAuthor(firstName, lastName) {
    try {
        await putJson(`/api/authors/${selectedAuthorId}`, { firstName, lastName });

        cachedAuthors = await fetchAuthors();
        renderAuthorsTable(rootElement, cachedAuthors);
        removeEditor();
    } catch (error) {
        notify(getErrorMessage(error, 'Failed to update author'));
        console.error('Error updating author:', error);
    }
}

export async function deleteSelectedAuthor() {
    if (!selectedAuthorId) {
        notifySelectionRequired('Kein Autor ausgewählt.');
        return;
    }

    if (!confirmDanger('Möchten Sie diesen Autor wirklich löschen?')) {
        return;
    }

    try {
        try {
            await deleteJson(`/api/authors/${selectedAuthorId}`);
        } catch (error) {
            if (error.status === 409) {
                notify(getErrorMessage(error));
                return;
            }
            throw error;
        }

        selectedAuthorId = null;
        cachedAuthors = await fetchAuthors();
        renderAuthorsTable(rootElement, cachedAuthors);
        removeEditor();
    } catch (error) {
        console.error('Error deleting author:', error);
        notify('Fehler beim Löschen des Autors.');
    }
}

function handleAuthorActions(event) {
    const actionButton = event.target.closest('[data-author-action]');
    if (!actionButton) return;
    const action = actionButton.dataset.authorAction;
    switch (action) {
        case 'create':
            setEditorMode('create');
            break;
        case 'edit':
            setEditorMode('edit');
            break;
        case 'delete':
            deleteSelectedAuthor();
            break;
        default:
            break;
    }
}

function handleAuthorRowDoubleClick(event) {
    if (event.target.closest('button, a, [data-author-action]')) return;
    const tbody = rootElement?.querySelector('tbody');
    const row = event.target.closest('tr[data-id]');
    if (!tbody || !row || !tbody.contains(row)) return;
    selectedAuthorId = Number(row.dataset.id);
    setEditorMode('edit');
}

async function handleConfirm(event) {
    event.preventDefault();
    const firstNameInput = rootElement.querySelector('#authorFirstNameInput');
    const lastNameInput = rootElement.querySelector('#authorLastNameInput');
    if (!lastNameInput) return;
    const firstName = firstNameInput ? firstNameInput.value.trim() : '';
    const lastName = lastNameInput.value.trim();
    if (!lastName) {
        notify('Name ist erforderlich.');
        return;
    }

    if (editorMode === 'edit') {
        if (!selectedAuthorId) {
            notifySelectionRequired('Bitte zuerst einen Autor auswählen.');
            return;
        }
        if (isDuplicateAuthor(firstName, lastName, selectedAuthorId)) {
            notify('Autor existiert bereits.');
            return;
        }
        await updateAuthor(firstName, lastName);
    } else {
        if (isDuplicateAuthor(firstName, lastName)) {
            notify('Autor existiert bereits.');
            return;
        }
        await createAuthor(firstName, lastName);
    }
}

function handleCancel(event) {
    event.preventDefault();
    removeEditor();
}
