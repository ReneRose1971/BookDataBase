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
        const assignedTableBody = dialog.querySelector('#assignedAuthorsTable tbody');
        const confirmBtn = dialog.querySelector('button[value="confirm"]');
        const cancelBtn = dialog.querySelector('button[value="cancel"]');

        let assignedAuthors = [];

        // Load authors for dropdown
        const authorsRes = await fetch('/api/authors');
        const authors = await authorsRes.json();
        authorSelect.innerHTML = authors.map(a => `<option value="${a.author_id}">${a.first_name} ${a.last_name}</option>`).join('');

        addAuthorBtn.addEventListener('click', () => {
            const authorId = parseInt(authorSelect.value);
            const author = authors.find(a => a.author_id === authorId);
            if (author && !assignedAuthors.find(a => a.author_id === authorId)) {
                assignedAuthors.push(author);
                renderAssignedAuthors(assignedTableBody, assignedAuthors);
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
            if (assignedAuthors.length === 0) return alert('Bitte mindestens einen Autor hinzufügen.');

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
                body: JSON.stringify({ title, authorIds })
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

function renderAssignedAuthors(tbody, authors) {
    tbody.innerHTML = authors.map(a => `
        <tr data-id="${a.author_id}">
            <td>${a.first_name}</td>
            <td>${a.last_name}</td>
        </tr>
    `).join('');
    
    tbody.querySelectorAll('tr').forEach(row => {
        row.style.cursor = 'pointer';
        row.title = 'Klicken zum Entfernen';
        row.onclick = () => {
            const id = parseInt(row.dataset.id);
            const index = authors.findIndex(a => a.author_id === id);
            if (index > -1) {
                authors.splice(index, 1);
                renderAssignedAuthors(tbody, authors);
            }
        };
    });
}