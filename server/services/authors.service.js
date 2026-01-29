import * as authorsRepo from "../repositories/authors.repo.js";

export async function listAuthors() {
    return authorsRepo.fetchAuthors();
}

export async function getAuthor(authorId) {
    return authorsRepo.fetchAuthorById(authorId);
}

export async function createAuthor(firstName, lastName) {
    const duplicateResult = await authorsRepo.checkAuthorDuplicate(firstName, lastName);
    if (duplicateResult.rowCount > 0) {
        return { duplicateResult, result: { rowCount: 0, rows: [] } };
    }
    return { duplicateResult, result: await authorsRepo.insertAuthor(firstName, lastName) };
}

export async function updateAuthor(authorId, firstName, lastName) {
    const duplicateResult = await authorsRepo.checkAuthorDuplicate(firstName, lastName, authorId);
    if (duplicateResult.rowCount > 0) {
        return { duplicateResult, result: { rowCount: 0, rows: [] } };
    }
    return { duplicateResult, result: await authorsRepo.updateAuthor(authorId, firstName, lastName) };
}

export async function getAuthorBooks(authorId) {
    return authorsRepo.fetchBooksByAuthor(authorId);
}

export async function removeAuthor(authorId) {
    const countResult = await authorsRepo.countAuthorBooks(authorId);
    if (countResult.rows[0].cnt > 0) {
        return { countResult };
    }
    const deleteResult = await authorsRepo.deleteAuthor(authorId);
    return { countResult, deleteResult };
}
