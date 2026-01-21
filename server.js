import express from "express";
import { Client, Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

console.log("CWD:", process.cwd());
console.log("ENV FILE:", path.join(__dirname, ".env"));
console.log("PGUSER:", process.env.PGUSER);
console.log("PGPASSWORD type:", typeof process.env.PGPASSWORD);
console.log("PGPASSWORD length:", process.env.PGPASSWORD ? process.env.PGPASSWORD.length : null);

if (typeof process.env.PGPASSWORD !== "string" || !process.env.PGPASSWORD.length) {
    console.error("PGPASSWORD fehlt/leer. Prüfe .env Pfad und Variablenname.");
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Serve views dynamically
app.use("/views", express.static(path.join(__dirname, "public", "views")));

// Content-Security-Policy header
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com; img-src 'self' data:;");
    next();
});

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function ensureBookListsTable() {
    const seedDataQuery = `
        INSERT INTO book_lists (name, is_standard)
        VALUES 
            ('Gelesene Bücher', true),
            ('Wunschliste', true)
        ON CONFLICT (name) DO NOTHING;
    `;

    try {
        await pool.query(seedDataQuery);
    } catch (error) {
        console.error('Error seeding book_lists table:', error);
    }
}

ensureBookListsTable();

app.post("/api/login", async (req, res) => {
    const { user, password } = req.body;

    const client = new Client({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user,
        password,
    });

    try {
        await client.connect();
        await client.query("SELECT 1 AS ok");
        res.status(200).send("DB OK");
    } catch (error) {
        res.status(200).send(`DB FAIL: ${error.message}`);
    } finally {
        await client.end();
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "app.html"));
});

app.get("/app", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "app.html"));
});

