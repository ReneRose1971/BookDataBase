# Datei-Inventar (HTML + JS)

Diese Übersicht listet alle HTML- und JavaScript-Dateien im Repository und beschreibt deren technische Rolle sowie relevante Abhängigkeiten.

## /public

### /public/app.html
- **Zweck:** Basis-HTML der Webanwendung.
- **Technische Rolle:** Host für SPA-Inhalte und Skript-Bundles.
- **Abhängigkeiten:** Lädt `public/app.js` und CSS-Dateien.

### /public/app.js
- **Zweck:** Clientseitiger Einstiegspunkt.
- **Technische Rolle:** SPA-Navigation, dynamisches Laden von Views und Controllern.
- **Abhängigkeiten:** `public/view-loader.js`, Controller-Module.

### /public/view-loader.js
- **Zweck:** View-/Fragment-Lader.
- **Technische Rolle:** Lädt HTML-Views und Fragmente, baut `ctx` für Controller.
- **Abhängigkeiten:** Fetch-API, Controller-Module.

### /public/ui-helpers.js
- **Zweck:** Allgemeine UI-Hilfsfunktionen.
- **Technische Rolle:** DOM-Helfer, Fetch-Wrapper.
- **Abhängigkeiten:** Keine externen Module.

### /public/api/api-client.js
- **Zweck:** Zentrale Fetch-Funktionen für API-Aufrufe.
- **Technische Rolle:** Abstraktion von HTTP-Requests.
- **Abhängigkeiten:** Fetch-API.

### /public/controllers/authors.controller.js
- **Zweck:** Controller für Autoren-View.
- **Technische Rolle:** Event-Handling, Datenlade- und Speicherroutinen.
- **Abhängigkeiten:** `public/ui-helpers.js`, `public/api/api-client.js`, Editor-Runtime.

### /public/controllers/books.controller.js
- **Zweck:** Controller für Bücher-View.
- **Technische Rolle:** Event-Handling, Datenlade- und Speicherroutinen.
- **Abhängigkeiten:** `public/ui-helpers.js`, `public/api/api-client.js`, Editor-Runtime.

### /public/controllers/lists.controller.js
- **Zweck:** Controller für Listen-View.
- **Technische Rolle:** Event-Handling, Datenlade- und Speicherroutinen.
- **Abhängigkeiten:** `public/ui-helpers.js`, `public/api/api-client.js`, Editor-Runtime.

### /public/controllers/tags.controller.js
- **Zweck:** Controller für Tags-View.
- **Technische Rolle:** Event-Handling, Datenlade- und Speicherroutinen.
- **Abhängigkeiten:** `public/ui-helpers.js`, `public/api/api-client.js`, Editor-Runtime.

### /public/controllers/userConfig.controller.js
- **Zweck:** Controller für Konfigurations-View.
- **Technische Rolle:** Laden/Speichern von Einstellungen.
- **Abhängigkeiten:** `public/api/api-client.js`.

### /public/editor-runtime/disposables.js
- **Zweck:** Sammlung für Cleanup-Funktionen.
- **Technische Rolle:** Verwaltung von Dispose-Callbacks.
- **Abhängigkeiten:** Keine externen Module.

### /public/editor-runtime/component-loader.js
- **Zweck:** Loader für Editor-Parts.
- **Technische Rolle:** Lädt Part-HTML und optionale JS-Module.
- **Abhängigkeiten:** `public/editor-runtime/disposables.js`.

### /public/editor-runtime/editor-composer.js
- **Zweck:** Editor-Composer.
- **Technische Rolle:** Lädt Editor-Manifeste, Shells und Slots, bindet Aktionen.
- **Abhängigkeiten:** `public/editor-runtime/component-loader.js`, `public/editor-runtime/disposables.js`.

### /public/editor-runtime/join-child-table.js
- **Zweck:** Wiederverwendbare Join-Table-Komponente.
- **Technische Rolle:** UI-Controller für n:m-Tabellen im Editor.
- **Abhängigkeiten:** Editor-Runtime und DOM-APIs.

### /public/views/app-spezifische Dateien

