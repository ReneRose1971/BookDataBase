import { enableSingleRowSelection } from '../ui-helpers.js';
import { openEditor, closeEditor } from '../editor-runtime/editor-composer.js';
import { createDisposables, addEvent } from '../editor-runtime/disposables.js';

let selectedBookId = null;
let editorMode = 'create';
let rootElement = null;
let disposables = null;
let editorDisposables = null;
let cachedLists = [];

export async function mount(ctx) {
    rootElement = ctx.root || ctx;
    disposables = createDisposables();

    const filterSelect = rootElement.querySelector('#booklistFilter');

    cachedLists = await fetchLists();

    if (filterSelect) {
        filterSelect.innerHTML = cachedLists.map(l => `<option value="${l.book_list_id}" ${l.name === 'Gelesene Bücher' ? 'selected' : ''}>${l.name}</option>`).join('');
        disposables.add(addEvent(filterSelect, 'change', async () => {
            const books = await fetchBooks(filterSelect.value);
            renderBooksTable(rootElement, books);
        }));
    }

    const initialListId = filterSelect ? filterSelect.value : null;
    const books = await fetchBooks(initialListId);
    renderBooksTable(rootElement, books);

    disposables.add(addEvent(rootElement, 'click', handleBookActions));

    const tbody = rootElement.querySelector('tbody');
    disposables.add(enableSingleRowSelection(tbody, (id) => {
        selectedBookId = Number(id);
    }));

    removeEditor();
}

