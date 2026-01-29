import pool from "../db/pool.js";
import * as booksRepo from "../repositories/books.repo.js";
import { getApiKey } from "../../config/config-store.js";
import { getPrompt } from "./prompt.service.js";
import { createChatCompletion } from "./openai.service.js";

export async function listBooks(listId) {
    return booksRepo.fetchBooks(listId);
}

export async function checkDuplicate(title, authorIds, bookId) {
    return booksRepo.checkDuplicate(title, authorIds, bookId);
}

export async function getBookDetails(bookId) {
    const [bookRes, authorsRes, listsRes, tagsRes] = await Promise.all([
        booksRepo.fetchBookById(bookId),
        booksRepo.fetchBookAuthors(bookId),
        booksRepo.fetchBookLists(bookId),
        booksRepo.fetchBookTags(bookId)
    ]);

    return { bookRes, authorsRes, listsRes, tagsRes };
}

export async function createBook(title, authorIds, listIds, summary = null) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const bookResult = await booksRepo.insertBook(client, title, summary);
        const bookId = bookResult.rows[0].book_id;

        for (const authorId of authorIds) {
            await booksRepo.insertBookAuthor(client, bookId, authorId);
        }

        for (const listId of listIds) {
            await booksRepo.insertBookList(client, bookId, listId);
        }

        await client.query('COMMIT');
        return { bookId };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function updateBook(bookId, title, authorIds, listIds, tagIds, summary) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await booksRepo.updateBookTitle(client, bookId, title);
        if (summary !== undefined) {
            await booksRepo.updateBookSummary(client, bookId, summary);
        }

        await booksRepo.deleteBookAuthors(client, bookId);
        for (const authorId of authorIds) {
            await booksRepo.insertBookAuthor(client, bookId, authorId);
        }

        await booksRepo.deleteBookLists(client, bookId);
        for (const listId of listIds) {
            await booksRepo.insertBookList(client, bookId, listId);
        }

        await booksRepo.deleteBookTags(client, bookId);
        if (Array.isArray(tagIds) && tagIds.length > 0) {
            for (const tagId of tagIds) {
                await booksRepo.insertBookTag(client, bookId, tagId);
            }
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function generateBookSummary(bookId) {
    const apiKey = await getApiKey("openai");
    if (!apiKey) {
        const error = new Error("OpenAI API-Key fehlt.");
        error.status = 400;
        throw error;
    }

    const [bookRes, authorsRes, listsRes, tagsRes] = await Promise.all([
        booksRepo.fetchBookById(bookId),
        booksRepo.fetchBookAuthors(bookId),
        booksRepo.fetchBookListNames(bookId),
        booksRepo.fetchBookTagNames(bookId)
    ]);

    if (bookRes.rowCount === 0) {
        const error = new Error("Buch nicht gefunden.");
        error.status = 404;
        throw error;
    }

    const book = bookRes.rows[0];
    const promptTemplates = await getPrompt("book_summary");

    const authors = authorsRes.rows
        .map((author) => `${author.first_name} ${author.last_name}`.trim())
        .filter(Boolean)
        .join(", ");
    const lists = listsRes.rows.map((row) => row.name).filter(Boolean).join(", ");
    const tags = tagsRes.rows.map((row) => row.name).filter(Boolean).join(", ");

    const templateData = {
        title: book.title ?? "",
        authors,
        lists,
        tags
    };

    const applyTemplate = (template) => template.replace(/{{\s*([\w-]+)\s*}}/g, (_, key) => templateData[key] ?? "");

    const systemPrompt = applyTemplate(promptTemplates.systemPrompt);
    const userPrompt = applyTemplate(promptTemplates.userPrompt);

    const summary = await createChatCompletion({
        apiKey,
        systemPrompt,
        userPrompt
    });

    await booksRepo.updateBookSummary(pool, bookId, summary);
    return summary;
}

export async function deleteBook(bookId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await booksRepo.deleteBookAuthors(client, bookId);
        await booksRepo.deleteBookLists(client, bookId);
        const deleteResult = await booksRepo.deleteBook(client, bookId);

        if (deleteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return { deleteResult };
        }

        await client.query('COMMIT');
        return { deleteResult };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
