import * as searchFacade from "../services/search/search-facade.service.js";
import * as externalJobService from "../services/search/external-search-job.service.js";
import * as authorsService from "../services/authors.service.js";
import * as booksService from "../services/books.service.js";
import { createImportCandidateAuthor, createImportCandidateBook } from "../models/search.models.js";
import { getProviderInfo } from "../services/search/search-providers.service.js";

function isNonEmptyArray(value) {
    return Array.isArray(value) && value.length > 0;
}

export async function searchLocal(req, res) {
    const { title } = req.body;
    if (!title || !title.trim()) {
        return res.status(400).json({ error: "Titel darf nicht leer sein." });
    }

    try {
        const result = await searchFacade.runLocalSearch(title);
        res.json(result);
    } catch (error) {
        console.error("Error running local search:", error);
        res.status(500).json({ error: "Fehler bei der lokalen Suche." });
    }
}

export async function searchExternal(req, res) {
    const { sessionId, title, providers } = req.body;
    if (!sessionId && (!title || !title.trim())) {
        return res.status(400).json({ error: "Titel oder Session-ID erforderlich." });
    }

    try {
        const result = await searchFacade.runExternalSearch({ sessionId, title, providers });
        if (!result) {
            return res.status(404).json({ error: "Such-Session nicht gefunden." });
        }
        res.json(result);
    } catch (error) {
        if (error.code === "GOOGLE_BOOKS_KEY_MISSING") {
            return res.status(400).json({ error: "Google Books API-Schlüssel fehlt." });
        }
        console.error("Error running external search:", error);
        res.status(500).json({ error: "Fehler bei der externen Suche." });
    }
}

export async function getSearchProviders(req, res) {
    try {
        const providerInfo = await getProviderInfo();
        res.set("Cache-Control", "no-store");
        res.json(providerInfo);
    } catch (error) {
        console.error("Error fetching search providers:", error);
        res.status(500).json({ error: "Fehler beim Laden der Suchprovider." });
    }
}

export async function startExternalSearch(req, res) {
    const { query, providers } = req.body;
    if (query && typeof query === "object" && !Array.isArray(query)) {
        console.warn("External search query was an object with keys:", Object.keys(query));
    }
    if (typeof query !== "string" || query.trim().length === 0) {
        return res.status(400).json({
            error: "query must be a non-empty string",
            receivedType: typeof query
        });
    }

    try {
        const result = await externalJobService.startExternalSearchJob(query.trim(), { providers });
        res.json(result);
    } catch (error) {
        console.error("Error starting external search job:", error);
        res.status(500).json({ error: "Fehler beim Start der externen Suche." });
    }
}

export async function getExternalSearchStatus(req, res) {
    const searchId = req.params.searchId;
    if (!searchId) {
        return res.status(400).json({ error: "Search-ID erforderlich." });
    }

    try {
        const status = externalJobService.getExternalSearchJobStatus(searchId);
        if (!status) {
            return res.status(404).json({ error: "Such-Job nicht gefunden." });
        }
        res.json(status);
    } catch (error) {
        console.error("Error fetching external search status:", error);
        res.status(500).json({ error: "Fehler beim Laden des Suchstatus." });
    }
}

export async function cancelExternalSearch(req, res) {
    const searchId = req.params.searchId;
    if (!searchId) {
        return res.status(400).json({ error: "Search-ID erforderlich." });
    }

    try {
        const result = externalJobService.cancelExternalSearchJob(searchId);
        if (!result) {
            return res.status(404).json({ error: "Such-Job nicht gefunden." });
        }
        res.json(result);
    } catch (error) {
        console.error("Error cancelling external search job:", error);
        res.status(500).json({ error: "Fehler beim Abbrechen der externen Suche." });
    }
}

export async function getSearchResults(req, res) {
    const sessionId = req.params.id || req.body.sessionId;
    if (!sessionId) {
        return res.status(400).json({ error: "Session-ID erforderlich." });
    }

    try {
        const result = searchFacade.getSearchResults(sessionId);
        if (!result) {
            return res.status(404).json({ error: "Such-Session nicht gefunden." });
        }
        res.json(result);
    } catch (error) {
        console.error("Error fetching search results:", error);
        res.status(500).json({ error: "Fehler beim Laden der Suchergebnisse." });
    }
}

