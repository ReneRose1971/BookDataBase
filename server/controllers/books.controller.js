import * as booksService from "../services/books.service.js";
import { parseIntParam } from "../middleware/validate.js";

export async function getBooks(req, res) {
    const listId = req.query.listId;

    try {
        const result = await booksService.listBooks(listId);
        res.json({ items: result.rows });
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Bücher.' });
    }
}

export async function checkDuplicate(req, res) {
    const { title, authorIds, bookId } = req.query;
    if (!title || !authorIds) {
        return res.status(400).json({ error: 'Titel und Autoren-IDs erforderlich.' });
    }
    const ids = JSON.parse(authorIds);
    try {
        const result = await booksService.checkDuplicate(title.trim(), ids, bookId);
        if (result.rowCount > 0) {
            res.json({ duplicate: true, book_id: result.rows[0].book_id });
        } else {
            res.json({ duplicate: false });
        }
    } catch (error) {
        console.error('Error checking duplicate book:', error);
        res.status(500).json({ error: 'Fehler bei der Duplikatsprüfung.' });
    }
}

export async function createBook(req, res) {
    const { title, authorIds, listIds } = req.body;

    if (!title || !authorIds || !Array.isArray(authorIds) || authorIds.length === 0) {
        return res.status(400).json({ error: 'Titel und mindestens ein Autor sind erforderlich.' });
    }

    if (!listIds || !Array.isArray(listIds) || listIds.length === 0) {
        return res.status(400).json({ error: 'Mindestens eine Bücherliste ist erforderlich.' });
    }

    try {
        const { bookId } = await booksService.createBook(title.trim(), authorIds, listIds);
        res.status(201).json({ book_id: bookId, title });
    } catch (error) {
        console.error('Error creating book:', error);
        res.status(500).json({ error: 'Fehler beim Erstellen des Buches.' });
    }
}

export async function getBookById(req, res) {
    const bookId = parseIntParam(req, res, 'id', 'Ungültige Buch-ID.');
    if (bookId === null) return;

    try {
        const { bookRes, authorsRes, listsRes, tagsRes } = await booksService.getBookDetails(bookId);

        if (bookRes.rowCount === 0) return res.status(404).json({ error: 'Buch nicht gefunden.' });

        const book = bookRes.rows[0];
        book.authors = authorsRes.rows;
        book.listIds = listsRes.rows.map(r => r.book_list_id);
        book.tagIds = tagsRes.rows.map(r => r.tag_id);

        res.json(book);
    } catch (error) {
        console.error('Error fetching book details:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Buchdetails.' });
    }
}

export async function updateBook(req, res) {
    const bookId = parseIntParam(req, res, 'id', 'Ungültige Daten.');
    const { title, authorIds, listIds, tagIds } = req.body;

    if (bookId === null || !title || !authorIds || !Array.isArray(authorIds) || authorIds.length === 0 || !listIds || !Array.isArray(listIds) || listIds.length === 0) {
        return res.status(400).json({ error: 'Ungültige Daten.' });
    }

    try {
        await booksService.updateBook(bookId, title.trim(), authorIds, listIds, tagIds);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating book:', error);
        res.status(500).json({ error: 'Fehler beim Aktualisieren des Buches.' });
    }
}

export async function deleteBook(req, res) {
    const bookId = parseIntParam(req, res, 'id', 'Ungültige Buch-ID.');
    if (bookId === null) return;

    try {
        const { deleteResult } = await booksService.deleteBook(bookId);

        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ error: 'Buch nicht gefunden.' });
        }

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting book:', error);
        res.status(500).json({ error: 'Interner Serverfehler.' });
    }
}
