import { getApiKey } from "../../../config/config-store.js";
import { SearchSource } from "../../models/search.models.js";

export const SUPPORTED_PROVIDERS = Object.freeze([
    SearchSource.GOOGLE_BOOKS,
    SearchSource.OPEN_LIBRARY,
    SearchSource.DNB
]);

export function getSupportedProviders() {
    return [...SUPPORTED_PROVIDERS];
}

export function normalizeProviders(requestedProviders) {
    if (!Array.isArray(requestedProviders) || requestedProviders.length === 0) {
        return getSupportedProviders();
    }
    return requestedProviders.filter((provider) => SUPPORTED_PROVIDERS.includes(provider));
}

export async function getProviderInfo() {
    const supportedProviders = getSupportedProviders();
    const enabledProviders = [];
    const disabledProviders = {};
    const googleBooksKey = await getApiKey("google_books");

    for (const provider of supportedProviders) {
        switch (provider) {
            case SearchSource.GOOGLE_BOOKS:
                if (googleBooksKey) {
                    enabledProviders.push(provider);
                } else {
                    disabledProviders[provider] = "API_KEY_MISSING";
                }
                break;
            case SearchSource.OPEN_LIBRARY:
            case SearchSource.DNB:
                enabledProviders.push(provider);
                break;
            default:
                disabledProviders[provider] = "UNSUPPORTED_PROVIDER";
                break;
        }
    }

    return {
        supportedProviders,
        enabledProviders,
        disabledProviders
    };
}
