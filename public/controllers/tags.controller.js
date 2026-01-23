let selectedTagId = null;
let editorMode = 'create';
let cachedTags = [];

export async function mount(rootElement) {
    cachedTags = await fetchTags();
    renderTagsTable(rootElement, cachedTags);
    resetEditor(rootElement);

    rootElement.addEventListener('click', handleTableClick);

    const createBtn = rootElement.querySelector('.button-group button:nth-child(1)');
    const editBtn = rootElement.querySelector('.button-group button:nth-child(2)');
    const deleteBtn = rootElement.querySelector('.button-group button:nth-child(3)');

    if (createBtn) createBtn.addEventListener('click', () => setEditorMode(rootElement, 'create'));
    if (editBtn) editBtn.addEventListener('click', () => setEditorMode(rootElement, 'edit'));
    if (deleteBtn) deleteBtn.addEventListener('click', deleteSelectedTag);

    const confirmBtn = rootElement.querySelector('[data-tag-editor-action="confirm"]');
    const cancelBtn = rootElement.querySelector('[data-tag-editor-action="cancel"]');

    if (confirmBtn) confirmBtn.addEventListener('click', (event) => handleConfirm(event, rootElement));
    if (cancelBtn) cancelBtn.addEventListener('click', (event) => handleCancel(event, rootElement));
}

export function unmount(rootElement) {
    rootElement.removeEventListener('click', handleTableClick);
}

async function fetchTags() {
    try {
        const res = await fetch('/api/tags');
        return await res.json();
    } catch (e) {
        console.error(e);
        return [];
    }
}

function renderTagsTable(rootElement, tags) {
    const tbody = rootElement.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = tags.map(tag => `
        <tr data-tag-id="${tag.tag_id}">
            <td>${tag.name}</td>
            <td>${tag.book_count || 0}</td>
        </tr>
    `).join('');
}

function handleTableClick(event) {
    const row = event.target.closest('tr');
    if (row && row.dataset.tagId) {
        selectedTagId = parseInt(row.dataset.tagId, 10);
        event.currentTarget.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
    }
}

function setEditorMode(rootElement, mode) {
    editorMode = mode;
    const input = rootElement.querySelector('#tagNameEditorInput');
    if (!input) return;
    if (mode === 'edit') {
        if (!selectedTagId) {
            alert('Bitte Tag auswählen.');
            return;
        }
        const selectedTag = cachedTags.find((tag) => tag.tag_id === selectedTagId);
        if (!selectedTag) {
            alert('Ausgewähltes Tag nicht gefunden.');
            return;
        }
        showEditor(rootElement);
        input.value = selectedTag.name;
    } else {
        showEditor(rootElement);
        input.value = '';
    }
    input.focus();
}

function resetEditor(rootElement) {
    editorMode = 'create';
    const input = rootElement.querySelector('#tagNameEditorInput');
    if (input) {
        input.value = '';
    }
    hideEditor(rootElement);
}

function isDuplicateName(name, excludeTagId = null) {
    const normalized = name.trim().toLowerCase();
    return cachedTags.some((tag) => {
        if (excludeTagId && tag.tag_id === excludeTagId) {
            return false;
        }
        return tag.name.trim().toLowerCase() === normalized;
    });
}

async function handleConfirm(event, rootElement) {
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

function handleCancel(event, rootElement) {
    event.preventDefault();
    resetEditor(rootElement);
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
            resetEditor(rootElement);
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
            resetEditor(rootElement);
        } else {
            const err = await res.json();
            alert(err.error);
        }
    } catch (e) {
        console.error(e);
    }
}

async function deleteSelectedTag() {
    if (!selectedTagId) return alert('Bitte Tag auswählen.');
    const rootElement = document.querySelector('.view-wrapper-tags');
    const selectedTag = cachedTags.find((tag) => tag.tag_id === selectedTagId);
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
        if (res.ok) {
            selectedTagId = null;
            cachedTags = await fetchTags();
            renderTagsTable(rootElement, cachedTags);
            resetEditor(rootElement);
        } else {
            const err = await res.json();
            alert(err.error);
        }
    } catch (e) {
        console.error(e);
    }
}

function showEditor(rootElement) {
    const editor = rootElement.querySelector('.tag-name-editor');
    if (editor) {
        editor.classList.remove('hidden');
    }
}

function hideEditor(rootElement) {
    const editor = rootElement.querySelector('.tag-name-editor');
    if (editor) {
        editor.classList.add('hidden');
    }
}
