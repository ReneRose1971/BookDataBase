## UI-Framework (verbindlich)

- Das gesamte UI verwendet ausschließlich **Pico.css**.
- Pico.css ist in `public/index.html` per CDN eingebunden.
- Keine weiteren CSS-Frameworks hinzufügen (kein Bootstrap, kein Tailwind, kein Bulma).
- Keine Inline-Styles. Eigene Styles nur in `public/app.css` und nur für Layout-Hilfen.
- UI in semantischem HTML (main/form/label/input/button/table).
- - Niemals `<style>`-Blöcke im HTML einfügen. CSS gehört ausschließlich nach `public/app.css`.
- - Änderungen an HTML/CSS müssen vorhandene Struktur respektieren; keine neuen Styling-Mechanismen (kein inline style, kein `<style>`, keine neuen Frameworks).

# UI-Update-Regeln für Web-App (Node / Express / Vanilla JavaScript)

## Ziel
Diese Regeln stellen sicher, dass UI-Updates konsistent, wartbar und datengetrieben erfolgen.  
Die Anwendung hat **einen Nutzer und ein Browserfenster**. Es werden **keine Live-Technologien** benötigt.

---

## Grundregel für UI-Updates
UI-Updates müssen datengetrieben erfolgen.  
Nach jeder erfolgreichen Create-, Update- oder Delete-Operation werden die relevanten Daten erneut vom Server geladen oder der zentrale Frontend-Zustand aktualisiert. Anschließend wird die betroffene Ansicht vollständig aus dem aktuellen Zustand neu gerendert.  
Einzelne DOM-Elemente dürfen nicht manuell synchronisiert oder gezielt nachgezogen werden.

---

## Zentraler Render-Mechanismus
Die Oberfläche wird über eine zentrale Render-Funktion oder klar abgegrenzte Render-Funktionen pro View aktualisiert.  
Event-Handler und API-Aufrufe dürfen keine UI-Logik enthalten.  
Sie stoßen ausschließlich Datenänderungen an und lösen danach ein Neurendern aus.

---

## Trennung der Zuständigkeiten
Das Backend ist ausschließlich für Datenzugriff und Datenänderungen zuständig.  
Das Frontend ist ausschließlich für Darstellung und Rendering zuständig.  
Die Datenbank triggert keine UI-Aktualisierung direkt.  
Da es nur einen Nutzer und ein Browserfenster gibt, werden keine WebSockets, keine Server-Sent Events und kein Polling eingesetzt.

---

## Konsistenz bei mehreren Controls
Wenn mehrere Controls dieselben Daten oder davon abgeleitete Informationen anzeigen (z. B. Liste, Zähler, Detailansicht), müssen sie immer aus derselben aktuellen Datenbasis gerendert werden.  
Teilaktualisierungen einzelner Controls sind zu vermeiden, da sie inkonsistente Zustände erzeugen können.

---

## Verbot unnötiger Komplexität
Es werden keine zusätzlichen Frontend-Frameworks oder State-Management-Bibliotheken eingeführt, solange dies nicht ausdrücklich beauftragt ist.  
Insbesondere sind React, Vue, Svelte, Redux, MobX oder ähnliche Technologien zu vermeiden.  
Die Lösung bleibt bei Vanilla JavaScript mit einem einfachen, zentralen Zustand.

---

## Definition of Done
Eine Änderung gilt nur dann als abgeschlossen, wenn nach einer Create-, Update- oder Delete-Operation die gesamte betroffene Ansicht korrekt aktualisiert ist.  
Dazu gehören alle abhängigen Anzeigen wie Listen, Zähler oder Filter, ohne dass im Code einzelne DOM-Elemente gezielt aktualisiert wurden.

# UI-Komposition – verbindliche Architektur- und Entwurfsregeln

## Zweck
Dieses Projekt verwendet bewusst Vanilla JavaScript mit HTML-View-Partials zur UI-Komposition.
Es werden keine Frontend-Frameworks wie React, Vue oder Angular eingesetzt.

Ziel ist eine klare, stabile und wartbare Trennung von:
- Markup (HTML)
- UI-Logik (Controller)
- Daten- und Fachlogik (Services / Use Cases)

