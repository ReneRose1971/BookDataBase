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
        await fetch(`/api/books/${rootElement.dataset.bookId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookData)
        });
    });

    cancelBtn.addEventListener('click', () => {
    });

    // Load existing book data
    (async () => {
        const bookId = rootElement.dataset.bookId;
        if (!bookId) {
            alert('Kein Buch ausgewählt.');
            return;
        }

        const bookRes = await fetch(`/api/books/${bookId}`);
        const bookData = await bookRes.json();
        titleInput.value = bookData.title;
        assignedAuthors = bookData.authors;
        renderAuthors();

        await loadAndRenderBookLists(rootElement);

        const listsGrid = rootElement.querySelector('.lists-checkbox-grid');
        if (listsGrid) {
            bookData.listIds.forEach(id => {
                const checkbox = listsGrid.querySelector(`input[name="book_list"][value="${id}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }

        console.log('Geladene Buchdaten:', bookData);
        console.log('Listen-IDs im Buch:', bookData.listIds);
    })();
}

export function unmount() {
    // Cleanup logic if needed
}