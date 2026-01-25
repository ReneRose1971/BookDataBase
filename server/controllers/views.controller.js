import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "..", "public");

export function getApp(req, res) {
    res.sendFile(path.join(publicDir, "app.html"));
}

export function getAuthors(req, res) {
    res.sendFile(path.join(publicDir, "authors.html"));
}
