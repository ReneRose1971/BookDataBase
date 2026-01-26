import * as configService from "../services/config.service.js";

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
        await configService.setApiKey('google_books', key);
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
        await configService.removeKey('googlebooks');
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting Google Books key:', error);
        res.status(500).json({ error: 'Fehler beim Löschen des Google Books-Schlüssels.' });
    }
}
