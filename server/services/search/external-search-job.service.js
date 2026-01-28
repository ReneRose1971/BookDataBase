import crypto from "crypto";
import { getApiKey } from "../../../config/config-store.js";
import { normalizeContainsInput, SearchSource } from "../../models/search.models.js";
import { searchLocalByTitle } from "./local-search.service.js";
import {
    createSearchSession,
    updateSearchSession,
    getSearchSession,
    purgeExpiredSessions
} from "./search-session.store.js";
import { normalizeProviders, SUPPORTED_PROVIDERS } from "./search-providers.service.js";
import { searchGoogleBooks } from "./providers/google-books.provider.js";
import { searchOpenLibrary } from "./providers/open-library.provider.js";
import { searchDnb } from "./providers/dnb.provider.js";

const PROVIDER_PAGE_SIZES = Object.freeze({
    [SearchSource.GOOGLE_BOOKS]: 20,
    [SearchSource.OPEN_LIBRARY]: 50,
    [SearchSource.DNB]: 100
});

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const jobs = new Map();

function now() {
    return Date.now();
}

function isExpired(job, ttlMs) {
    return now() - job.updatedAt > ttlMs;
}

function purgeExpiredJobs() {
    for (const [searchId, job] of jobs.entries()) {
        if (isExpired(job, job.ttlMs)) {
            jobs.delete(searchId);
        }
    }
}

function buildItemKey(item) {
    const titleKey = normalizeContainsInput(item?.title || "");
    const authorKey = Array.isArray(item?.authors)
        ? item.authors
            .map((author) => normalizeContainsInput(author.fullName || `${author.firstName || ""} ${author.lastName || ""}`.trim()))
            .filter(Boolean)
            .join("|")
        : "";
    return `${titleKey}::${authorKey}`;
}

function matchesContains(item, normalizedQuery) {
    if (!normalizedQuery) {
        return false;
    }
    const normalizedTitle = normalizeContainsInput(item?.title || "");
    return normalizedTitle.includes(normalizedQuery);
}

function updateJobItems(job, newItems = []) {
    let addedCount = 0;
    for (const item of newItems) {
        const key = buildItemKey(item);
        if (job.itemKeys.has(key)) {
            continue;
        }
        job.itemKeys.add(key);
        job.externalItems.push(item);
        addedCount += 1;
    }
    if (addedCount > 0) {
        job.items = [...job.localItems, ...job.externalItems];
        updateSearchSession(job.sessionId, { externalItems: job.externalItems });
    }
    job.updatedAt = now();
    return addedCount;
}

function updateProviderProgress(job, provider, updates = {}) {
    job.providerProgress[provider] = {
        ...(job.providerProgress[provider] || {}),
        ...updates
    };
    job.updatedAt = now();
}

async function runGoogleBooksPaging(job, query, normalizedQuery) {
    const provider = SearchSource.GOOGLE_BOOKS;
    let page = 1;
    let startIndex = 0;
    let totalItems = null;
    let matchedItems = 0;

    let apiKey = null;
    try {
        apiKey = await getApiKey("google_books");
        if (!apiKey) {
            throw new Error("GOOGLE_BOOKS_KEY_MISSING");
        }
    } catch (error) {
        updateProviderProgress(job, provider, {
            status: "error",
            error: "GOOGLE_BOOKS_KEY_MISSING"
        });
        return;
    }

    while (!job.cancelled) {
        const controller = new AbortController();
        job.abortControllers.set(provider, controller);
        try {
            const result = await searchGoogleBooks(query, {
                apiKey,
                limit: PROVIDER_PAGE_SIZES[provider],
                startIndex,
                signal: controller.signal
            });
            totalItems = typeof result.totalItems === "number" ? result.totalItems : totalItems;
            const filtered = result.items.filter((item) => matchesContains(item, normalizedQuery));
            matchedItems += updateJobItems(job, filtered);
            updateProviderProgress(job, provider, {
                status: "running",
                page,
                fetchedItems: result.items.length,
                matchedItems,
                total: totalItems
            });
            if (result.items.length === 0 || result.items.length < PROVIDER_PAGE_SIZES[provider]) {
                break;
            }
            startIndex += PROVIDER_PAGE_SIZES[provider];
            page += 1;
        } catch (error) {
            if (job.cancelled && error?.name === "AbortError") {
                return;
            }
            updateProviderProgress(job, provider, {
                status: "error",
                error: error?.code || "GOOGLE_BOOKS_ERROR"
            });
            return;
        }
    }

    updateProviderProgress(job, provider, {
        status: job.cancelled ? "cancelled" : "done",
        page,
        matchedItems,
        total: totalItems
    });
}

async function runOpenLibraryPaging(job, query, normalizedQuery) {
    const provider = SearchSource.OPEN_LIBRARY;
    let page = 1;
    let totalItems = null;
    let matchedItems = 0;

    while (!job.cancelled) {
        const controller = new AbortController();
        job.abortControllers.set(provider, controller);
        try {
            const result = await searchOpenLibrary(query, {
                limit: PROVIDER_PAGE_SIZES[provider],
                page,
                signal: controller.signal
            });
            totalItems = typeof result.totalItems === "number" ? result.totalItems : totalItems;
            const filtered = result.items.filter((item) => matchesContains(item, normalizedQuery));
            matchedItems += updateJobItems(job, filtered);
            updateProviderProgress(job, provider, {
                status: "running",
                page,
                fetchedItems: result.items.length,
                matchedItems,
                total: totalItems
            });
            if (result.items.length === 0 || result.items.length < PROVIDER_PAGE_SIZES[provider]) {
                break;
            }
            if (typeof totalItems === "number" && page * PROVIDER_PAGE_SIZES[provider] >= totalItems) {
                break;
            }
            page += 1;
        } catch (error) {
            if (job.cancelled && error?.name === "AbortError") {
                return;
            }
            updateProviderProgress(job, provider, {
                status: "error",
                error: error?.code || "OPEN_LIBRARY_ERROR"
            });
            return;
        }
    }

    updateProviderProgress(job, provider, {
        status: job.cancelled ? "cancelled" : "done",
        page,
        matchedItems,
        total: totalItems
    });
}

