# FT(05) Implementierungs-Log

## 2026-02-12T10:30:00+00:00

### Änderungen / Dateien
- Update: `server/services/search/providers/dnb.provider.js` (DNB-SRU-Integration inkl. Mapping/Fehlercodes)
- Update: `server/services/search/external-search.service.js` (DNB-Provider aktiviert)
- Update: `server/models/search.models.js` (erweiterte Suchtreffer-Felder)
- Update: `public/controllers/search.controller.js` (Import-Buttons nur für externe Treffer)
- Update: `package.json`, `package-lock.json` (fast-xml-parser)

### Notizen
- DNB-Provider liefert echte Treffer über SRU (recordSchema=dc).
- Fehlercodes: `DNB_UNAVAILABLE`, `DNB_BAD_RESPONSE`.
- Lokale Treffer blenden Import-Buttons aus.

### Offene Punkte / TODO
- Externe Rate-Limits/Caching noch nicht umgesetzt.
- Optional: Persistente Speicherung der Search-Sessions statt In-Memory.

## 2026-01-25T15:15:43+00:00

### Änderungen / Dateien
- Neu: `server/models/search.models.js`
- Neu: `server/repositories/search.repo.js`
- Neu: `server/services/search/search-session.store.js`
- Neu: `server/services/search/local-search.service.js`
- Neu: `server/services/search/external-search.service.js`
- Neu: `server/services/search/search-facade.service.js`
- Neu: `server/services/search/providers/google-books.provider.js`
- Neu: `server/services/search/providers/open-library.provider.js`
- Neu: `server/services/search/providers/dnb.provider.js`
- Neu: `server/controllers/search.controller.js`
- Neu: `server/routes/search.routes.js`
- Update: `server/app.js`
- Update: `server/repositories/authors.repo.js`
- Update: `server/services/authors.service.js`
- Update: `config/config-store.js`
- Update: `server/controllers/config.controller.js`
- Update: `server/routes/config.routes.js`

### Endpoints
- `POST /api/search/local` → lokale Titelsuche (UC25)
- `POST /api/search/external` → externe Suche (UC26)
- `GET /api/search/results/:id` → Ergebnisliste abrufen (UC27)
- `POST /api/search/results` → Ergebnisliste abrufen (UC27)
- `POST /api/search/import/author` → Autor aus Treffer übernehmen (UC28)
- `POST /api/search/import/book` → Buch aus Treffer übernehmen (UC29)
- `POST /api/config/apis/google-books` → Google-Books-Key speichern
- `DELETE /api/config/apis/google-books` → Google-Books-Key entfernen

### Services / Provider
- `LocalSearchService` (lokale Titelsuche, Normalisierung, Tokenisierung)
- `ExternalSearchService` (Provider-Orchestrierung, Aggregation, optionale Deduplikation)
- `SearchFacade` (UC25 → optional UC26 → UC27, Ergebnislisten-Handling)
- Provider: `GoogleBooksProvider`, `OpenLibraryProvider`, `DnbProvider` (TODO für DNB-API)
- Search-Session-Store (kurzlebig, in-memory)

### Regeln & Validierungen (FT/UC)
- Titel darf nicht leer sein (UC25)
- Lokale Suche ist immer erster Schritt (FT05)
- Externe Suche nur auf explizite Anfrage (UC26)
- Ergebnisliste kombiniert lokale + externe Treffer (UC27)
- Übernahme benötigt explizite Bestätigung (UC28/UC29)
- Autor-Dublette verhindern (Feature 01, UC28)
- Buch benötigt mind. 1 Autor + mind. 1 Bücherliste (Feature 07, UC29)
- Google Books Key erforderlich; Key wird nie geloggt oder im Klartext zurückgegeben (Feature 06)

### Offene Punkte / TODO
- Externe Rate-Limits/Caching noch nicht umgesetzt.
- Optional: Persistente Speicherung der Search-Sessions statt In-Memory.

### Hinweis
- UI wurde explizit nicht umgesetzt.
