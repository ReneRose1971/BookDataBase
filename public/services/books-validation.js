export const BOOK_VALIDATION_MESSAGES = {
    titleInvalid: 'Bitte einen gültigen Titel eingeben.',
    authorsRequired: 'Ein Buch muss mindestens einen Autor haben.',
    listsRequired: 'Bitte wählen Sie mindestens eine Liste aus.',
    duplicate: 'Ein Buch mit diesem Titel und diesen Autoren existiert bereits.',
    selectBookRequired: 'Bitte ein Buch auswählen.',
    authorNotFound: 'Ausgewählter Autor nicht gefunden.',
    listNotFound: 'Ausgewählte Liste nicht gefunden.',
    tagNotFound: 'Ausgewähltes Tag nicht gefunden.'
};

export function validateTitle(title) {
    if (!title || title.trim().length < 2) {
        return BOOK_VALIDATION_MESSAGES.titleInvalid;
    }
    return null;
}

export function validateAuthors(authors) {
    if (!Array.isArray(authors) || authors.length === 0) {
        return BOOK_VALIDATION_MESSAGES.authorsRequired;
    }
    return null;
}

export function validateLists(lists) {
    if (!Array.isArray(lists) || lists.length === 0) {
        return BOOK_VALIDATION_MESSAGES.listsRequired;
    }
    return null;
}

export function getBookInputError({ title, authors, lists }) {
    return validateTitle(title)
        || validateAuthors(authors)
        || validateLists(lists)
        || null;
}
