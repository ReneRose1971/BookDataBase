# Trefferliste: Filterung (Frontend)

## Filterfelder
- Titel
- Autor(en) (zusammengeführt)
- Optional: ISBN, Publisher, Jahr, externe ID (wenn vorhanden)

## Normalisierung
- `String(s ?? "")`
- `.toLowerCase()`
- `.trim()`
- Whitespace normalisieren (`/\s+/g` → " ")

## Pipeline
1. **Filter:** `filteredItems = filter(allItems, filterText)`
2. **Sortierung:** `sortedItems = sort(filteredItems, sortState)`
3. **Pagination:** `pagedItems = paginate(sortedItems, page, pageSize)`

> **Paging-Regel:** Bei Änderung von `filterText` wird `page` auf `1` gesetzt.

## Anzeige
- Ohne Filter: `Treffer: X`
- Mit Filter: `Treffer: X — Gefiltert: Y`

## Testfälle
1. **Contains, case-insensitive:** Filtertext `muster` findet Titel/Autor mit `Muster`.
2. **Titel + Autor:** Filtertext `mann` findet Treffer mit Autor `Thomas Mann`.
3. **Sortierung:** Filter aktivieren, nach Autor sortieren → Reihenfolge bleibt korrekt.
4. **Pagination:** Filter aktivieren, Seite wechseln → korrekte Seitenanzahl.
5. **Page-Reset:** Filtertext ändern → aktuelle Seite springt auf 1.
6. **Clear:** Clear-Button löscht Filter, fokussiert Eingabe, Liste zeigt wieder alle Treffer.