#### /public/views/books.view.html
- **Zweck:** View für Bücher.
- **Technische Rolle:** HTML-Layout.
- **Abhängigkeiten:** Zugehöriger Controller `books.controller.js`.

#### /public/views/book-editor.view.html
- **Zweck:** View für Buch-Editor.
- **Technische Rolle:** HTML-Layout.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/authors.view.html
- **Zweck:** View für Autoren.
- **Technische Rolle:** HTML-Layout.
- **Abhängigkeiten:** Zugehöriger Controller `authors.controller.js`.

#### /public/views/tags.view.html
- **Zweck:** View für Tags.
- **Technische Rolle:** HTML-Layout.
- **Abhängigkeiten:** Zugehöriger Controller `tags.controller.js`.

#### /public/views/lists.view.html
- **Zweck:** View für Listen.
- **Technische Rolle:** HTML-Layout.
- **Abhängigkeiten:** Zugehöriger Controller `lists.controller.js`.

#### /public/views/userConfig.view.html
- **Zweck:** View für Konfiguration.
- **Technische Rolle:** HTML-Layout.
- **Abhängigkeiten:** Zugehöriger Controller `userConfig.controller.js`.

#### /public/views/author-editor.view.html
- **Zweck:** Editor-View für Autoren.
- **Technische Rolle:** HTML-Layout.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/booklist-name-editor.view.html
- **Zweck:** Editor-View für Listenname.
- **Technische Rolle:** HTML-Layout.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/tag-name-editor.view.html
- **Zweck:** Editor-View für Tagname.
- **Technische Rolle:** HTML-Layout.
- **Abhängigkeiten:** Editor-Runtime.

### /public/views/editors/shells

#### /public/views/editors/shells/authors.shell.html
- **Zweck:** Editor-Shell für Autoren.
- **Technische Rolle:** Basis-Layout mit Slots.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/editors/shells/books.shell.html
- **Zweck:** Editor-Shell für Bücher.
- **Technische Rolle:** Basis-Layout mit Slots.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/editors/shells/lists.shell.html
- **Zweck:** Editor-Shell für Listen.
- **Technische Rolle:** Basis-Layout mit Slots.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/editors/shells/tags.shell.html
- **Zweck:** Editor-Shell für Tags.
- **Technische Rolle:** Basis-Layout mit Slots.
- **Abhängigkeiten:** Editor-Runtime.

### /public/views/editors/parts

#### /public/views/editors/parts/author-actions.part.html
- **Zweck:** Editor-Part für Aktionen.
- **Technische Rolle:** Button-/Action-Bereich.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/editors/parts/author-fields.part.html
- **Zweck:** Editor-Part für Eingabefelder.
- **Technische Rolle:** Formular-Layout.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/editors/parts/book-actions.part.html
- **Zweck:** Editor-Part für Aktionen.
- **Technische Rolle:** Button-/Action-Bereich.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/editors/parts/book-authors.part.html
- **Zweck:** Editor-Part für Autorenliste.
- **Technische Rolle:** Teilansicht/Slot-Inhalt.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/editors/parts/book-header.part.html
- **Zweck:** Editor-Part für Header.
- **Technische Rolle:** Titelbereich.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/editors/parts/book-lists.part.html
- **Zweck:** Editor-Part für Listen.
- **Technische Rolle:** Teilansicht/Slot-Inhalt.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/editors/parts/join-child-table.part.html
- **Zweck:** Editor-Part für Join-Child-Tabelle.
- **Technische Rolle:** Layout für die Join-Table-Komponente.
- **Abhängigkeiten:** `public/editor-runtime/join-child-table.js`.

#### /public/views/editors/parts/list-actions.part.html
- **Zweck:** Editor-Part für Aktionen.
- **Technische Rolle:** Button-/Action-Bereich.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/editors/parts/list-fields.part.html
- **Zweck:** Editor-Part für Eingabefelder.
- **Technische Rolle:** Formular-Layout.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/editors/parts/tag-actions.part.html
- **Zweck:** Editor-Part für Aktionen.
- **Technische Rolle:** Button-/Action-Bereich.
- **Abhängigkeiten:** Editor-Runtime.

#### /public/views/editors/parts/tag-fields.part.html
- **Zweck:** Editor-Part für Eingabefelder.
- **Technische Rolle:** Formular-Layout.
- **Abhängigkeiten:** Editor-Runtime.

