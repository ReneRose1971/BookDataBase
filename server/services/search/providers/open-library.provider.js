import { createSearchResultItem, SearchSource } from "../../../models/search.models.js";

function extractYear(year) {
    if (typeof year === "number") {
        return year;
    }
    if (typeof year === "string") {
        const match = year.match(/\d{4}/);
        return match ? Number(match[0]) : null;
    }
    return null;
}

function pickFirst(value) {
    if (Array.isArray(value)) {
        return value.find((entry) => typeof entry === "string" && entry.trim()) || value[0] || "";
    }
    return typeof value === "string" ? value : "";
}

function createProviderError(message, code, details) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
}

export async function searchOpenLibrary(title, { limit = 40, fetcher = fetch } = {}) {
    if (!title) {
        return { items: [], totalItems: null, requestUrl: null, status: 200, statusText: "No query", limit };
    }

    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set("title", title);
    url.searchParams.set("limit", String(limit));

    const response = await fetcher(url.toString());
    if (!response.ok) {
        const bodyText = await response.text();
        throw createProviderError("OPEN_LIBRARY_ERROR", "OPEN_LIBRARY_ERROR", {
            status: response.status,
            statusText: response.statusText,
            bodySnippet: bodyText.slice(0, 500),
            requestUrl: url.toString()
        });
    }

    const data = await response.json();
    const docs = Array.isArray(data.docs) ? data.docs : [];
    const mappedItems = docs
        .map((doc) => {
            const titleValue = doc.title || "";
            if (!titleValue) {
                return null;
            }
            return createSearchResultItem({
                title: titleValue,
                authors: Array.isArray(doc.author_name) ? doc.author_name : [],
                isbn: pickFirst(doc.isbn) || null,
                year: extractYear(doc.first_publish_year),
                publisher: pickFirst(doc.publisher) || null,
                externalId: doc.key || null,
                source: SearchSource.OPEN_LIBRARY,
                rawPayload: {
                    key: doc.key || null,
                    source: "open_library"
                }
            });
        })
        .filter(Boolean);

    return {
        items: mappedItems,
        totalItems: typeof data.numFound === "number" ? data.numFound : null,
        requestUrl: url.toString(),
        status: response.status,
        statusText: response.statusText,
        limit
    };
}
