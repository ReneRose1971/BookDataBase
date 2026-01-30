import { loadViewInto } from '../view-loader.js';

export function createSearchImportModalManager() {
    let activeModal = null;

    function closeActiveModal() {
        if (!activeModal) return;
        const modalController = activeModal?.controller;
        if (modalController && typeof modalController.close === 'function') {
            modalController.close({ skipFocusRestore: true, skipOnClose: true });
        }
        if (activeModal.dispose) {
            activeModal.dispose();
        }
        activeModal = null;
    }

    async function openImportModal({ childViewName, title, context, triggerEl }) {
        closeActiveModal();
        const modalHost = document.createElement('div');
        document.body.appendChild(modalHost);
        const modalHandle = await loadViewInto({
            targetEl: modalHost,
            viewPath: '/views/modal/modal-shell.view.html',
            controllerPath: '/controllers/modal-shell.controller.js'
        });
        const modalController = modalHandle?.controller;
        activeModal = modalHandle;
        if (modalController && typeof modalController.open === 'function') {
            await modalController.open({
                title,
                childViewName,
                context,
                triggerEl,
                onClose: () => {
                    if (activeModal?.dispose) {
                        activeModal.dispose();
                    }
                    activeModal = null;
                }
            });
        }
    }

    return {
        openImportModal,
        close: closeActiveModal
    };
}
