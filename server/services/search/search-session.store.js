import crypto from "crypto";

const DEFAULT_TTL_MS = 15 * 60 * 1000;

const sessions = new Map();

function now() {
    return Date.now();
}

function isExpired(session, ttlMs) {
    return now() - session.updatedAt > ttlMs;
}

export function createSearchSession({ query, localItems, externalItems = [] }, ttlMs = DEFAULT_TTL_MS) {
    const sessionId = crypto.randomUUID();
    const timestamp = now();
    const session = {
        sessionId,
        query,
        localItems: Array.isArray(localItems) ? localItems : [],
        externalItems: Array.isArray(externalItems) ? externalItems : [],
        createdAt: timestamp,
        updatedAt: timestamp,
        ttlMs
    };
    sessions.set(sessionId, session);
    return session;
}

export function updateSearchSession(sessionId, updates = {}) {
    const session = sessions.get(sessionId);
    if (!session) {
        return null;
    }
    const merged = {
        ...session,
        ...updates,
        updatedAt: now()
    };
    sessions.set(sessionId, merged);
    return merged;
}

export function getSearchSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
        return null;
    }
    if (isExpired(session, session.ttlMs)) {
        sessions.delete(sessionId);
        return null;
    }
    return session;
}

export function getCombinedItems(session) {
    if (!session) {
        return [];
    }
    return [...(session.localItems || []), ...(session.externalItems || [])];
}

export function purgeExpiredSessions() {
    for (const [sessionId, session] of sessions.entries()) {
        if (isExpired(session, session.ttlMs)) {
            sessions.delete(sessionId);
        }
    }
}
