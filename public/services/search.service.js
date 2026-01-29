import { getJson, postJson } from '../api/api-client.js';

export async function searchLocal(title) {
    return postJson('/api/search/local', { title });
}

export async function startExternalSearch(query, providers) {
    return postJson('/api/search/external/start', { query, providers });
}

export async function getExternalProviders() {
    return getJson('/api/search/providers');
}

export async function getExternalSearchStatus(searchId) {
    return getJson(`/api/search/external/status/${searchId}`);
}

export async function cancelExternalSearch(searchId) {
    return postJson(`/api/search/external/cancel/${searchId}`);
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
