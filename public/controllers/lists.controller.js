let selectedListId = null;

export async function mount(rootElement) {
    // Fetch and render lists
    const lists = await fetchLists();
    renderListsTable(rootElement, lists);

    // Bind click events for table rows
    rootElement.addEventListener('click', handleTableClick);

    // Bind click events for buttons
    const createButton = rootElement.querySelector('.button-group button:nth-child(1)');
    const editButton = rootElement.querySelector('.button-group button:nth-child(2)');
    const deleteButton = rootElement.querySelector('.button-group button:nth-child(3)');

    if (createButton) {
        createButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openCreateListDialog();
        });
    }

    if (editButton) {
        editButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openEditListDialog(rootElement);
        });
    }

    if (deleteButton) {
        deleteButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteSelectedList(rootElement);
        });
    }
}

export function unmount(rootElement) {
    // Clean up events and other resources
    rootElement.removeEventListener('click', handleTableClick);

    // Dialog cleanup
    const dialogs = document.querySelectorAll('body > dialog');
    dialogs.forEach(d => d.remove());
}

async function fetchLists() {
    try {
        const response = await fetch('/api/book-lists');
        if (!response.ok) {
            throw new Error('Failed to fetch lists');
        }
        const { items } = await response.json();
        return items;
    } catch (error) {
        console.error('Error fetching lists:', error);
        return [];
    }
}

function renderListsTable(rootElement, lists) {
    const tbody = rootElement.querySelector('tbody');
    if (!tbody) {
        console.error('Table body not found');
        return;
    }

    // Clear existing rows
    tbody.innerHTML = '';

    // Populate table with lists
    lists.forEach(list => {
        const row = document.createElement('tr');
        row.dataset.bookListId = list.book_list_id;
        row.innerHTML = `
            <td>${list.name}</td>
            <td>${list.is_standard ? 'Ja' : 'Nein'}</td>
            <td>${list.book_count || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

function handleTableClick(event) {
    const row = event.target.closest('tr');
    if (row && row.dataset.bookListId) {
        selectedListId = parseInt(row.dataset.bookListId, 10);

        // Remove 'selected' class from all rows
        const rows = event.currentTarget.querySelectorAll('tr');
        rows.forEach(r => r.classList.remove('selected'));

        // Add 'selected' class to the clicked row
        row.classList.add('selected');
    }
}

async function openCreateListDialog() {
    try {
        const response = await fetch('/views/list-create.dialog.view.html');
        if (!response.ok) {
            throw new Error('Failed to load dialog HTML');
        }
        const dialogHTML = await response.text();

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = dialogHTML;
        const dialog = tempDiv.querySelector('dialog');
        if (!dialog) {
            throw new Error('Dialog element not found in loaded HTML');
        }
        document.body.appendChild(dialog);

        const confirmButton = dialog.querySelector('button[value="confirm"]');
        const cancelButton = dialog.querySelector('button[value="cancel"]');
        const nameInput = dialog.querySelector('#name');

        dialog.showModal();

        if (cancelButton) {
            cancelButton.addEventListener('click', (e) => {
                e.preventDefault();
                dialog.close();
                dialog.remove();
            });
        }

        if (confirmButton) {
            confirmButton.addEventListener('click', async (e) => {
                e.preventDefault();
                const name = nameInput.value.trim();

                if (!name) {
                    alert('Name ist erforderlich.');
                    return;
                }

                try {
                    const response = await fetch('/api/book-lists', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name })
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || 'Failed to create list');
                    }

                    const lists = await fetchLists();
                    const rootElement = document.querySelector('.view-wrapper-lists');
                    renderListsTable(rootElement, lists);
                    dialog.close();
                    dialog.remove();
                } catch (error) {
                    alert(error.message);
                    console.error('Error creating list:', error);
                }
            });
        }
    } catch (error) {
        console.error('Error opening create list dialog:', error);
    }
}

async function openEditListDialog(rootElement) {
    if (!selectedListId) {
        alert('Keine Liste ausgewählt.');
        return;
    }

    try {
        const response = await fetch(`/api/book-lists/${selectedListId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch list details');
        }
        const list = await response.json();

        if (list.item.is_standard) {
            alert('Standardlisten dürfen nicht bearbeitet werden.');
            return;
        }

        const dialogResponse = await fetch('/views/list-edit.dialog.view.html');
        if (!dialogResponse.ok) {
            throw new Error('Failed to load dialog HTML');
        }
        const dialogHTML = await dialogResponse.text();

        const dialogContainer = document.createElement('div');
        dialogContainer.innerHTML = dialogHTML;
        const dialogElement = dialogContainer.querySelector('dialog');
        document.body.appendChild(dialogElement);

        const confirmButton = dialogElement.querySelector('button[value="confirm"]');
        const cancelButton = dialogElement.querySelector('button[value="cancel"]');
        const nameInput = dialogElement.querySelector('#name');
        nameInput.value = list.item.name;

        dialogElement.showModal();

        if (cancelButton) {
            cancelButton.addEventListener('click', (e) => {
                e.preventDefault();
                dialogElement.close();
                dialogElement.remove();
            });
        }

        if (confirmButton) {
            confirmButton.addEventListener('click', async (e) => {
                e.preventDefault();
                const name = nameInput.value.trim();

                if (!name) {
                    alert('Name ist erforderlich.');
                    return;
                }

                try {
                    const response = await fetch(`/api/book-lists/${selectedListId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name })
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || 'Failed to update list');
                    }

                    const lists = await fetchLists();
                    renderListsTable(rootElement, lists);
                    dialogElement.close();
                    dialogElement.remove();
                } catch (error) {
                    alert(error.message);
                    console.error('Error updating list:', error);
                }
            });
        }
    } catch (error) {
        console.error('Error opening edit list dialog:', error);
    }
}

async function deleteSelectedList(rootElement) {
    if (!selectedListId) {
        alert('Keine Liste ausgewählt.');
        return;
    }

    if (!confirm('Möchten Sie diese Liste wirklich löschen?')) {
        return;
    }

    try {
        const response = await fetch(`/api/book-lists/${selectedListId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch list details');
        }
        const list = await response.json();

        if (list.item.is_standard) {
            alert('Standardlisten können nicht gelöscht werden.');
            return;
        }

        const deleteResponse = await fetch(`/api/book-lists/${selectedListId}`, {
            method: 'DELETE'
        });

        if (deleteResponse.status === 409) {
            const error = await deleteResponse.json();
            alert(error.error);
            return;
        }

        if (!deleteResponse.ok) {
            throw new Error('Failed to delete list');
        }

        selectedListId = null;
        const lists = await fetchLists();
        renderListsTable(rootElement, lists);
    } catch (error) {
        console.error('Error deleting list:', error);
    }
}