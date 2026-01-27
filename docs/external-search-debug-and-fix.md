# Externe Suche: Debugging und Fix

## Kurzbeschreibung des Problems
Die externe Suche lieferte bei Prefix-/Teilbegriffen unzuverlässige Treffer. Gleichzeitig wirkte die Trefferzahl oft konstant, weil nur die geladenen Ergebnisse gezählt und angezeigt wurden, obwohl die Provider selbst mehr Treffer haben können.

## Exakter Suchfluss (Request → UI)
1. **UI/Frontend**: Die Suche startet im Frontend und ruft `searchExternal` auf (via `/api/search/external`). Der eingegebene Titel wird aus `#searchTitle` gelesen und an das Backend gesendet.【F:public/controllers/search.controller.js†L219-L287】
2. **Backend-Endpoint**: `/api/search/external` delegiert an `runExternalSearch` im Search-Facade und liefert die Session-Antwort zurück.【F:server/controllers/search.controller.js†L25-L49】
3. **Search-Facade**:
   - Erstellt/verwaltet die Session und ruft `searchExternalByTitle`.
   - Kombiniert lokale und externe Treffer, dedupliziert und liefert Items + Counts + Provider-Status.【F:server/services/search/search-facade.service.js†L66-L129】
4. **Provider-Calls**:
   - Google Books: `q=intitle:<title>` mit `maxResults`.
   - Open Library: `title=<title>` mit `limit`.
   - DNB: `query=title all "<title>"` mit `maximumRecords`.
   Diese Calls sind jeweils limit-basiert und **es gibt kein Paging**.【F:server/services/search/providers/google-books.provider.js†L25-L103】【F:server/services/search/providers/open-library.provider.js†L24-L83】【F:server/services/search/providers/dnb.provider.js†L96-L180】
5. **Aggregation/Response**: Die Response enthält `items`, eine `counts`-Struktur sowie `providerStatus`. Die Trefferzahl war zuvor im Frontend als `items.length` dargestellt und damit faktisch die **Anzeige- statt Gesamtzahl**.【F:public/controllers/search.controller.js†L214-L287】

## Diagnose (Ursache)
**Hauptursache:**
- Die externe Suche arbeitet mit **harten Provider-Limits** und **ohne Paging**. Dadurch werden immer nur die ersten N Treffer je Provider geladen. Das ist in den Provider-Requests eindeutig sichtbar (z. B. `maxResults`, `limit`, `maximumRecords`).【F:server/services/search/providers/google-books.provider.js†L25-L103】【F:server/services/search/providers/open-library.provider.js†L24-L83】【F:server/services/search/providers/dnb.provider.js†L96-L180】
- Im Frontend wurde die Trefferzahl bisher als **Anzahl der geladenen Items** angezeigt (statt der tatsächlich verfügbaren Treffer), was den Eindruck eines konstanten Ergebnisses erzeugte.【F:public/controllers/search.controller.js†L214-L287】

**Nebenursache (Relevanz):**
- Treffer wurden nicht nach Relevanz (Exact/Prefix/Contains) sortiert. Bei begrenzten Provider-Resultsets kann ein relevanter Treffer außerhalb der ersten N Treffer landen.

## Fix (Änderungen & Begründung)
1. **Provider-Limits transparent + Logging mit Details**
   - Provider liefern jetzt zusätzlich `totalItems`, `limit`, `status` und eine **logbare URL ohne Secrets**.
   - Backend loggt Query, Provider, URL, Status, Count und Total; bei Fehlern zusätzlich Status/Text und Body-Snippet.
   - Damit ist klar, wie viele Items geladen wurden und ob ein Provider Fehler liefert.【F:server/services/search/external-search.service.js†L1-L133】【F:server/services/search/providers/google-books.provider.js†L1-L103】【F:server/services/search/providers/open-library.provider.js†L1-L83】【F:server/services/search/providers/dnb.provider.js†L1-L180】

2. **Relevanz-Ranking vor Dedupe**
   - Externe Items werden nach Exact/Prefix/Contains/Token-Match gewichtet sortiert, anschließend dedupliziert.
   - Dadurch sollen Prefix-Treffer (z. B. „Zukunftsmedizin“ bei „Zukunfts“) in den ersten Ergebnissen erscheinen, sofern der Provider sie liefert.【F:server/services/search/search-facade.service.js†L12-L129】

3. **UI: Anzeige der geladenen Treffer und Provider-Status**
   - Die UI zeigt jetzt „Angezeigt: X“ und pro Provider `count/total` inkl. Limit und HTTP-Status (wenn vorhanden).
   - Dadurch ist sichtbar, ob die Trefferzahl durch Limits begrenzt ist und ob ein Provider Fehler liefert.【F:public/controllers/search.controller.js†L97-L142】

4. **Limit-Anpassung**
   - Die Limits wurden moderat erhöht (Google 20, OpenLibrary 60, DNB 20), um den Recall bei Prefix-Suchen zu verbessern, ohne Paging zu implementieren.【F:server/services/search/external-search.service.js†L6-L60】

## Testprotokoll (Repro A/B/C)
**Hinweis:** In der aktuellen Umgebung ist der Netzwerkzugriff auf externe Provider blockiert (`ENETUNREACH`). Daher konnten die externen Requests nicht ausgeführt werden. Der Fix ist jedoch so umgesetzt, dass er bei verfügbarer Netzverbindung die Provider-Response-Totalwerte und Logs liefert.

Geplante Repro-Queries:
- **A:** "Zukunfts"
- **B:** "Zukunftsmedizin"
- **C:** "Klima" vs. "Klimawandel"

Erwartetes Verhalten nach Fix:
- Trefferliste enthält bei Prefix-Suchen relevante Titel (z. B. „Zukunftsmedizin“), sofern der Provider sie in den geladenen Ergebnissen liefert.
- UI zeigt „Angezeigt: X“ und pro Provider `count/total` inkl. Limit.
- Provider-Fehler werden im Backend-Log dokumentiert und in der UI als „Fehler“ angezeigt.

## Offene Punkte / Verbesserungen
- **Paging**: Für vollständig korrekte Trefferzahlen und bessere Recall-Qualität sollte Paging implementiert werden (Backend nimmt `page/offset`, Provider verwenden `startIndex/page`, UI bietet „Mehr laden“).
- **Provider-spezifische Ranking-Strategien**: Falls ein Provider stark abweichendes Ranking liefert, könnten Provider-spezifische Boosts nötig sein.
