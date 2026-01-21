async function loadDataViews(rootElement = document) {
    // Find all elements with the data-view attribute that have not been loaded yet
    const viewElements = rootElement.querySelectorAll('[data-view]:not([data-view-loaded])');

    for (const element of viewElements) {
        const viewName = element.getAttribute('data-view');
        if (!viewName) {
            console.error('Element with [data-view] is missing a value:', element);
            continue;
        }

        try {
            // Fetch the corresponding view partial
            const response = await fetch(`/views/${viewName}.view.html`);
            if (!response.ok) {
                throw new Error(`Failed to load view: ${viewName} (HTTP ${response.status})`);
            }

            // Insert the fetched HTML into the element
            const html = await response.text();
            element.innerHTML = html;

            // Mark the element as loaded to prevent reloading
            element.setAttribute('data-view-loaded', 'true');

            // Recursively load nested views, with a depth limit
            const currentDepth = parseInt(element.getAttribute('data-view-depth') || '0', 10);
            if (currentDepth < 5) {
                element.setAttribute('data-view-depth', currentDepth + 1);
                await loadDataViews(element);
            } else {
                console.warn(`Max depth reached for nested views in element:`, element);
            }
        } catch (error) {
            console.error(`Error loading view '${viewName}':`, error);
        }
    }
}

// Expose the function globally
window.loadDataViews = loadDataViews;