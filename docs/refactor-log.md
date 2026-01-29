# Refactor-Log (Release)

## Dateien geändert / hinzugefügt
- `public/controllers/books.controller.js` – API-Aufrufe und Validierungs-/Fehltexte ausgelagert; Controller fokussiert auf Orchestrierung und Rendering.
- `public/services/books-api.service.js` – zentrale API-Calls für Books (I/O via api-client) mit bisherigen Fallbacks beibehalten.
- `public/services/books-validation.js` – Validierung und Fehltexte für Book-Operationen zentralisiert.
- `public/services/notify.service.js` – vereinheitlichte Alerts (weiterhin `alert`), inkl. Standard-Helper.
- `public/controllers/authors.controller.js` – Alerts über `notify` konsolidiert.
- `public/controllers/lists.controller.js` – Alerts über `notify` konsolidiert.
- `public/controllers/tags.controller.js` – Alerts über `notify` konsolidiert.
- `public/controllers/inline-entity-picker.controller.js` – Alert für Auswahl über `notify` vereinheitlicht.
- `public/editor-runtime/join-child-table.js` – Alert-Handling über `notify` vereinheitlicht.
- `public/ui-helpers.js` – redundanten JSON-Fetch-Helper entfernt (api-client ist Single Source).
- `docs/refactor-log.md` – dieser Log inkl. Risiken & Smoke-Tests.

## Warum
- Konsolidierung von HTTP/JSON-Handling auf `public/api/api-client.js`.
- Reduktion von Redundanzen durch dedizierte Services für Books (API/Validierung) und vereinheitlichte Notify-Aufrufe.
- Controller bleiben Orchestratoren (Events, State, Render), Services kapseln Logik.

## Risiko / Impact
- Niedrig: Refactoring ohne Änderung der Endpunkte, UI oder Datenflüsse. Risiko besteht v. a. in veränderten Importpfaden/Signaturen.

## Manuelle Smoke-Tests (Klickpfade)
- **Books CRUD:** Navigieren zu „Bücher“ → „Neu“ → Titel+Autor+Liste speichern → Eintrag bearbeiten → löschen.
- **Authors CRUD:** „Autoren“ → Autor anlegen → bearbeiten → löschen (inkl. Konfliktfall testen).
- **Lists CRUD:** „Listen“ → neue Liste anlegen → umbenennen → löschen (Standardliste prüfen).
- **Tags CRUD:** „Tags“ → Tag anlegen → bearbeiten → löschen (mit/ohne verknüpfte Bücher).
- **Search:** „Büchersuche“ → lokale Suche → externe Suche → Import-Dialog öffnen/abbrechen.
- **Config:** „Konfiguration“ → Einstellungen laden/ändern/speichern.