## /server

### /server/index.js
- **Zweck:** Server-Startpunkt.
- **Technische Rolle:** Startet Express-App und HTTP-Server.
- **Abhängigkeiten:** `server/app.js`.

### /server/app.js
- **Zweck:** Express-App-Konfiguration.
- **Technische Rolle:** Middleware, statische Assets, Routing.
- **Abhängigkeiten:** Routenmodule, Middleware, `dotenv`.

### /server/db/pool.js
- **Zweck:** PostgreSQL-Pool.
- **Technische Rolle:** Datenbankverbindung.
- **Abhängigkeiten:** `pg`, `.env`.

### /server/middleware/error-handler.js
- **Zweck:** Fehlerbehandlung.
- **Technische Rolle:** Express Error Middleware.
- **Abhängigkeiten:** Express.

### /server/middleware/validate.js
- **Zweck:** Validierung.
- **Technische Rolle:** Hilfsfunktionen für Request-Parameter.
- **Abhängigkeiten:** Keine externen Module.

### /server/routes/auth.routes.js
- **Zweck:** Auth-Routen.
- **Technische Rolle:** Endpoint-Definitionen.
- **Abhängigkeiten:** `server/controllers/auth.controller.js`.

### /server/routes/authors.routes.js
- **Zweck:** Autoren-Routen.
- **Technische Rolle:** Endpoint-Definitionen.
- **Abhängigkeiten:** `server/controllers/authors.controller.js`.

### /server/routes/book-lists.routes.js
- **Zweck:** Listen-Routen.
- **Technische Rolle:** Endpoint-Definitionen.
- **Abhängigkeiten:** `server/controllers/book-lists.controller.js`.

### /server/routes/books.routes.js
- **Zweck:** Bücher-Routen.
- **Technische Rolle:** Endpoint-Definitionen.
- **Abhängigkeiten:** `server/controllers/books.controller.js`.

### /server/routes/config.routes.js
- **Zweck:** Konfigurations-Routen.
- **Technische Rolle:** Endpoint-Definitionen.
- **Abhängigkeiten:** `server/controllers/config.controller.js`.

### /server/routes/search.routes.js
- **Zweck:** Such-Routen.
- **Technische Rolle:** Endpoint-Definitionen.
- **Abhängigkeiten:** `server/controllers/search.controller.js`.

### /server/routes/tags.routes.js
- **Zweck:** Tag-Routen.
- **Technische Rolle:** Endpoint-Definitionen.
- **Abhängigkeiten:** `server/controllers/tags.controller.js`.

### /server/routes/views.routes.js
- **Zweck:** View-Routen.
- **Technische Rolle:** Liefert Views/Assets.
- **Abhängigkeiten:** `server/controllers/views.controller.js`.

### /server/controllers/auth.controller.js
- **Zweck:** Auth-Controller.
- **Technische Rolle:** Request-Handling.
- **Abhängigkeiten:** `server/services/auth.service.js`.

### /server/controllers/authors.controller.js
- **Zweck:** Autoren-Controller.
- **Technische Rolle:** Request-Handling.
- **Abhängigkeiten:** `server/services/authors.service.js`.

### /server/controllers/book-lists.controller.js
- **Zweck:** Listen-Controller.
- **Technische Rolle:** Request-Handling.
- **Abhängigkeiten:** `server/services/book-lists.service.js`.

### /server/controllers/books.controller.js
- **Zweck:** Bücher-Controller.
- **Technische Rolle:** Request-Handling.
- **Abhängigkeiten:** `server/services/books.service.js`.

### /server/controllers/config.controller.js
- **Zweck:** Konfigurations-Controller.
- **Technische Rolle:** Request-Handling.
- **Abhängigkeiten:** `server/services/config.service.js`.

### /server/controllers/search.controller.js
- **Zweck:** Such-Controller.
- **Technische Rolle:** Request-Handling.
- **Abhängigkeiten:** `server/services/search/*`.

### /server/controllers/tags.controller.js
- **Zweck:** Tag-Controller.
- **Technische Rolle:** Request-Handling.
- **Abhängigkeiten:** `server/services/tags.service.js`.

