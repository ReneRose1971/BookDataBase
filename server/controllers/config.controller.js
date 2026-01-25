import * as configService from "../services/config.service.js";

export async function getApiStatus(req, res) {
    try {
        const status = await configService.getStatus();
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

export async function saveOpenLibraryKey(req, res) {
    const { key } = req.body;
    if (!key) {
        return res.status(400).json({ error: 'Key darf nicht leer sein.' });
    }
    try {
        await configService.saveKey('openlibrary', key);
        res.status(204).send();
    } catch (error) {
        console.error('Error saving Open Library key:', error);
        res.status(500).json({ error: 'Fehler beim Speichern des Open Library-Schlüssels.' });
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

export async function deleteOpenLibraryKey(req, res) {
    try {
        await configService.removeKey('openlibrary');
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting Open Library key:', error);
        res.status(500).json({ error: 'Fehler beim Entfernen des Open Library-Schlüssels.' });
    }
}
