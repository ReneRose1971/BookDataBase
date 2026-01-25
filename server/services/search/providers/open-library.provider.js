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

export async function searchGoogleBooks(title, { limit = 10, fetcher = fetch } = {}) {
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", title);
    url.searchParams.set("maxResults", String(limit));

    const response = await fetcher(url.toString());
    if (!response.ok) {
        const error = new Error(`Google Books request failed with ${response.status}`);
        error.code = "GOOGLE_BOOKS_ERROR";
        throw error;
    }

    const data = await response.json();
    return data.items.map((item) => ({
        title: item.volumeInfo.title,
        authors: item.volumeInfo.authors || [],
        isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier || null,
        year: item.volumeInfo.publishedDate?.split("-")[0] || null,
        source: SearchSource.GOOGLE_BOOKS,
    }));
}
