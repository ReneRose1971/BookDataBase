import * as configService from "../services/config.service.js";
import { getPrompt, savePrompt } from "../services/prompt.service.js";

const PROMPT_NAME = "book_summary";
const PROMPT_LIMITS = {
    system: { min: 20, max: 8000 },
    user: { min: 10, max: 8000 }
};

export async function getApiStatus(req, res) {
    try {
        const status = await configService.getStatus();
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'ETag': ''
        });
        res.json(status);
    } catch (error) {
        console.error('Error fetching API key status:', error);
        res.status(500).json({ error: 'Fehler beim Abrufen des API-Status.' });
    }
}

export async function saveOpenAiKey(req, res) {
    const { key } = req.body;
    if (!key) {
        return res.status(400).json({ error: 'Key darf nicht leer sein.' });
    }
    try {
        await configService.saveKey('openai', key);
        res.status(204).send();
    } catch (error) {
        console.error('Error saving OpenAI key:', error);
        res.status(500).json({ error: 'Fehler beim Speichern des OpenAI-Schlüssels.' });
    }
}

export async function saveGoogleBooksKey(req, res) {
    const { key } = req.body;
    if (!key) {
        return res.status(400).json({ error: 'Key darf nicht leer sein.' });
    }
    try {
        await configService.saveKey('google_books', key);
        res.status(204).send();
    } catch (error) {
        console.error('Error saving Google Books key:', error);
        res.status(500).json({ error: 'Fehler beim Speichern des Google Books-Schlüssels.' });
    }
}

export async function deleteOpenAiKey(req, res) {
    try {
        await configService.removeKey('openai');
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting OpenAI key:', error);
        res.status(500).json({ error: 'Fehler beim Entfernen des OpenAI-Schlüssels.' });
    }
}

export async function deleteGoogleBooksKey(req, res) {
    try {
        await configService.removeKey('google_books');
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting Google Books key:', error);
        res.status(500).json({ error: 'Fehler beim Löschen des Google Books-Schlüssels.' });
    }
}

function validatePromptField(value, { min, max }, label) {
    if (typeof value !== "string") {
        return `${label} muss Text sein.`;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return `${label} darf nicht leer sein.`;
    }
    if (trimmed.length < min) {
        return `${label} ist zu kurz (mindestens ${min} Zeichen).`;
    }
    if (trimmed.length > max) {
        return `${label} ist zu lang (maximal ${max} Zeichen).`;
    }
    return null;
}

export async function getBookSummaryPrompt(req, res) {
    try {
        const prompts = await getPrompt(PROMPT_NAME);
        res.json(prompts);
    } catch (error) {
        console.error('Error loading book summary prompt:', error);
        const status = error.status || 500;
        res.status(status).json({ error: 'Fehler beim Laden der Prompt-Vorlagen.' });
    }
}

export async function saveBookSummaryPrompt(req, res) {
    const { systemPrompt, userPrompt } = req.body;
    const systemError = validatePromptField(systemPrompt, PROMPT_LIMITS.system, 'System Prompt');
    if (systemError) {
        return res.status(400).json({ error: systemError });
    }
    const userError = validatePromptField(userPrompt, PROMPT_LIMITS.user, 'User Prompt');
    if (userError) {
        return res.status(400).json({ error: userError });
    }

    try {
        const saved = await savePrompt(PROMPT_NAME, {
            systemPrompt: systemPrompt.trim(),
            userPrompt: userPrompt.trim()
        });
        res.json(saved);
    } catch (error) {
        console.error('Error saving book summary prompt:', error);
        const status = error.status || 500;
        res.status(status).json({ error: 'Fehler beim Speichern der Prompt-Vorlagen.' });
    }
}
