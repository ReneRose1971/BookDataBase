import pool from "../db/pool.js";

export async function fetchTags() {
    const query = `
        SELECT t.tag_id, t.name, COUNT(bt.book_id)::int as book_count
        FROM tags t
        LEFT JOIN book_tags bt ON t.tag_id = bt.tag_id
        GROUP BY t.tag_id, t.name
        ORDER BY t.name ASC;
    `;
    return pool.query(query);
}

export async function insertTag(name) {
    const query = 'INSERT INTO tags (name) VALUES ($1) RETURNING *';
    return pool.query(query, [name]);
}

export async function updateTag(tagId, name) {
    const query = 'UPDATE tags SET name = $1 WHERE tag_id = $2 RETURNING *';
    return pool.query(query, [name, tagId]);
}

export async function deleteTagRelations(tagId) {
    return pool.query('DELETE FROM book_tags WHERE tag_id = $1', [tagId]);
}

export async function deleteTag(tagId) {
    return pool.query('DELETE FROM tags WHERE tag_id = $1 RETURNING *', [tagId]);
}
