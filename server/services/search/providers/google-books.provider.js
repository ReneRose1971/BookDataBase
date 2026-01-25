import { createSearchResultItem, SearchSource } from "../../../models/search.models.js";

function extractIsbn(identifiers = []) {
    if (!Array.isArray(identifiers)) {
        return null;
    }
    const preferred = identifiers.find((id) => id.type === "ISBN_13" || id.type === "ISBN_10");
    return preferred?.identifier || identifiers[0]?.identifier || null;
}

function extractYear(publishedDate) {
    if (typeof publishedDate !== "string") {
        return null;
    }
    const match = publishedDate.match(/\d{4}/);
    return match ? Number(match[0]) : null;
}

export async function searchGoogleBooks(title, { apiKey, limit = 10, fetcher = fetch } = {}) {
    if (!apiKey) {
        const error = new Error("GOOGLE_BOOKS_KEY_MISSING");
        error.code = "GOOGLE_BOOKS_KEY_MISSING";
        throw error;
    }

    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", `intitle:${title}`);
    url.searchParams.set("maxResults", String(limit));
    url.searchParams.set("key", apiKey);

    const response = await fetcher(url.toString());
    if (!response.ok) {
        const error = new Error(`Google Books request failed with ${response.status}`);
        error.code = "GOOGLE_BOOKS_ERROR";
        throw error;
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];

    return items
        .map((entry) => {
            const volumeInfo = entry.volumeInfo || {};
            const volumeTitle = volumeInfo.title || "";
            if (!volumeTitle) {
                return null;
            }
            return createSearchResultItem({
                title: volumeTitle,
                authors: Array.isArray(volumeInfo.authors) ? volumeInfo.authors : [],
                isbn: extractIsbn(volumeInfo.industryIdentifiers),
                year: extractYear(volumeInfo.publishedDate),
                source: SearchSource.GOOGLE_BOOKS,
                rawPayload: {
                    id: entry.id,
                    source: "google_books"
                }
            });
        })
        .filter(Boolean);
}
