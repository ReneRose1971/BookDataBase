import { loadFragment } from '../view-loader.js';
import { enableSingleRowSelection, fetchJson, confirmDanger } from '../ui-helpers.js';

let selectedTagId = null;
let editorMode = 'create';
let cachedTags = [];

export async function mount(ctx) {
    const rootElement = ctx.root || ctx;
    cachedTags = await fetchTags();
    renderTagsTable(rootElement, cachedTags);
    removeEditor(rootElement);

    rootElement.addEventListener('click', handleRootActions);

    enableSingleRowSelection(rootElement.querySelector('tbody'), (id) => {
        console.log('Row selected with ID:', id); // Debugging line
        selectedTagId = parseInt(id, 10);
    });
}

export function unmount(rootElement) {
    rootElement.removeEventListener('click', handleRootActions);
}

// Ensure tag_id is stored as a number
// Debugging: Log fetched tags
async function fetchTags() {
    try {
        const res = await fetch('/api/tags');
        const tags = await res.json();
        const normalizedTags = tags.map(tag => ({
            ...tag,
            tag_id: parseInt(tag.tag_id, 10) // Convert tag_id to number
        }));
        console.log('Normalized tags:', normalizedTags); // Debugging line
        return normalizedTags;
    } catch (e) {
        console.error(e);
        return [];
    }
}

// Ensure data-tag-id is used consistently
// Debugging: Verify data-id generation
function renderTagsTable(rootElement, tags) {
    const tbody = rootElement.querySelector('tbody');
    if (!tbody) return;
    selectedTagId = null;
    tbody.innerHTML = tags.map(tag => {
        console.log('Rendering tag:', tag); // Debugging line
        return `
            <tr data-id="${String(tag.tag_id)}">
                <td>${tag.name}</td>
                <td>${tag.book_count || 0}</td>
            </tr>
        `;
    }).join('');
}

function handleRootActions(event) {
    const actionButton = event.target.closest('[data-tag-action], [data-tag-editor-action]');
    if (!actionButton) return;

    const rootElement = event.currentTarget;

    if (actionButton.dataset.tagAction) {
        handleTagActions(actionButton.dataset.tagAction, rootElement);
    } else if (actionButton.dataset.tagEditorAction) {
        handleEditorActions(actionButton.dataset.tagEditorAction, rootElement);
    }
}

// Ensure selectedTagId is properly updated and validated before actions
// Debugging: Log selectedTagId and type during processing
function handleTagActions(action, rootElement) {
    console.log('Selected Tag ID:', selectedTagId, 'Type:', typeof selectedTagId); // Debugging line

    if (!selectedTagId && (action === 'edit' || action === 'delete')) {
        alert('Bitte Tag auswählen.');
        return;
    }

    switch (action) {
        case 'create':
            setEditorMode(rootElement, 'create');
            break;
        case 'edit':
            setEditorMode(rootElement, 'edit');
            break;
        case 'delete':
            deleteSelectedTag(rootElement);
            break;
    }
}

function handleEditorActions(action, rootElement) {
    switch (action) {
        case 'confirm':
            handleConfirm(rootElement);
            break;
        case 'cancel':
            handleCancel(rootElement);
            break;
    }
}

function handleTableClick(event) {
    const row = event.target.closest('tr');
    if (row && row.dataset.id) { // Updated to use data-id
        selectedTagId = parseInt(row.dataset.id, 10);
        const rows = event.currentTarget.querySelectorAll('tr');
        rows.forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
    }
}

async function setEditorMode(rootElement, mode) {
    if (mode === 'edit') {
        if (!selectedTagId) {
            alert('Bitte Tag auswählen.');
            return;
        }
        const selectedTag = cachedTags.find(tag => tag.tag_id === selectedTagId);
        if (!selectedTag) {
            alert('Ausgewähltes Tag nicht gefunden.');
            return;
        }
        editorMode = mode;
        await renderEditor(rootElement, selectedTag.name);
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
    const slot = rootElement.querySelector('.tag-editor-slot');
    if (slot) {
        slot.innerHTML = '';
    }
}

async function renderEditor(rootElement, value) {
    const slot = rootElement.querySelector('.tag-editor-slot');
    if (!slot) return;
    clearEditor(rootElement);
    try {
        await loadFragment(slot, '/views/tag-name-editor.view.html');
    } catch (error) {
        console.error(error);
        alert('Tag-Editor konnte nicht geladen werden.');
        return;
    }
    const input = rootElement.querySelector('#tagNameEditorInput');
    if (input) {
        input.value = value;
        input.focus();
    }
}

// Debugging: Log database access details
async function deleteSelectedTag(rootElement) {
    if (!selectedTagId) {
        alert('Bitte Tag auswählen.');
        return;
    }
    const selectedTag = cachedTags.find(tag => tag.tag_id === selectedTagId);
    console.log('Selected Tag for Deletion:', selectedTag); // Debugging line

    if (!selectedTag) {
        alert('Ausgewähltes Tag nicht gefunden.');
        return;
    }
    if (selectedTag.book_count > 0) {
        const removeRelations = confirm('Dieses Tag ist mit Büchern verknüpft. Verknüpfungen entfernen und Tag löschen?');
        if (!removeRelations) return;
    } else if (!confirm('Tag wirklich löschen?')) {
        return;
    }
    try {
        const res = await fetch(`/api/tags/${selectedTagId}`, { method: 'DELETE' });
        console.log('Database Response:', res); // Debugging line
        if (res.ok) {
            selectedTagId = null;
            cachedTags = await fetchTags();
            renderTagsTable(rootElement, cachedTags);
            removeEditor(rootElement);
        } else {
            const err = await res.json();
            alert(err.error);
        }
    } catch (e) {
        console.error(e);
    }
}

async function handleConfirm(rootElement) {
    const input = rootElement.querySelector('#tagNameEditorInput');
    if (!input) return;
    const name = input.value.trim();
    if (!name) {
        alert('Name ist erforderlich.');
        return;
    }

    if (editorMode === 'edit') {
        if (!selectedTagId) {
            alert('Bitte Tag auswählen.');
            return;
        }
        if (isDuplicateName(name, selectedTagId)) {
            alert('Ein Tag mit diesem Namen existiert bereits.');
            return;
        }
        await updateTag(rootElement, name);
    } else {
        if (isDuplicateName(name)) {
            alert('Ein Tag mit diesem Namen existiert bereits.');
            return;
        }
        await createTag(rootElement, name);
    }
}

function handleCancel(rootElement) {
    removeEditor(rootElement);
}

async function createTag(rootElement, name) {
    try {
        const res = await fetch('/api/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            cachedTags = await fetchTags();
            renderTagsTable(rootElement, cachedTags);
            removeEditor(rootElement);
        } else {
            const err = await res.json();
            alert(err.error);
        }
    } catch (e) {
        console.error(e);
    }
}

async function updateTag(rootElement, name) {
    try {
        const res = await fetch(`/api/tags/${selectedTagId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            cachedTags = await fetchTags();
            renderTagsTable(rootElement, cachedTags);
            removeEditor(rootElement);
        } else {
            const err = await res.json();
            alert(err.error);
        }
    } catch (e) {
        console.error(e);
    }
}

function isDuplicateName(name, excludeTagId = null) {
    const normalized = name.trim().toLowerCase();
    return cachedTags.some(tag => {
        if (excludeTagId && tag.tag_id === excludeTagId) {
            return false;
        }
        return tag.name.trim().toLowerCase() === normalized;
    });
}

// Bound events:
// - click on root (delegation)
// - row selection via enableSingleRowSelection
