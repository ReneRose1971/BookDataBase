import { loadViewAndController } from './view-loader.js';

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
