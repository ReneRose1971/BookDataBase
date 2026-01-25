import { enableSingleRowSelection } from '../ui-helpers.js';
import { openEditor, closeEditor } from '../editor-runtime/editor-composer.js';
import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { createJoinChildTableController } from '../editor-runtime/join-child-table.js';

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
    let assignedLists = [];
    let assignedTags = [];

    let allAuthors = [];
    let allLists = [];
    let allTags = [];

    let authorsById = new Map();
    let listsById = new Map();
    let tagsById = new Map();

    let bookData = null;

    const getAuthorId = (author) => author.author_id ?? author.id ?? author.authorId ?? author.AuthorId;
    const getListId = (list) => list.book_list_id ?? list.id ?? list.bookListId ?? list.BookListId;
    const getTagId = (tag) => tag.tag_id ?? tag.id ?? tag.tagId ?? tag.TagId;

    const handleCancel = (event) => {
        event.preventDefault();
        removeEditor();
    };

    const handleConfirm = async (event) => {
        event.preventDefault();
        const title = titleInput.value.trim();
        if (!title || title.length < 2) return alert('Bitte einen gültigen Titel eingeben.');
        if (assignedAuthors.length === 0) return alert('Ein Buch muss mindestens einen Autor haben.');
        if (assignedLists.length === 0) return alert('Bitte wählen Sie mindestens eine Liste aus.');

        const authorIds = assignedAuthors.map(a => getAuthorId(a));
        const listIds = assignedLists.map(l => getListId(l));
        const tagIds = assignedTags.map(t => getTagId(t)).filter(id => id !== undefined && id !== null);

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
            body: JSON.stringify({ title, authorIds, listIds, tagIds })
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
    const authorsHost = editorRoot.querySelector('[data-editor-part="book-authors"]');
    const listsHost = editorRoot.querySelector('[data-editor-part="book-lists"]');
    const tagsHost = editorRoot.querySelector('[data-editor-part="book-tags"]');

    const fetches = [
        fetch('/api/authors'),
        fetch('/api/book-lists'),
        fetch('/api/tags')
    ];

    if (bookId) {
        fetches.push(fetch(`/api/books/${bookId}`));
    }

    const [authorsRes, listsRes, tagsRes, bookRes] = await Promise.all(fetches);
    allAuthors = await authorsRes.json();
    const listsData = await listsRes.json();
    allLists = listsData.items || [];
    allTags = await tagsRes.json();

    if (bookId && bookRes) {
        bookData = await bookRes.json();
    }

    authorsById = new Map(
        allAuthors
            .map((author) => [getAuthorId(author), author])
            .filter(([id]) => id !== undefined && id !== null)
            .map(([id, author]) => [String(id), author])
    );

    listsById = new Map(
        allLists
            .map((list) => [getListId(list), list])
            .filter(([id]) => id !== undefined && id !== null)
            .map(([id, list]) => [String(id), list])
    );

    tagsById = new Map(
        allTags
            .map((tag) => [getTagId(tag), tag])
            .filter(([id]) => id !== undefined && id !== null)
            .map(([id, tag]) => [String(id), tag])
    );

    if (bookData) {
        if (titleInput) {
            titleInput.value = bookData.title || '';
        }
        assignedAuthors = Array.isArray(bookData.authors) ? bookData.authors : [];
        if (Array.isArray(bookData.listIds)) {
            assignedLists = allLists.filter((list) => bookData.listIds.includes(getListId(list)));
        }
        if (Array.isArray(bookData.tagIds)) {
            assignedTags = allTags.filter((tag) => bookData.tagIds.includes(getTagId(tag)));
        } else if (Array.isArray(bookData.tags)) {
            assignedTags = bookData.tags;
        }
    }

    const persistRelations = async (nextAuthors, nextLists) => {
        if (!bookId) return true;
        const title = titleInput.value.trim();
        if (!title || title.length < 2) {
            alert('Bitte einen gültigen Titel eingeben.');
            return false;
        }
        const authorIds = nextAuthors.map(a => getAuthorId(a)).filter(id => id !== undefined && id !== null);
        const listIds = nextLists.map(l => getListId(l)).filter(id => id !== undefined && id !== null);

        if (authorIds.length === 0) {
            alert('Ein Buch muss mindestens einen Autor haben.');
            return false;
        }
        if (listIds.length === 0) {
            alert('Bitte wählen Sie mindestens eine Liste aus.');
            return false;
        }

        const res = await fetch(`/api/books/${bookId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, authorIds, listIds })
        });

        if (!res.ok) {
            const err = await res.json();
            alert(err.error || 'Fehler beim Aktualisieren.');
            return false;
        }
        return true;
    };

    const joinContext = {
        bookId,
        mode
    };

    const authorsController = createJoinChildTableController({
        sectionLabel: 'Autoren',
        columns: [
            { header: 'Vorname', field: 'first_name' },
            { header: 'Nachname', field: 'last_name' }
        ],
        key: getAuthorId,
        formatOption: (author) => `${author.first_name} ${author.last_name}`,
        texts: {
            modalTitle: 'Autor auswählen',
            messages: {
                selectRequired: 'Bitte einen Autor auswählen.',
                duplicate: 'Dieser Autor ist bereits zugewiesen.',
                removeSelectRequired: 'Bitte einen Autor auswählen.',
                removeConfirm: 'Autor wirklich entfernen?'
            }
        },
        loadAssigned: async () => assignedAuthors,
        loadAvailable: async () => allAuthors,
        addRelation: async (ctx, authorKey) => {
            const author = authorsById.get(authorKey);
            if (!author) {
                alert('Ausgewählter Autor nicht gefunden.');
                return;
            }
            const nextAuthors = [...assignedAuthors, author];
            const persisted = await persistRelations(nextAuthors, assignedLists);
            if (!persisted) return;
            assignedAuthors = nextAuthors;
        },
        removeRelation: async (ctx, authorKey) => {
            const nextAuthors = assignedAuthors.filter(a => String(getAuthorId(a)) !== String(authorKey));
            if (bookId && nextAuthors.length === 0) {
                alert('Ein Buch muss mindestens einen Autor haben.');
                return;
            }
            const persisted = await persistRelations(nextAuthors, assignedLists);
            if (!persisted) return;
            assignedAuthors = nextAuthors;
        },
        confirmRemoveText: (author) => {
            if (!author) return 'Autor wirklich entfernen?';
            return `Autor ${author.first_name} ${author.last_name} wirklich entfernen?`;
        }
    });

    const listsController = createJoinChildTableController({
        sectionLabel: 'Bücherlisten',
        columns: [
            { header: 'Liste', field: 'name' }
        ],
        key: getListId,
        formatOption: (list) => list.name,
        texts: {
            modalTitle: 'Liste auswählen',
            messages: {
                selectRequired: 'Bitte eine Liste auswählen.',
                duplicate: 'Diese Liste ist bereits zugewiesen.',
                removeSelectRequired: 'Bitte eine Liste auswählen.',
                removeConfirm: 'Liste wirklich entfernen?'
            }
        },
        loadAssigned: async () => assignedLists,
        loadAvailable: async () => allLists,
        addRelation: async (ctx, listKey) => {
            const list = listsById.get(listKey);
            if (!list) {
                alert('Ausgewählte Liste nicht gefunden.');
                return;
            }
            const nextLists = [...assignedLists, list];
            const persisted = await persistRelations(assignedAuthors, nextLists);
            if (!persisted) return;
            assignedLists = nextLists;
        },
        removeRelation: async (ctx, listKey) => {
            const nextLists = assignedLists.filter(l => String(getListId(l)) !== String(listKey));
            if (bookId && nextLists.length === 0) {
                alert('Bitte wählen Sie mindestens eine Liste aus.');
                return;
            }
            const persisted = await persistRelations(assignedAuthors, nextLists);
            if (!persisted) return;
            assignedLists = nextLists;
        },
        confirmRemoveText: (list) => {
            if (!list) return 'Liste wirklich entfernen?';
            return `Liste "${list.name}" wirklich entfernen?`;
        }
    });

    const tagsController = createJoinChildTableController({
        sectionLabel: 'Tags',
        columns: [
            { header: 'Tag', field: 'name' }
        ],
        key: getTagId,
        formatOption: (tag) => tag.name,
        texts: {
            modalTitle: 'Tag auswählen',
            messages: {
                selectRequired: 'Bitte ein Tag auswählen.',
                duplicate: 'Dieses Tag ist bereits zugewiesen.',
                removeSelectRequired: 'Bitte ein Tag auswählen.',
                removeConfirm: 'Tag wirklich entfernen?'
            }
        },
        loadAssigned: async () => assignedTags,
        loadAvailable: async () => allTags,
        addRelation: async (ctx, tagKey) => {
            const tag = tagsById.get(tagKey);
            if (!tag) {
                alert('Ausgewähltes Tag nicht gefunden.');
                return;
            }
            const nextTags = [...assignedTags, tag];
            assignedTags = nextTags;
        },
        removeRelation: async (ctx, tagKey) => {
            const nextTags = assignedTags.filter(t => String(getTagId(t)) !== String(tagKey));
            assignedTags = nextTags;
        },
        confirmRemoveText: (tag) => {
            if (!tag) return 'Tag wirklich entfernen?';
            return `Tag "${tag.name}" wirklich entfernen?`;
        }
    });

    if (authorsHost) {
        await authorsController.mount(authorsHost, joinContext);
        editorDisposables.add(() => authorsController.dispose());
    }
    if (listsHost) {
        await listsController.mount(listsHost, joinContext);
        editorDisposables.add(() => listsController.dispose());
    }
    if (tagsHost) {
        await tagsController.mount(tagsHost, joinContext);
        editorDisposables.add(() => tagsController.dispose());
    }
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
    const action = actionButton.dataset.bookAction;
    switch (action) {
        case 'create':
            setEditorMode('create');
            break;
        case 'edit':
            setEditorMode('edit');
            break;
        case 'delete':
            deleteSelectedBook();
            break;
        default:
            break;
    }
}
