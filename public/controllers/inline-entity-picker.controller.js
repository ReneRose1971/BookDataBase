import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { notifySelectionRequired } from '../services/notify.service.js';

const DEFAULT_TEXTS = {
    title: 'Eintrag auswählen',
    confirmLabel: 'Bestätigen',
    cancelLabel: 'Abbrechen',
    selectPlaceholder: 'Bitte auswählen',
    messages: {
        selectRequired: 'Bitte eine Auswahl treffen.'
    }
};

export async function mount(ctx) {
    const root = ctx.root;
    const disposables = createDisposables();

    const titleEl = root.querySelector('[data-inline-title]');
    const searchRow = root.querySelector('[data-inline-search-row]');
    const searchInput = root.querySelector('[data-inline-search]');
    const selectEl = root.querySelector('[data-inline-select]');
    const confirmButton = root.querySelector('[data-inline-action="confirm"]');
    const cancelButton = root.querySelector('[data-inline-action="cancel"]');

    const texts = {
        ...DEFAULT_TEXTS,
        ...(ctx.texts || {}),
        messages: {
            ...DEFAULT_TEXTS.messages,
            ...((ctx.texts && ctx.texts.messages) || {})
        }
    };

    if (titleEl) {
        titleEl.textContent = texts.title || '';
    }
    if (confirmButton) {
        confirmButton.textContent = texts.confirmLabel;
    }
    if (cancelButton) {
        cancelButton.textContent = texts.cancelLabel;
    }

    if (searchRow && ctx.enableSearch) {
        searchRow.classList.remove('hidden');
    }

    const getKey = typeof ctx.getKey === 'function'
        ? ctx.getKey
        : (item) => item && item.id !== undefined ? String(item.id) : '';

    const getLabel = typeof ctx.getLabel === 'function'
        ? ctx.getLabel
        : (item) => (item && item.name !== undefined ? String(item.name) : getKey(item));

    const items = Array.isArray(ctx.items)
        ? ctx.items.slice()
        : (typeof ctx.loadItems === 'function' ? await ctx.loadItems() : []);

    const renderOptions = (filterText = '') => {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = texts.selectPlaceholder;
        selectEl.appendChild(placeholder);

        const normalizedFilter = filterText.trim().toLowerCase();
        items
            .filter((item) => {
                if (!normalizedFilter) return true;
                return getLabel(item).toLowerCase().includes(normalizedFilter);
            })
            .forEach((item) => {
                const option = document.createElement('option');
                option.value = getKey(item);
                option.textContent = getLabel(item);
                selectEl.appendChild(option);
            });
    };

    renderOptions();

    if (searchInput) {
        disposables.add(addEvent(searchInput, 'input', () => {
            renderOptions(searchInput.value || '');
        }));
    }

    const handleConfirm = async () => {
        const selectedValue = selectEl ? String(selectEl.value || '') : '';
        if (!selectedValue) {
            notifySelectionRequired(texts.messages.selectRequired);
            return;
        }
        const selectedItem = items.find((item) => getKey(item) === selectedValue) || null;
        if (typeof ctx.onConfirm === 'function') {
            await ctx.onConfirm(selectedValue, selectedItem);
        }
    };

    const handleCancel = async () => {
        if (typeof ctx.onCancel === 'function') {
            await ctx.onCancel();
        }
    };

    if (confirmButton) {
        disposables.add(addEvent(confirmButton, 'click', handleConfirm));
    }
    if (cancelButton) {
        disposables.add(addEvent(cancelButton, 'click', handleCancel));
    }

    return {
        dispose() {
            disposables.disposeAll();
        }
    };
}
