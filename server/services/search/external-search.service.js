import { getApiKey } from "../../../config/config-store.js";
import { SearchSource, normalizeTitleInput } from "../../models/search.models.js";
import { searchGoogleBooks } from "./providers/google-books.provider.js";
import { searchOpenLibrary } from "./providers/open-library.provider.js";
import { searchDnb } from "./providers/dnb.provider.js";

const PROVIDERS = [SearchSource.GOOGLE_BOOKS, SearchSource.OPEN_LIBRARY, SearchSource.DNB];
const PROVIDER_LIMITS = Object.freeze({
    [SearchSource.GOOGLE_BOOKS]: 20,
    [SearchSource.OPEN_LIBRARY]: 60,
    [SearchSource.DNB]: 20
});

function logProviderSuccess({ provider, query, requestUrl, status, count, total }) {
    const totalLabel = typeof total === "number" ? total : "n/a";
    console.info(
        `[ExternalSearch] provider=${provider} query="${query}" status=${status} count=${count} total=${totalLabel} url=${requestUrl}`
    );
}

function logProviderError({ provider, query, error }) {
    const details = error?.details || {};
    const status = details.status ? ` status=${details.status}` : "";
    const statusText = details.statusText ? ` statusText="${details.statusText}"` : "";
    const requestUrl = details.requestUrl ? ` url=${details.requestUrl}` : "";
    const snippet = details.bodySnippet ? ` body="${details.bodySnippet}"` : "";
    console.error(
        `[ExternalSearch] provider=${provider} query="${query}" error=${error?.code || error?.message || "unknown"}${status}${statusText}${requestUrl}${snippet}`
    );
}

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
            const googleBooksResult = await searchGoogleBooks(normalizedTitle, {
                apiKey,
                limit: PROVIDER_LIMITS[SearchSource.GOOGLE_BOOKS]
            });
            results.push(...googleBooksResult.items);
            providerStatus[SearchSource.GOOGLE_BOOKS] = {
                status: "ok",
                count: googleBooksResult.items.length,
                total: googleBooksResult.totalItems,
                limit: googleBooksResult.limit
            };
            logProviderSuccess({
                provider: SearchSource.GOOGLE_BOOKS,
                query: normalizedTitle,
                requestUrl: googleBooksResult.requestUrl,
                status: googleBooksResult.status,
                count: googleBooksResult.items.length,
                total: googleBooksResult.totalItems
            });
        } catch (error) {
            if (error.code === "GOOGLE_BOOKS_KEY_MISSING") {
                const missingKeyError = new Error("Google Books API-Schlüssel fehlt.");
                missingKeyError.code = "GOOGLE_BOOKS_KEY_MISSING";
                throw missingKeyError;
            }
            providerStatus[SearchSource.GOOGLE_BOOKS] = {
                status: "error",
                error: error.code || "GOOGLE_BOOKS_ERROR",
                statusCode: error?.details?.status
            };
            logProviderError({ provider: SearchSource.GOOGLE_BOOKS, query: normalizedTitle, error });
        }
    }

    if (requestedProviders.includes(SearchSource.OPEN_LIBRARY)) {
        try {
            const openLibraryResult = await searchOpenLibrary(normalizedTitle, {
                limit: PROVIDER_LIMITS[SearchSource.OPEN_LIBRARY]
            });
            results.push(...openLibraryResult.items);
            providerStatus[SearchSource.OPEN_LIBRARY] = {
                status: "ok",
                count: openLibraryResult.items.length,
                total: openLibraryResult.totalItems,
                limit: openLibraryResult.limit
            };
            logProviderSuccess({
                provider: SearchSource.OPEN_LIBRARY,
                query: normalizedTitle,
                requestUrl: openLibraryResult.requestUrl,
                status: openLibraryResult.status,
                count: openLibraryResult.items.length,
                total: openLibraryResult.totalItems
            });
        } catch (error) {
            providerStatus[SearchSource.OPEN_LIBRARY] = {
                status: "error",
                error: error.code || "OPEN_LIBRARY_ERROR",
                statusCode: error?.details?.status
            };
            logProviderError({ provider: SearchSource.OPEN_LIBRARY, query: normalizedTitle, error });
        }
    }

    if (requestedProviders.includes(SearchSource.DNB)) {
        try {
            const dnbResult = await searchDnb(normalizedTitle, {
                limit: PROVIDER_LIMITS[SearchSource.DNB]
            });
            results.push(...dnbResult.items);
            providerStatus[SearchSource.DNB] = {
                status: "ok",
                count: dnbResult.items.length,
                total: dnbResult.totalItems,
                limit: dnbResult.limit,
                providerMeta: dnbResult.providerMeta
            };
            logProviderSuccess({
                provider: SearchSource.DNB,
                query: normalizedTitle,
                requestUrl: dnbResult.requestUrl,
                status: dnbResult.status,
                count: dnbResult.items.length,
                total: dnbResult.totalItems
            });
        } catch (error) {
            providerStatus[SearchSource.DNB] = {
                status: "error",
                error: error.code || "DNB_ERROR",
                statusCode: error?.details?.status
            };
            logProviderError({ provider: SearchSource.DNB, query: normalizedTitle, error });
        }
    }

    return { items: results, providerStatus };
}
