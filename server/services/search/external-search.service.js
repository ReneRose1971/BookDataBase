import { getApiKey } from "../../../config/config-store.js";
import { SearchSource, normalizeTitleInput } from "../../models/search.models.js";
import { searchGoogleBooks } from "./providers/google-books.provider.js";
import { searchOpenLibrary } from "./providers/open-library.provider.js";
import { searchDnb } from "./providers/dnb.provider.js";

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
            const googleBooksItems = await searchGoogleBooks(normalizedTitle, { apiKey });
            results.push(...googleBooksItems);
            providerStatus[SearchSource.GOOGLE_BOOKS] = { status: "ok", count: googleBooksItems.length };
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
        try {
            const dnbItems = await searchDnb(normalizedTitle);
            results.push(...dnbItems);
            providerStatus[SearchSource.DNB] = { status: "ok", count: dnbItems.length };
        } catch (error) {
            providerStatus[SearchSource.DNB] = { status: "error" };
        }
    }

    return { items: results, providerStatus };
}
