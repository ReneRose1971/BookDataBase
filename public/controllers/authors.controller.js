let selectedAuthorId = null;

export async function mount(rootElement) {
    // Fetch and render authors
    const authors = await fetchAuthors();
    renderAuthorsTable(rootElement, authors);

    // Bind click events for table rows
    rootElement.addEventListener('click', handleTableClick);

    // Bind click events for buttons
    const createButton = rootElement.querySelector('.button-group button:nth-child(1)');
    const editButton = rootElement.querySelector('.button-group button:nth-child(2)');
    const deleteButton = rootElement.querySelector('.button-group button:nth-child(3)');

    if (createButton) {
        createButton.addEventListener('click', openCreateAuthorDialog);
    }

    if (editButton) {
        editButton.addEventListener('click', openEditAuthorDialog);
    }

    if (deleteButton) {
        deleteButton.addEventListener('click', deleteSelectedAuthor);
    }
}

export function unmount(rootElement) {
    // Clean up events and other resources
    rootElement.removeEventListener('click', handleTableClick);

    // Unbind click events for buttons
    const createButton = rootElement.querySelector('.button-group button:nth-child(1)');
    const editButton = rootElement.querySelector('.button-group button:nth-child(2)');
    const deleteButton = rootElement.querySelector('.button-group button:nth-child(3)');

    if (createButton) {
        createButton.removeEventListener('click', openCreateAuthorDialog);
    }

    if (editButton) {
        editButton.removeEventListener('click', openEditAuthorDialog);
    }

    if (deleteButton) {
        deleteButton.removeEventListener('click', deleteSelectedAuthor);
    }

    const dialog = rootElement.querySelector('dialog');
    if (dialog) {
        dialog.remove();
    }
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

    // Populate table with authors
    authors.forEach(author => {
        const row = document.createElement('tr');
        row.dataset.authorId = author.author_id;
        row.innerHTML = `
            <td>${author.last_name}</td>
            <td>${author.first_name}</td>
            <td>${author.book_count || 0}</td>
        `;
        tbody.appendChild(row);
    });

    // Debugging log to confirm author_id values in table rows
    console.log('Table row author IDs:', Array.from(rootElement.querySelectorAll('tr')).map(row => row.dataset.authorId));
}

function handleTableClick(event) {
    const row = event.target.closest('tr');
    if (row && row.dataset.authorId) {
        selectedAuthorId = parseInt(row.dataset.authorId, 10);
        console.log(`Selected author ID: ${selectedAuthorId}`);

        // Remove 'selected' class from all rows
        const rows = event.currentTarget.querySelectorAll('tr');
        rows.forEach(r => r.classList.remove('selected'));

        // Add 'selected' class to the clicked row
        row.classList.add('selected');
    }
}

export async function openCreateAuthorDialog() {
    try {
        // 1. Dialog-HTML per fetch() laden
        const response = await fetch('/views/author-create.dialog.view.html');
        if (!response.ok) {
            throw new Error('Failed to load dialog HTML');
        }
        const dialogHTML = await response.text();

        // 2. In document.body einfügen
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = dialogHTML;
        const dialog = tempDiv.querySelector('dialog');
        if (!dialog) {
            throw new Error('Dialog element not found in loaded HTML');
        }
        document.body.appendChild(dialog);

        // Ensure the cancel button explicitly closes the dialog
        const cancelButton = dialog.querySelector('#cancelButton');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                dialog.close('cancel');
                dialog.remove();
                console.log('Dialog geschlossen und entfernt');
            });
        }

        // Ensure returnValue is set for the cancel button
        cancelButton.addEventListener('click', () => {
            dialog.returnValue = 'cancel';
        });

        // Debugging logs to verify dialog behavior
        console.log('Dialog initialized and shown');
        dialog.addEventListener('close', () => {
            console.log('Dialog closed with returnValue:', dialog.returnValue);
        });

        // 3. dialog.showModal() aufrufen
        dialog.showModal();

        // 4. Auf dialog.close warten
        await new Promise(resolve => {
            dialog.addEventListener('close', resolve, { once: true });
        });

        // 5. Wenn returnValue !== "confirm": Dialog entfernen, Ende
        if (dialog.returnValue !== 'confirm') {
            dialog.remove();
            return;
        }

        // 6. Werte lesen, trimmen, validieren
        const firstName = dialog.querySelector('#firstName')?.value.trim();
        const lastName = dialog.querySelector('#lastName')?.value.trim();
        
        if (!firstName || !lastName) {
            alert('Vorname und Nachname sind erforderlich.');
            dialog.remove();
            return;
        }

        // 7. POST /api/authors
        try {
            const response = await fetch('/api/authors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName, lastName })
            });

            if (response.status === 409) {
                alert('Autor existiert bereits.');
                dialog.remove();
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to create author');
            }

            // 8. Erfolg: Dialog schließen & entfernen, Autorenliste neu laden
            dialog.remove();
            const authors = await fetchAuthors();
            const authorsTable = document.querySelector('table');
            if (authorsTable) {
                renderAuthorsTable(authorsTable, authors);
            }
        } catch (error) {
            console.error('Error creating author:', error);
            alert('Fehler beim Erstellen des Autors.');
            dialog.remove();
        }
    } catch (error) {
        console.error('Error handling create author dialog:', error);
    }
}

