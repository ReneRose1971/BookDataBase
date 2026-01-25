import * as searchRepo from "../../repositories/search.repo.js";
import { buildSearchQuery, createSearchResultItem, SearchSource } from "../../models/search.models.js";

export async function searchLocalByTitle(title) {
    const query = buildSearchQuery(title);
    if (!query.normalizedTitle || query.tokens.length === 0) {
        return { query, items: [] };
    }

    const result = await searchRepo.searchBooksByTitleTokens(query.tokens);
    const items = result.rows.map((row) => {
        const authors = Array.isArray(row.authors)
            ? row.authors.map((author) => ({
                firstName: author.first_name,
                lastName: author.last_name
            }))
            : [];

        return createSearchResultItem({
            title: row.title,
            authors,
            source: SearchSource.LOCAL,
            rawPayload: { bookId: row.book_id }
        });
    });

    return { query, items };
}
