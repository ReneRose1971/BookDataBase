import crypto from "crypto";

export const SearchSource = Object.freeze({
    LOCAL: "local",
    GOOGLE_BOOKS: "google_books",
    OPEN_LIBRARY: "open_library",
    DNB: "dnb"
});

export function normalizeTitleInput(title) {
    if (typeof title !== "string") {
        return "";
    }
    return title
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function tokenizeTitle(normalizedTitle) {
    if (!normalizedTitle) {
        return [];
    }
    return normalizedTitle.split(" ").filter(Boolean);
}

export function buildSearchQuery(title) {
    const normalizedTitle = normalizeTitleInput(title);
    return {
        title: typeof title === "string" ? title.trim() : "",
        normalizedTitle,
        tokens: tokenizeTitle(normalizedTitle)
    };
}

export function parseAuthorName(name) {
    if (!name || typeof name !== "string") {
        return { firstName: "", lastName: "", fullName: "" };
    }
    const trimmed = name.trim();
    if (!trimmed) {
        return { firstName: "", lastName: "", fullName: "" };
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: "", fullName: trimmed };
    }
    return {
        firstName: parts.slice(0, -1).join(" "),
        lastName: parts[parts.length - 1],
        fullName: trimmed
    };
}

export function normalizeAuthorInput(author) {
    if (!author) {
        return { firstName: "", lastName: "", fullName: "" };
    }
    if (typeof author === "string") {
        return parseAuthorName(author);
    }
    const firstName = typeof author.firstName === "string" ? author.firstName.trim() : "";
    const lastName = typeof author.lastName === "string" ? author.lastName.trim() : "";
    const fullName = typeof author.fullName === "string" && author.fullName.trim()
        ? author.fullName.trim()
        : [firstName, lastName].filter(Boolean).join(" ");

    return { firstName, lastName, fullName };
}

export function createSearchResultItem({
    title,
    authors = [],
    isbn = null,
    year = null,
    source,
    rawPayload = null,
    itemId = crypto.randomUUID()
}) {
    const normalizedAuthors = Array.isArray(authors)
        ? authors.map((author) => normalizeAuthorInput(author)).filter((author) => author.fullName || author.firstName || author.lastName)
        : [];

    return {
        itemId,
        title: typeof title === "string" ? title.trim() : "",
        authors: normalizedAuthors,
        isbn,
        year,
        source,
        rawPayload
    };
}

export function createImportCandidateAuthor(author) {
    const normalized = normalizeAuthorInput(author);
    return {
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        fullName: normalized.fullName
    };
}

export function createImportCandidateBook({ title, authors = [], isbn = null, year = null }) {
    return {
        title: typeof title === "string" ? title.trim() : "",
        authors: Array.isArray(authors) ? authors.map(createImportCandidateAuthor) : [],
        isbn,
        year
    };
}