export async function importAuthor(req, res) {
    const { sessionId, searchId, itemId, authorIndex = 0, author, confirm } = req.body;

    let candidate = null;
    if (author) {
        candidate = createImportCandidateAuthor(author);
    } else if (sessionId && itemId) {
        const item = searchFacade.getResultItem(sessionId, itemId);
        if (!item) {
            return res.status(404).json({ error: "Suchtreffer nicht gefunden." });
        }
        candidate = searchFacade.buildAuthorCandidateFromItem(item, authorIndex);
    } else if (searchId && itemId) {
        const item = externalJobService.getExternalSearchItem(searchId, itemId);
        if (!item) {
            return res.status(404).json({ error: "Suchtreffer nicht gefunden." });
        }
        candidate = searchFacade.buildAuthorCandidateFromItem(item, authorIndex);
    }

    if (!candidate) {
        return res.status(400).json({ error: "Autorendaten fehlen." });
    }

    if (!confirm) {
        return res.json({ candidate, confirmRequired: true });
    }

    if (!candidate.firstName || !candidate.lastName) {
        return res.status(400).json({ error: "Vorname und Nachname sind erforderlich." });
    }

    try {
        const { duplicateResult, result } = await authorsService.createAuthor(candidate.firstName.trim(), candidate.lastName.trim());
        if (duplicateResult.rowCount > 0) {
            return res.status(409).json({ error: "Autor existiert bereits.", candidate });
        }
        res.status(201).json({ candidate, author: result.rows[0] });
    } catch (error) {
        console.error("Error importing author:", error);
        res.status(500).json({ error: "Fehler beim Übernehmen des Autors." });
    }
}

export async function importBook(req, res) {
    const { sessionId, searchId, itemId, book, authorIds, listIds, confirm } = req.body;

    let candidate = null;
    if (book) {
        candidate = createImportCandidateBook(book);
    } else if (sessionId && itemId) {
        const item = searchFacade.getResultItem(sessionId, itemId);
        if (!item) {
            return res.status(404).json({ error: "Suchtreffer nicht gefunden." });
        }
        candidate = searchFacade.buildBookCandidateFromItem(item);
    } else if (searchId && itemId) {
        const item = externalJobService.getExternalSearchItem(searchId, itemId);
        if (!item) {
            return res.status(404).json({ error: "Suchtreffer nicht gefunden." });
        }
        candidate = searchFacade.buildBookCandidateFromItem(item);
    }

    if (!candidate) {
        return res.status(400).json({ error: "Buchdaten fehlen." });
    }

    if (!confirm) {
        return res.json({ candidate, confirmRequired: true });
    }

    if (!candidate.title) {
        return res.status(400).json({ error: "Titel darf nicht leer sein." });
    }

    if (!isNonEmptyArray(listIds)) {
        return res.status(400).json({ error: "Mindestens eine Bücherliste ist erforderlich." });
    }

    let resolvedAuthorIds = isNonEmptyArray(authorIds) ? authorIds : [];

    if (resolvedAuthorIds.length === 0) {
        resolvedAuthorIds = await searchFacade.resolveAuthorIds(candidate.authors || []);
    }

    if (!isNonEmptyArray(resolvedAuthorIds)) {
        return res.status(400).json({ error: "Mindestens ein Autor ist erforderlich." });
    }

    try {
        const { bookId } = await booksService.createBook(candidate.title.trim(), resolvedAuthorIds, listIds);
        res.status(201).json({
            candidate,
            book: { book_id: bookId, title: candidate.title.trim() },
            authorIds: resolvedAuthorIds,
            listIds
        });
    } catch (error) {
        console.error("Error importing book:", error);
        res.status(500).json({ error: "Fehler beim Übernehmen des Buches." });
    }
}
