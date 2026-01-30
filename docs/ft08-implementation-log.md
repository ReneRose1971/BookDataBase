# FT(08) Implementierungs-Log – Cover Scan & Extract

## 2025-02-14T12:00:00+00:00

### Vorab-Notiz (PDF gelesen)
- PDF gelesen: `FT (08) Cover Scan und Extract.pdf`
- Kernanforderungen übernommen:
  - Multi-Cover-Scan: 1 Bild = 1 Buch, beliebig viele Dateien (technisches Limit erforderlich).
  - Strukturierte OpenAI-Antwort mit eindeutiger Zuordnung pro Bild (fileIndex/fileId).
  - Ergebnisliste pro Cover, editierbar, selektiver Import; keine automatische Persistierung.
  - Fehler je Datei isoliert behandeln; keine Blockade anderer Ergebnisse.
  - Mehrdeutige Ergebnisse explizit kennzeichnen.
  - Datenschutz: Bilder nur transient, nicht dauerhaft speichern.

### FT(08) – Implementierung nach PDF-Spezifikation

#### Änderungen / Dateien
- Neu: `public/views/cover-scan.view.html`
- Neu: `public/controllers/cover-scan.controller.js`
- Neu: `public/services/cover-scan.service.js`
- Update: `public/app.html` (Nav-Eintrag „Cover Scan“ unter Stammdaten → unter „Büchersuche“)
- Update: `public/app.js` (Route `cover-scan` → View/Controller/Title)
- Update: `public/css/dataviews.css` (Layout/Styles für Cover-Scan-View)
- Neu: `server/services/cover-scan.service.js`
- Neu: `server/controllers/cover-scan.controller.js`
- Neu: `server/routes/cover-scan.routes.js`
- Update: `server/app.js` (Route eingebunden)
- Update: `package.json`, `package-lock.json` (multer)
- Neu: `docs/ft08-cover-scan.md` (Endpunkte/Platzierung)

#### Zusammenfassung
- UI-Platzierung: Stammdaten → unter „Büchersuche“ (View-Loader integriert).
- Endpunkte: `/api/cover-scan/config`, `/api/cover-scan/extract`, `/api/cover-scan/import`.
- Import-Flow: bestehende Buch-Anlage inkl. Duplikatprüfung, Listenpflicht, Autoren-Auflösung.
- PDF-Referenz: `FT (08) Cover Scan und Extract.pdf`.
