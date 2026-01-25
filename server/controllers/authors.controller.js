import * as authorsService from "../services/authors.service.js";
import { parseIntParam } from "../middleware/validate.js";

export async function getAuthors(req, res) {
    try {
        const result = await authorsService.listAuthors();
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching authors:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Autoren.' });
    }
}

export async function getAuthorById(req, res) {
    const authorId = parseIntParam(req, res, 'id', 'Ungültige Autoren-ID.');
    if (authorId === null) return;

    try {
        const result = await authorsService.getAuthor(authorId);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Autor nicht gefunden.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching author by ID:', error);
        res.status(500).json({ error: 'Fehler beim Laden des Autors.' });
    }
}

export async function createAuthor(req, res) {
    const { firstName, lastName } = req.body;

    if (!firstName || !lastName) {
        return res.status(400).json({ error: 'Vorname und Nachname sind erforderlich.' });
    }

    try {
        const { duplicateResult, result } = await authorsService.createAuthor(firstName.trim(), lastName.trim());

        if (duplicateResult.rowCount > 0) {
            return res.status(409).json({ error: 'Autor existiert bereits.' });
        }

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating author:', error);
        res.status(500).json({ error: 'Fehler beim Erstellen des Autors.' });
    }
}

export async function getAuthorBooks(req, res) {
    const authorId = parseIntParam(req, res, 'id', 'Ungültige Autoren-ID.');
    if (authorId === null) return;

    try {
        const result = await authorsService.getAuthorBooks(authorId);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching books for author:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Bücher des Autors.' });
    }
}

export async function updateAuthor(req, res) {
    const authorId = parseIntParam(req, res, 'id', 'Ungültige Eingabedaten.');
    const { firstName, lastName } = req.body;

    if (authorId === null || !firstName || !lastName) {
        return res.status(400).json({ error: 'Ungültige Eingabedaten.' });
    }

    try {
        const { duplicateResult, result } = await authorsService.updateAuthor(authorId, firstName.trim(), lastName.trim());

        if (duplicateResult.rowCount > 0) {
            return res.status(409).json({ error: 'Autor existiert bereits.' });
        }

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Autor nicht gefunden.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating author:', error);
        res.status(500).json({ error: 'Fehler beim Aktualisieren des Autors.' });
    }
}

export async function deleteAuthor(req, res) {
    console.log("HIT DELETE /api/authors/:id", req.params.id);

    const authorId = parseIntParam(req, res, 'id', 'Ungültige Autoren-ID.');
    if (authorId === null) return;

    try {
        const { countResult, deleteResult } = await authorsService.removeAuthor(authorId);

        const count = countResult.rows[0].cnt;
        if (count > 0) {
            return res.status(409).json({ error: 'Autor kann nicht gelöscht werden, da er mit Büchern verknüpft ist.' });
        }

        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ error: 'Autor nicht gefunden.' });
        }

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting author:', error);
        res.status(500).json({ error: 'Fehler beim Löschen des Autors.' });
    }
}
