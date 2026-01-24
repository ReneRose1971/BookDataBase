let currentController = null;

export async function loadFragment(target, fragmentPath) {
    if (!target) {
        console.error(`Target is null or undefined. Cannot load fragment: ${fragmentPath}`);
        displayError(`Fehler: Ziel-Element für Fragment '${fragmentPath}' nicht gefunden.`);
        return;
    }

    if (fragmentPath.endsWith('.view.html')) {
        console.error(`View-Pfad wurde fälschlich als Fragment verwendet: ${fragmentPath}`);
        displayError(`Fehler: View-Pfad wurde fälschlich als Fragment verwendet: ${fragmentPath}`);
        return;
    }

    try {
        const response = await fetch(fragmentPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch fragment: ${fragmentPath} (Status: ${response.status})`);
        }
        const html = await response.text();
        target.innerHTML = html;
    } catch (error) {
        console.error(`Error loading fragment '${fragmentPath}':`, error);
        displayError(`Fehler beim Laden des Fragments '${fragmentPath}': ${error.message}`);
    }
}

export async function loadFragments(rootElement) {
    if (!rootElement || !(rootElement instanceof HTMLElement)) {
        console.error('Invalid root element. Cannot load fragments.');
        displayError('Fehler: Ungültiges Root-Element für Fragmente.');
        return;
    }

    const fragmentTargets = rootElement.querySelectorAll('[data-fragment]');
    for (const target of fragmentTargets) {
        const fragmentPath = target.dataset.fragment;
        if (!fragmentPath) {
            console.warn('Skipping target with empty or undefined data-fragment attribute:', target);
            continue;
        }
        await loadFragment(target, fragmentPath);
    }
}

// Update the section headline dynamically based on the title field
export async function loadViewAndController(viewPath, controllerPath, title) {
    try {
        // Unmount the current controller if it exists
        if (currentController && typeof currentController.unmount === 'function') {
            currentController.unmount(document.querySelector('#content'));
        }
        currentController = null;

        // Load the view
        const response = await fetch(viewPath);
        if (!response.ok) throw new Error(`Failed to load view: ${viewPath}`);
        const html = await response.text();
        const contentElement = document.querySelector('#content');
        contentElement.innerHTML = html;

        // Load fragments within the loaded view
        await loadFragments(contentElement);

        // Update the section headline
        const headlineElement = document.querySelector('.section-label-headline');
        if (headlineElement) {
            headlineElement.textContent = title || '';
        }

        // Create context object
        const viewName = viewPath.split('/').pop().split('.').shift();
        const ctx = {
            root: contentElement,
            viewName,
            title,
            navigate: (view) => {
                const navButton = document.querySelector(`.nav-button[data-view="${view}"]`);
                if (navButton) navButton.click();
            }
        };

        // Load and mount the controller
        const module = await import(controllerPath);
        try {
            if (module.mount.length >= 1) {
                module.mount(ctx);
            } else {
                module.mount(ctx.root);
            }
        } catch (error) {
            console.warn('Controller mount failed with context, falling back to root:', error);
            module.mount(ctx.root);
        }
        currentController = module;
    } catch (error) {
        console.error('Error loading view or controller:', error);
        const contentElement = document.querySelector('#content');
        if (contentElement) {
            contentElement.innerHTML = `<div style="color: red; font-weight: bold;">Fehler: ${error.message}</div>`;
        }
    }
}

function displayError(message) {
    const content = document.querySelector('#content');
    if (content) {
        const errorArticle = document.createElement('article');
        errorArticle.style.color = 'red';
        errorArticle.textContent = message;
        content.appendChild(errorArticle);
    }
}
