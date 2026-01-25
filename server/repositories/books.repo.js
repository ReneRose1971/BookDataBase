import pool from "../db/pool.js";

export async function fetchBooks(listId) {
    let query = `
        SELECT b.book_id, b.title, STRING_AGG(a.first_name || ' ' || a.last_name, ', ') as authors
        FROM books b
        LEFT JOIN book_authors ba ON b.book_id = ba.book_id
        LEFT JOIN authors a ON ba.author_id = a.author_id
    `;

    const params = [];
    if (listId) {
        query += `
            INNER JOIN book_book_lists bbl ON b.book_id = bbl.book_id
            WHERE bbl.book_list_id = $1
        `;
        params.push(listId);
    }

    query += `
        GROUP BY b.book_id, b.title
        ORDER BY b.title ASC;
    `;

    return pool.query(query, params);
}

export async function checkDuplicate(title, authorIds, bookId) {
    const query = `
        SELECT b.book_id
        FROM books b
        JOIN book_authors ba ON b.book_id = ba.book_id
        WHERE LOWER(b.title) = LOWER($1)
        AND ($3 IS NULL OR b.book_id <> $3) -- Aktuelles Buch ausschließen
        GROUP BY b.book_id
        HAVING ARRAY_AGG(ba.author_id::bigint ORDER BY ba.author_id) = ARRAY(SELECT unnest($2::bigint[]) ORDER BY 1);
    `;
    return pool.query(query, [title, authorIds, bookId]);
}

export async function fetchBookById(bookId) {
    const query = 'SELECT book_id, title FROM books WHERE book_id = $1';
    return pool.query(query, [bookId]);
}

export async function fetchBookAuthors(bookId) {
    const query = `
        SELECT a.author_id, a.first_name, a.last_name
        FROM authors a
        JOIN book_authors ba ON a.author_id = ba.author_id
        WHERE ba.book_id = $1
    `;
    return pool.query(query, [bookId]);
}

export async function fetchBookLists(bookId) {
    const query = `
        SELECT book_list_id
        FROM book_book_lists
        WHERE book_id = $1
    `;
    return pool.query(query, [bookId]);
}

export async function fetchBookTags(bookId) {
    const query = `
        SELECT tag_id
        FROM book_tags
        WHERE book_id = $1
    `;
    return pool.query(query, [bookId]);
}

export async function insertBook(db, title) {
    return db.query('INSERT INTO books (title) VALUES ($1) RETURNING book_id', [title]);
}

export async function insertBookAuthor(db, bookId, authorId) {
    return db.query('INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2)', [bookId, authorId]);
}

export async function insertBookList(db, bookId, listId) {
    return db.query('INSERT INTO book_book_lists (book_id, book_list_id) VALUES ($1, $2)', [bookId, listId]);
}

export async function updateBookTitle(db, bookId, title) {
    return db.query('UPDATE books SET title = $1, updated_at = NOW() WHERE book_id = $2', [title, bookId]);
}

export async function deleteBookAuthors(db, bookId) {
    return db.query('DELETE FROM book_authors WHERE book_id = $1', [bookId]);
}

export async function deleteBookLists(db, bookId) {
    return db.query('DELETE FROM book_book_lists WHERE book_id = $1', [bookId]);
}

export async function deleteBookTags(db, bookId) {
    return db.query('DELETE FROM book_tags WHERE book_id = $1', [bookId]);
}

export async function insertBookTag(db, bookId, tagId) {
    return db.query('INSERT INTO book_tags (book_id, tag_id) VALUES ($1, $2)', [bookId, tagId]);
}

export async function deleteBook(db, bookId) {
    return db.query('DELETE FROM books WHERE book_id = $1', [bookId]);
}