export async function openEditAuthorDialog() {
    if (!selectedAuthorId) {
        alert('Kein Autor ausgewählt.');
        return;
    }

    try {
        console.log('Fetching author data for ID:', selectedAuthorId);

        const response = await fetch(`/api/authors/${selectedAuthorId}`);
        if (!response.ok) {
            if (response.status === 404) {
                alert('Autor nicht gefunden. Bitte wählen Sie einen gültigen Autor aus.');
            } else {
                alert('Fehler beim Abrufen der Autorendaten.');
            }
            return;
        }

        const author = await response.json();
        console.log('First author keys:', Object.keys(author));

        // Open dialog and populate fields
        const dialogResponse = await fetch('/views/author-edit.dialog.view.html');
        if (!dialogResponse.ok) {
            throw new Error('Failed to load dialog HTML');
        }
        const dialogHTML = await dialogResponse.text();

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = dialogHTML;
        const dialog = tempDiv.querySelector('dialog');
        if (!dialog) {
            throw new Error('Dialog element not found in loaded HTML');
        }
        document.body.appendChild(dialog);

        const firstNameInput = dialog.querySelector('#firstName');
        const lastNameInput = dialog.querySelector('#lastName');
        if (firstNameInput && lastNameInput) {
            firstNameInput.value = author.first_name;
            lastNameInput.value = author.last_name;
        }

        // Set authorId as dataset attribute of the dialog
        dialog.dataset.authorId = selectedAuthorId;

        // Cancel button logic
        const cancelButton = dialog.querySelector('#cancelButton');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                dialog.close('cancel');
            });
        }

        // Confirm button logic
        const confirmButton = dialog.querySelector('[value="confirm"]');
        if (confirmButton) {
            confirmButton.addEventListener('click', async () => {
                const authorId = dialog.dataset.authorId;
                const formData = new FormData(dialog.querySelector('form'));
                const payload = Object.fromEntries(formData.entries());

                console.log('Author ID:', authorId);
                console.log('Payload:', payload);

                try {
                    const response = await fetch(`/api/authors/${authorId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });

                    if (!response.ok) {
                        throw new Error('Failed to update author');
                    }

                    dialog.close('confirm');

                    // Reload authors table
                    const authors = await fetchAuthors();
                    const authorsTable = document.querySelector('table');
                    renderAuthorsTable(authorsTable, authors);
                } catch (error) {
                    console.error('Error updating author:', error);
                }
            });
        }

        dialog.showModal();

        await new Promise(resolve => {
            dialog.addEventListener('close', resolve, { once: true });
        });

        if (dialog.returnValue !== 'confirm') {
            dialog.remove();
            return;
        }

        const updatedFirstName = firstNameInput.value.trim();
        const updatedLastName = lastNameInput.value.trim();
        if (!updatedFirstName || !updatedLastName) {
            alert('Vorname und Nachname sind erforderlich.');
            dialog.remove();
            return;
        }

        const updateResponse = await fetch(`/api/authors/${selectedAuthorId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: updatedFirstName, lastName: updatedLastName })
        });

        console.log('Selected author ID:', selectedAuthorId);
        console.log('Server response:', updateResponse);

        if (!updateResponse.ok) {
            alert('Fehler beim Aktualisieren des Autors.');
        }

        dialog.remove();
    } catch (error) {
        console.error('Error handling edit author dialog:', error);
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

    console.log('Deleting author with ID:', selectedAuthorId);

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
        const authors = await fetchAuthors();
        
        // Find the current view container (where the table is actually located)
        const currentView = document.querySelector('.view-wrapper-authors');
        if (currentView) {
            renderAuthorsTable(currentView, authors);
        } else {
            console.error('Authors view container not found');
            // Fallback: try to find any table and render
            const anyTable = document.querySelector('table');
            if (anyTable) renderAuthorsTable(anyTable.closest('div'), authors);
        }
    } catch (error) {
        console.error('Error deleting author:', error);
        alert('Fehler beim Löschen des Autors.');
    }
}