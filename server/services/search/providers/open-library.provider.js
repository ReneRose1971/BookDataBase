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

export async function searchOpenLibrary(title, { limit = 10, fetcher = fetch } = {}) {
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set("title", title);
    url.searchParams.set("limit", String(limit));

    const response = await fetcher(url.toString());
    if (!response.ok) {
        const error = new Error(`Open Library request failed with ${response.status}`);
        error.code = "OPEN_LIBRARY_ERROR";
        throw error;
    }

    const data = await response.json();
    const docs = Array.isArray(data.docs) ? data.docs : [];

    return docs
        .map((doc) => {
            const docTitle = doc.title || "";
            if (!docTitle) {
                return null;
            }
            return createSearchResultItem({
                title: docTitle,
                authors: Array.isArray(doc.author_name) ? doc.author_name : [],
                isbn: Array.isArray(doc.isbn) ? doc.isbn[0] : null,
                year: extractYear(doc.first_publish_year),
                source: SearchSource.OPEN_LIBRARY,
                rawPayload: {
                    key: doc.key,
                    source: "open_library"
                }
            });
        })
        .filter(Boolean);
}
