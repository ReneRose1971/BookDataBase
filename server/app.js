import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ensureStandardLists } from "./services/book-lists.service.js";
import { errorHandler } from "./middleware/error-handler.js";
import authRoutes from "./routes/auth.routes.js";
import viewsRoutes from "./routes/views.routes.js";
import configRoutes from "./routes/config.routes.js";
import tagsRoutes from "./routes/tags.routes.js";
import bookListsRoutes from "./routes/book-lists.routes.js";
import authorsRoutes from "./routes/authors.routes.js";
import booksRoutes from "./routes/books.routes.js";
import searchRoutes from "./routes/search.routes.js";
import coverScanRoutes from "./routes/cover-scan.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

console.log("CWD:", process.cwd());
console.log("ENV FILE:", path.join(__dirname, "..", ".env"));
console.log("PGUSER:", process.env.PGUSER);
console.log("PGPASSWORD type:", typeof process.env.PGPASSWORD);
console.log("PGPASSWORD length:", process.env.PGPASSWORD ? process.env.PGPASSWORD.length : null);

if (typeof process.env.PGPASSWORD !== "string" || !process.env.PGPASSWORD.length) {
    console.error("PGPASSWORD fehlt/leer. Prüfe .env Pfad und Variablenname.");
    process.exit(1);
}

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Serve views dynamically
app.use("/views", express.static(path.join(__dirname, "..", "public", "views")));

// Content-Security-Policy header
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com; img-src 'self' data:;");
    next();
});

const envPath = path.join(__dirname, "..", ".env");
const result = dotenv.config({ path: envPath });

console.log("dotenv error:", result.error ? String(result.error) : null);
console.log("dotenv parsed keys:", result.parsed ? Object.keys(result.parsed) : null);

console.log("process.env has PGUSER:", Object.prototype.hasOwnProperty.call(process.env, "PGUSER"));
console.log("process.env has DB_USER:", Object.prototype.hasOwnProperty.call(process.env, "DB_USER"));

ensureStandardLists().catch((error) => {
    console.error('Error seeding book_lists table:', error);
});

app.use(authRoutes);
app.use(viewsRoutes);
app.use(configRoutes);
app.use(tagsRoutes);
app.use(bookListsRoutes);
app.use(authorsRoutes);
app.use(booksRoutes);
app.use(searchRoutes);
app.use(coverScanRoutes);
app.use(errorHandler);

console.log("SERVER.JS LOADED:", fileURLToPath(import.meta.url));

export default app;