Copilot MUSS sich strikt an die folgenden Regeln halten.

---

## Grundprinzip (verbindlich)

- Views sind reine HTML-Fragmente (Partials).
- Views werden clientseitig nachgeladen und in Container eingefügt.
- Views enthalten keinerlei Logik.
- UI-Logik befindet sich ausschließlich in JavaScript-Controllern.
- Views sind komponierbar und schachtelbar.
- Jede View hat genau einen Controller.
- Es existiert ein klar definierter View-Lifecycle.

---

## Verzeichnisstruktur (verbindlich)

public/
- index.html
- app.js                      (ViewHost / Einstiegspunkt)
- views/
  - books.view.html
  - authors.view.html
- controllers/
  - books.controller.js
  - authors.controller.js
- services/
- css/
  - style.css

Copilot DARF:
- keine alternative Struktur einführen
- keine zusätzlichen Ebenen vorschlagen

---

## Views (*.view.html)

Views enthalten KEINE:
- script-Tags
- style-Tags
- Inline-Event-Handler (onclick, onchange, etc.)
- fachliche oder technische Logik

Views enthalten KEINE vollständigen HTML-Dokumente
(kein html-, head- oder body-Element).

Erlaubt:
- semantisches HTML
- data-* Attribute zur Deklaration von Verhalten
- Platzhalter für Subviews

Beispiel für einen Subview-Platzhalter:
    <div data-view="authors"></div>

---

## Controller (*.controller.js)

Für jede View existiert genau ein Controller.

Ein Controller ist verantwortlich für:
- Initialisierung der View
- Event-Bindings
- Datenladung
- Aufräumen beim Entfernen der View

Jeder Controller MUSS exakt folgende Funktionen exportieren:

    export function mount(rootElement) {}
    export function unmount() {}

### Verbindliche Regeln für Controller

- Alle DOM-Zugriffe erfolgen ausschließlich relativ zu rootElement.
- Event-Handler werden nur im mount() gebunden.
- Event-Handler werden im unmount() entfernt oder über Event Delegation gelöst.
- Controller greifen nicht direkt auf globale DOM-Elemente zu.
- Controller erzeugen kein HTML per String-Templates.

---

## View-Lifecycle (verbindlich)

Beim Anzeigen einer View:
1. View-HTML wird per fetch() geladen.
2. HTML wird in den Zielcontainer eingefügt.
3. Der zugehörige Controller wird ermittelt.
4. controller.mount(container) wird aufgerufen.

Beim Wechsel einer View:
1. unmount() des aktuellen Controllers wird aufgerufen.
2. DOM-Inhalt des Containers wird ersetzt.
3. Neuer Controller wird gemountet.

Copilot MUSS diesen Ablauf exakt einhalten.

---

## Subviews / Schachtelung

- Views dürfen Unterviews über data-view deklarieren.
- Subviews werden nach dem Laden der Hauptview automatisch nachgeladen.
- Jede Subview:
  - ist selbst eine .view.html
  - besitzt einen eigenen Controller
  - unterliegt exakt denselben Regeln wie Hauptviews

Schachtelung ist erlaubt und ausdrücklich vorgesehen.

---

## Event-Handling (verbindlich)

Erlaubt:
- Event Delegation am Root-Element der View
- explizites Binden und Entfernen von Events im Controller

Nicht erlaubt:
- Inline-Events im HTML
- globale Event-Handler ohne View-Bezug
- mehrfaches Registrieren von Events beim erneuten Mount

---

## Trennung von Verantwortlichkeiten

- Views: Darstellung
- Controller: UI-Logik
- Services / Use Cases: Datenzugriff und Fachlogik

Controller dürfen Services verwenden.
Views dürfen weder Controller noch Services direkt aufrufen.

---

## Verbotene Praktiken (absolut)

Copilot DARF NICHT:
- JavaScript in .view.html einbetten
- Logik in HTML oder Templates implementieren
- DOM außerhalb des View-Roots manipulieren
- neue Frameworks oder UI-Bibliotheken einführen
- alternative Architekturmuster vorschlagen
- mehrere Controller für eine View erzeugen
- Styles oder Scripts dynamisch in Views injizieren

Abweichungen von diesen Regeln gelten als Fehler.
