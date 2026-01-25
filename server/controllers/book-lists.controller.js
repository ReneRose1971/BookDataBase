import * as listsService from "../services/book-lists.service.js";
import { parseIntParam } from "../middleware/validate.js";

export async function getBookLists(req, res) {
    try {
        const result = await listsService.listBookLists();
        res.json({ items: result.rows });
    } catch (error) {
        console.error('Error fetching book lists:', error);
        res.status(500).json({ error: 'Konnte Bücherlisten nicht laden.' });
    }
}

export async function getBookList(req, res) {
    const bookListId = parseIntParam(req, res, 'id', 'Ungültige Listen-ID.');
    if (bookListId === null) return;

    try {
        const result = await listsService.getBookListById(bookListId);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Liste nicht gefunden.' });
        }

        res.json({ item: result.rows[0] });
    } catch (error) {
        console.error('Error fetching book list by ID:', error);
        res.status(500).json({ error: 'Interner Serverfehler.' });
    }
}

export async function createBookList(req, res) {
    const { name } = req.body;

    if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name ist ungültig.' });
    }

    const trimmedName = name.trim();

    try {
        const result = await listsService.createBookList(trimmedName);
        res.status(201).json({ item: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            res.status(409).json({ error: 'Liste existiert bereits.' });
        } else {
            console.error('Error inserting book list:', error);
            res.status(500).json({ error: 'Interner Serverfehler.' });
        }
    }
}

export async function updateBookList(req, res) {
    const bookListId = parseIntParam(req, res, 'id', 'Ungültige Listen-ID.');
    const { name } = req.body;

    if (bookListId === null) return;

    if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name ist ungültig.' });
    }

    const trimmedName = name.trim();

    try {
        const { listResult, nameCheckResult } = await listsService.updateBookList(bookListId, trimmedName);

        if (listResult.rows.length === 0) {
            return res.status(404).json({ error: 'Liste nicht gefunden.' });
        }

        const list = listResult.rows[0];
        if (list.is_standard) {
            return res.status(403).json({ error: 'Standardlisten dürfen nicht bearbeitet werden.' });
        }

        if (nameCheckResult.rows.length > 0) {
            return res.status(409).json({ error: 'Name wird bereits verwendet.' });
        }

        const updateResult = await listsService.saveBookList(bookListId, trimmedName);
        res.json({ item: updateResult.rows[0] });
    } catch (error) {
        console.error('Error updating book list:', error);
        res.status(500).json({ error: 'Interner Serverfehler.' });
    }
}

export async function deleteBookList(req, res) {
    const bookListId = parseIntParam(req, res, 'id', 'Ungültige Listen-ID.');
    if (bookListId === null) return;

    try {
        const { listResult, orphanCheckResult } = await listsService.deleteBookList(bookListId);

        if (listResult.rows.length === 0) {
            return res.status(404).json({ error: 'Liste nicht gefunden.' });
        }

        const list = listResult.rows[0];
        if (list.is_standard) {
            return res.status(403).json({ error: 'Standardlisten können nicht gelöscht werden.' });
        }

        if (orphanCheckResult.rows.length > 0) {
            return res.status(409).json({ error: 'Liste kann nicht gelöscht werden, da sonst Bücher keiner Liste mehr zugeordnet wären.' });
        }

        await listsService.removeBookList(bookListId);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting book list:', error);
        res.status(500).json({ error: 'Interner Serverfehler.' });
    }
}
