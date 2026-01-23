import { loadFragment } from '../view-loader.js';

let selectedAuthorId = null;
let cachedAuthors = [];
let editorMode = 'create';

export async function mount(rootElement) {
    // Fetch and render authors
    cachedAuthors = await fetchAuthors();
    renderAuthorsTable(rootElement, cachedAuthors);
    removeEditor(rootElement);

    // Bind click events for table rows
    rootElement.addEventListener('click', handleTableClick);
    rootElement.addEventListener('click', handleAuthorActions);
    rootElement.addEventListener('click', handleEditorActions);
}

export function unmount(rootElement) {
    // Clean up events and other resources
    rootElement.removeEventListener('click', handleTableClick);
    rootElement.removeEventListener('click', handleAuthorActions);
    rootElement.removeEventListener('click', handleEditorActions);
}

async function fetchAuthors() {
    try {
        const response = await fetch('/api/authors');
        if (!response.ok) {
            throw new Error('Failed to fetch authors');
        }
        const authors = await response.json();
        console.log('Fetched authors:', authors); // Debugging log
        return authors;
    } catch (error) {
        console.error('Error fetching authors:', error);
        return [];
    }
}

function renderAuthorsTable(rootElement, authors) {
    const tbody = rootElement.querySelector('tbody');
    if (!tbody) {
        console.error('Table body not found');
        return;
    }

    // Clear existing rows
    tbody.innerHTML = '';
    selectedAuthorId = null;

    // Populate table with authors
    authors.forEach(author => {
        const row = document.createElement('tr');
        row.dataset.authorId = String(author.author_id);
        row.innerHTML = `
            <td>${author.last_name}</td>
            <td>${author.first_name}</td>
            <td>${author.book_count || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

function handleTableClick(event) {
    const row = event.target.closest('tr');
    if (row && row.dataset.authorId) {
        selectedAuthorId = parseInt(row.dataset.authorId, 10);

        // Remove 'selected' class from all rows
        const rows = event.currentTarget.querySelectorAll('tr');
        rows.forEach(r => r.classList.remove('selected'));

        // Add 'selected' class to the clicked row
        row.classList.add('selected');
    }
}

async function setEditorMode(rootElement, mode) {
    if (mode === 'edit') {
        if (!selectedAuthorId) {
            alert('Bitte zuerst einen Autor auswählen.');
            return;
        }
        const selectedAuthor = cachedAuthors.find((author) => Number(author.author_id) === selectedAuthorId);
        if (!selectedAuthor) {
            alert('Ausgewählter Autor nicht gefunden.');
            return;
        }
        editorMode = mode;
        await renderEditor(rootElement, selectedAuthor.first_name, selectedAuthor.last_name);
    } else {
        editorMode = mode;
        await renderEditor(rootElement, '', '');
    }
}

function removeEditor(rootElement) {
    clearEditor(rootElement);
    editorMode = 'create';
}

function clearEditor(rootElement) {
    const slot = rootElement.querySelector('.author-editor-slot');
    if (slot) {
        slot.innerHTML = '';
    }
}

function isDuplicateAuthor(firstName, lastName, excludeAuthorId = null) {
    const normalizedFirst = firstName.trim().toLowerCase();
    const normalizedLast = lastName.trim().toLowerCase();
    return cachedAuthors.some((author) => {
        if (excludeAuthorId && Number(author.author_id) === excludeAuthorId) {
            return false;
        }
        return author.first_name.trim().toLowerCase() === normalizedFirst
            && author.last_name.trim().toLowerCase() === normalizedLast;
    });
}

async function renderEditor(rootElement, firstNameValue, lastNameValue) {
    const slot = rootElement.querySelector('.author-editor-slot');
    if (!slot) return;
    clearEditor(rootElement);
    const viewPath = editorMode === 'edit'
        ? '/views/author-edit.view.html'
        : '/views/author-create.view.html';
    try {
        await loadFragment(slot, viewPath);
    } catch (error) {
        console.error(error);
        alert('Autor-Editor konnte nicht geladen werden.');
        return;
    }
    const firstNameInput = rootElement.querySelector('#authorFirstNameInput');
    const lastNameInput = rootElement.querySelector('#authorLastNameInput');
    if (firstNameInput) firstNameInput.value = firstNameValue;
    if (lastNameInput) lastNameInput.value = lastNameValue;
    if (lastNameInput) lastNameInput.focus();
}

async function createAuthor(rootElement, firstName, lastName) {
    try {
        const response = await fetch('/api/authors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create author');
        }

        cachedAuthors = await fetchAuthors();
        renderAuthorsTable(rootElement, cachedAuthors);
        removeEditor(rootElement);
    } catch (error) {
        alert(error.message);
        console.error('Error creating author:', error);
    }
}

async function updateAuthor(rootElement, firstName, lastName) {
    try {
        const response = await fetch(`/api/authors/${selectedAuthorId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update author');
        }

        cachedAuthors = await fetchAuthors();
        renderAuthorsTable(rootElement, cachedAuthors);
        removeEditor(rootElement);
    } catch (error) {
        alert(error.message);
        console.error('Error updating author:', error);
    }
}

export async function deleteSelectedAuthor() {
    if (!selectedAuthorId) {
        alert('Kein Autor ausgewählt.');
        return;
    }

    const confirmDelete = confirm('Möchten Sie diesen Autor wirklich löschen?');
    if (!confirmDelete) {
        return;
    }

    try {
        const response = await fetch(`/api/authors/${selectedAuthorId}`, {
            method: 'DELETE'
        });

        if (response.status === 409) {
            const errorData = await response.json();
            alert(errorData.error);
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to delete author');
        }

        // Erfolg: Autorenliste neu laden und Auswahl zurücksetzen
        selectedAuthorId = null;
        cachedAuthors = await fetchAuthors();
        const currentView = document.querySelector('.view-wrapper-authors');
        if (currentView) {
            renderAuthorsTable(currentView, cachedAuthors);
            removeEditor(currentView);
        }
    } catch (error) {
        console.error('Error deleting author:', error);
        alert('Fehler beim Löschen des Autors.');
    }
}

function handleAuthorActions(event) {
    const actionButton = event.target.closest('[data-author-action]');
    if (!actionButton) return;
    const rootElement = event.currentTarget;
    if (actionButton.dataset.authorAction === 'create') {
        setEditorMode(rootElement, 'create');
    }
    if (actionButton.dataset.authorAction === 'edit') {
        setEditorMode(rootElement, 'edit');
    }
    if (actionButton.dataset.authorAction === 'delete') {
        deleteSelectedAuthor();
    }
}

async function handleConfirm(event, rootElement) {
    event.preventDefault();
    const firstNameInput = rootElement.querySelector('#authorFirstNameInput');
    const lastNameInput = rootElement.querySelector('#authorLastNameInput');
    if (!lastNameInput) return;
    const firstName = firstNameInput ? firstNameInput.value.trim() : '';
    const lastName = lastNameInput.value.trim();
    if (!lastName) {
        alert('Name ist erforderlich.');
        return;
    }

    if (editorMode === 'edit') {
        if (!selectedAuthorId) {
            alert('Bitte zuerst einen Autor auswählen.');
            return;
        }
        if (isDuplicateAuthor(firstName, lastName, selectedAuthorId)) {
            alert('Autor existiert bereits.');
            return;
        }
        await updateAuthor(rootElement, firstName, lastName);
    } else {
        if (isDuplicateAuthor(firstName, lastName)) {
            alert('Autor existiert bereits.');
            return;
        }
        await createAuthor(rootElement, firstName, lastName);
    }
}

function handleCancel(event, rootElement) {
    event.preventDefault();
    removeEditor(rootElement);
}

function handleEditorActions(event) {
    const actionButton = event.target.closest('[data-author-editor-action]');
    if (!actionButton) return;
    const rootElement = event.currentTarget;
    if (actionButton.dataset.authorEditorAction === 'confirm') {
        handleConfirm(event, rootElement);
    }
    if (actionButton.dataset.authorEditorAction === 'cancel') {
        handleCancel(event, rootElement);
    }
}
