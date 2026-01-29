// scripts/migrate-add-summary-column.js
import pg from "pg";
import dotenv from "dotenv";

// Load env vars
dotenv.config();

const { Pool } = pg;

const config = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const pool = new Pool(config);

async function migrate() {
  const client = await pool.connect();
  try {
    // Log DB connection info
    console.log(`DB-Connection: host=${config.host}, db=${config.database}`);
    // Check if column exists
    const checkRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'books' AND column_name = 'summary'`);
    if (checkRes.rowCount === 0) {
      await client.query(`ALTER TABLE books ADD COLUMN summary TEXT`);
      console.log("Spalte 'summary' wurde hinzugefügt.");
    } else {
      console.log("Spalte 'summary' existiert bereits.");
    }
  } catch (err) {
    console.error("Migration fehlgeschlagen:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
