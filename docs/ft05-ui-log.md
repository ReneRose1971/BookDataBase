# FT05 UI Log – Büchersuche

## UI-Dateien
- `public/app.html` (Nav-Button „Büchersuche“)
- `public/app.js` (Route `search` → View/Controller/Title)
- `public/views/search.view.html`
- `public/controllers/search.controller.js`
- `public/services/search.service.js`
- `public/editors/search-import-author.editor.json`
- `public/editors/search-import-book.editor.json`
- `public/views/editors/shells/search-import-author.shell.html`
- `public/views/editors/shells/search-import-book.shell.html`
- `public/views/editors/parts/search-import-author-fields.part.html`
- `public/views/editors/parts/search-import-book-fields.part.html`
- `public/views/editors/parts/search-import-actions.part.html`
- `public/css/dataviews.css`
- `public/css/components.css`

## Navigation
- Neuer `.nav-button[data-view="search"]` mit Label „Büchersuche“ in der Stammdaten-Navigation.

## Verwendete Endpoints (nur bestehende)
- `POST /api/search/local`
- `POST /api/search/external`
- `POST /api/search/import/author`
- `POST /api/search/import/book`
- `GET /api/book-lists`

## Offene TODOs (technisch)
- Keine: DNB-Provider liefert aktuell nur TODO-Status im Backend (bekannter Stand).

## Akzeptanzkriterien
- Neuer Nav-Button lädt die „Büchersuche“-View zuverlässig.
- Lokale Suche funktioniert (oder zeigt klar, welcher Endpoint fehlt).
- Externe Suche ist ohne lokale Suche nicht möglich (disabled + Hinweis).
- Ergebnisliste zeigt lokale + externe Treffer gemeinsam.
- „Übernehmen“ öffnet einen Dialog/Editor mit Korrektur + expliziter Bestätigung.
- Keine Memory-Leaks: `unmount` räumt Events auf.
