# Implementation Log – BookDataBase

Dieses Dokument dient der fortlaufenden Dokumentation des **tatsächlich umgesetzten**
Implementierungsfortschritts.  
Es beschreibt ausschließlich **was implementiert wurde**, **wie es gelöst ist**
und **welche technischen Probleme behoben wurden**.

Planungen, zukünftige Use Cases oder noch nicht begonnene Arbeiten sind **bewusst nicht Bestandteil**
dieses Logs.

---

## Projektstatus (Kurzüberblick)

**Stand:** funktionsfähig  
**Technischer Zustand:** stabil  
**Blockierende Fehler:** keine  
**Arbeitsmodus:** inkrementelle Implementierung mit Copilot (patch-orientiert)

---

## Infrastruktur & Setup

### Backend
- Node.js + Express
- PostgreSQL (lokal)
- Anbindung über `pg` (ESM, kein ORM)
- Konfiguration über `.env`
- UTF-8 Encoding End-to-End sichergestellt

### Frontend
- Statisches HTML
- Vanilla JavaScript
- CSS ohne Framework
- Modal-basierte Benutzeroberfläche

### Entwicklungsleitlinien
- Keine Premium-/AI-Requests
- Keine automatischen Code-Dumps im Chat
- Copilot ändert Dateien direkt
- Änderungen erfolgen patch-orientiert, ohne Refactor-Eskalation

---

## Datenbank – Umgesetzte Strukturen

### Tabelle `book_lists`

**Struktur:**
- `book_list_id` (Primary Key)
- `name` (citext, unique)
- `is_standard` (boolean)
- `created_at`
- `updated_at`

**Bedeutung:**
- `is_standard = true` kennzeichnet System-/Standardlisten
- Standardlisten sind gegen Löschung geschützt

---

### Tabelle `book_book_lists`

**Zweck:**
- Verknüpfung zwischen Büchern und Bücherlisten

**Verwendung im aktuellen Stand:**
- Prüfung vor dem Löschen einer Bücherliste

---

## Feature FT-03 – Bücherlisten

### Bücherlisten anzeigen
**Status:** implementiert

- Button „Listen“ öffnet Modal
- Listen werden aus der Datenbank geladen
- Anzeige per Dropdown
- UTF-8 Darstellung korrekt (inkl. Umlaute)

---

### Neue Bücherliste anlegen
**Status:** implementiert

- Endpoint: `POST /api/book-lists`
- Validierung:
  - Name erforderlich
  - Trimmen des Eingabewerts
- Neue Listen werden mit `is_standard = false` angelegt
- Unique-Verletzung (Name existiert bereits) wird korrekt behandelt (HTTP 409)
- UI lädt Liste neu und selektiert sie

---

### Bücherliste löschen
**Status:** implementiert

**Regeln umgesetzt:**
- Standardlisten (`is_standard = true`) können nicht gelöscht werden
- Eine Liste kann nur gelöscht werden, wenn keine Einträge in `book_book_lists` existieren

**Verhalten:**
- HTTP 403 bei Standardlisten
- HTTP 409 bei vorhandenen Buchverknüpfungen
- HTTP 404 bei nicht existierender Liste
- HTTP 204 bei erfolgreicher Löschung

---

## UI / UX – umgesetzter Stand

### Modal „Bücherlisten“
- Funktional vollständig
- Buttons:
  - Anlegen
  - Löschen
  - Schließen
- Buttons sind horizontal ausgerichtet
- Flexbox-Layout stabil, kein unerwünschter Umbruch

---

## Gelöste technische Probleme

- Schema-Mismatch zwischen Code und DB (`id`, `is_default`)
  - Anpassung an reales Schema (`book_list_id`, `is_standard`)
- Fehlerhafte Seed-Logik beim Serverstart
  - Korrigiert auf bestehende Tabellenstruktur
- Encoding-Probleme bei Umlauten
  - Ursache behoben, Datenbank bereinigt
- Serverstart-Fehler durch falsche Spaltenreferenzen
  - Vollständig beseitigt
- UI-Layout-Probleme bei Button-Ausrichtung
  - CSS-Fix mit robuster Flexbox-Konfiguration

## 2026-01-17 – UI-Update-Architektur (Web-App)

**Thema:** Konsistente Aktualisierung mehrerer Controls bei Datenänderungen

**Ausgangslage:**  
In der Web-App (Node / Express / Vanilla JavaScript) werden mehrere UI-Controls aus denselben Datenbanktabellen gespeist. Änderungen (Create/Update/Delete) führten bisher zu verteilten DOM-Manipulationen in Event-Handlern und API-Callbacks.

**Entscheidung:**  
Für das Szenario *ein Nutzer, ein Browserfenster* wird eine datengetriebene UI-Architektur festgelegt. Nach jeder erfolgreichen Datenänderung werden die relevanten Daten neu geladen oder der zentrale Frontend-Zustand aktualisiert. Anschließend wird die betroffene Ansicht vollständig aus diesem Zustand neu gerendert.

