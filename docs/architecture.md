# Architektur-Dokumentation (Ist-Zustand)

## Zweck & Einordnung

### Was dieses Dokument beschreibt
Diese Datei beschreibt den technischen Ist-Zustand der Anwendung: Verzeichnisstruktur, zentrale Laufzeitflüsse, Frontend-/Backend-Bausteine und Datenzugriff. Sie ist als Orientierung für Entwickler*innen und KI-Systeme gedacht.

### Was dieses Dokument bewusst nicht beschreibt
- Keine Fachlogik, Features, Use Cases oder Geschäftsregeln.
- Keine Ziel- oder Wunscharchitektur.
- Keine Roadmap oder Erweiterungspläne.

## Gesamtüberblick (Ist-Zustand)

### Frontend / Backend / Datenhaltung
- **Frontend**: Statische HTML-Dateien und ES-Module im Ordner `public/`.
- **Backend**: Express.js-Anwendung im Ordner `server/`.
- **Datenhaltung**: PostgreSQL-Datenbank, angebunden über `pg` (Pool).

### Verwendete Technologien
- Node.js (ES Modules)
- Express.js (HTTP-Server, Routing)
- PostgreSQL (persistente Datenhaltung)
- Vanilla JavaScript im Frontend (keine Frameworks, kein Build-Step)

### Bewusst einfache Struktur
Die Anwendung folgt einer klaren Ordnerstruktur mit getrennten Bereichen für Frontend, Backend, Konfiguration und Dokumentation. Komplexe Rahmenwerke oder Build-Pipelines sind nicht vorhanden.

## Frontend-Architektur

### SPA-Navigation
- Navigation erfolgt clientseitig über `public/app.js`.
- Views werden dynamisch geladen und in ein zentrales Content-Element eingesetzt.
- Es gibt keinen Framework-Router.

### View/Controller-Prinzip
- HTML-Views liegen in `public/views/`.
- Jeder View kann einen Controller (`public/controllers/*.controller.js`) besitzen.
- Controller exportieren `mount(ctx)` und optional `unmount(root)`.

### Lifecycle (mount / unmount)
- Beim View-Wechsel wird `unmount` des vorherigen Controllers aufgerufen (falls vorhanden).
- Danach wird die neue View geladen und `mount(ctx)` aufgerufen.

### Dynamisches Laden von Views & Fragmenten
- `public/view-loader.js` lädt View-HTML und optionale Fragmente (`data-fragment`).
- Fragmente sind eigenständige HTML-Dateien, die in definierte Container gerendert werden.

### Editor-System (Manifest-basiert)
- Editor-Definitionen basieren auf JSON-Manifesten in `public/editors/`.
- Shells und Parts liegen in `public/views/editors/`.
- Das Editor-Runtime-Modul lädt Shells, verteilt Parts in Slots und bindet Aktionen.

### Disposables / Cleanup-Strategie
- `public/editor-runtime/disposables.js` verwaltet Cleanup-Funktionen.
- Event-Handler und Ressourcen sollen über Disposables sauber entfernt werden.

## Backend-Struktur

### Vorhandene Server-Komponenten
- Einstieg: `server/index.js` und `server/app.js`.
- Routen: `server/routes/*.routes.js`.
- Controller: `server/controllers/*.controller.js`.
- Services: `server/services/*.service.js`.
- Repositories: `server/repositories/*.repo.js`.
- Middleware: `server/middleware/*`.

### Routen, Controller, Services (rein beschreibend)
- Routen definieren HTTP-Endpoints und delegieren an Controller.
- Controller validieren Requests, orchestrieren Services und senden Responses.
- Services kapseln wiederverwendbare Abläufe und rufen Repositories auf.
- Repository-Module kapseln SQL-Statements.

Es existiert keine zentrale Dependency-Injection und keine formale Layer-Durchsetzung über die Dateistruktur hinaus.

## Datenzugriff & Persistenz
- Datenzugriff erfolgt über `pg`-Pool (`server/db/pool.js`).
- Repositories führen SQL-Queries direkt aus.
- Transaktionen werden bei Bedarf in Services umgesetzt.

## Kommunikationsflüsse

### Frontend ↔ Backend
- Frontend verwendet `fetch`-Aufrufe (z. B. in `public/ui-helpers.js` und `public/api/api-client.js`).
- Backend liefert JSON oder statische HTML/Assets.

### Initialisierung & Laufzeit
- `server/index.js` startet den HTTP-Server.
- `server/app.js` registriert Middleware, statische Ressourcen und Routen.
- `public/app.js` initialisiert die SPA-Navigation im Browser.

## Bewusste Designentscheidungen
- Kein Framework-Router im Frontend.
- Kein globaler State-Manager.
- Kein automatisches Dependency-Injection-System.
- Editor-System erlaubt nur einen aktiven Editor gleichzeitig.

## Abgrenzungen & Nicht-Ziele
- Keine Aussagen zu Fachlogik oder Geschäftsregeln.
- Keine Annahmen zu zukünftigen Erweiterungen oder Refactorings.
- Keine implizite Verpflichtung auf ein Schichtenmodell.

## Offene technische Punkte
- Fehlende Tests für Teile der Backend-Services.
- Keine zentralisierte Fehlerbehandlung im Frontend.
- Dokumentation der Infrastruktur/Deploy-Umgebung ist nicht vorhanden.
