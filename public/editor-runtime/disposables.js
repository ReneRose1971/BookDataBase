export function createDisposables() {
    const disposers = new Set();

    return {
        add(disposer) {
            if (typeof disposer === 'function') {
                disposers.add(disposer);
            } else if (disposer && typeof disposer.dispose === 'function') {
                const disposeWrapper = () => disposer.dispose();
                disposers.add(disposeWrapper);
            }
            return disposer;
        },
        disposeAll() {
            for (const disposer of Array.from(disposers)) {
                try {
                    disposer();
                } catch (error) {
                    console.warn('Disposer failed:', error);
                }
            }
            disposers.clear();
        }
    };
}

export function addEvent(element, type, handler, options) {
    if (!element) {
        return () => {};
    }
    element.addEventListener(type, handler, options);
    return () => element.removeEventListener(type, handler, options);
}

export function trackAbortController(disposables) {
    const controller = new AbortController();
    if (disposables) {
        disposables.add(() => controller.abort());
    }
    return controller;
}
