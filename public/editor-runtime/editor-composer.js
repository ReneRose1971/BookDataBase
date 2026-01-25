import { createDisposables, addEvent } from './disposables.js';
import { loadHtml, loadPart } from './component-loader.js';

let activeEditor = null;

export async function openEditor({ host, manifestPath, mode = 'create', dataContext = {}, actions = {} }) {
    await closeEditor();

    if (!host) {
        throw new Error('Editor host element missing.');
    }

    const manifestResponse = await fetch(manifestPath);
    if (!manifestResponse.ok) {
        throw new Error(`Failed to load manifest: ${manifestPath}`);
    }
    const manifest = await manifestResponse.json();

    host.innerHTML = '';
    await loadHtml(host, manifest.shell);

    const disposables = createDisposables();
    const slots = {};

    const shellRoot = host.firstElementChild || host;

    if (manifest.slots) {
        for (const [slotName, parts] of Object.entries(manifest.slots)) {
            const slotElement = host.querySelector(`[data-editor-slot="${slotName}"]`);
            if (!slotElement) continue;
            slots[slotName] = slotElement;

            for (const part of parts) {
                const partContainer = document.createElement('div');
                if (part.name) {
                    partContainer.dataset.editorPart = part.name;
                }
                slotElement.appendChild(partContainer);
                await loadPart(partContainer, part, {
                    host,
                    shellRoot,
                    slotName,
                    manifest,
                    mode,
                    dataContext
                }, disposables);
            }
        }
    }

    let confirmBusy = false;

    const handleActions = async (event) => {
        const actionButton = event.target.closest('[data-editor-action]');
        if (!actionButton) return;
        const action = actionButton.dataset.editorAction;
        if (action === 'confirm' && typeof actions.confirm === 'function') {
            if (confirmBusy) return;
            confirmBusy = true;
            try {
                await actions.confirm(event);
            } catch (error) {
                console.error('Editor confirm action failed:', error);
            } finally {
                confirmBusy = false;
            }
            return;
        }
        if (action === 'cancel' && typeof actions.cancel === 'function') {
            try {
                await actions.cancel(event);
            } catch (error) {
                console.error('Editor cancel action failed:', error);
            }
        }
    };

    disposables.add(addEvent(host, 'click', handleActions));

    activeEditor = {
        host,
        disposables
    };

    return {
        host,
        root: shellRoot,
        slots,
        manifest,
        mode,
        dataContext
    };
}

export async function closeEditor() {
    if (!activeEditor) return;
    const { host, disposables } = activeEditor;
    disposables.disposeAll();
    if (host) {
        host.innerHTML = '';
    }
    activeEditor = null;
}
