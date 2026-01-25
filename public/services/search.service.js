import { getJson, postJson } from '../api/api-client.js';

export async function searchLocal(title) {
    return postJson('/api/search/local', { title });
}

export async function searchExternal({ sessionId, title, providers } = {}) {
    return postJson('/api/search/external', { sessionId, title, providers });
}

export async function getSearchResults(sessionId) {
    return getJson(`/api/search/results/${sessionId}`);
}

export async function importAuthor(payload) {
    return postJson('/api/search/import/author', payload);
}

export async function importBook(payload) {
    return postJson('/api/search/import/book', payload);
}
