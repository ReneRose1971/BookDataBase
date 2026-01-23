// LEGACY: unused
// This file is no longer referenced in the project.

import { loadAndRenderBookLists } from './books.controller.js';

export function mount(rootElement) {
    const titleInput = rootElement.querySelector('#bookTitle');
    const authorSelect = rootElement.querySelector('#authorSelect');
    const addAuthorBtn = rootElement.querySelector('#addAuthorBtn');
    const removeAuthorBtn = rootElement.querySelector('#removeAuthorBtn');
    const assignedTableBody = rootElement.querySelector('#assignedAuthorsTable tbody');
    const listsGrid = rootElement.querySelector('.lists-checkbox-grid');
    const confirmBtn = rootElement.querySelector('button[value="confirm"]');
    const cancelBtn = rootElement.querySelector('button[value="cancel"]');

    let assignedAuthors = [];
    let selectedInDialogId = null;
    let allAuthors = [];

    const updateRemoveBtnState = () => {
        removeAuthorBtn.disabled = selectedInDialogId === null;
    };

    const renderAuthors = () => {
        assignedTableBody.innerHTML = assignedAuthors.map(a => `
            <tr data-id="${a.author_id}" class="${selectedInDialogId === a.author_id ? 'selected' : ''}">
                <td>${a.first_name}</td>
                <td>${a.last_name}</td>
            </tr>
        `).join('');

        assignedTableBody.querySelectorAll('tr').forEach(row => {
            row.onclick = () => {
                const id = parseInt(row.dataset.id);
                selectedInDialogId = (selectedInDialogId === id) ? null : id;
                renderAuthors();
                updateRemoveBtnState();
            };
        });
    };

    addAuthorBtn.addEventListener('click', () => {
        const authorId = parseInt(authorSelect.value);
        const author = allAuthors.find(a => parseInt(a.author_id, 10) === authorId);
        if (author && !assignedAuthors.some(a => parseInt(a.author_id, 10) === authorId)) {
            assignedAuthors.push(author);
            renderAuthors();
        }
    });

    removeAuthorBtn.addEventListener('click', () => {
        if (selectedInDialogId !== null) {
            assignedAuthors = assignedAuthors.filter(a => a.author_id !== selectedInDialogId);
            selectedInDialogId = null;
            renderAuthors();
            updateRemoveBtnState();
        }
    });

    confirmBtn.addEventListener('click', async (event) => {
        event.preventDefault(); // Prevent default form submission

        const bookData = {
            title: titleInput.value,
            authors: assignedAuthors,
            lists: Array.from(listsGrid.querySelectorAll('input:checked')).map(cb => cb.value)
        };
        await fetch('/api/books', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookData)
        });
    });

    cancelBtn.addEventListener('click', () => {
    });

    (async () => {
        const authorsRes = await fetch('/api/authors');
        allAuthors = await authorsRes.json();
        authorSelect.innerHTML = allAuthors.map(a => `<option value="${a.author_id}">${a.first_name} ${a.last_name}</option>`).join('');

        await loadAndRenderBookLists(rootElement);
    })();
}

export function unmount() {
    // Cleanup logic if needed
}