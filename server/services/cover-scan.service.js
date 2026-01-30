const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

const DEFAULT_MAX_FILES = 12;
const DEFAULT_MAX_FILE_SIZE_BYTES = 6 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function getCoverScanConfig() {
    const maxFiles = Number(process.env.COVER_SCAN_MAX_FILES || DEFAULT_MAX_FILES);
    const maxFileSizeBytes = Number(process.env.COVER_SCAN_MAX_FILE_SIZE_BYTES || DEFAULT_MAX_FILE_SIZE_BYTES);
    const model = process.env.COVER_SCAN_MODEL || DEFAULT_MODEL;
    return {
        maxFiles: Number.isFinite(maxFiles) ? maxFiles : DEFAULT_MAX_FILES,
        maxFileSizeBytes: Number.isFinite(maxFileSizeBytes) ? maxFileSizeBytes : DEFAULT_MAX_FILE_SIZE_BYTES,
        supportedMimeTypes: Array.from(SUPPORTED_MIME_TYPES),
        model
    };
}

export function validateCoverFile(file, config) {
    const errors = [];
    if (!SUPPORTED_MIME_TYPES.has(file.mimetype)) {
        errors.push(`Dateityp nicht unterstützt (${file.mimetype || "unbekannt"}).`);
    }
    if (file.size > config.maxFileSizeBytes) {
        errors.push(`Datei ist zu groß (max. ${(config.maxFileSizeBytes / (1024 * 1024)).toFixed(1)} MB).`);
    }
    return errors;
}

export async function extractCoverMetadata({ apiKey, files, model }) {
    const content = [
        {
            type: "text",
            text: [
                "Du extrahierst Buchmetadaten aus Cover-Bildern.",
                "Gib ausschließlich JSON zurück (kein Markdown).",
                "Antwortformat:",
                "{\"results\":[{\"fileIndex\":0,\"title\":\"...\",\"authors\":[\"...\"]",
                ",\"isbn\":null,\"ambiguous\":false,\"confidence\":null,\"errors\":[]}]}",
                "Wenn ein Ergebnis mehrdeutig ist, setze ambiguous=true und erkläre kurz im errors-Array.",
                "Wenn nichts erkannt wird, gib title leer und errors mit Begründung an.",
                "Die Bilder sind jeweils mit fileIndex gekennzeichnet."
            ].join("\n")
        }
    ];

    for (const file of files) {
        content.push({ type: "text", text: `fileIndex: ${file.fileIndex}` });
        content.push({
            type: "image_url",
            image_url: {
                url: `data:${file.mimetype};base64,${file.base64}`,
                detail: "high"
            }
        });
    }

    const response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "system",
                    content: "Extrahiere strukturierte Buchdaten aus Cover-Bildern."
                },
                {
                    role: "user",
                    content
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2
        })
    });

    if (!response.ok) {
        let errorMessage = `OpenAI API Fehler (Status ${response.status}).`;
        try {
            const payload = await response.json();
            if (payload?.error?.message) {
                errorMessage = payload.error.message;
            }
        } catch (error) {
            // ignore parse errors
        }
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
    }

    const payload = await response.json();
    const contentText = payload?.choices?.[0]?.message?.content;
    if (!contentText) {
        const error = new Error("OpenAI hat keine verwertbare Antwort geliefert.");
        error.status = 502;
        throw error;
    }

    let parsed = null;
    try {
        parsed = JSON.parse(contentText);
    } catch (error) {
        const parseError = new Error("OpenAI-Antwort ist kein gültiges JSON.");
        parseError.status = 502;
        throw parseError;
    }

    const results = Array.isArray(parsed) ? parsed : parsed?.results;
    if (!Array.isArray(results)) {
        const error = new Error("OpenAI-Antwort enthält keine Ergebnisliste.");
        error.status = 502;
        throw error;
    }

    return results;
}

export function normalizeOpenAiResult(raw) {
    const fileIndex = Number(raw?.fileIndex);
    const title = typeof raw?.title === "string" ? raw.title.trim() : "";
    const isbn = typeof raw?.isbn === "string" ? raw.isbn.trim() : null;
    let authors = [];
    if (Array.isArray(raw?.authors)) {
        authors = raw.authors.map((author) => String(author ?? "").trim()).filter(Boolean);
    } else if (typeof raw?.authors === "string") {
        authors = raw.authors.split(",").map((part) => part.trim()).filter(Boolean);
    }
    const ambiguous = Boolean(raw?.ambiguous);
    const confidence = raw?.confidence ?? null;
    const errors = Array.isArray(raw?.errors)
        ? raw.errors.map((err) => String(err ?? "").trim()).filter(Boolean)
        : [];

    return {
        fileIndex: Number.isFinite(fileIndex) ? fileIndex : null,
        title,
        authors,
        isbn,
        ambiguous,
        confidence,
        errors
    };
}
