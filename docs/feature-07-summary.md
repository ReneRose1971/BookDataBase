# Feature 07 – Buch-Summary mit konfigurierbarem OpenAI-Prompt

## Datenmodelländerung
- Tabelle `books` wurde um die Spalte `summary` (TEXT, NULL) erweitert.
- Die Book-Endpunkte laden und speichern die Zusammenfassung nun mit.

## Prompt-Konzept
- Prompts liegen im Ordner `prompts/`:
  - `book_summary.system.md`
  - `book_summary.user.md`
- Der System-Prompt definiert Rolle, Stil und Regeln (Deutsch, sachlich, keine Spoiler, 3–6 Absätze).
- Der User-Prompt enthält Platzhalter für Buchdaten (`{{title}}`, `{{authors}}`, `{{lists}}`, `{{tags}}`).

## Neue API-Endpunkte
- `GET /api/config/prompts/book_summary`
  - Liefert die aktuellen Prompt-Vorlagen.
- `PUT /api/config/prompts/book_summary`
  - Speichert System- und User-Prompt (Whitelist, Längen- und Leere-Validierung).
- `POST /api/books/:id/summary`
  - Erstellt eine Zusammenfassung via OpenAI, speichert sie in `books.summary` und gibt sie zurück.
