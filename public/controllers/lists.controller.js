import { enableSingleRowSelection } from '../ui-helpers.js';
import { openEditor, closeEditor } from '../editor-runtime/editor-composer.js';
import { createDisposables, addEvent } from '../editor-runtime/disposables.js';

let selectedListId = null;
let cachedLists = [];
let editorMode = 'create';
let rootElement = null;
let disposables = null;

export async function mount(ctx) {
    rootElement = ctx.root || ctx;
    disposables = createDisposables();

    cachedLists = await fetchLists();
    renderListsTable(rootElement, cachedLists);
    removeEditor();

    disposables.add(addEvent(rootElement, 'click', handleListActions));

    const tbody = rootElement.querySelector('tbody');
    disposables.add(enableSingleRowSelection(tbody, (id) => {
        selectedListId = Number(id);
    }));
}

export function unmount() {
    closeEditor();
    if (disposables) {
        disposables.disposeAll();
    }
    rootElement = null;
    selectedListId = null;
}

async function fetchLists() {
    try {
        const response = await fetch('/api/book-lists');
        if (!response.ok) {
            throw new Error('Failed to fetch lists');
        }
        const { items } = await response.json();
        return items;
    } catch (error) {
        console.error('Error fetching lists:', error);
        return [];
    }
}

function renderListsTable(rootElement, lists) {
    const tbody = rootElement.querySelector('tbody');
    if (!tbody) {
        console.error('Table body not found');
        return;
    }

    tbody.innerHTML = '';
    selectedListId = null;

    lists.forEach(list => {
        const row = document.createElement('tr');
        row.dataset.id = String(list.book_list_id);
        row.innerHTML = `
            <td>${list.name}</td>
            <td>${list.is_standard ? 'Ja' : 'Nein'}</td>
            <td>${list.book_count || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

async function setEditorMode(mode) {
    if (mode === 'edit') {
        if (!selectedListId) {
            alert('Keine Liste ausgewählt.');
            return;
        }
        const selectedList = cachedLists.find((list) => Number(list.book_list_id) === selectedListId);
        if (!selectedList) {
            alert('Ausgewählte Liste nicht gefunden.');
            return;
        }
        if (selectedList.is_standard) {
            alert('Standardlisten dürfen nicht bearbeitet werden.');
            return;
        }
        editorMode = mode;
        await renderEditor(selectedList.name);
    } else {
        editorMode = mode;
        await renderEditor('');
    }
}

function removeEditor() {
    closeEditor();
    editorMode = 'create';
}

function isDuplicateName(name, excludeListId = null) {
    const normalized = name.trim().toLowerCase();
    return cachedLists.some((list) => {
        if (excludeListId && list.book_list_id === excludeListId) {
            return false;
        }
        return list.name.trim().toLowerCase() === normalized;
    });
}

async function renderEditor(value) {
    const slot = rootElement.querySelector('.booklist-name-editor-slot');
    if (!slot) return;

    await openEditor({
        host: slot,
        manifestPath: '/editors/lists.editor.json',
        mode: editorMode,
        dataContext: { listId: selectedListId },
        actions: {
            confirm: (event) => handleConfirm(event),
            cancel: (event) => handleCancel(event)
        }
    });

    const input = rootElement.querySelector('#booklistNameEditorInput');
    if (input) {
        input.value = value;
        input.focus();
    }
}

async function deleteSelectedList() {
    if (!selectedListId) {
        alert('Keine Liste ausgewählt.');
        return;
    }

    if (!confirm('Möchten Sie diese Liste wirklich löschen?')) {
        return;
    }

    try {
        const response = await fetch(`/api/book-lists/${selectedListId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch list details');
        }
        const list = await response.json();

        if (Number(list.item.book_list_id) !== selectedListId) {
            alert('Ausgewählte Liste nicht gefunden.');
            return;
        }

        if (list.item.is_standard) {
            alert('Standardlisten können nicht gelöscht werden.');
            return;
        }

        const deleteResponse = await fetch(`/api/book-lists/${selectedListId}`, {
            method: 'DELETE'
        });

        if (deleteResponse.status === 409) {
            const error = await deleteResponse.json();
            alert(error.error);
            return;
        }

        if (!deleteResponse.ok) {
            throw new Error('Failed to delete list');
        }

        selectedListId = null;
        cachedLists = await fetchLists();
        renderListsTable(rootElement, cachedLists);
        removeEditor();
    } catch (error) {
        console.error('Error deleting list:', error);
    }
}

async function handleConfirm(event) {
    event.preventDefault();
    const input = rootElement.querySelector('#booklistNameEditorInput');
    if (!input) return;
    const name = input.value.trim();
    if (!name) {
        alert('Name ist erforderlich.');
        return;
    }

    if (editorMode === 'edit') {
        if (!selectedListId) {
            alert('Keine Liste ausgewählt.');
            return;
        }
        if (isDuplicateName(name, selectedListId)) {
            alert('Eine Liste mit diesem Namen existiert bereits.');
            return;
        }
        await updateList(name);
    } else {
        if (isDuplicateName(name)) {
            alert('Eine Liste mit diesem Namen existiert bereits.');
            return;
        }
        await createList(name);
    }
}

function handleCancel(event) {
    event.preventDefault();
    removeEditor();
}

async function createList(name) {
    try {
        const response = await fetch('/api/book-lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create list');
        }

        cachedLists = await fetchLists();
        renderListsTable(rootElement, cachedLists);
        removeEditor();
    } catch (error) {
        alert(error.message);
        console.error('Error creating list:', error);
    }
}

async function updateList(name) {
    try {
        const response = await fetch(`/api/book-lists/${selectedListId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update list');
        }

        cachedLists = await fetchLists();
        renderListsTable(rootElement, cachedLists);
        removeEditor();
    } catch (error) {
        alert(error.message);
        console.error('Error updating list:', error);
    }
}

function handleListActions(event) {
    const actionButton = event.target.closest('[data-list-action]');
    if (!actionButton) return;
    if (actionButton.dataset.listAction === 'create') {
        setEditorMode('create');
    }
    if (actionButton.dataset.listAction === 'edit') {
        setEditorMode('edit');
    }
    if (actionButton.dataset.listAction === 'delete') {
        deleteSelectedList();
    }
}