// Extend GET /api/book-lists to include book_count
app.get('/api/book-lists', async (req, res) => {
    const fetchListsQuery = `
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

    try {
        const result = await pool.query(fetchListsQuery);
        res.json({ items: result.rows });
    } catch (error) {
        console.error('Error fetching book lists:', error);
        res.status(500).json({ error: 'Konnte Bücherlisten nicht laden.' });
    }
});

// Add GET /api/book-lists/:id
app.get('/api/book-lists/:id', async (req, res) => {
    const bookListId = parseInt(req.params.id, 10);

    if (isNaN(bookListId)) {
        return res.status(400).json({ error: 'Ungültige Listen-ID.' });
    }

    const fetchListQuery = `
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

    try {
        const result = await pool.query(fetchListQuery, [bookListId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Liste nicht gefunden.' });
        }

        res.json({ item: result.rows[0] });
    } catch (error) {
        console.error('Error fetching book list by ID:', error);
        res.status(500).json({ error: 'Interner Serverfehler.' });
    }
});

app.post('/api/book-lists', async (req, res) => {
    const { name } = req.body;

    // Validate the name
    if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name ist ungültig.' });
    }

    const trimmedName = name.trim();

    const insertQuery = `
        INSERT INTO book_lists (name, is_standard)
        VALUES ($1, false)
        RETURNING book_list_id, name, is_standard;
    `;

    try {
        const result = await pool.query(insertQuery, [trimmedName]);
        res.status(201).json({ item: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            res.status(409).json({ error: 'Liste existiert bereits.' });
        } else {
            console.error('Error inserting book list:', error);
            res.status(500).json({ error: 'Interner Serverfehler.' });
        }
    }
});

app.put('/api/book-lists/:id', async (req, res) => {
    const bookListId = parseInt(req.params.id, 10);
    const { name } = req.body;

    if (isNaN(bookListId)) {
        return res.status(400).json({ error: 'Ungültige Listen-ID.' });
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name ist ungültig.' });
    }

    const trimmedName = name.trim();

    try {
        const listQuery = `
            SELECT book_list_id, is_standard
            FROM book_lists
            WHERE book_list_id = $1;
        `;
        const listResult = await pool.query(listQuery, [bookListId]);

        if (listResult.rows.length === 0) {
            return res.status(404).json({ error: 'Liste nicht gefunden.' });
        }

        const list = listResult.rows[0];
        if (list.is_standard) {
            return res.status(403).json({ error: 'Standardlisten dürfen nicht bearbeitet werden.' });
        }

        const nameCheckQuery = `
            SELECT 1
            FROM book_lists
            WHERE name = $1 AND book_list_id <> $2;
        `;
        const nameCheckResult = await pool.query(nameCheckQuery, [trimmedName, bookListId]);

        if (nameCheckResult.rows.length > 0) {
            return res.status(409).json({ error: 'Name wird bereits verwendet.' });
        }

        const updateQuery = `
            UPDATE book_lists
            SET name = $1
            WHERE book_list_id = $2
            RETURNING book_list_id, name, is_standard;
        `;
        const updateResult = await pool.query(updateQuery, [trimmedName, bookListId]);

        res.json({ item: updateResult.rows[0] });
    } catch (error) {
        console.error('Error updating book list:', error);
        res.status(500).json({ error: 'Interner Serverfehler.' });
    }
});

app.delete('/api/book-lists/:id', async (req, res) => {
    const bookListId = parseInt(req.params.id, 10);

    if (isNaN(bookListId)) {
        return res.status(400).json({ error: 'Ungültige Listen-ID.' });
    }

    try {
        const listQuery = `
            SELECT book_list_id, is_standard
            FROM book_lists
            WHERE book_list_id = $1;
        `;
        const listResult = await pool.query(listQuery, [bookListId]);

        if (listResult.rows.length === 0) {
            return res.status(404).json({ error: 'Liste nicht gefunden.' });
        }

        const list = listResult.rows[0];
        if (list.is_standard) {
            return res.status(403).json({ error: 'Standardlisten können nicht gelöscht werden.' });
        }

        const orphanCheckQuery = `
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
        const orphanCheckResult = await pool.query(orphanCheckQuery, [bookListId]);

        if (orphanCheckResult.rows.length > 0) {
            return res.status(409).json({ error: 'Liste kann nicht gelöscht werden, da sonst Bücher keiner Liste mehr zugeordnet wären.' });
        }

        await pool.query('DELETE FROM book_book_lists WHERE book_list_id = $1;', [bookListId]);
        await pool.query('DELETE FROM book_lists WHERE book_list_id = $1;', [bookListId]);

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting book list:', error);
        res.status(500).json({ error: 'Interner Serverfehler.' });
    }
});

// Route to get all authors
app.get('/api/authors', async (req, res) => {
    try {
        const query = `
            SELECT author_id AS author_id, first_name, last_name
            FROM authors
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching authors:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Autoren.' });
    }
});

// Route to get author by ID
app.get('/api/authors/:id', async (req, res) => {
    const authorId = parseInt(req.params.id, 10);

    if (isNaN(authorId)) {
        return res.status(400).json({ error: 'Ungültige Autoren-ID.' });
    }

    try {
        const query = `
            SELECT author_id AS author_id, first_name, last_name
            FROM authors
            WHERE author_id = $1
        `;
        const result = await pool.query(query, [authorId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Autor nicht gefunden.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching author by ID:', error);
        res.status(500).json({ error: 'Fehler beim Laden des Autors.' });
    }
});

app.post('/api/authors', async (req, res) => {
    const { firstName, lastName } = req.body;

    if (!firstName || !lastName) {
        return res.status(400).json({ error: 'Vorname und Nachname sind erforderlich.' });
    }

    try {
        const checkDuplicateQuery = `
            SELECT 1 FROM authors WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2);
        `;
        const duplicateResult = await pool.query(checkDuplicateQuery, [firstName.trim(), lastName.trim()]);

        if (duplicateResult.rowCount > 0) {
            return res.status(409).json({ error: 'Autor existiert bereits.' });
        }

        const insertQuery = `
            INSERT INTO authors (first_name, last_name)
            VALUES ($1, $2)
            RETURNING author_id, first_name, last_name;
        `;
        const result = await pool.query(insertQuery, [firstName.trim(), lastName.trim()]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating author:', error);
        res.status(500).json({ error: 'Fehler beim Erstellen des Autors.' });
    }
});

app.get('/api/authors/:id/books', async (req, res) => {
    const authorId = parseInt(req.params.id, 10);

    if (isNaN(authorId)) {
        return res.status(400).json({ error: 'Ungültige Autoren-ID.' });
    }

    try {
        const query = `
            SELECT b.book_id, b.title
            FROM books b
            INNER JOIN book_authors ba ON b.book_id = ba.book_id
            WHERE ba.author_id = $1
            ORDER BY b.title;
        `;
        const result = await pool.query(query, [authorId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching books for author:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Bücher des Autors.' });
    }
});

app.put('/api/authors/:id', async (req, res) => {
    const authorId = parseInt(req.params.id, 10);
    const { firstName, lastName } = req.body;

    if (isNaN(authorId) || !firstName || !lastName) {
        return res.status(400).json({ error: 'Ungültige Eingabedaten.' });
    }

    try {
        const checkDuplicateQuery = `
            SELECT 1 FROM authors WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2) AND author_id != $3;
        `;
        const duplicateResult = await pool.query(checkDuplicateQuery, [firstName.trim(), lastName.trim(), authorId]);

        if (duplicateResult.rowCount > 0) {
            return res.status(409).json({ error: 'Autor existiert bereits.' });
        }

        const updateQuery = `
            UPDATE authors
            SET first_name = $1, last_name = $2, updated_at = now()
            WHERE author_id = $3
            RETURNING author_id, first_name, last_name;
        `;
        const result = await pool.query(updateQuery, [firstName.trim(), lastName.trim(), authorId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Autor nicht gefunden.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating author:', error);
        res.status(500).json({ error: 'Fehler beim Aktualisieren des Autors.' });
    }
});

// Route to serve authors.html
app.get("/authors", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "authors.html"));
});

const envPath = path.join(__dirname, ".env");
const result = dotenv.config({ path: envPath });

console.log("dotenv error:", result.error ? String(result.error) : null);
console.log("dotenv parsed keys:", result.parsed ? Object.keys(result.parsed) : null);

console.log("process.env has PGUSER:", Object.prototype.hasOwnProperty.call(process.env, "PGUSER"));
console.log("process.env has DB_USER:", Object.prototype.hasOwnProperty.call(process.env, "DB_USER"));

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
});

console.log("SERVER.JS LOADED:", fileURLToPath(import.meta.url));

console.log("REGISTER DELETE /api/authors/:id");
app.delete('/api/authors/:id', async (req, res) => {
    console.log("HIT DELETE /api/authors/:id", req.params.id);

    const authorId = parseInt(req.params.id, 10);

    if (isNaN(authorId)) {
        return res.status(400).json({ error: 'Ungültige Autoren-ID.' });
    }

    try {
        // Check if the author has associated books
        const countQuery = `
            SELECT COUNT(*)::int AS cnt
            FROM book_authors
            WHERE author_id = $1;
        `;
        const countResult = await pool.query(countQuery, [authorId]);
        const count = countResult.rows[0].cnt;

        if (count > 0) {
            return res.status(409).json({ error: 'Autor kann nicht gelöscht werden, da er mit Büchern verknüpft ist.' });
        }

        // Delete the author
        const deleteQuery = `
            DELETE FROM authors
            WHERE author_id = $1;
        `;
        const deleteResult = await pool.query(deleteQuery, [authorId]);

        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ error: 'Autor nicht gefunden.' });
        }

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting author:', error);
        res.status(500).json({ error: 'Fehler beim Löschen des Autors.' });
    }
});