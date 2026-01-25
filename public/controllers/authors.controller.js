import { enableSingleRowSelection, confirmDanger } from '../ui-helpers.js';
import { openEditor, closeEditor } from '../editor-runtime/editor-composer.js';
import { createDisposables, addEvent } from '../editor-runtime/disposables.js';

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
        const response = await fetch('/api/authors');
        if (!response.ok) {
            throw new Error('Failed to fetch authors');
        }
        return await response.json();
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
            alert('Bitte zuerst einen Autor auswählen.');
            return;
        }
        const selectedAuthor = cachedAuthors.find((author) => Number(author.author_id) === selectedAuthorId);
        if (!selectedAuthor) {
            alert('Ausgewählter Autor nicht gefunden.');
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
        const response = await fetch('/api/authors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create author');
        }

        cachedAuthors = await fetchAuthors();
        renderAuthorsTable(rootElement, cachedAuthors);
        removeEditor();
    } catch (error) {
        alert(error.message);
        console.error('Error creating author:', error);
    }
}

async function updateAuthor(firstName, lastName) {
    try {
        const response = await fetch(`/api/authors/${selectedAuthorId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update author');
        }

        cachedAuthors = await fetchAuthors();
        renderAuthorsTable(rootElement, cachedAuthors);
        removeEditor();
    } catch (error) {
        alert(error.message);
        console.error('Error updating author:', error);
    }
}

export async function deleteSelectedAuthor() {
    if (!selectedAuthorId) {
        alert('Kein Autor ausgewählt.');
        return;
    }

    if (!confirmDanger('Möchten Sie diesen Autor wirklich löschen?')) {
        return;
    }

    try {
        const response = await fetch(`/api/authors/${selectedAuthorId}`, {
            method: 'DELETE'
        });

        if (response.status === 409) {
            const errorData = await response.json();
            alert(errorData.error);
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to delete author');
        }

        selectedAuthorId = null;
        cachedAuthors = await fetchAuthors();
        renderAuthorsTable(rootElement, cachedAuthors);
        removeEditor();
    } catch (error) {
        console.error('Error deleting author:', error);
        alert('Fehler beim Löschen des Autors.');
    }
}

function handleAuthorActions(event) {
    const actionButton = event.target.closest('[data-author-action]');
    if (!actionButton) return;
    if (actionButton.dataset.authorAction === 'create') {
        setEditorMode('create');
    }
    if (actionButton.dataset.authorAction === 'edit') {
        setEditorMode('edit');
    }
    if (actionButton.dataset.authorAction === 'delete') {
        deleteSelectedAuthor();
    }
}

async function handleConfirm(event) {
    event.preventDefault();
    const firstNameInput = rootElement.querySelector('#authorFirstNameInput');
    const lastNameInput = rootElement.querySelector('#authorLastNameInput');
    if (!lastNameInput) return;
    const firstName = firstNameInput ? firstNameInput.value.trim() : '';
    const lastName = lastNameInput.value.trim();
    if (!lastName) {
        alert('Name ist erforderlich.');
        return;
    }

    if (editorMode === 'edit') {
        if (!selectedAuthorId) {
            alert('Bitte zuerst einen Autor auswählen.');
            return;
        }
        if (isDuplicateAuthor(firstName, lastName, selectedAuthorId)) {
            alert('Autor existiert bereits.');
            return;
        }
        await updateAuthor(firstName, lastName);
    } else {
        if (isDuplicateAuthor(firstName, lastName)) {
            alert('Autor existiert bereits.');
            return;
        }
        await createAuthor(firstName, lastName);
    }
}

function handleCancel(event) {
    event.preventDefault();
    removeEditor();
}
