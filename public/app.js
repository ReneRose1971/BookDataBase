import { loadFragment } from './view-loader.js';

const routes = {
    books: { controller: './controllers/books.controller.js', title: 'Bücher' },
    authors: { controller: './controllers/authors.controller.js', title: 'Autoren' },
    lists: { controller: './controllers/lists.controller.js', title: 'Listen' },
    tags: { controller: './controllers/tags.controller.js', title: 'Tags' }
};

let currentController = null;

async function loadView(viewName) {
    const route = routes[viewName];
    if (!route) {
        console.error(`Route not found for view: ${viewName}`);
        return;
    }

    const { controller, title } = route;
    const container = document.querySelector('#app');

    if (currentController && currentController.unmount) {
        currentController.unmount();
    }

    try {
        const module = await import(controller);
        currentController = module;

        document.title = title;
        await loadFragment(container, `/views/${viewName}.view.html`);
        if (module.mount) {
            module.mount(container);
        }
    } catch (error) {
        console.error(`Failed to load view: ${viewName}`, error);
    }
}

document.querySelectorAll('.nav-button[data-view]').forEach(button => {
    button.addEventListener('click', () => {
        const viewName = button.dataset.view;
        loadView(viewName);
    });
});

// Load the default view on initial page load
loadView('books');
