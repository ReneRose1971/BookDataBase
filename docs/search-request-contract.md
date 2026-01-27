# Search Request Contract

## Endpoint

`POST /api/search/external/start`

## Erwarteter Body

```json
{ "query": "string", "providers": ["google", "openlibrary", "dnb"] }
```

## Fehlerfall (400)

```json
{ "error": "query must be a non-empty string", "receivedType": "object" }
```

## Mini-Testprotokoll

- Query: Zukunftsmedizin → Treffer von Google/OpenLibrary (DNB ggf. später)
- Query: Zukunftsm → keine Trim-Fehler, Suche liefert Ergebnisse
- Query: Zukunfts → viele Treffer, keine Trim-Fehler
