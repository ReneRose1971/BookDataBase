import { enableSingleRowSelection } from '../ui-helpers.js';
import { openEditor, closeEditor } from '../editor-runtime/editor-composer.js';
import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { getJson, postJson, putJson, deleteJson, getErrorMessage } from '../api/api-client.js';

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
    disposables.add(addEvent(tbody, 'dblclick', handleListRowDoubleClick));
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
        const { items } = await getJson('/api/book-lists');
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
        const list = await getJson(`/api/book-lists/${selectedListId}`);

        if (Number(list.item.book_list_id) !== selectedListId) {
            alert('Ausgewählte Liste nicht gefunden.');
            return;
        }

        if (list.item.is_standard) {
            alert('Standardlisten können nicht gelöscht werden.');
            return;
        }

        try {
            await deleteJson(`/api/book-lists/${selectedListId}`);
        } catch (error) {
            if (error.status === 409) {
                alert(getErrorMessage(error));
                return;
            }
            throw error;
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
        await postJson('/api/book-lists', { name });

        cachedLists = await fetchLists();
        renderListsTable(rootElement, cachedLists);
        removeEditor();
    } catch (error) {
        alert(getErrorMessage(error, 'Failed to create list'));
        console.error('Error creating list:', error);
    }
}

async function updateList(name) {
    try {
        await putJson(`/api/book-lists/${selectedListId}`, { name });

        cachedLists = await fetchLists();
        renderListsTable(rootElement, cachedLists);
        removeEditor();
    } catch (error) {
        alert(getErrorMessage(error, 'Failed to update list'));
        console.error('Error updating list:', error);
    }
}

function handleListActions(event) {
    const actionButton = event.target.closest('[data-list-action]');
    if (!actionButton) return;
    const action = actionButton.dataset.listAction;
    switch (action) {
        case 'create':
            setEditorMode('create');
            break;
        case 'edit':
            setEditorMode('edit');
            break;
        case 'delete':
            deleteSelectedList();
            break;
        default:
            break;
    }
}

function handleListRowDoubleClick(event) {
    if (event.target.closest('button, a, [data-list-action]')) return;
    const tbody = rootElement?.querySelector('tbody');
    const row = event.target.closest('tr[data-id]');
    if (!tbody || !row || !tbody.contains(row)) return;
    selectedListId = Number(row.dataset.id);
    setEditorMode('edit');
}
