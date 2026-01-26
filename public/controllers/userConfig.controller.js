import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { getJson, postJson, deleteJson, getErrorMessage } from '../api/api-client.js';

let openAiKeyStatus = false;
let googleBooksKeyStatus = false;
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
        const status = await getJson('/api/config/apis', { cache: 'no-store' });

        const openAiInput = rootElement.querySelector('#openai-api-key');
        const googleBooksInput = rootElement.querySelector('#googlebooks-api-key');
        const openAiStatus = rootElement.querySelector('#openai-status');
        const googleBooksStatus = rootElement.querySelector('#googlebooks-status');
        const openAiRemoveButton = rootElement.querySelector('[data-api-action="remove-openai"]');
        const googleBooksRemoveButton = rootElement.querySelector('[data-api-action="remove-googlebooks"]');

        if (status.openai) {
            openAiStatus.textContent = 'Key gespeichert';
            openAiInput.placeholder = '(Key gespeichert)';
            openAiRemoveButton.disabled = false;
        } else {
            openAiStatus.textContent = 'Kein Key gespeichert';
            openAiInput.placeholder = 'API Key eingeben';
            openAiRemoveButton.disabled = true;
        }

        if (status.google_books) {
            googleBooksStatus.textContent = 'Key gespeichert';
            googleBooksInput.placeholder = '(Key gespeichert)';
            googleBooksRemoveButton.disabled = false;
        } else {
            googleBooksStatus.textContent = 'Kein Key gespeichert';
            googleBooksInput.placeholder = 'API Key eingeben';
            googleBooksRemoveButton.disabled = true;
        }
    } catch (error) {
        displayError(rootElement, 'Fehler beim Laden des API-Status.');
    }
}

function updateUi(rootElement) {
    const openAiInput = rootElement.querySelector('#openai-api-key');
    const googleBooksInput = rootElement.querySelector('#googlebooks-api-key');

    if (openAiInput) {
        openAiInput.value = openAiKeyStatus ? 'SET' : '';
    } else {
        console.error('OpenAI input field not found');
    }

    if (googleBooksInput) {
        googleBooksInput.value = googleBooksKeyStatus ? 'SET' : '';
    } else {
        console.error('Google Books input field not found');
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
        case 'remove-google-books':
            await removeApiKey(rootElement, 'googlebooks');
            break;
        case 'cancel':
            resetUi(rootElement);
            break;
    }
}

async function saveApiKeys(rootElement) {
    const openAiInput = rootElement.querySelector('#openai-api-key');
    const googleBooksInput = rootElement.querySelector('#googlebooks-api-key');

    if (!openAiInput) {
        console.error("Missing element: openai-api-key");
        return;
    }

    if (!googleBooksInput) {
        console.error("Missing element: googlebooks-api-key");
        return;
    }

    const openAiKey = openAiInput.value.trim();
    const googleBooksKey = googleBooksInput.value.trim();

    if (!openAiKey && !googleBooksKey) {
        displayError(rootElement, 'Mindestens ein Key muss eingegeben werden.');
        return;
    }

    try {
        if (openAiKey) {
            await postJson('/api/config/apis/openai', { key: openAiKey });
        }

        if (googleBooksKey) {
            await postJson('/api/config/apis/googlebooks', { key: googleBooksKey });
        }

        openAiInput.value = '';
        googleBooksInput.value = '';
        await loadApiKeyStatus(rootElement);
    } catch (error) {
        displayError(rootElement, getErrorMessage(error, 'Fehler beim Speichern der API-Keys.'));
    }
}

async function removeApiKey(rootElement, keyType) {
    try {
        const endpoint = keyType === 'openai'
            ? '/api/config/apis/openai'
            : '/api/config/apis/googlebooks';
        await deleteJson(endpoint);
        await loadApiKeyStatus(rootElement);
    } catch (error) {
        displayError(rootElement, getErrorMessage(error, `Fehler beim Entfernen des ${keyType} API-Keys.`));
    }
}

function resetUi(rootElement) {
    const openAiInput = rootElement.querySelector('#openai-api-key');
    const googleBooksInput = rootElement.querySelector('#googlebooks-api-key');

    if (openAiInput) openAiInput.value = '';
    if (googleBooksInput) googleBooksInput.value = '';

    updateUi(rootElement);
}

function displayError(rootElement, message) {
    const errorElement = rootElement.querySelector('.error');
    if (errorElement) {
        errorElement.textContent = message;
    }
}
