# Trefferliste: Sortierung + Pagination (Frontend)

## Defaults
- **Sortierung:** Titel (A–Z) als Standard (`title`, `asc`).
- **PageSize:** 10 Treffer pro Seite.
- **Page:** 1-basiert, wird bei Änderungen automatisch validiert (Clamp auf gültigen Bereich).

## Ableitungs-Algorithmus (stable sort + paging)
1. **Rohdaten sammeln:** `allItems` enthält alle Treffer (wird beim Polling erweitert).
2. **Sort-Key normalisieren:**
   - `trim` → `toLocaleLowerCase('de-DE')` → Whitespace normalisieren.
   - **Titel:** normalisierter `title`.
   - **Autor:** erster Autor (aus `authors`), normalisiert; leer, falls keine Autoren.
3. **Stabile Sortierung:**
   - Sortiere `({ item, idx })` per `localeCompare('de')`.
   - Bei Gleichheit entscheidet `idx` (ursprüngliche Reihenfolge bleibt stabil).
4. **Pagination:**
   - `totalCount = sortedItems.length`.
   - `totalPages = ceil(totalCount / pageSize)`.
   - `page` wird automatisch auf `[1, totalPages]` geklemmt.
   - `pagedItems` sind der Slice für die aktuelle Seite.

## Polling-Verhalten (jobbasierte externe Suche)
- Neue Treffer werden in `allItems` **gemergt** (bereits vorhandene Items werden aktualisiert, neue werden angehängt).
- Danach werden **Sortierung und Pagination erneut abgeleitet**, ohne die Sortierung zurückzusetzen.
- Die aktuelle Seite bleibt erhalten, solange sie gültig ist.
- Wenn die Suche läuft, wird die Trefferanzeige als **„Treffer: X (lädt …)“** ergänzt.

## Testprotokoll
1. **Pagination aktiv:** Suche mit > 10 Treffern, Seite 2 auswählen → Anzeige „Seite 2 von Z“, Buttons korrekt enabled/disabled.
2. **Sortierung + Toggle:** Auf „Titel“ klicken → A–Z, erneut klicken → Z–A. Dasselbe für „Autor(en)“.
3. **Polling + stabile Sortierung:** Externe Suche starten, Sortierung aktivieren, während neue Treffer eintreffen → Reihenfolge bleibt sortiert, aktuelle Seite bleibt erhalten.