### /server/controllers/views.controller.js
- **Zweck:** View-Controller.
- **Technische Rolle:** Rendert/serviert Views.
- **Abhängigkeiten:** Express.

### /server/repositories/authors.repo.js
- **Zweck:** SQL-Zugriff Autoren.
- **Technische Rolle:** Datenbankzugriffe.
- **Abhängigkeiten:** `server/db/pool.js`.

### /server/repositories/book-lists.repo.js
- **Zweck:** SQL-Zugriff Listen.
- **Technische Rolle:** Datenbankzugriffe.
- **Abhängigkeiten:** `server/db/pool.js`.

### /server/repositories/books.repo.js
- **Zweck:** SQL-Zugriff Bücher.
- **Technische Rolle:** Datenbankzugriffe.
- **Abhängigkeiten:** `server/db/pool.js`.

### /server/repositories/search.repo.js
- **Zweck:** SQL-Zugriff Suche.
- **Technische Rolle:** Datenbankzugriffe.
- **Abhängigkeiten:** `server/db/pool.js`.

### /server/repositories/tags.repo.js
- **Zweck:** SQL-Zugriff Tags.
- **Technische Rolle:** Datenbankzugriffe.
- **Abhängigkeiten:** `server/db/pool.js`.

### /server/services/auth.service.js
- **Zweck:** Auth-Service.
- **Technische Rolle:** Hilfsfunktionen für Auth.
- **Abhängigkeiten:** Keine externen Module.

### /server/services/authors.service.js
- **Zweck:** Autoren-Service.
- **Technische Rolle:** Service-Layer-Funktionen.
- **Abhängigkeiten:** `server/repositories/authors.repo.js`.

### /server/services/book-lists.service.js
- **Zweck:** Listen-Service.
- **Technische Rolle:** Service-Layer-Funktionen.
- **Abhängigkeiten:** `server/repositories/book-lists.repo.js`.

### /server/services/books.service.js
- **Zweck:** Bücher-Service.
- **Technische Rolle:** Service-Layer-Funktionen.
- **Abhängigkeiten:** `server/repositories/books.repo.js`, `server/db/pool.js`.

### /server/services/config.service.js
- **Zweck:** Konfigurations-Service.
- **Technische Rolle:** Zugriff auf Konfigurationsdaten.
- **Abhängigkeiten:** `config/config-store.js`.

### /server/services/tags.service.js
- **Zweck:** Tag-Service.
- **Technische Rolle:** Service-Layer-Funktionen.
- **Abhängigkeiten:** `server/repositories/tags.repo.js`.

### /server/services/search/local-search.service.js
- **Zweck:** Lokale Suche.
- **Technische Rolle:** Lokale DB-Suche.
- **Abhängigkeiten:** `server/repositories/search.repo.js`, `server/models/search.models.js`.

### /server/services/search/external-search.service.js
- **Zweck:** Externe Suche.
- **Technische Rolle:** Provider-Orchestrierung.
- **Abhängigkeiten:** Provider-Module, `server/models/search.models.js`.

### /server/services/search/search-facade.service.js
- **Zweck:** Suche-Fassade.
- **Technische Rolle:** Orchestrierung und Session-Handling.
- **Abhängigkeiten:** `server/services/search/*`, `server/repositories/authors.repo.js`.

### /server/services/search/search-session.store.js
- **Zweck:** In-Memory-Session-Speicher.
- **Technische Rolle:** Kurzlebiger Session-Store.
- **Abhängigkeiten:** Node.js `crypto`.

### /server/services/search/providers/google-books.provider.js
- **Zweck:** Google-Books-Provider.
- **Technische Rolle:** Externe API-Abfrage.
- **Abhängigkeiten:** Fetch-API.

### /server/services/search/providers/open-library.provider.js
- **Zweck:** Open-Library-Provider.
- **Technische Rolle:** Externe API-Abfrage.
- **Abhängigkeiten:** Fetch-API.

### /server/services/search/providers/dnb.provider.js
- **Zweck:** DNB-Provider.
- **Technische Rolle:** Platzhalter (kein API-Aufruf).
- **Abhängigkeiten:** Keine externen Module.
