import { getApiKey } from "../../../config/config-store.js";
import { SearchSource, normalizeTitleInput } from "../../models/search.models.js";
import { searchGoogleBooks } from "./providers/google-books.provider.js";

const PROVIDERS = [SearchSource.GOOGLE_BOOKS];

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

    return { items: results, providerStatus };
}
