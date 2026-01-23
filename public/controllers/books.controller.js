import { loadFragment } from '../view-loader.js';

let selectedBookId = null;
let editorMode = 'create';

export async function mount(rootElement) {
    const filterSelect = rootElement.querySelector('#booklistFilter');
    
    // Load lists for filter
    const listsRes = await fetch('/api/book-lists');
    const listsData = await listsRes.json();
    const lists = listsData.items || [];
    
    if (filterSelect) {
        filterSelect.innerHTML = lists.map(l => `<option value="${l.book_list_id}" ${l.name === 'Gelesene Bücher' ? 'selected' : ''}>${l.name}</option>`).join('');
        filterSelect.onchange = async () => {
            const books = await fetchBooks(filterSelect.value);
            renderBooksTable(rootElement, books);
        };
    }

    // Initial load with filter if available
    const initialListId = filterSelect ? filterSelect.value : null;
    const books = await fetchBooks(initialListId);
    renderBooksTable(rootElement, books);

    rootElement.addEventListener('click', handleTableClick);
    rootElement.addEventListener('click', handleBookActions);

    removeEditor(rootElement);
}

export function unmount(rootElement) {
    rootElement.removeEventListener('click', handleTableClick);
    rootElement.removeEventListener('click', handleBookActions);
}

