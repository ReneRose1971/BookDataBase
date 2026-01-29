# Externe Suche: Debugging und Fix

## Kurzbeschreibung des Problems
Die externe Suche war limitiert (harte Limits, kein Paging) und Trefferlisten basierten auf geladenen Ergebnissen statt auf kompletter Provider-Paging-Iteration. Außerdem war ein Abbruch nicht möglich und die Backend-Logik erzwingt jetzt die „Contains“-Semantik serverseitig.

## Neuer Suchfluss (Job-basiert, Request → UI)
1. **UI/Frontend**: Externe Suche startet über `POST /api/search/external/start` und erhält eine `searchId`. Das UI pollt anschließend `GET /api/search/external/status/:searchId` und kann über `POST /api/search/external/cancel/:searchId` abbrechen.【F:public/controllers/search.controller.js†L244-L365】【F:public/services/search.service.js†L1-L19】
2. **Backend-Endpoints**: Controller delegiert an den Job-Service (`startExternalSearchJob`, `getExternalSearchJobStatus`, `cancelExternalSearchJob`).【F:server/controllers/search.controller.js†L1-L110】
3. **Search-Job**:
   - Erstellt eine Session (inkl. lokaler Treffer) und startet parallel pro Provider einen Paging-Loop.
   - Ergebnisse werden während des Laufens gesammelt, dedupliziert und an die Session gehängt.
   - Das UI erhält kontinuierlich `items` + `providerProgress` mit Seiten-/Trefferständen.【F:server/services/search/external-search-job.service.js†L1-L263】
4. **Provider-Paging**:
   - Google Books (`startIndex`), Open Library (`page`), DNB (`startRecord`) iterieren seitenweise ohne Ergebnisdeckel.
   - Abbruch verwendet `AbortController` und stoppt die Paging-Schleifen sofort.【F:server/services/search/external-search-job.service.js†L73-L206】【F:server/services/search/providers/google-books.provider.js†L18-L97】【F:server/services/search/providers/open-library.provider.js†L19-L83】【F:server/services/search/providers/dnb.provider.js†L102-L180】
5. **UI-Anzeige**: „Geladen: X“ wird anhand der aktuell gelieferten Items berechnet, Provider-Fortschritt wird live angezeigt.【F:public/controllers/search.controller.js†L115-L180】

## Contains-Regel & Normalisierung
Die Suche erzwingt serverseitig eine „Contains“-Semantik nach Normalisierung:

```
normalize(s):
  trim
  lower-case
  mehrfach-Whitespace → 1
  diakritische Zeichen entfernen
```

Matching-Regel: `normalize(title).includes(normalize(query))`. Diese Regel wird **immer** serverseitig geprüft, unabhängig davon, wie der Provider intern sucht. Damit werden auch Treffer akzeptiert, die den Query-String irgendwo im Titel enthalten.【F:server/services/search/external-search-job.service.js†L33-L78】

## DNB-SRU/CQL Query (Wildcard)
Verwendete DNB-Query (SRU/CQL):

```
title all "<query>*"
```

- **Wildcard/Contains**: `*` erlaubt Prefix-Matches auf dem Titelindex. Die finale Contains-Regel wird serverseitig erzwungen (siehe Abschnitt oben).
- **Paging**: `startRecord` + `maximumRecords`.
- **Felder/Indizes**: `title` Index im SRU-Endpoint `https://services.dnb.de/sru/dnb`, `recordSchema=dc`.【F:server/services/search/providers/dnb.provider.js†L92-L182】

## Fix (Änderungen & Begründung)
1. **Job-basierte Suche ohne Ergebnislimit**:
   - Paging-Schleifen je Provider iterieren bis „keine weiteren Ergebnisse“ oder manuelles Abbrechen.
   - Es gibt keine Timeout-Mechanismen mehr im Suchlauf.【F:server/services/search/external-search-job.service.js†L73-L263】【F:server/services/search/providers/dnb.provider.js†L102-L180】
2. **Manuelles Abbrechen**:
   - `cancelled`-Flag + AbortController pro Provider bricht laufende Requests sofort ab.
   - UI stellt Abbrechen-Button bereit und stoppt Polling.【F:server/services/search/external-search-job.service.js†L231-L263】【F:public/controllers/search.controller.js†L334-L365】
3. **UI-Status & Fortschritt**:
   - „Geladen: X“ + Provider-Fortschritt in der Statuszeile.
   - Keine Limit-Anzeige mehr (da es kein Ergebnislimit gibt).【F:public/controllers/search.controller.js†L115-L180】

## Testprotokoll (Repro A/B/C)
**Hinweis:** In der aktuellen Umgebung ist der Netzwerkzugriff auf externe Provider blockiert (`ENETUNREACH`). Daher konnten die externen Requests nicht ausgeführt werden. Der Fix ist jedoch so umgesetzt, dass er bei verfügbarer Netzverbindung Paging und Contains-Regeln durchsetzt.

Geplante Repro-Queries:
- **A:** "Zukunfts"
- **B:** "Zukunftsmedizin"
- **C:** "Klima" vs. "Klimawandel"

Erwartetes Verhalten nach Fix:
- Trefferliste enthält Titel, die „zukunfts“ **irgendwo** im Titel enthalten (contains, normalisiert).
- Treffer werden nicht künstlich auf 20/50/80 begrenzt, sondern bis zum Provider-Ende gepaged.
- Manuelles Abbrechen stoppt laufende Requests und beendet Paging-Schleifen sofort.
