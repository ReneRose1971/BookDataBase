# DNB-Provider Fix: SRU/CQL Indizes, Prefix, Paging, Diagnose

## Ausgangslage / Problem
Der DNB-Provider nutzte eine nicht verlässliche Query-Strategie mit dem CQL-Index `title` und dem Query-Typ `title all`, außerdem wurde `recordSchema=dc` gesetzt. In der DNB-SRU-Antwort führt das zu Diagnosen wie „Unknown schema for retrieval“ und zu fehlenden Treffern (z. B. bei Prefix-Suchen wie „Zukunfts“), obwohl DNB passende Datensätze hat.

**Vorherige Query-Strategie**
- CQL: `title all "<term>*"`
- Beispiel-URL:
  - `https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=title+all+%22Zukunfts*%22&maximumRecords=10&recordSchema=dc`
- Diagnosebeleg (DNB antwortet mit „Unknown schema for retrieval“ in der SRU-Diagnose).

## Neue Query-Strategie (Pflichtstrategie)
1. **Primärer Index: WOE**
   - Prefix-Suche ausschließlich als `WOE=<term>*`.
2. **Wildcard-Regel**
   - Nur Suffix-Wildcard: `Zukunfts*`.
   - Kein `*Zukunfts*`.
3. **Lokales „contains“-Filtering**
   - DNB liefert Kandidaten über `WOE=<term>*`.
   - Danach lokale Filterung mit `normalize(title).includes(normalize(userQuery))`.
4. **Paging**
   - `maximumRecords` = Seitengröße (100).
   - `startRecord` wird korrekt inkrementiert (1, 101, 201, …).
   - Stop: keine Records, `startRecord > numberOfRecords`, oder manueller Cancel-Flag.

## Beispiel-URLs (ohne Secrets)
- Prefix (WOE):
  - `https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=WOE%3DZukunfts*&maximumRecords=1&recordSchema=MARC21-xml`
- Prefix (WOE):
  - `https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=WOE%3DZukunftsmedizin*&maximumRecords=1&recordSchema=MARC21-xml`

## Testprotokoll (Reproduktion + Fix)

### 1) Vorheriges Verhalten (Problemnachweis)
**Query:** `Zukunfts`
- URL: `https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=title+all+%22Zukunfts*%22&maximumRecords=10&recordSchema=dc`
- HTTP-Status: 200
- SRU-Diagnose: `Unknown schema for retrieval`
- `numberOfRecords`: nicht vorhanden
- `returnedRecords`: 0
- Verwendeter Index/Query: `title all` (nicht verlässlich)

### 2) Neues Verhalten (WOE Prefix)
**Query:** `Zukunfts`
- URL: `https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=WOE%3DZukunfts*&maximumRecords=1&recordSchema=MARC21-xml`
- HTTP-Status: 200
- `numberOfRecords`: 88299
- `returnedRecords`: 1
- Index/Query: `WOE`, Modus `prefix`

**Query:** `Zukunftsmedizin`
- URL: `https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=WOE%3DZukunftsmedizin*&maximumRecords=1&recordSchema=MARC21-xml`
- HTTP-Status: 200
- `numberOfRecords`: 16
- `returnedRecords`: 1
- Index/Query: `WOE`, Modus `prefix`

## Ergebnis
- Prefix-Suchen wie „Zukunfts“ liefern nun Kandidaten über WOE.
- Lokales Filtering sorgt dafür, dass nur echte „contains“-Treffer zurückgegeben werden.
- Paging lädt mehrere Seiten, bis DNB keine weiteren Records liefert oder `numberOfRecords` erreicht ist.
