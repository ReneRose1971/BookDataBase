import { searchLocalByTitle } from "./local-search.service.js";
import { searchExternalByTitle } from "./external-search.service.js";
import {
    createSearchSession,
    updateSearchSession,
    getSearchSession,
    getCombinedItems,
    purgeExpiredSessions
} from "./search-session.store.js";
import {
    createImportCandidateAuthor,
    createImportCandidateBook,
    normalizeTitleInput
} from "../../models/search.models.js";
import * as authorsRepo from "../../repositories/authors.repo.js";
import * as authorsService from "../authors.service.js";

function buildCounts(items) {
    return items.reduce((acc, item) => {
        const source = item.source || "unknown";
        acc[source] = (acc[source] || 0) + 1;
        return acc;
    }, {});
}

function dedupeItems(items) {
    const seen = new Set();
    return items.filter((item) => {
        const titleKey = normalizeTitleInput(item.title);
        const authorKey = Array.isArray(item.authors)
            ? item.authors.map((author) => normalizeTitleInput(author.fullName || `${author.firstName} ${author.lastName}`)).join("|")
            : "";
        const key = `${titleKey}::${authorKey}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function buildSessionResponse(session) {
    const items = getCombinedItems(session);
    return {
        sessionId: session.sessionId,
        query: session.query,
        items,
        counts: buildCounts(items),
        providerStatus: session.providerStatus || {}
    };
}

export async function runLocalSearch(title) {
    purgeExpiredSessions();
    const { query, items } = await searchLocalByTitle(title);
    const session = createSearchSession({ query, localItems: items });
    return buildSessionResponse(session);
}

export async function runExternalSearch({ sessionId, title, providers } = {}) {
    purgeExpiredSessions();
    let session = sessionId ? getSearchSession(sessionId) : null;
    const normalizedTitle = normalizeTitleInput(title);

    if (session && normalizedTitle) {
        const existingTitle = normalizeTitleInput(session.query?.title);
        if (existingTitle && existingTitle !== normalizedTitle) {
            session = null;
        }
    }

    if (!session) {
        const localResult = await runLocalSearch(title);
        session = getSearchSession(localResult.sessionId);
    }

    if (!session) {
        return null;
    }

    const externalResult = await searchExternalByTitle(session.query.title, { providers });
    const dedupedExternal = dedupeItems(externalResult.items || []);

    session = updateSearchSession(session.sessionId, {
        externalItems: dedupedExternal,
        providerStatus: externalResult.providerStatus
    });

    return buildSessionResponse(session);
}

export function getSearchResults(sessionId) {
    const session = getSearchSession(sessionId);
    if (!session) {
        return null;
    }
    return buildSessionResponse(session);
}

export function getResultItem(sessionId, itemId) {
    const session = getSearchSession(sessionId);
    if (!session) {
        return null;
    }
    return getCombinedItems(session).find((item) => item.itemId === itemId) || null;
}

export function buildAuthorCandidateFromItem(item, authorIndex = 0) {
    if (!item || !Array.isArray(item.authors) || item.authors.length === 0) {
        return null;
    }
    const author = item.authors[authorIndex] || item.authors[0];
    return createImportCandidateAuthor(author);
}

export function buildBookCandidateFromItem(item) {
    if (!item) {
        return null;
    }
    return createImportCandidateBook({
        title: item.title,
        authors: item.authors,
        isbn: item.isbn || null,
        year: item.year || null
    });
}

export async function resolveAuthorIds(authors) {
    if (!Array.isArray(authors) || authors.length === 0) {
        return [];
    }

    const resolved = [];

    for (const author of authors) {
        const firstName = author.firstName?.trim() || "";
        const lastName = author.lastName?.trim() || "";
        if (!firstName || !lastName) {
            continue;
        }
        const existing = await authorsRepo.fetchAuthorByName(firstName, lastName);
        if (existing.rowCount > 0) {
            resolved.push(existing.rows[0].author_id);
            continue;
        }
        const { duplicateResult, result } = await authorsService.createAuthor(firstName, lastName);
        if (duplicateResult.rowCount > 0) {
            const fallback = await authorsRepo.fetchAuthorByName(firstName, lastName);
            if (fallback.rowCount > 0) {
                resolved.push(fallback.rows[0].author_id);
            }
            continue;
        }
        if (result?.rows?.[0]?.author_id) {
            resolved.push(result.rows[0].author_id);
        }
    }

    return resolved;
}
