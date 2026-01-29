import pool from "../db/pool.js";

export async function fetchLists() {
    const query = `
        SELECT
            bl.book_list_id,
            bl.name,
            bl.is_standard,
            COUNT(bbl.book_id)::int AS book_count
        FROM book_lists bl
        LEFT JOIN book_book_lists bbl ON bbl.book_list_id = bl.book_list_id
        GROUP BY bl.book_list_id
        ORDER BY bl.is_standard DESC, bl.name ASC;
    `;
    return pool.query(query);
}

export async function fetchListById(bookListId) {
    const query = `
        SELECT
            bl.book_list_id,
            bl.name,
            bl.is_standard,
            COUNT(bbl.book_id)::int AS book_count
        FROM book_lists bl
        LEFT JOIN book_book_lists bbl ON bbl.book_list_id = bl.book_list_id
        WHERE bl.book_list_id = $1
        GROUP BY bl.book_list_id;
    `;
    return pool.query(query, [bookListId]);
}

export async function fetchListMeta(bookListId) {
    const query = `
        SELECT book_list_id, is_standard
        FROM book_lists
        WHERE book_list_id = $1;
    `;
    return pool.query(query, [bookListId]);
}

export async function insertList(name) {
    const query = `
        INSERT INTO book_lists (name, is_standard)
        VALUES ($1, false)
        RETURNING book_list_id, name, is_standard;
    `;
    return pool.query(query, [name]);
}

export async function checkNameConflict(name, bookListId) {
    const query = `
        SELECT 1
        FROM book_lists
        WHERE name = $1 AND book_list_id <> $2;
    `;
    return pool.query(query, [name, bookListId]);
}

export async function updateList(name, bookListId) {
    const query = `
        UPDATE book_lists
        SET name = $1
        WHERE book_list_id = $2
        RETURNING book_list_id, name, is_standard;
    `;
    return pool.query(query, [name, bookListId]);
}

export async function checkOrphanBooks(bookListId) {
    const query = `
        SELECT bbl.book_id
        FROM book_book_lists bbl
        WHERE bbl.book_list_id = $1
        AND NOT EXISTS (
            SELECT 1
            FROM book_book_lists b2
            WHERE b2.book_id = bbl.book_id
            AND b2.book_list_id <> $1
        )
        LIMIT 1;
    `;
    return pool.query(query, [bookListId]);
}

export async function deleteBookListRelations(bookListId) {
    return pool.query('DELETE FROM book_book_lists WHERE book_list_id = $1;', [bookListId]);
}

export async function deleteBookList(bookListId) {
    return pool.query('DELETE FROM book_lists WHERE book_list_id = $1;', [bookListId]);
}

export async function seedStandardLists() {
    const seedDataQuery = `
        INSERT INTO book_lists (name, is_standard)
        VALUES 
            ('Gelesene Bücher', true),
            ('Wunschliste', true)
        ON CONFLICT (name) DO NOTHING;
    `;
    return pool.query(seedDataQuery);
}
