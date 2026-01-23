import { loadFragment } from './view-loader.js';

let editorRoot = null;
let editorMode = null;
let assignedAuthors = [];
let removedAuthorIds = new Set();
let selectedInDialogId = null;
let authorsById = new Map();

export async function openCreate(root, options) {
    editorMode = 'create';
    await renderEditor(root, options);
}

export async function openEdit(root, bookId, options) {
    editorMode = 'edit';
    await renderEditor(root, options, bookId);
}

export function close() {
    if (editorRoot) {
        editorRoot.innerHTML = '';
        editorRoot = null;
        editorMode = null;
        assignedAuthors = [];
        removedAuthorIds.clear();
        selectedInDialogId = null;
        authorsById.clear();
    }
}

export function unmount() {
    close();
}

async function renderEditor(root, options, bookId = null) {
    editorRoot = root.querySelector('.book-editor-slot');
    if (!editorRoot) return;

    close();

    try {
        await loadFragment(editorRoot, '/views/book-editor.view.html');
    } catch (error) {
        console.error('Failed to load book editor:', error);
        return;
    }

    const titleElement = editorRoot.querySelector('#bookEditorTitle');
    if (titleElement) {
        titleElement.textContent = editorMode === 'edit' ? 'Buch bearbeiten' : 'Neues Buch';
    }

    const titleInput = editorRoot.querySelector('#bookTitle');
    const authorSelect = editorRoot.querySelector('#authorSelect');
    const addAuthorBtn = editorRoot.querySelector('#addAuthorBtn');
    const removeAuthorBtn = editorRoot.querySelector('#removeAuthorBtn');
    const assignedTableBody = editorRoot.querySelector('#assignedAuthorsTable tbody');
    const listsGrid = editorRoot.querySelector('.lists-checkbox-grid');
    const confirmBtn = editorRoot.querySelector('[data-book-editor-action="confirm"]');
    const cancelBtn = editorRoot.querySelector('[data-book-editor-action="cancel"]');

    const { authors, lists } = options;
    authorsById = new Map(authors.map(author => [String(author.author_id), author]));

    authorSelect.innerHTML = [
        '<option value="">Bitte auswählen</option>',
        ...authors.map(a => `<option value="${a.author_id}">${a.first_name} ${a.last_name}</option>`)
    ].join('');

    listsGrid.innerHTML = lists.map(list => `
        <label style="display: flex; align-items: center; gap: 8px; font-weight: normal; margin-bottom: 0;">
            <input type="checkbox" name="book_list" value="${list.book_list_id}">
            ${list.name}
        </label>
    `).join('');

    if (bookId) {
        const book = options.books.find(b => b.book_id === bookId);
        if (book) {
            titleInput.value = book.title;
            assignedAuthors = book.authors;
            renderAssignedAuthors();

            book.listIds.forEach(id => {
                const checkbox = listsGrid.querySelector(`input[value="${id}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
    }

    // Bound events:
    // - click on add/remove author buttons
    // - click on confirm/cancel buttons

    addAuthorBtn.addEventListener('click', addAuthor);
    removeAuthorBtn.addEventListener('click', removeAuthor);
    confirmBtn.addEventListener('click', confirm);
    cancelBtn.addEventListener('click', cancel);

    function addAuthor() {
        const selectedId = authorSelect.value;
        if (!selectedId) return alert('Bitte einen Autor auswählen.');
        const author = authorsById.get(selectedId);
        if (!author) return alert('Autor nicht gefunden.');
        if (assignedAuthors.some(a => a.author_id === author.author_id)) {
            return alert('Autor bereits zugewiesen.');
        }
        assignedAuthors.push(author);
        renderAssignedAuthors();
    }

    function removeAuthor() {
        if (!selectedInDialogId) return;
        assignedAuthors = assignedAuthors.filter(a => a.author_id !== selectedInDialogId);
        renderAssignedAuthors();
    }

    function renderAssignedAuthors() {
        assignedTableBody.innerHTML = assignedAuthors.map(a => `
            <tr data-author-id="${a.author_id}">
                <td>${a.first_name}</td>
                <td>${a.last_name}</td>
            </tr>
        `).join('');
    }

    function confirm() {
        const title = titleInput.value.trim();
        if (!title) return alert('Titel ist erforderlich.');
        const selectedLists = Array.from(listsGrid.querySelectorAll('input:checked')).map(cb => cb.value);
        if (!selectedLists.length) return alert('Mindestens eine Liste auswählen.');
        console.log('Confirmed:', { title, assignedAuthors, selectedLists });
    }

    function cancel() {
        close();
    }
}