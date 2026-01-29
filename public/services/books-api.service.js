import { getJson, postJson, putJson, deleteJson } from '../api/api-client.js';

export async function fetchBooks(listId = null) {
    try {
        const url = listId ? `/api/books?listId=${listId}` : '/api/books';
        const data = await getJson(url);
        return data.items || [];
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function fetchBookLists() {
    try {
        const listsData = await getJson('/api/book-lists');
        return listsData.items || [];
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function fetchAuthors() {
    try {
        return await getJson('/api/authors');
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function fetchTags() {
    try {
        return await getJson('/api/tags');
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function fetchBook(bookId) {
    return getJson(`/api/books/${bookId}`);
}

export async function checkDuplicateBook(title, authorIds) {
    try {
        return await getJson(`/api/books/check-duplicate?title=${encodeURIComponent(title)}&authorIds=${JSON.stringify(authorIds)}`);
    } catch (error) {
        console.error(error);
        return { duplicate: false };
    }
}

export async function createBook(payload) {
    return postJson('/api/books', payload);
}

export async function updateBook(bookId, payload) {
    return putJson(`/api/books/${bookId}`, payload);
}

export async function deleteBook(bookId) {
    return deleteJson(`/api/books/${bookId}`);
}

export async function generateBookSummary(bookId) {
    return postJson(`/api/books/${bookId}/summary`);
}
