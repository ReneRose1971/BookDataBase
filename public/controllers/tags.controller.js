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
    try {
        const response = await fetch('/views/tag-create.dialog.view.html');
        const dialogHTML = await response.text();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = dialogHTML;
        const dialog = tempDiv.querySelector('dialog');
        document.body.appendChild(dialog);

        const confirmBtn = dialog.querySelector('button[value="confirm"]');
        const cancelBtn = dialog.querySelector('button[value="cancel"]');
        const nameInput = dialog.querySelector('#tagName');

        dialog.showModal();

        cancelBtn.onclick = (e) => {
            e.preventDefault();
            dialog.close();
            dialog.remove();
        };

        confirmBtn.onclick = async (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            if (!name) return alert('Name ist erforderlich.');

            try {
                const res = await fetch('/api/tags', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                if (res.ok) {
                    const tags = await fetchTags();
                    renderTagsTable(document.querySelector('.view-wrapper-tags'), tags);
                    dialog.close();
                    dialog.remove();
                } else {
                    const err = await res.json();
                    alert(err.error);
                }
            } catch (e) {
                console.error(e);
            }
        };
    } catch (e) {
        console.error(e);
    }
}

async function openEditTagDialog() {
    if (!selectedTagId) return alert('Bitte Tag auswählen.');
    
    try {
        const tagRes = await fetch('/api/tags');
        const tags = await tagRes.json();
        const tag = tags.find(t => t.tag_id === selectedTagId);
        if (!tag) return;

        const response = await fetch('/views/tag-edit.dialog.view.html');
        const dialogHTML = await response.text();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = dialogHTML;
        const dialog = tempDiv.querySelector('dialog');
        document.body.appendChild(dialog);

        const confirmBtn = dialog.querySelector('button[value="confirm"]');
        const cancelBtn = dialog.querySelector('button[value="cancel"]');
        const nameInput = dialog.querySelector('#tagName');
        nameInput.value = tag.name;

        dialog.showModal();

        cancelBtn.onclick = (e) => {
            e.preventDefault();
            dialog.close();
            dialog.remove();
        };

        confirmBtn.onclick = async (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            if (!name) return alert('Name ist erforderlich.');

            try {
                const res = await fetch(`/api/tags/${selectedTagId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                if (res.ok) {
                    const tags = await fetchTags();
                    renderTagsTable(document.querySelector('.view-wrapper-tags'), tags);
                    dialog.close();
                    dialog.remove();
                } else {
                    const err = await res.json();
                    alert(err.error);
                }
            } catch (e) {
                console.error(e);
            }
        };
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