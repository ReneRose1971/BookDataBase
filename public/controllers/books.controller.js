let selectedBookId = null;

export async function mount(rootElement) {
    const books = await fetchBooks();
    renderBooksTable(rootElement, books);

    rootElement.addEventListener('click', handleTableClick);

    const createBtn = rootElement.querySelector('.button-group button:nth-child(1)');
    const editBtn = rootElement.querySelector('.button-group button:nth-child(2)');
    const deleteBtn = rootElement.querySelector('.button-group button:nth-child(3)');

    if (createBtn) {
        createBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openCreateBookDialog(rootElement);
        });
    }
}

export function unmount(rootElement) {
    rootElement.removeEventListener('click', handleTableClick);
    const dialogs = document.querySelectorAll('body > dialog');
    dialogs.forEach(d => d.remove());
}

async function fetchBooks() {
    try {
        const res = await fetch('/api/books');
        const data = await res.json();
        return data.items || [];
    } catch (e) {
        console.error(e);
        return [];
    }
}

function renderBooksTable(rootElement, books) {
    const tbody = rootElement.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = books.map(book => `
        <tr data-book-id="${book.book_id}">
            <td>${book.title}</td>
            <td>${book.authors || ''}</td>
        </tr>
    `).join('');
}

function handleTableClick(event) {
    const row = event.target.closest('tr');
    if (row && row.dataset.bookId) {
        selectedBookId = parseInt(row.dataset.bookId, 10);
        event.currentTarget.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
    }
}

async function openCreateBookDialog(rootElement) {
    try {
        const response = await fetch('/views/book-create.dialog.view.html');
        const dialogHTML = await response.text();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = dialogHTML;
        const dialog = tempDiv.querySelector('dialog');
        document.body.appendChild(dialog);

        const titleInput = dialog.querySelector('#bookTitle');
        const authorSelect = dialog.querySelector('#authorSelect');
        const addAuthorBtn = dialog.querySelector('#addAuthorBtn');
        const removeAuthorBtn = dialog.querySelector('#removeAuthorBtn');
        const assignedTableBody = dialog.querySelector('#assignedAuthorsTable tbody');
        const listsGrid = dialog.querySelector('.lists-checkbox-grid');
        const confirmBtn = dialog.querySelector('button[value="confirm"]');
        const cancelBtn = dialog.querySelector('button[value="cancel"]');

        let assignedAuthors = [];
        let selectedInDialogId = null;

        // Load authors for dropdown
        const authorsRes = await fetch('/api/authors');
        const authors = await authorsRes.json();
        authorSelect.innerHTML = authors.map(a => `<option value="${a.author_id}">${a.first_name} ${a.last_name}</option>`).join('');

        // Load book lists
        const listsRes = await fetch('/api/book_lists');
        const bookLists = await listsRes.json();
        listsGrid.innerHTML = bookLists.map(list => `
            <label style="display: flex; align-items: center; gap: 8px; font-weight: normal; margin-bottom: 0;">
                <input type="checkbox" name="book_list" value="${list.book_list_id}" ${list.name === 'Gelesene Bücher' || list.name === 'Wunschliste' ? '' : ''}>
                ${list.name}
            </label>
        `).join('');

        const updateRemoveBtnState = () => {
            removeAuthorBtn.disabled = selectedInDialogId === null;
        };

        const renderDialogAuthors = () => {
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
                    renderDialogAuthors();
                    updateRemoveBtnState();
                };
            });
        };

        addAuthorBtn.addEventListener('click', () => {
            const authorId = parseInt(authorSelect.value);
            const author = authors.find(a => a.author_id === authorId);
            if (author && !assignedAuthors.find(a => a.author_id === authorId)) {
                assignedAuthors.push(author);
                renderDialogAuthors();
            }
        });

        removeAuthorBtn.addEventListener('click', () => {
            if (selectedInDialogId !== null) {
                assignedAuthors = assignedAuthors.filter(a => a.author_id !== selectedInDialogId);
                selectedInDialogId = null;
                renderDialogAuthors();
                updateRemoveBtnState();
            }
        });

        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            dialog.close();
            dialog.remove();
        });

        confirmBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const title = titleInput.value.trim();
            if (!title) return alert('Bitte Titel eingeben.');
            if (assignedAuthors.length === 0) return alert('Ein Buch muss mindestens einen Autor haben.');

            const checkedLists = Array.from(dialog.querySelectorAll('input[name="book_list"]:checked')).map(cb => parseInt(cb.value));
            if (checkedLists.length === 0) return alert('Bitte wählen Sie mindestens eine Liste aus.');

            const authorIds = assignedAuthors.map(a => a.author_id);
            
            // Check for duplicate
            const checkRes = await fetch(`/api/books/check-duplicate?title=${encodeURIComponent(title)}&authorIds=${JSON.stringify(authorIds)}`);
            const { duplicate } = await checkRes.json();
            
            if (duplicate) {
                alert('Ein Buch mit diesem Titel und diesen Autoren existiert bereits.');
                return;
            }

            // Create book
            const createRes = await fetch('/api/books', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, authorIds, listIds: checkedLists })
            });

            if (createRes.ok) {
                const books = await fetchBooks();
                renderBooksTable(rootElement, books);
                dialog.close();
                dialog.remove();
            } else {
                const err = await createRes.json();
                alert(err.error || 'Fehler beim Speichern.');
            }
        });

        dialog.showModal();
    } catch (e) {
        console.error(e);
    }
}

// Remove old helper function as it's now integrated in openCreateBookDialog
function renderAssignedAuthors(tbody, authors) {
    // Deprecated
}