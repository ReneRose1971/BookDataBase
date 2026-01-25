# Datei-Inventar (HTML + JS)

## Überblick
Diese Datei bietet eine Übersicht über alle HTML- und JavaScript-Dateien im Projekt. Jede Datei wird mit ihrem Zweck und den wichtigsten Inhalten beschrieben.

## /public
### /public/app.html
- **Zweck**: Grundlayout der Anwendung.
- **Inhalt**: Enthält Platzhalter für dynamisch geladene Views.

### /public/app.js
- **Zweck**: Einstiegspunkt des Frontends.
- **Inhalt**: Initialisiert die Anwendung und lädt Views.

### /public/view-loader.js
- **Zweck**: Dynamisches Laden von HTML-Fragmenten.
- **Inhalt**: Funktionen `loadFragment` und `loadFragments` für das Laden und Einfügen von HTML in den DOM.

### /public/ui-helpers.js
- **Zweck**: Sammlung von UI-Hilfsfunktionen.
- **Inhalt**: Funktionen wie `enableSingleRowSelection` und `fetchJson`.

## /public/views
### /public/views/books.view.html
- **Zweck**: View für die Buchverwaltung.
- **Inhalt**: Tabelle zur Anzeige von Büchern, Buttons für CRUD-Operationen.

### /public/views/authors.view.html
- **Zweck**: View für die Autorenverwaltung.
- **Inhalt**: Tabelle zur Anzeige von Autoren, Buttons für CRUD-Operationen.

## /server
### /server.js
- **Zweck**: Einstiegspunkt des Backends.
- **Inhalt**: Lädt und startet den Express-Server.

### /server/services/config.service.js
- **Zweck**: Service für API-Schlüsselverwaltung.
- **Inhalt**: Funktionen wie `getStatus`, `saveKey`, `removeKey`.

### /server/services/tags.service.js
- **Zweck**: Service für Tag-Management.
- **Inhalt**: Funktionen wie `listTags`, `createTag`, `updateTag`, `removeTag`.

### /server/services/books.service.js
- **Zweck**: Service für Buch-Management.
- **Inhalt**: Funktionen wie `listBooks`, `createBook`, `updateBook`, `deleteBook`.

### /server/services/book-lists.service.js
- **Zweck**: Service für Buchlisten.
- **Inhalt**: Funktionen wie `listBookLists`, `createBookList`, `deleteBookList`.

### /server/services/authors.service.js
- **Zweck**: Service für Autorenverwaltung.
- **Inhalt**: Funktionen wie `listAuthors`, `createAuthor`, `updateAuthor`, `removeAuthor`.

### /server/services/auth.service.js
- **Zweck**: Service für Authentifizierung.
- **Inhalt**: Funktion `testLogin` zur Überprüfung von Login-Daten.