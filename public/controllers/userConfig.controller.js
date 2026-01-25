import { fetchJson } from '../ui-helpers.js';
import { createDisposables, addEvent } from '../editor-runtime/disposables.js';

let openAiKeyStatus = false;
let openLibraryKeyStatus = false;
let rootElement = null;
let disposables = null;

export async function mount(ctx) {
    rootElement = ctx.root || ctx;
    if (!(rootElement instanceof HTMLElement)) {
        console.error('Invalid rootElement passed to mount:', rootElement);
        return;
    }

    disposables = createDisposables();

    await loadApiKeyStatus(rootElement);

    disposables.add(addEvent(rootElement, 'click', handleButtonActions));
}

export function unmount() {
    if (disposables) {
        disposables.disposeAll();
    }
    rootElement = null;
}

async function loadApiKeyStatus(rootElement) {
    try {
        const status = await fetchJson('/api/config/apis');
        openAiKeyStatus = status.openai.present;
        openLibraryKeyStatus = status.openlibrary.present;

        updateUi(rootElement);
    } catch (error) {
        displayError(rootElement, 'Fehler beim Laden des API-Status.');
    }
}

function updateUi(rootElement) {
    const openAiInput = rootElement.querySelector('#openai-api-key');
    const openLibraryInput = rootElement.querySelector('#openlibrary-api-key');

    if (openAiInput) {
        openAiInput.value = openAiKeyStatus ? openAiKeyStatus : '';
    } else {
        console.error('OpenAI input field not found');
    }

    if (openLibraryInput) {
        openLibraryInput.value = openLibraryKeyStatus ? openLibraryKeyStatus : '';
    } else {
        console.error('Open Library input field not found');
    }
}

async function handleButtonActions(event) {
    const action = event.target.dataset.apiAction;
    if (!action) return;

    switch (action) {
        case 'save':
            await saveApiKeys(rootElement);
            break;
        case 'remove-openai':
            await removeApiKey(rootElement, 'openai');
            break;
        case 'remove-openlibrary':
            await removeApiKey(rootElement, 'openlibrary');
            break;
        case 'cancel':
            resetUi(rootElement);
            break;
    }
}

async function saveApiKeys(rootElement) {
    const openAiInput = rootElement.querySelector('#openai-api-key');
    const openLibraryInput = rootElement.querySelector('#openlibrary-api-key');

    const openAiKey = openAiInput.value.trim();
    const openLibraryKey = openLibraryInput.value.trim();

    if (!openAiKey && !openLibraryKey) {
        displayError(rootElement, 'Mindestens ein Key muss eingegeben werden.');
        return;
    }

    try {
        if (openAiKey) {
            await fetch('/api/config/apis/openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: openAiKey })
            });
        }

        if (openLibraryKey) {
            await fetch('/api/config/apis/openlibrary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: openLibraryKey })
            });
        }

        openAiInput.value = '';
        openLibraryInput.value = '';
        await loadApiKeyStatus(rootElement);
    } catch (error) {
        displayError(rootElement, 'Fehler beim Speichern der API-Keys.');
    }
}

async function removeApiKey(rootElement, keyType) {
    try {
        await fetch(`/api/api-keys/${keyType}`, { method: 'DELETE' });
        await loadApiKeyStatus(rootElement);
    } catch (error) {
        displayError(rootElement, `Fehler beim Entfernen des ${keyType} API-Keys.`);
    }
}

function resetUi(rootElement) {
    const openAiInput = rootElement.querySelector('#openai-api-key');
    const openLibraryInput = rootElement.querySelector('#openlibrary-api-key');

    if (openAiInput) openAiInput.value = '';
    if (openLibraryInput) openLibraryInput.value = '';

    updateUi(rootElement);
}

function displayError(rootElement, message) {
    const errorElement = rootElement.querySelector('.error');
    if (errorElement) {
        errorElement.textContent = message;
    }
}
