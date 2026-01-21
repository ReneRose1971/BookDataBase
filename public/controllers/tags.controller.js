let selectedTagId = null;

export async function mount(rootElement) {
    const tags = await fetchTags();
    renderTagsTable(rootElement, tags);

    rootElement.addEventListener('click', handleTableClick);

    const createBtn = rootElement.querySelector('.button-group button:nth-child(1)');
    const editBtn = rootElement.querySelector('.button-group button:nth-child(2)');
    const deleteBtn = rootElement.querySelector('.button-group button:nth-child(3)');

    if (createBtn) createBtn.addEventListener('click', openCreateTagDialog);
    if (editBtn) editBtn.addEventListener('click', openEditTagDialog);
    if (deleteBtn) deleteBtn.addEventListener('click', deleteSelectedTag);
}

export function unmount(rootElement) {
    rootElement.removeEventListener('click', handleTableClick);
    const dialogs = document.querySelectorAll('body > dialog');
    dialogs.forEach(d => d.remove());
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

async function openCreateTagDialog() {
    const name = prompt('Name des neuen Tags:');
    if (!name) return;
    try {
        const res = await fetch('/api/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            const tags = await fetchTags();
            renderTagsTable(document.querySelector('.view-wrapper-tags'), tags);
        } else {
            const err = await res.json();
            alert(err.error);
        }
    } catch (e) {
        console.error(e);
    }
}

async function openEditTagDialog() {
    if (!selectedTagId) return alert('Bitte Tag auswählen.');
    const name = prompt('Neuer Name für das Tag:');
    if (!name) return;
    try {
        const res = await fetch(`/api/tags/${selectedTagId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            const tags = await fetchTags();
            renderTagsTable(document.querySelector('.view-wrapper-tags'), tags);
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
    if (!confirm('Tag wirklich löschen?')) return;
    try {
        const res = await fetch(`/api/tags/${selectedTagId}`, { method: 'DELETE' });
        if (res.ok) {
            selectedTagId = null;
            const tags = await fetchTags();
            renderTagsTable(document.querySelector('.view-wrapper-tags'), tags);
        } else {
            const err = await res.json();
            alert(err.error);
        }
    } catch (e) {
        console.error(e);
    }
}