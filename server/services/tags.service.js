import * as tagsRepo from "../repositories/tags.repo.js";

export async function listTags() {
    return tagsRepo.fetchTags();
}

export async function createTag(name) {
    return tagsRepo.insertTag(name);
}

export async function updateTag(tagId, name) {
    return tagsRepo.updateTag(tagId, name);
}

export async function removeTag(tagId) {
    await tagsRepo.deleteTagRelations(tagId);
    return tagsRepo.deleteTag(tagId);
}