export function unmount() {
    closeEditor();
    clearEditorDisposables();
    if (disposables) {
        disposables.disposeAll();
    }
    rootElement = null;
    selectedBookId = null;
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

async function fetchLists() {
    try {
        const listsRes = await fetch('/api/book-lists');
        const listsData = await listsRes.json();
        return listsData.items || [];
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
        <tr data-id="${book.book_id}" style="cursor: pointer;">
            <td>${book.title}</td>
            <td>${book.authors || ''}</td>
        </tr>
    `).join('');
}

async function deleteSelectedBook() {
    if (!selectedBookId) return alert('Bitte ein Buch auswählen.');
    if (!confirm('Buch wirklich löschen?')) return;

    try {
        const res = await fetch(`/api/books/${selectedBookId}`, { method: 'DELETE' });
        if (res.ok) {
            selectedBookId = null;
            const books = await fetchBooks();
            renderBooksTable(rootElement, books);
            removeEditor();
        } else {
            const errorText = await res.text();
            alert(`Fehler beim Löschen (${res.status}): ${errorText}`);
        }
    } catch (e) {
        alert(`Ein Fehler ist aufgetreten: ${e.message}`);
        console.error(e);
    }
}

function clearEditorDisposables() {
    if (editorDisposables) {
        editorDisposables.disposeAll();
        editorDisposables = null;
    }
}

function removeEditor() {
    closeEditor();
    clearEditorDisposables();
    editorMode = 'create';
}

async function renderBookEditor(mode, bookId = null) {
    editorMode = mode;
    const slot = rootElement.querySelector('.book-editor-slot');
    if (!slot) return;

    closeEditor();
    clearEditorDisposables();

    let assignedAuthors = [];
    let selectedInDialogId = null;
    let authorsById = new Map();

    const handleCancel = (event) => {
        event.preventDefault();
        removeEditor();
    };

    const handleConfirm = async (event) => {
        event.preventDefault();
        const title = titleInput.value.trim();
        if (!title || title.length < 2) return alert('Bitte einen gültigen Titel eingeben.');
        if (assignedAuthors.length === 0) return alert('Ein Buch muss mindestens einen Autor haben.');

        const checkedLists = Array.from(editorRoot.querySelectorAll('input[name="book_list"]:checked')).map(cb => parseInt(cb.value));
        if (checkedLists.length === 0) return alert('Bitte wählen Sie mindestens eine Liste aus.');

        const authorIds = assignedAuthors.map(a => getAuthorId(a));

        const checkRes = await fetch(`/api/books/check-duplicate?title=${encodeURIComponent(title)}&authorIds=${JSON.stringify(authorIds)}`);
        const checkData = await checkRes.json();

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
            removeEditor();
        } else {
            const err = await saveRes.json();
            alert(err.error || 'Fehler beim Speichern.');
        }
    };

    await openEditor({
        host: slot,
        manifestPath: '/editors/books.editor.json',
        mode,
        dataContext: { bookId },
        actions: {
            confirm: handleConfirm,
            cancel: handleCancel
        }
    });

    const editorRoot = slot.querySelector('.book-editor');
    if (!editorRoot) return;

    editorDisposables = createDisposables();

    const titleElement = editorRoot.querySelector('#bookEditorTitle');
    if (titleElement) {
        titleElement.textContent = mode === 'edit' ? 'Buch bearbeiten' : 'Neues Buch';
    }

    const titleInput = editorRoot.querySelector('#bookTitle');
    const authorSelect = editorRoot.querySelector('#authorSelect');
    const addAuthorBtn = editorRoot.querySelector('#addAuthorBtn');
    const removeAuthorBtn = editorRoot.querySelector('#removeAuthorBtn');
    const assignedTableBody = editorRoot.querySelector('#assignedAuthorsTable tbody');
    const listsGrid = editorRoot.querySelector('.lists-checkbox-grid');

    const [authorsRes, listsRes] = await Promise.all([
        fetch('/api/authors'),
        fetch('/api/book-lists')
    ]);
    const allAuthors = await authorsRes.json();
    const listsData = await listsRes.json();
    const bookLists = listsData.items || [];

    const getAuthorId = (author) => author.author_id ?? author.id ?? author.authorId ?? author.AuthorId;

    authorsById = new Map(
        allAuthors
            .map((author) => [getAuthorId(author), author])
            .filter(([id]) => id !== undefined && id !== null)
            .map(([id, author]) => [String(id), author])
    );

    authorSelect.innerHTML = [
        '<option value="">Bitte auswählen</option>',
        ...allAuthors.map(a => {
            const authorId = getAuthorId(a);
            return `<option value="${authorId}">${a.first_name} ${a.last_name}</option>`;
        })
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

    const renderDialogAuthors = () => {
        assignedTableBody.innerHTML = assignedAuthors.map(a => {
            const authorId = String(getAuthorId(a));
            const selectedClass = selectedInDialogId === authorId ? 'selected' : '';
            return `
                <tr data-id="${authorId}" class="${selectedClass}">
                    <td>${a.first_name}</td>
                    <td>${a.last_name}</td>
                </tr>
            `;
        }).join('');
    };

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

    editorDisposables.add(enableSingleRowSelection(assignedTableBody, (id) => {
        selectedInDialogId = id;
        updateRemoveBtnState();
    }));

    editorDisposables.add(addEvent(addAuthorBtn, 'click', () => {
        const selectedId = String(authorSelect.value).trim();
        if (selectedId === '') {
            alert('Bitte einen Autor auswählen.');
            return;
        }
        const author = authorsById.get(selectedId);
        if (!author) {
            alert('Ausgewählter Autor nicht gefunden.');
            return;
        }
        const alreadyAssigned = assignedAuthors.some(a => String(getAuthorId(a)) === selectedId);
        if (!alreadyAssigned) {
            assignedAuthors.push(author);
            renderDialogAuthors();
            updateRemoveBtnState();
        } else {
            alert('Dieser Autor ist bereits zugewiesen.');
        }
    }));

    editorDisposables.add(addEvent(removeAuthorBtn, 'click', () => {
        if (selectedInDialogId !== null) {
            assignedAuthors = assignedAuthors.filter(a => String(getAuthorId(a)) !== String(selectedInDialogId));
            selectedInDialogId = null;
            renderDialogAuthors();
            updateRemoveBtnState();
        } else {
            alert('Bitte einen Autor auswählen.');
        }
    }));
}

async function setEditorMode(mode) {
    if (mode === 'edit') {
        if (!selectedBookId) {
            alert('Bitte ein Buch auswählen.');
            return;
        }
        await renderBookEditor('edit', selectedBookId);
    } else {
        await renderBookEditor('create');
    }
}

function handleBookActions(event) {
    const actionButton = event.target.closest('[data-book-action]');
    if (!actionButton) return;
    if (actionButton.dataset.bookAction === 'create') {
        setEditorMode('create');
    }
    if (actionButton.dataset.bookAction === 'edit') {
        setEditorMode('edit');
    }
    if (actionButton.dataset.bookAction === 'delete') {
        deleteSelectedBook();
    }
}
