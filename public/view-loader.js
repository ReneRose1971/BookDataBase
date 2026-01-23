let currentController = null;

export async function loadFragment(target, fragmentPath) {
    const response = await fetch(fragmentPath);
    if (!response.ok) {
        throw new Error(`Failed to load fragment: ${fragmentPath}`);
    }
    const html = await response.text();
    target.innerHTML = html;
}

export async function loadFragments(rootElement) {
    const fragmentTargets = Array.from(rootElement.querySelectorAll('[data-fragment]'));
    await Promise.all(fragmentTargets.map(async (target) => {
        const fragmentPath = target.dataset.fragment;
        if (!fragmentPath) return;
        await loadFragment(target, fragmentPath);
    }));
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

        await loadFragments(contentElement);

        // Update the section headline
        const headlineElement = document.querySelector('.section-label-headline');
        if (headlineElement) {
            headlineElement.textContent = title || '';
        }

        // Load and mount the controller
        const module = await import(controllerPath);
        module.mount(contentElement);
        currentController = module;
    } catch (error) {
        console.error('Error loading view or controller:', error);
        const contentElement = document.querySelector('#content');
        if (contentElement) {
            contentElement.innerHTML = `<div style="color: red; font-weight: bold;">Fehler: ${error.message}</div>`;
        }
    }
}
