import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { loadViewInto } from '../view-loader.js';

let rootElement = null;
let titleElement = null;
let bodyElement = null;
let closeButton = null;
let backdropElement = null;
let openDisposables = null;
let childViewHandle = null;
let triggerElement = null;
let onCloseCallback = null;
let isOpen = false;

export function mount(ctx) {
    rootElement = ctx.root || ctx;
    titleElement = rootElement.querySelector('[data-modal-title]');
    bodyElement = rootElement.querySelector('[data-modal-body]');
    closeButton = rootElement.querySelector('[data-modal-close]');
    backdropElement = rootElement.querySelector('[data-modal-backdrop]');
}

export function unmount() {
    close({ skipFocusRestore: true, skipOnClose: true });
    rootElement = null;
    titleElement = null;
    bodyElement = null;
    closeButton = null;
    backdropElement = null;
}

export async function open({ title, childViewName, context = {}, onClose, triggerEl } = {}) {
    if (!rootElement || !bodyElement) {
        throw new Error('Modal root element missing.');
    }

    if (!childViewName) {
        throw new Error('childViewName missing for modal.');
    }

    if (isOpen) {
        close({ skipFocusRestore: true, skipOnClose: true });
    }

    isOpen = true;
    triggerElement = triggerEl || null;
    onCloseCallback = typeof onClose === 'function' ? onClose : null;

    if (titleElement) {
        titleElement.textContent = title || '';
    }

    document.body.classList.add('modal-open');

    openDisposables = createDisposables();

    if (closeButton) {
        openDisposables.add(addEvent(closeButton, 'click', () => close()));
    }

    if (backdropElement) {
        openDisposables.add(addEvent(backdropElement, 'click', () => close()));
    }

    openDisposables.add(addEvent(document, 'keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    }));

    if (childViewHandle) {
        childViewHandle.dispose();
        childViewHandle = null;
    }

    bodyElement.innerHTML = '';

    childViewHandle = await loadViewInto({
        targetEl: bodyElement,
        viewPath: `/views/${childViewName}.view.html`,
        controllerPath: `/controllers/${childViewName}.controller.js`,
        context: {
            ...context,
            modal: {
                close
            }
        }
    });

    focusFirstElement();
}

export function close({ skipFocusRestore = false, skipOnClose = false } = {}) {
    if (!isOpen) return;
    isOpen = false;

    if (openDisposables) {
        openDisposables.disposeAll();
        openDisposables = null;
    }

    if (childViewHandle) {
        childViewHandle.dispose();
        childViewHandle = null;
    }

    if (bodyElement) {
        bodyElement.innerHTML = '';
    }

    document.body.classList.remove('modal-open');

    if (rootElement && rootElement.parentNode) {
        rootElement.parentNode.removeChild(rootElement);
    }

    if (!skipFocusRestore && triggerElement && typeof triggerElement.focus === 'function') {
        triggerElement.focus();
    }

    const callback = onCloseCallback;
    onCloseCallback = null;
    triggerElement = null;

    if (!skipOnClose && callback) {
        callback();
    }
}

function focusFirstElement() {
    if (!bodyElement) return;
    const focusTarget = bodyElement.querySelector('input, select, textarea, button, [tabindex]:not([tabindex="-1"])');
    if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus();
    } else if (closeButton && typeof closeButton.focus === 'function') {
        closeButton.focus();
    }
}