async function fetchBooks(listId = null) {
    try {
        const url = listId ? `/api/books?listId=${listId}` : '/api/books';
        const res = await fetch(url);
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
    selectedBookId = null;
    tbody.innerHTML = books.map(book => `
        <tr data-book-id="${book.book_id}" class="${selectedBookId === book.book_id ? 'selected' : ''}" style="cursor: pointer;">
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

async function deleteSelectedBook(rootElement) {
    if (!selectedBookId) return alert('Bitte ein Buch auswählen.');
    if (!confirm('Buch wirklich löschen?')) return;

    try {
        const res = await fetch(`/api/books/${selectedBookId}`, { method: 'DELETE' });
        if (res.ok) {
            selectedBookId = null;
            const books = await fetchBooks();
            renderBooksTable(rootElement, books);
            removeEditor(rootElement);
        }
    } catch (e) {
        console.error(e);
    }
}

function removeEditor(rootElement) {
    const slot = rootElement.querySelector('.book-editor-slot');
    if (slot) {
        slot.innerHTML = '';
    }
    editorMode = 'create';
}

async function renderBookEditor(rootElement, mode, bookId = null) {
    try {
        editorMode = mode;
        const slot = rootElement.querySelector('.book-editor-slot');
        if (!slot) return;
        removeEditor(rootElement);
        const viewPath = mode === 'edit'
            ? '/views/books-edit.view.html'
            : '/views/books-create.view.html';
        await loadFragment(slot, viewPath);
        const editorRoot = slot.querySelector('.book-editor');
        if (!editorRoot) return;

        const titleInput = editorRoot.querySelector('#bookTitle');
        const authorSelect = editorRoot.querySelector('#authorSelect');
        const addAuthorBtn = editorRoot.querySelector('#addAuthorBtn');
        const removeAuthorBtn = editorRoot.querySelector('#removeAuthorBtn');
        const assignedTableBody = editorRoot.querySelector('#assignedAuthorsTable tbody');
        const listsGrid = editorRoot.querySelector('.lists-checkbox-grid');
        const confirmBtn = editorRoot.querySelector('[data-book-editor-action="confirm"]');
        const cancelBtn = editorRoot.querySelector('[data-book-editor-action="cancel"]');

        let assignedAuthors = [];
        let selectedInDialogId = null;
        const removedAuthorIds = new Set();

        // Load baseline data
        const [authorsRes, listsRes] = await Promise.all([
            fetch('/api/authors'),
            fetch('/api/book-lists')
        ]);
        const allAuthors = await authorsRes.json();
        const listsData = await listsRes.json();
        const bookLists = listsData.items || [];

        authorSelect.innerHTML = [
            '<option value="">Bitte auswählen</option>',
            ...allAuthors.map(a => `<option value="${a.author_id}">${a.first_name} ${a.last_name}</option>`)
        ].join('');
        listsGrid.innerHTML = bookLists.map(list => `
            <label style="display: flex; align-items: center; gap: 8px; font-weight: normal; margin-bottom: 0;">
                <input type="checkbox" name="book_list" value="${list.book_list_id}">
                ${list.name}
            </label>
        `).join('');

        const updateRemoveBtnState = () => {
            removeAuthorBtn.disabled = selectedInDialogId === null;
        };

        const removeAssignedAuthor = async (authorId) => {
            if (bookId) {
                removedAuthorIds.add(authorId);
            }
            assignedAuthors = assignedAuthors.filter(a => a.author_id !== authorId);
            selectedInDialogId = null;
            renderDialogAuthors();
            updateRemoveBtnState();
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

        // If editing, load book data
        if (bookId) {
            const bookRes = await fetch(`/api/books/${bookId}`);
            const bookData = await bookRes.json();
            titleInput.value = bookData.title;
            assignedAuthors = bookData.authors;
            renderDialogAuthors();
            updateRemoveBtnState();
            
            bookData.listIds.forEach(id => {
                const cb = editorRoot.querySelector(`input[name="book_list"][value="${id}"]`);
                if (cb) cb.checked = true;
            });
        }

        addAuthorBtn.addEventListener('click', () => {
            if (authorSelect.value === '') {
                alert('Bitte einen Autor auswählen.');
                return;
            }
            const authorId = Number(authorSelect.value);
            if (!Number.isInteger(authorId)) {
                alert('Bitte einen gültigen Autor auswählen.');
                return;
            }
            const author = allAuthors.find(a => a.author_id === authorId);
            if (!author) {
                alert('Ausgewählter Autor nicht gefunden.');
                return;
            }
            if (author && !assignedAuthors.find(a => a.author_id === authorId)) {
                assignedAuthors.push(author);
                renderDialogAuthors();
                updateRemoveBtnState();
            } else {
                alert('Dieser Autor ist bereits zugewiesen.');
            }
        });

        removeAuthorBtn.addEventListener('click', () => {
            if (selectedInDialogId !== null) {
                removeAssignedAuthor(selectedInDialogId);
            } else {
                alert('Bitte einen Autor auswählen.');
            }
        });

        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            removeEditor(rootElement);
        });

        confirmBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const title = titleInput.value.trim();
            if (!title || title.length < 2) return alert('Bitte einen gültigen Titel eingeben.');
            if (assignedAuthors.length === 0) return alert('Ein Buch muss mindestens einen Autor haben.');

            const checkedLists = Array.from(editorRoot.querySelectorAll('input[name="book_list"]:checked')).map(cb => parseInt(cb.value));
            if (checkedLists.length === 0) return alert('Bitte wählen Sie mindestens eine Liste aus.');

            const authorIds = assignedAuthors.map(a => a.author_id);
            
            // Check for duplicate
            const checkRes = await fetch(`/api/books/check-duplicate?title=${encodeURIComponent(title)}&authorIds=${JSON.stringify(authorIds)}`);
            const checkData = await checkRes.json();
            
            // If duplicate exists and it's either a new book or a different book being edited
            if (checkData.duplicate && (!bookId || checkData.book_id !== bookId)) {
                alert('Ein Buch mit diesem Titel und diesen Autoren existiert bereits.');
                return;
            }

            const method = bookId ? 'PUT' : 'POST';
            const url = bookId ? `/api/books/${bookId}` : '/api/books';

            const saveRes = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, authorIds, listIds: checkedLists })
            });

            if (saveRes.ok) {
                const books = await fetchBooks();
                renderBooksTable(rootElement, books);
                removeEditor(rootElement);
            } else {
                const err = await saveRes.json();
                alert(err.error || 'Fehler beim Speichern.');
            }
        });
    } catch (e) {
        console.error(e);
    }
}

async function setEditorMode(rootElement, mode) {
    if (mode === 'edit') {
        if (!selectedBookId) {
            alert('Bitte ein Buch auswählen.');
            return;
        }
        await renderBookEditor(rootElement, 'edit', selectedBookId);
    } else {
        await renderBookEditor(rootElement, 'create');
    }
}

function handleBookActions(event) {
    const actionButton = event.target.closest('[data-book-action]');
    if (!actionButton) return;
    const rootElement = event.currentTarget;
    if (actionButton.dataset.bookAction === 'create') {
        setEditorMode(rootElement, 'create');
    }
    if (actionButton.dataset.bookAction === 'edit') {
        setEditorMode(rootElement, 'edit');
    }
    if (actionButton.dataset.bookAction === 'delete') {
        deleteSelectedBook(rootElement);
    }
}
