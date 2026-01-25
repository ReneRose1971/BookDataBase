import pool from "../db/pool.js";
import * as booksRepo from "../repositories/books.repo.js";

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

export async function createBook(title, authorIds, listIds) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const bookResult = await booksRepo.insertBook(client, title);
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

export async function updateBook(bookId, title, authorIds, listIds, tagIds) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await booksRepo.updateBookTitle(client, bookId, title);

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
