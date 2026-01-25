import * as listsRepo from "../repositories/book-lists.repo.js";

export async function ensureStandardLists() {
    return listsRepo.seedStandardLists();
}

export async function listBookLists() {
    return listsRepo.fetchLists();
}

export async function getBookListById(bookListId) {
    return listsRepo.fetchListById(bookListId);
}

export async function createBookList(name) {
    return listsRepo.insertList(name);
}

export async function updateBookList(bookListId, name) {
    const listResult = await listsRepo.fetchListMeta(bookListId);
    return { listResult, nameCheckResult: await listsRepo.checkNameConflict(name, bookListId) };
}

export async function saveBookList(bookListId, name) {
    return listsRepo.updateList(name, bookListId);
}

export async function deleteBookList(bookListId) {
    const listResult = await listsRepo.fetchListMeta(bookListId);
    const orphanCheckResult = await listsRepo.checkOrphanBooks(bookListId);

    return { listResult, orphanCheckResult };
}

export async function removeBookList(bookListId) {
    await listsRepo.deleteBookListRelations(bookListId);
    await listsRepo.deleteBookList(bookListId);
}
