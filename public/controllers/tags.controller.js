import { enableSingleRowSelection } from '../ui-helpers.js';
import { openEditor, closeEditor } from '../editor-runtime/editor-composer.js';
import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { getJson, postJson, putJson, deleteJson, getErrorMessage } from '../api/api-client.js';

let selectedTagId = null;
let editorMode = 'create';
let cachedTags = [];
let rootElement = null;
let disposables = null;

export async function mount(ctx) {
    rootElement = ctx.root || ctx;
    disposables = createDisposables();

    cachedTags = await fetchTags();
    renderTagsTable(rootElement, cachedTags);
    removeEditor();

    disposables.add(addEvent(rootElement, 'click', handleRootActions));

    const tbody = rootElement.querySelector('tbody');
    disposables.add(enableSingleRowSelection(tbody, (id) => {
        selectedTagId = parseInt(id, 10);
    }));
}

export function unmount() {
    closeEditor();
    if (disposables) {
        disposables.disposeAll();
    }
    rootElement = null;
    selectedTagId = null;
}

async function fetchTags() {
    try {
        const tags = await getJson('/api/tags');
        return tags.map(tag => ({
            ...tag,
            tag_id: parseInt(tag.tag_id, 10)
        }));
    } catch (e) {
        console.error(e);
        return [];
    }
}

function renderTagsTable(rootElement, tags) {
    const tbody = rootElement.querySelector('tbody');
    if (!tbody) return;
    selectedTagId = null;
    tbody.innerHTML = tags.map(tag => {
        return `
            <tr data-id="${String(tag.tag_id)}">
                <td>${tag.name}</td>
                <td>${tag.book_count || 0}</td>
            </tr>
        `;
    }).join('');
}

function handleRootActions(event) {
    const actionButton = event.target.closest('[data-tag-action]');
    if (!actionButton) return;

    if (actionButton.dataset.tagAction) {
        handleTagActions(actionButton.dataset.tagAction);
    }
}

function handleTagActions(action) {
    if (!selectedTagId && (action === 'edit' || action === 'delete')) {
        alert('Bitte Tag auswählen.');
        return;
    }

    switch (action) {
        case 'create':
            setEditorMode('create');
            break;
        case 'edit':
            setEditorMode('edit');
            break;
        case 'delete':
            deleteSelectedTag();
            break;
    }
}

async function setEditorMode(mode) {
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
        await renderEditor(selectedTag.name);
    } else {
        editorMode = mode;
        await renderEditor('');
    }
}

function removeEditor() {
    closeEditor();
    editorMode = 'create';
}

function isDuplicateTagName(name, excludeTagId = null) {
    const normalized = name.trim().toLowerCase();
    return cachedTags.some((tag) => {
        if (excludeTagId !== null && tag.tag_id === excludeTagId) {
            return false;
        }
        return tag.name.trim().toLowerCase() === normalized;
    });
}

async function renderEditor(value) {
    const slot = rootElement.querySelector('.tag-editor-slot');
    if (!slot) return;

    await openEditor({
        host: slot,
        manifestPath: '/editors/tags.editor.json',
        mode: editorMode,
        dataContext: { tagId: selectedTagId },
        actions: {
            confirm: (event) => handleConfirm(event),
            cancel: (event) => handleCancel(event)
        }
    });

    const input = rootElement.querySelector('#tagNameEditorInput');
    if (input) {
        input.value = value;
        input.focus();
    }
}

async function deleteSelectedTag() {
    if (!selectedTagId) {
        alert('Bitte Tag auswählen.');
        return;
    }
    const selectedTag = cachedTags.find(tag => tag.tag_id === selectedTagId);

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
        await deleteJson(`/api/tags/${selectedTagId}`);
        selectedTagId = null;
        cachedTags = await fetchTags();
        renderTagsTable(rootElement, cachedTags);
        removeEditor();
    } catch (e) {
        alert(getErrorMessage(e));
        console.error(e);
    }
}

async function handleConfirm(event) {
    event.preventDefault();
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
        if (isDuplicateTagName(name, selectedTagId)) {
            alert('Tag existiert bereits.');
            return;
        }
        await updateTag(name);
    } else {
        if (isDuplicateTagName(name)) {
            alert('Tag existiert bereits.');
            return;
        }
        await createTag(name);
    }
}

function handleCancel(event) {
    event.preventDefault();
    removeEditor();
}

async function createTag(name) {
    try {
        await postJson('/api/tags', { name });
        cachedTags = await fetchTags();
        renderTagsTable(rootElement, cachedTags);
        removeEditor();
    } catch (e) {
        alert(getErrorMessage(e, 'Fehler beim Erstellen des Tags.'));
    }
}

async function updateTag(name) {
    try {
        await putJson(`/api/tags/${selectedTagId}`, { name });
        cachedTags = await fetchTags();
        renderTagsTable(rootElement, cachedTags);
        removeEditor();
    } catch (e) {
        alert(getErrorMessage(e, 'Fehler beim Aktualisieren des Tags.'));
    }
}
