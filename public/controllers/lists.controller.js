import { loadFragment } from '../view-loader.js';
import { enableSingleRowSelection, fetchJson, confirmDanger } from '../ui-helpers.js';

let selectedListId = null;
let cachedLists = [];
let editorMode = 'create';

export async function mount(ctx) {
    const rootElement = ctx.root || ctx;
    // Fetch and render lists
    cachedLists = await fetchLists();
    renderListsTable(rootElement, cachedLists);
    removeEditor(rootElement);

    // Bind click events for table rows
    rootElement.addEventListener('click', handleTableClick);
    rootElement.addEventListener('click', handleListActions);
    rootElement.addEventListener('click', handleEditorActions);

    enableSingleRowSelection(rootElement.querySelector('tbody'), (id) => {
        selectedListId = id;
    });
}

export function unmount(rootElement) {
    // Clean up events and other resources
    rootElement.removeEventListener('click', handleTableClick);
    rootElement.removeEventListener('click', handleListActions);
    rootElement.removeEventListener('click', handleEditorActions);
}

// Bound events:
// - click on root (delegation)
// - row selection via enableSingleRowSelection

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

    // Clear existing rows
    tbody.innerHTML = '';
    selectedListId = null;

    // Populate table with lists
    lists.forEach(list => {
        const row = document.createElement('tr');
        row.dataset.bookListId = String(list.book_list_id);
        row.innerHTML = `
            <td>${list.name}</td>
            <td>${list.is_standard ? 'Ja' : 'Nein'}</td>
            <td>${list.book_count || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

function handleTableClick(event) {
    const row = event.target.closest('tr');
    if (row && row.dataset.bookListId) {
        selectedListId = parseInt(row.dataset.bookListId, 10);

        // Remove 'selected' class from all rows
        const rows = event.currentTarget.querySelectorAll('tr');
        rows.forEach(r => r.classList.remove('selected'));

        // Add 'selected' class to the clicked row
        row.classList.add('selected');
    }
}

async function setEditorMode(rootElement, mode) {
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
        await renderEditor(rootElement, selectedList.name);
    } else {
        editorMode = mode;
        await renderEditor(rootElement, '');
    }
}

function removeEditor(rootElement) {
    clearEditor(rootElement);
    editorMode = 'create';
}

function clearEditor(rootElement) {
    const slot = rootElement.querySelector('.booklist-name-editor-slot');
    if (slot) {
        slot.innerHTML = '';
    }
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

async function renderEditor(rootElement, value) {
    const slot = rootElement.querySelector('.booklist-name-editor-slot');
    if (!slot) return;
    clearEditor(rootElement);
    try {
        await loadFragment(slot, '/views/booklist-name-editor.view.html');
    } catch (error) {
        console.error(error);
        alert('Booklist-Editor konnte nicht geladen werden.');
        return;
    }
    const input = rootElement.querySelector('#booklistNameEditorInput');
    if (input) {
        input.value = value;
        input.focus();
    }
}

async function deleteSelectedList(rootElement) {
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
        removeEditor(rootElement);
    } catch (error) {
        console.error('Error deleting list:', error);
    }
}

async function handleConfirm(event, rootElement) {
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
        await updateList(rootElement, name);
    } else {
        if (isDuplicateName(name)) {
            alert('Eine Liste mit diesem Namen existiert bereits.');
            return;
        }
        await createList(rootElement, name);
    }
}

function handleCancel(event, rootElement) {
    event.preventDefault();
    removeEditor(rootElement);
}

async function createList(rootElement, name) {
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
        removeEditor(rootElement);
    } catch (error) {
        alert(error.message);
        console.error('Error creating list:', error);
    }
}

async function updateList(rootElement, name) {
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
        removeEditor(rootElement);
    } catch (error) {
        alert(error.message);
        console.error('Error updating list:', error);
    }
}

function handleListActions(event) {
    const actionButton = event.target.closest('[data-list-action]');
    if (!actionButton) return;
    const rootElement = event.currentTarget;
    if (actionButton.dataset.listAction === 'create') {
        setEditorMode(rootElement, 'create');
    }
    if (actionButton.dataset.listAction === 'edit') {
        setEditorMode(rootElement, 'edit');
    }
    if (actionButton.dataset.listAction === 'delete') {
        deleteSelectedList(rootElement);
    }
}

function handleEditorActions(event) {
    const actionButton = event.target.closest('[data-booklist-editor-action]');
    if (!actionButton) return;
    const rootElement = event.currentTarget;
    if (actionButton.dataset.booklistEditorAction === 'confirm') {
        handleConfirm(event, rootElement);
    }
    if (actionButton.dataset.booklistEditorAction === 'cancel') {
        handleCancel(event, rootElement);
    }
}
