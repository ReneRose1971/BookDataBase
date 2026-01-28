import { createDisposables, addEvent } from '../editor-runtime/disposables.js';
import { getJson, postJson, putJson, deleteJson, getErrorMessage } from '../api/api-client.js';

let openAiKeyStatus = false;
let googleBooksKeyStatus = false;
let rootElement = null;
let disposables = null;
let cachedPromptTemplates = null;

export async function mount(ctx) {
    rootElement = ctx.root || ctx;
    if (!(rootElement instanceof HTMLElement)) {
        console.error('Invalid rootElement passed to mount:', rootElement);
        return;
    }

    disposables = createDisposables();

    await loadApiKeyStatus(rootElement);
    await loadPromptTemplates(rootElement);

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

        const openAiPresent = Boolean(status?.openai?.present);
        const googleBooksPresent = Boolean(status?.google_books?.present);

        if (openAiPresent) {
            openAiStatus.textContent = 'Key vorhanden';
            openAiInput.placeholder = '(Key gespeichert)';
            openAiRemoveButton.disabled = false;
        } else {
            openAiStatus.textContent = 'Kein Key vorhanden';
            openAiInput.placeholder = 'API Key eingeben';
            openAiRemoveButton.disabled = true;
        }

        if (googleBooksPresent) {
            googleBooksStatus.textContent = 'Key vorhanden';
            googleBooksInput.placeholder = '(Key gespeichert)';
            googleBooksRemoveButton.disabled = false;
        } else {
            googleBooksStatus.textContent = 'Kein Key vorhanden';
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
    const promptAction = event.target.dataset.promptAction;
    if (action) {
        switch (action) {
            case 'save':
                await saveApiKeys(rootElement);
                break;
            case 'remove-openai':
                await removeApiKey(rootElement, 'openai');
                break;
            case 'remove-googlebooks':
                await removeApiKey(rootElement, 'googlebooks');
                break;
            case 'cancel':
                resetUi(rootElement);
                break;
        }
        return;
    }

    if (promptAction) {
        switch (promptAction) {
            case 'save':
                await savePromptTemplates(rootElement);
                break;
            case 'reset':
                resetPromptTemplates(rootElement);
                break;
        }
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

async function loadPromptTemplates(rootElement) {
    try {
        const prompts = await getJson('/api/config/prompts/book_summary', { cache: 'no-store' });
        cachedPromptTemplates = prompts;
        applyPromptTemplates(rootElement, prompts);
        setPromptStatus(rootElement, '');
    } catch (error) {
        setPromptStatus(rootElement, getErrorMessage(error, 'Fehler beim Laden der Prompt-Vorlagen.'));
    }
}

function applyPromptTemplates(rootElement, prompts) {
    const systemPrompt = rootElement.querySelector('#book-summary-system-prompt');
    const userPrompt = rootElement.querySelector('#book-summary-user-prompt');

    if (systemPrompt) {
        systemPrompt.value = prompts?.systemPrompt || '';
    }
    if (userPrompt) {
        userPrompt.value = prompts?.userPrompt || '';
    }
}

async function savePromptTemplates(rootElement) {
    const systemPrompt = rootElement.querySelector('#book-summary-system-prompt');
    const userPrompt = rootElement.querySelector('#book-summary-user-prompt');

    if (!systemPrompt || !userPrompt) {
        console.error('Prompt fields not found');
        return;
    }

    try {
        const payload = {
            systemPrompt: systemPrompt.value,
            userPrompt: userPrompt.value
        };
        const saved = await putJson('/api/config/prompts/book_summary', payload);
        cachedPromptTemplates = saved;
        applyPromptTemplates(rootElement, saved);
        setPromptStatus(rootElement, 'Prompt-Vorlagen gespeichert.');
    } catch (error) {
        setPromptStatus(rootElement, getErrorMessage(error, 'Fehler beim Speichern der Prompt-Vorlagen.'));
    }
}

function resetPromptTemplates(rootElement) {
    if (!cachedPromptTemplates) {
        setPromptStatus(rootElement, 'Keine Prompt-Vorlagen geladen.');
        return;
    }
    applyPromptTemplates(rootElement, cachedPromptTemplates);
    setPromptStatus(rootElement, 'Prompt-Vorlagen zurückgesetzt.');
}

function setPromptStatus(rootElement, message) {
    const statusElement = rootElement.querySelector('[data-prompt-status]');
    if (statusElement) {
        statusElement.textContent = message;
    }
}
