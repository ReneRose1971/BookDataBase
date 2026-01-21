async function loadView(viewName, mountCallback) {
    const contentElement = document.getElementById("content");
    try {
        const response = await fetch(`/views/${viewName}.view.html`);
        if (!response.ok) {
            throw new Error(`Failed to load view: ${viewName}`);
        }
        const html = await response.text();
        contentElement.innerHTML = html;

        // Call the mount callback after the view is loaded
        if (typeof mountCallback === "function") {
            mountCallback(contentElement);
        }
    } catch (error) {
        console.error("Error loading view:", error);
        contentElement.innerHTML = `<p>Fehler beim Laden der Ansicht: ${viewName}</p>`;
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove("hidden");
    }
}

const viewControllerMap = {
    books: { view: '/views/books.view.html', controller: '/controllers/books.controller.js', title: 'Bücher' },
    authors: { view: '/views/authors.view.html', controller: '/controllers/authors.controller.js', title: 'Autoren' },
    lists: { view: '/views/lists.view.html', controller: '/controllers/lists.controller.js', title: 'Listen' },
    tags: { view: '/views/tags.view.html', controller: '/controllers/tags.controller.js', title: 'Tags' }
};

// Update the section headline dynamically based on the title field
async function loadViewAndController(viewPath, controllerPath, title) {
    try {
        // Load the view
        const response = await fetch(viewPath);
        if (!response.ok) throw new Error(`Failed to load view: ${viewPath}`);
        const html = await response.text();
        document.querySelector('#content').innerHTML = html;

        // Update the section headline
        const headlineElement = document.querySelector('.section-label-headline');
        if (headlineElement) {
            headlineElement.textContent = title || '';
        }

        // Load and mount the controller
        const module = await import(controllerPath);
        module.mount(document.querySelector('#content'));
    } catch (error) {
        console.error('Error loading view or controller:', error);
    }
}

document.querySelectorAll('.nav-button[data-view]').forEach(button => {
    button.addEventListener('click', async (event) => {
        const viewKey = event.target.dataset.view;
        if (viewControllerMap[viewKey]) {
            const { view, controller, title } = viewControllerMap[viewKey];
            await loadViewAndController(view, controller, title);
        } else {
            console.error(`No mapping found for view: ${viewKey}`);
        }
    });
});