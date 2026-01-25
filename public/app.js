import { loadViewAndController } from './view-loader.js';

const routes = {
    books: { controller: './controllers/books.controller.js', title: 'Bücher' },
    authors: { controller: './controllers/authors.controller.js', title: 'Autoren' },
    lists: { controller: './controllers/lists.controller.js', title: 'Listen' },
    tags: { controller: './controllers/tags.controller.js', title: 'Tags' },
    userConfig: { controller: './controllers/userConfig.controller.js', title: 'Konfiguration' },
    search: { controller: './controllers/search.controller.js', title: 'Büchersuche' }
};

document.querySelectorAll('.nav-button[data-view]').forEach(button => {
    button.addEventListener('click', () => {
        const viewName = button.dataset.view;
        const route = routes[viewName];
        if (route) {
            loadViewAndController(`/views/${viewName}.view.html`, route.controller, route.title);
        } else {
            console.error(`Route not found for view: ${viewName}`);
        }
    });
});
