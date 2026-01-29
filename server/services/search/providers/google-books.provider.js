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

function buildGoogleBooksUrls(title, apiKey, limit, startIndex) {
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", `intitle:${title}`);
    url.searchParams.set("maxResults", String(limit));
    if (typeof startIndex === "number" && startIndex > 0) {
        url.searchParams.set("startIndex", String(startIndex));
    }
    if (apiKey) {
        url.searchParams.set("key", apiKey);
    }

    const logUrl = new URL(url.toString());
    if (logUrl.searchParams.has("key")) {
        logUrl.searchParams.set("key", "REDACTED");
    }

    return { url, logUrl };
}

function createProviderError(message, code, details) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
}

export async function searchGoogleBooks(title, { apiKey, limit = 10, startIndex = 0, fetcher = fetch, signal } = {}) {
    if (!apiKey) {
        const error = new Error("GOOGLE_BOOKS_KEY_MISSING");
        error.code = "GOOGLE_BOOKS_KEY_MISSING";
        throw error;
    }

    const { url, logUrl } = buildGoogleBooksUrls(title, apiKey, limit, startIndex);
    const response = await fetcher(url.toString(), { signal });
    if (!response.ok) {
        const bodyText = await response.text();
        throw createProviderError("GOOGLE_BOOKS_ERROR", "GOOGLE_BOOKS_ERROR", {
            status: response.status,
            statusText: response.statusText,
            bodySnippet: bodyText.slice(0, 500),
            requestUrl: logUrl.toString()
        });
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const mappedItems = items
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

    return {
        items: mappedItems,
        totalItems: typeof data.totalItems === "number" ? data.totalItems : null,
        requestUrl: logUrl.toString(),
        status: response.status,
        statusText: response.statusText,
        limit,
        startIndex
    };
}
