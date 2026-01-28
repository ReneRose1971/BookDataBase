import { createDisposables, addEvent } from './disposables.js';
import { enableSingleRowSelection } from '../ui-helpers.js';
import { loadViewInto } from '../view-loader.js';

const DEFAULT_TEXTS = {
    addLabel: 'Einfügen',
    removeLabel: 'Entfernen',
    modalTitle: 'Eintrag auswählen',
    confirmLabel: 'Bestätigen',
    cancelLabel: 'Abbrechen',
    selectPlaceholder: 'Bitte auswählen',
    messages: {
        selectRequired: 'Bitte eine Auswahl treffen.',
        duplicate: 'Dieser Eintrag ist bereits zugewiesen.',
        removeSelectRequired: 'Bitte einen Eintrag auswählen.',
        removeConfirm: 'Eintrag wirklich entfernen?'
    }
};

export function createJoinChildTableController(config) {
    if (!config || typeof config !== 'object') {
        throw new Error('JoinChildTable: config is required.');
    }

    const resolvedTexts = {
        ...DEFAULT_TEXTS,
        ...(config.texts || {}),
        messages: {
            ...DEFAULT_TEXTS.messages,
            ...((config.texts && config.texts.messages) || {})
        }
    };

    const getKey = (item) => {
        if (!item) return '';
        const key = typeof config.key === 'function' ? config.key(item) : item[config.key];
        return key === undefined || key === null ? '' : String(key);
    };

    const getColumnValue = (item, column) => {
        if (!column) return '';
        if (typeof column.value === 'function') {
            return column.value(item);
        }
        if (column.field) {
            return item && item[column.field] !== undefined ? item[column.field] : '';
        }
        return '';
    };

    const getOptionLabel = (item) => {
        if (!item) return '';
        if (typeof config.formatOption === 'function') {
            return config.formatOption(item);
        }
        return getKey(item);
    };

    let root = null;
    let ctx = null;
    let disposables = null;
    let assignedItems = [];
    let availableItems = [];
    let selectedKey = null;

    let elements = null;
    let inlinePickerHandle = null;

    const inlineConfig = config.inlinePicker || null;
    const inlineEnabled = inlineConfig && inlineConfig.enabled;

    const cacheElements = () => {
        const label = root.querySelector('[data-join-label]');
        const tableHead = root.querySelector('[data-join-table-head]');
        const tableBody = root.querySelector('[data-join-table-body]');
        const addButton = root.querySelector('[data-join-action="add"]');
        const removeButton = root.querySelector('[data-join-action="remove"]');
        const inlineHost = root.querySelector('[data-inline-picker-host]');
        const modal = root.querySelector('[data-join-modal]');
        const modalTitle = root.querySelector('[data-join-modal-title]');
        const select = root.querySelector('[data-join-select]');
        const confirmButton = root.querySelector('[data-join-action="confirm"]');
        const cancelButton = root.querySelector('[data-join-action="cancel"]');

        elements = {
            label,
            tableHead,
            tableBody,
            addButton,
            removeButton,
            inlineHost,
            modal,
            modalTitle,
            select,
            confirmButton,
            cancelButton
        };
    };

    const renderHeader = () => {
        if (!elements.tableHead) return;
        elements.tableHead.innerHTML = '';
        const row = document.createElement('tr');
        (config.columns || []).forEach((column) => {
            const th = document.createElement('th');
            th.textContent = column && column.header ? column.header : '';
            row.appendChild(th);
        });
        elements.tableHead.appendChild(row);
    };

    const renderRows = () => {
        if (!elements.tableBody) return;
        elements.tableBody.innerHTML = '';
        assignedItems.forEach((item) => {
            const row = document.createElement('tr');
            const itemKey = getKey(item);
            row.dataset.id = itemKey;
            if (selectedKey && selectedKey === itemKey) {
                row.classList.add('selected');
            }
            (config.columns || []).forEach((column) => {
                const td = document.createElement('td');
                const value = getColumnValue(item, column);
                td.textContent = value !== undefined && value !== null ? String(value) : '';
                row.appendChild(td);
            });
            elements.tableBody.appendChild(row);
        });
    };

    const renderSelect = () => {
        if (!elements.select) return;
        elements.select.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = resolvedTexts.selectPlaceholder;
        elements.select.appendChild(placeholder);

        availableItems.forEach((item) => {
            const option = document.createElement('option');
            const itemKey = getKey(item);
            option.value = itemKey;
            option.textContent = String(getOptionLabel(item));
            elements.select.appendChild(option);
        });
    };

    const updateRemoveButton = () => {
        if (elements.removeButton) {
            elements.removeButton.disabled = !selectedKey;
        }
    };

    const openModal = () => {
        if (!elements.modal) return;
        renderSelect();
        elements.select.value = '';
        elements.modal.classList.remove('hidden');
    };

    const closeModal = () => {
        if (!elements.modal) return;
        elements.modal.classList.add('hidden');
    };

    const closeInlinePicker = () => {
        if (inlinePickerHandle) {
            inlinePickerHandle.dispose();
            if (inlineConfig && typeof inlineConfig.manager?.clearActive === 'function') {
                inlineConfig.manager.clearActive(inlinePickerHandle);
            }
            inlinePickerHandle = null;
        }
    };

    const openInlinePicker = async () => {
        if (!elements.inlineHost) return;
        if (inlineConfig && typeof inlineConfig.manager?.closeActive === 'function') {
            inlineConfig.manager.closeActive(inlinePickerHandle);
        }
        closeInlinePicker();
        await refreshAvailable();

        const viewPath = inlineConfig?.viewPath || '/views/pickers/inline-entity-picker.view.html';
        const controllerPath = inlineConfig?.controllerPath || '/controllers/inline-entity-picker.controller.js';
        const inlineContext = {
            items: availableItems.slice(),
            getKey,
            getLabel: getOptionLabel,
            texts: {
                title: resolvedTexts.modalTitle,
                confirmLabel: resolvedTexts.confirmLabel,
                cancelLabel: resolvedTexts.cancelLabel,
                selectPlaceholder: resolvedTexts.selectPlaceholder,
                messages: resolvedTexts.messages
            },
            onConfirm: async (selectedKey) => {
                await handleAddConfirm(selectedKey);
            },
            onCancel: () => {
                closeInlinePicker();
            }
        };

        inlinePickerHandle = await loadViewInto({
            targetEl: elements.inlineHost,
            viewPath,
            controllerPath,
            context: inlineContext
        });

        if (inlineConfig && typeof inlineConfig.manager?.setActive === 'function') {
            inlineConfig.manager.setActive(inlinePickerHandle);
        }
    };

    const refreshAssigned = async () => {
        assignedItems = (await config.loadAssigned(ctx)) || [];
        selectedKey = null;
        renderRows();
        updateRemoveButton();
    };

    const refreshAvailable = async () => {
        availableItems = (await config.loadAvailable(ctx)) || [];
        renderSelect();
    };

    const notifyChanged = async () => {
        if (typeof config.onChanged === 'function') {
            await config.onChanged(ctx, assignedItems.slice());
        }
    };

    const handleAddConfirm = async (valueOverride = null) => {
        const selectedValue = valueOverride !== null
            ? String(valueOverride || '')
            : (elements.select ? String(elements.select.value || '') : '');
        if (!selectedValue) {
            alert(resolvedTexts.messages.selectRequired);
            return;
        }
        const duplicate = assignedItems.some((item) => getKey(item) === selectedValue);
        if (duplicate) {
            alert(resolvedTexts.messages.duplicate);
            return;
        }
        if (typeof config.beforeAdd === 'function') {
            await config.beforeAdd(ctx, selectedValue);
        }
        await config.addRelation(ctx, selectedValue);
        await refreshAssigned();
        await refreshAvailable();
        await notifyChanged();
        if (inlineEnabled) {
            closeInlinePicker();
        } else {
            closeModal();
        }
    };

    const handleRemoveConfirm = async () => {
        if (!selectedKey) {
            alert(resolvedTexts.messages.removeSelectRequired);
            return;
        }
        const selectedItem = assignedItems.find((item) => getKey(item) === selectedKey);
        const confirmText = typeof config.confirmRemoveText === 'function'
            ? config.confirmRemoveText(selectedItem)
            : resolvedTexts.messages.removeConfirm;
        if (!confirm(confirmText)) {
            return;
        }
        if (typeof config.beforeRemove === 'function') {
            await config.beforeRemove(ctx, selectedKey);
        }
        await config.removeRelation(ctx, selectedKey);
        await refreshAssigned();
        await refreshAvailable();
        await notifyChanged();
    };

    const handleClick = async (event) => {
        const target = event.target;
        if (!target) return;
        const actionElement = target.closest('[data-join-action]');
        if (!actionElement || !root.contains(actionElement)) return;
        const action = actionElement.dataset.joinAction;
        switch (action) {
            case 'add':
                if (inlineEnabled) {
                    await openInlinePicker();
                } else {
                    openModal();
                }
                break;
            case 'remove':
                await handleRemoveConfirm();
                break;
            case 'confirm':
                await handleAddConfirm();
                break;
            case 'cancel':
                closeModal();
                break;
            case 'close':
                if (elements.modal && event.target === elements.modal) {
                    closeModal();
                }
                break;
            default:
                break;
        }
    };

    const mount = async (host, context = {}) => {
        if (!host) {
            throw new Error('JoinChildTable: host is required.');
        }
        root = host;
        ctx = context;
        disposables = createDisposables();

        cacheElements();
        if (elements.inlineHost && inlineConfig && inlineConfig.hostKey) {
            elements.inlineHost.dataset.inlinePickerHost = inlineConfig.hostKey;
        }

        if (elements.label) {
            elements.label.textContent = config.sectionLabel || resolvedTexts.sectionLabel || '';
        }
        if (elements.addButton) {
            elements.addButton.textContent = resolvedTexts.addLabel;
        }
        if (elements.removeButton) {
            elements.removeButton.textContent = resolvedTexts.removeLabel;
            elements.removeButton.disabled = true;
        }
        if (elements.modalTitle) {
            elements.modalTitle.textContent = resolvedTexts.modalTitle;
        }
        if (elements.confirmButton) {
            elements.confirmButton.textContent = resolvedTexts.confirmLabel;
        }
        if (elements.cancelButton) {
            elements.cancelButton.textContent = resolvedTexts.cancelLabel;
        }

        renderHeader();

        await refreshAssigned();
        await refreshAvailable();

        if (elements.tableBody) {
            disposables.add(enableSingleRowSelection(elements.tableBody, (id) => {
                selectedKey = id;
                updateRemoveButton();
            }));
        }
        disposables.add(addEvent(root, 'click', handleClick));

        return {
            dispose
        };
    };

    const dispose = () => {
        closeInlinePicker();
        if (disposables) {
            disposables.disposeAll();
        }
        disposables = null;
        root = null;
        ctx = null;
        assignedItems = [];
        availableItems = [];
        selectedKey = null;
    };

    const getAssignedItems = () => assignedItems.slice();

    return {
        mount,
        dispose,
        getAssignedItems
    };
}
