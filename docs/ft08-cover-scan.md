# FT(08) Cover Scan – Endpunkte & UI

## Endpunkte

- `GET /api/cover-scan/config`
  - Liefert Limits und erlaubte Bildtypen für den Cover-Scan.
  - Response: `{ maxFiles, maxFileSizeBytes, supportedMimeTypes }`

- `POST /api/cover-scan/extract`
  - Multipart-Upload (`files[]`) für Cover-Bilder.
  - Response: `{ results: [ { fileIndex, fileName, title, authors, isbn, status, ambiguous, errors } ] }`

- `POST /api/cover-scan/import`
  - Import eines geprüften Scan-Ergebnisses.
  - Body: `{ title, authors, isbn?, listIds }`
  - Nutzt bestehende Buch-Anlage inkl. Duplikatprüfung.

## UI Platzierung

- Navigation → Stammdaten → unterhalb „Büchersuche“.
- View lädt über den bestehenden View-Loader (`cover-scan.view.html` + `cover-scan.controller.js`).

## Wie testen (lokal)

1. OpenAI-Key unter „Konfiguration“ hinterlegen.
2. Cover Scan öffnen, mehrere Cover-Dateien auswählen (JPG/PNG/WebP).
3. „Scannen“ klicken und Ergebnisse prüfen (Status + Editierbarkeit).
4. Für ein Ergebnis Listen auswählen und „Importieren“ klicken.
