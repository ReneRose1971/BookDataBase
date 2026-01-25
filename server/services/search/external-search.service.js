import { getApiKey } from "../../../config/config-store.js";
import { SearchSource, normalizeTitleInput } from "../../models/search.models.js";
import { searchGoogleBooks } from "./providers/google-books.provider.js";
import { searchOpenLibrary } from "./providers/open-library.provider.js";
import { buildDnbNotImplementedResult } from "./providers/dnb.provider.js";

const PROVIDERS = [SearchSource.GOOGLE_BOOKS, SearchSource.OPEN_LIBRARY, SearchSource.DNB];

function normalizeProviders(requestedProviders) {
    if (!Array.isArray(requestedProviders) || requestedProviders.length === 0) {
        return PROVIDERS;
    }
    return requestedProviders.filter((provider) => PROVIDERS.includes(provider));
}

export async function searchExternalByTitle(title, { providers } = {}) {
    const normalizedTitle = normalizeTitleInput(title);
    if (!normalizedTitle) {
        return { items: [], providerStatus: {} };
    }

    const providerStatus = {};
    const requestedProviders = normalizeProviders(providers);
    const results = [];

    if (requestedProviders.includes(SearchSource.GOOGLE_BOOKS)) {
        try {
            const apiKey = await getApiKey("google_books");
            const googleItems = await searchGoogleBooks(normalizedTitle, { apiKey });
            results.push(...googleItems);
            providerStatus[SearchSource.GOOGLE_BOOKS] = { status: "ok", count: googleItems.length };
        } catch (error) {
            if (error.code === "GOOGLE_BOOKS_KEY_MISSING") {
                const missingKeyError = new Error("Google Books API-Schlüssel fehlt.");
                missingKeyError.code = "GOOGLE_BOOKS_KEY_MISSING";
                throw missingKeyError;
            }
            providerStatus[SearchSource.GOOGLE_BOOKS] = { status: "error" };
        }
    }

    if (requestedProviders.includes(SearchSource.OPEN_LIBRARY)) {
        try {
            const openLibraryItems = await searchOpenLibrary(normalizedTitle);
            results.push(...openLibraryItems);
            providerStatus[SearchSource.OPEN_LIBRARY] = { status: "ok", count: openLibraryItems.length };
        } catch (error) {
            providerStatus[SearchSource.OPEN_LIBRARY] = { status: "error" };
        }
    }

    if (requestedProviders.includes(SearchSource.DNB)) {
        const dnbResult = buildDnbNotImplementedResult();
        providerStatus[SearchSource.DNB] = { status: "todo", count: 0, warning: dnbResult.warning };
    }

    return { items: results, providerStatus };
}
