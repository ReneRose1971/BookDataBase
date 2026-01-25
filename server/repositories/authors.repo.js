import pool from "../db/pool.js";

export async function fetchAuthors() {
    const query = `
        SELECT 
            a.author_id, 
            a.first_name, 
            a.last_name,
            COUNT(ba.book_id)::int AS book_count
        FROM authors a
        LEFT JOIN book_authors ba ON a.author_id = ba.author_id
        GROUP BY a.author_id, a.first_name, a.last_name
        ORDER BY a.last_name ASC, a.first_name ASC
    `;
    return pool.query(query);
}

export async function fetchAuthorById(authorId) {
    const query = `
        SELECT author_id AS author_id, first_name, last_name
        FROM authors
        WHERE author_id = $1
    `;
    return pool.query(query, [authorId]);
}

export async function fetchAuthorByName(firstName, lastName) {
    const query = `
        SELECT author_id, first_name, last_name
        FROM authors
        WHERE LOWER(first_name) = LOWER($1)
        AND LOWER(last_name) = LOWER($2)
    `;
    return pool.query(query, [firstName, lastName]);
}

export async function checkAuthorDuplicate(firstName, lastName, authorId = null) {
    const query = authorId
        ? `
            SELECT 1 FROM authors
            WHERE LOWER(first_name) = LOWER($1)
            AND LOWER(last_name) = LOWER($2)
            AND author_id != $3;
        `
        : `
            SELECT 1 FROM authors
            WHERE LOWER(first_name) = LOWER($1)
            AND LOWER(last_name) = LOWER($2);
        `;
    const params = authorId ? [firstName, lastName, authorId] : [firstName, lastName];
    return pool.query(query, params);
}

export async function insertAuthor(firstName, lastName) {
    const query = `
        INSERT INTO authors (first_name, last_name)
        VALUES ($1, $2)
        RETURNING author_id, first_name, last_name;
    `;
    return pool.query(query, [firstName, lastName]);
}

export async function updateAuthor(authorId, firstName, lastName) {
    const query = `
        UPDATE authors
        SET first_name = $1, last_name = $2, updated_at = now()
        WHERE author_id = $3
        RETURNING author_id, first_name, last_name;
    `;
    return pool.query(query, [firstName, lastName, authorId]);
}

export async function fetchBooksByAuthor(authorId) {
    const query = `
        SELECT b.book_id, b.title
        FROM books b
        INNER JOIN book_authors ba ON b.book_id = ba.book_id
        WHERE ba.author_id = $1
        ORDER BY b.title;
    `;
    return pool.query(query, [authorId]);
}

export async function countAuthorBooks(authorId) {
    const query = `
        SELECT COUNT(*)::int AS cnt
        FROM book_authors
        WHERE author_id = $1;
    `;
    return pool.query(query, [authorId]);
}

export async function deleteAuthor(authorId) {
    const query = `
        DELETE FROM authors
        WHERE author_id = $1;
    `;
    return pool.query(query, [authorId]);
}
