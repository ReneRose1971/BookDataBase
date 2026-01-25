import { SearchSource, createSearchResultItem } from "../../../models/search.models.js";

export async function searchDnb(title) {
    return {
        items: [],
        warning: `DNB provider not configured for query: ${title}`,
        source: SearchSource.DNB
    };
}

export function buildDnbNotImplementedResult() {
    return {
        items: [],
        warning: "DNB provider is not implemented. TODO: add API integration.",
        source: SearchSource.DNB
    };
}

export function mapDnbPlaceholder(title) {
    return createSearchResultItem({
        title,
        authors: [],
        source: SearchSource.DNB,
        rawPayload: { note: "DNB provider not implemented" }
    });
}
