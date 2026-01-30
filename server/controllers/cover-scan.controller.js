import { getApiKey } from "../../config/config-store.js";
import * as booksService from "../services/books.service.js";
import * as searchFacade from "../services/search/search-facade.service.js";
import {
    extractCoverMetadata,
    getCoverScanConfig,
    normalizeOpenAiResult,
    validateCoverFile
} from "../services/cover-scan.service.js";

export function getCoverScanConfigEndpoint(req, res) {
    const config = getCoverScanConfig();
    res.json({
        maxFiles: config.maxFiles,
        maxFileSizeBytes: config.maxFileSizeBytes,
        supportedMimeTypes: config.supportedMimeTypes
    });
}

export async function extractCoverScan(req, res) {
    const config = getCoverScanConfig();
    const files = Array.isArray(req.files) ? req.files : [];

    if (!files.length) {
        return res.status(400).json({ error: "Keine Dateien übermittelt." });
    }

    const startTime = Date.now();
    const results = files.map((file, index) => ({
        fileIndex: index,
        fileName: file.originalname,
        title: "",
        authors: [],
        isbn: null,
        ambiguous: false,
        confidence: null,
        status: "pending",
        errors: []
    }));

    const validFiles = [];

    files.forEach((file, index) => {
        const errors = validateCoverFile(file, config);
        if (errors.length > 0) {
            results[index].status = "invalid";
            results[index].errors = errors;
            return;
        }
        validFiles.push({
            fileIndex: index,
            mimetype: file.mimetype,
            base64: file.buffer.toString("base64"),
            size: file.size
        });
    });

    if (!validFiles.length) {
        return res.json({ results });
    }

    const apiKey = await getApiKey("openai");
    if (!apiKey) {
        validFiles.forEach((file) => {
            const target = results[file.fileIndex];
            target.status = "failed";
            target.errors.push("OpenAI API-Key fehlt.");
        });
        return res.json({ results, error: "OpenAI API-Key fehlt." });
    }

    try {
        const rawResults = await extractCoverMetadata({
            apiKey,
            files: validFiles,
            model: config.model
        });

        const mapped = new Map();
        rawResults.forEach((item) => {
            const normalized = normalizeOpenAiResult(item);
            if (Number.isInteger(normalized.fileIndex)) {
                mapped.set(normalized.fileIndex, normalized);
            }
        });

        validFiles.forEach((file) => {
            const target = results[file.fileIndex];
            const normalized = mapped.get(file.fileIndex);
            if (!normalized) {
                target.status = "failed";
                target.errors.push("Kein Ergebnis von OpenAI erhalten.");
                return;
            }
            target.title = normalized.title;
            target.authors = normalized.authors;
            target.isbn = normalized.isbn;
            target.ambiguous = normalized.ambiguous;
            target.confidence = normalized.confidence;
            target.errors = normalized.errors;

            if (!target.title || target.authors.length === 0) {
                target.status = "failed";
                if (!target.title) target.errors.push("Titel fehlt.");
                if (target.authors.length === 0) target.errors.push("Autor(en) fehlen.");
            } else if (target.ambiguous) {
                target.status = "ambiguous";
            } else {
                target.status = "scanned";
            }
        });
    } catch (error) {
        validFiles.forEach((file) => {
            const target = results[file.fileIndex];
            target.status = "failed";
            target.errors.push(error.message || "OpenAI-Fehler.");
        });
        console.error("Cover-Scan OpenAI-Fehler:", error.message);
    }

    const durationMs = Date.now() - startTime;
    console.info("Cover-Scan abgeschlossen", {
        fileCount: files.length,
        validCount: validFiles.length,
        durationMs
    });

    return res.json({ results });
}

export async function importCoverScan(req, res) {
    const { title, authors, listIds } = req.body || {};

    if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "Titel darf nicht leer sein." });
    }

    if (!Array.isArray(listIds) || listIds.length === 0) {
        return res.status(400).json({ error: "Mindestens eine Bücherliste ist erforderlich." });
    }

    const parsedAuthors = parseAuthors(authors);
    if (parsedAuthors.length === 0) {
        return res.status(400).json({ error: "Mindestens ein Autor ist erforderlich." });
    }

    const normalizedListIds = listIds.map((id) => Number(id)).filter((id) => Number.isFinite(id));
    if (!normalizedListIds.length) {
        return res.status(400).json({ error: "Mindestens eine gültige Bücherliste ist erforderlich." });
    }

    const resolvedAuthorIds = await searchFacade.resolveAuthorIds(parsedAuthors);
    if (!resolvedAuthorIds.length) {
        return res.status(400).json({ error: "Autoren konnten nicht aufgelöst werden." });
    }

    const duplicateCheck = await booksService.checkDuplicate(title.trim(), resolvedAuthorIds);
    if (duplicateCheck.rowCount > 0) {
        return res.status(409).json({ error: "Buch existiert bereits." });
    }

    try {
        const { bookId } = await booksService.createBook(
            title.trim(),
            resolvedAuthorIds,
            normalizedListIds
        );
        return res.status(201).json({
            book: { book_id: bookId, title: title.trim() },
            authorIds: resolvedAuthorIds,
            listIds: normalizedListIds
        });
    } catch (error) {
        console.error("Error importing cover scan book:", error);
        return res.status(500).json({ error: "Fehler beim Übernehmen des Buches." });
    }
}

function parseAuthors(authors) {
    if (!Array.isArray(authors)) {
        if (typeof authors === "string") {
            return splitAuthorString(authors);
        }
        return [];
    }

    const parsed = [];
    for (const entry of authors) {
        if (!entry) continue;
        if (typeof entry === "string") {
            parsed.push(...splitAuthorString(entry));
            continue;
        }
        if (entry.firstName && entry.lastName) {
            parsed.push({
                firstName: String(entry.firstName).trim(),
                lastName: String(entry.lastName).trim(),
                fullName: `${entry.firstName} ${entry.lastName}`.trim()
            });
        }
    }
    return parsed.filter((author) => author.firstName && author.lastName);
}

function splitAuthorString(value) {
    const parts = value
        .split(/[;|]/g)
        .map((chunk) => chunk.trim())
        .filter(Boolean);

    const parsed = [];
    parts.forEach((chunk) => {
        if (chunk.includes(",")) {
            const [lastName, firstName] = chunk.split(",").map((item) => item.trim());
            if (firstName && lastName) {
                parsed.push({ firstName, lastName, fullName: `${firstName} ${lastName}`.trim() });
            }
            return;
        }
        const tokens = chunk.split(/\s+/).filter(Boolean);
        if (tokens.length < 2) {
            return;
        }
        const lastName = tokens.pop();
        const firstName = tokens.join(" ");
        if (firstName && lastName) {
            parsed.push({ firstName, lastName, fullName: `${firstName} ${lastName}`.trim() });
        }
    });

    return parsed;
}
