import pool from "../db/pool.js";

export async function searchBooksByTitleTokens(tokens) {
    const params = [];
    let whereClause = "";

    if (Array.isArray(tokens) && tokens.length > 0) {
        const conditions = tokens.map((token, index) => {
            params.push(`%${token}%`);
            return `LOWER(b.title) LIKE $${index + 1}`;
        });
        whereClause = `WHERE ${conditions.join(" AND ")}`;
    }

    const query = `
        SELECT
            b.book_id,
            b.title,
            json_agg(
                json_build_object(
                    'author_id', a.author_id,
                    'first_name', a.first_name,
                    'last_name', a.last_name
                )
                ORDER BY a.last_name, a.first_name
            ) AS authors
        FROM books b
        JOIN book_authors ba ON b.book_id = ba.book_id
        JOIN authors a ON ba.author_id = a.author_id
        ${whereClause}
        GROUP BY b.book_id, b.title
        ORDER BY b.title ASC;
    `;

    return pool.query(query, params);
}