**Architekturprinzip:**  
- UI-Updates erfolgen nicht controlweise, sondern zustandsweise.  
- Es existiert ein zentraler Render-Einstiegspunkt (`render()`), der alle betroffenen Controls aus dem aktuellen Zustand ableitet.  
- Event-Handler und API-Aufrufe enthalten keine direkte Datenanzeige-Logik.  
- Interaktionslogik (z. B. Modal öffnen/schließen, Tastaturereignisse) bleibt in Event-Handlern erlaubt.  
- Es werden keine Live-Technologien (WebSockets, SSE, Polling) eingesetzt.

**Begründung:**  
Dieses Vorgehen ist etabliert, reduziert Kopplung, verhindert inkonsistente UI-Zustände und bleibt auch bei mehreren betroffenen Controls und Tabellen überschaubar. Die Lösung ist bewusst minimal gehalten und verzichtet auf zusätzliche Frameworks oder State-Management-Bibliotheken.

**Status:**  
Architekturentscheidung getroffen.  
Refactoring zur Zentralisierung der Render-Logik beauftragt.

### UI / UX – Ergänzung: Delete-Button Aktivierung

**Status:** implementiert

- Der Button „Löschen“ ist standardmäßig deaktiviert.
- Aktivierung erfolgt nur, wenn eine gültige Liste selektiert ist:
  - `book_list_id` ist vorhanden und numerisch gültig.
- Zusätzlich wird geprüft, ob die selektierte Liste **keine Standardliste** ist:
  - `is_standard = true` → „Löschen“ bleibt deaktiviert.
  - `is_standard = false` → „Löschen“ kann aktiviert werden (sofern ID gültig).
- Nach dem Neuladen der Listen (z. B. nach Anlegen oder Löschen) wird der Button-Zustand erneut korrekt bewertet.

### UI / UX – Ergänzung: Navigations-Gruppen (Stammdaten / Ordnungsdaten)

**Status:** implementiert

- Die linke Navigation ist fachlich in zwei Gruppen gegliedert:
  - **Stammdaten** (Bücher, Autoren)
  - **Ordnungsdaten** (Listen, Tags)
- Jede Gruppe besitzt ein eigenes visuelles Container-Element mit erhöhtem Innenabstand (Padding)
  und klarer Trennung (Margin) zur nächsten Gruppe.
- Die Gruppenüberschriften sind als **Label-artige Elemente** umgesetzt:
  - zentriert ausgerichtet
  - größere Schrift als die Button-Beschriftungen
  - weiße Schrift auf hellgrauem Hintergrund
  - volle Breite des jeweiligen Gruppencontainers (Block-Level-Darstellung)
- Die Buttons bleiben unverändert und sind optisch eindeutig den jeweiligen Gruppen zugeordnet.
- Ergebnis ist eine ruhige, klar strukturierte Navigation mit deutlicher fachlicher Hierarchie.

HTML Updates:

Konsistente Seitenstruktur für authors.html, books.html, lists.html, tags.html und layout_app.html sichergestellt.
"Startseite"-Button in allen relevanten Seiten hinzugefügt und am unteren Rand der Navigationsspalte positioniert.
CSS Updates:

Ergänzung eines komplementären Farbschemas in app.css.
Anpassung der Button-Positionierung:
Problem: "Startseite"-Button erstreckte sich über alle Spalten aufgrund von position: absolute.
Lösung: Umstellung auf position: relative und korrekte Ausrichtung sichergestellt.
Validierung:

Button-Funktionalität und Styling auf allen Seiten überprüft.
Einheitliches Design und konsistente Benutzererfahrung bestätigt.

---

## Umgesetzte Änderungen (Januar 2026)

### Backend

#### Autorenverwaltung (API-Endpunkte)
- **GET /api/authors**: Liefert `author_id`, `first_name`, `last_name`, `book_count`.
- **POST /api/authors**: Fügt einen neuen Autor hinzu. Validierung und Dublettenprüfung implementiert.
- **PUT /api/authors/:id**: Aktualisiert einen Autor. Validierung und Dublettenprüfung implementiert.
- **DELETE /api/authors/:id**: Löscht einen Autor, sofern keine Bücher zugeordnet sind.
- **GET /api/authors/:id/books**: Liefert Bücher eines Autors (`book_id`, `title`).

### Frontend

#### Views
- **author-create.dialog.view.html**: Dialog-View für das Erstellen eines neuen Autors.
- **author-edit.dialog.view.html**: Dialog-View für das Bearbeiten eines Autors, inklusive Buchanzeige.

#### Controller (authors.controller.js)
- **Autoren anzeigen**: Lädt Autorenliste beim Mount der View und rendert die Tabelle.
- **Create-Author-Dialog**: Implementiert das Laden, Anzeigen und Verarbeiten des Dialogs für neue Autoren.
- **Edit-Author-Dialog**: Implementiert das Laden, Anzeigen und Bearbeiten eines Autors, inklusive Buchanzeige.
- **Autor löschen**: Implementiert das Löschen eines ausgewählten Autors, inklusive Konfliktbehandlung.