async function runDnbPaging(job, query, normalizedQuery) {
    const provider = SearchSource.DNB;
    let page = 1;
    let startRecord = 1;
    let totalItems = null;
    let matchedItems = 0;

    while (!job.cancelled) {
        const controller = new AbortController();
        job.abortControllers.set(provider, controller);
        try {
            const result = await searchDnb(query, {
                limit: PROVIDER_PAGE_SIZES[provider],
                startRecord,
                pageSize: PROVIDER_PAGE_SIZES[provider],
                fetchAllPages: false,
                signal: controller.signal
            });
            totalItems = typeof result.totalItems === "number" ? result.totalItems : totalItems;
            const filtered = result.items.filter((item) => matchesContains(item, normalizedQuery));
            matchedItems += updateJobItems(job, filtered);
            updateProviderProgress(job, provider, {
                status: "running",
                page,
                fetchedItems: result.items.length,
                matchedItems,
                total: totalItems
            });
            if (result.items.length === 0 || result.items.length < PROVIDER_PAGE_SIZES[provider]) {
                break;
            }
            if (typeof totalItems === "number" && startRecord + PROVIDER_PAGE_SIZES[provider] > totalItems) {
                break;
            }
            startRecord += PROVIDER_PAGE_SIZES[provider];
            page += 1;
        } catch (error) {
            if (job.cancelled && error?.name === "AbortError") {
                return;
            }
            updateProviderProgress(job, provider, {
                status: "error",
                error: error?.code || "DNB_ERROR"
            });
            return;
        }
    }

    updateProviderProgress(job, provider, {
        status: job.cancelled ? "cancelled" : "done",
        page,
        matchedItems,
        total: totalItems
    });
}

async function runJobSearch(job, providers) {
    const normalizedQuery = normalizeContainsInput(job.query?.title || "");
    const tasks = [];

    if (providers.includes(SearchSource.GOOGLE_BOOKS)) {
        tasks.push(runGoogleBooksPaging(job, job.query.title, normalizedQuery));
    }
    if (providers.includes(SearchSource.OPEN_LIBRARY)) {
        tasks.push(runOpenLibraryPaging(job, job.query.title, normalizedQuery));
    }
    if (providers.includes(SearchSource.DNB)) {
        tasks.push(runDnbPaging(job, job.query.title, normalizedQuery));
    }

    await Promise.allSettled(tasks);
    if (!job.cancelled) {
        job.state = "done";
    }
    job.updatedAt = now();
}

export async function startExternalSearchJob(query, { providers } = {}) {
    purgeExpiredSessions();
    purgeExpiredJobs();
    const localResult = await searchLocalByTitle(query);
    const session = createSearchSession({ query: localResult.query, localItems: localResult.items });
    const searchId = crypto.randomUUID();
    const timestamp = now();
    const job = {
        searchId,
        sessionId: session.sessionId,
        query: localResult.query,
        state: "running",
        cancelled: false,
        items: [...localResult.items],
        localItems: [...localResult.items],
        externalItems: [],
        providerProgress: {},
        abortControllers: new Map(),
        itemKeys: new Set(localResult.items.map(buildItemKey)),
        createdAt: timestamp,
        updatedAt: timestamp,
        ttlMs: DEFAULT_TTL_MS
    };

    jobs.set(searchId, job);
    const normalizedProviders = normalizeProviders(providers);
    runJobSearch(job, normalizedProviders);
    return { id: searchId };
}

export function getExternalSearchJobStatus(searchId) {
    purgeExpiredJobs();
    const job = jobs.get(searchId);
    if (!job || isExpired(job, job.ttlMs)) {
        jobs.delete(searchId);
        return null;
    }
    return {
        state: job.state,
        items: job.items,
        providerProgress: job.providerProgress
    };
}

export function getExternalSearchSessionId(searchId) {
    const job = jobs.get(searchId);
    if (!job || isExpired(job, job.ttlMs)) {
        jobs.delete(searchId);
        return null;
    }
    return job.sessionId;
}

export function cancelExternalSearchJob(searchId) {
    const job = jobs.get(searchId);
    if (!job || isExpired(job, job.ttlMs)) {
        jobs.delete(searchId);
        return null;
    }
    job.cancelled = true;
    job.state = "cancelled";
    for (const controller of job.abortControllers.values()) {
        controller.abort();
    }
    for (const provider of SUPPORTED_PROVIDERS) {
        if (job.providerProgress[provider]?.status === "running") {
            updateProviderProgress(job, provider, { status: "cancelled" });
        }
    }
    job.updatedAt = now();
    return { ok: true };
}

export function getExternalSearchItem(searchId, itemId) {
    const sessionId = getExternalSearchSessionId(searchId);
    if (!sessionId) {
        return null;
    }
    const session = getSearchSession(sessionId);
    if (!session) {
        return null;
    }
    const combined = [...(session.localItems || []), ...(session.externalItems || [])];
    return combined.find((item) => item.itemId === itemId) || null;
}
