# Überblick

Diese Anwendung lädt Views dynamisch als HTML und bindet dazu Controller ein. Die Navigation ist clientseitig (SPA) über Buttons mit `data-view`. Zusätzlich gibt es ein manifest-basiertes Editor-System, das Editor-Shells und -Parts zusammensetzt und Lifecycle/Disposal zentral behandelt. Grundlage sind `public/app.js`, `public/view-loader.js` und das Editor-Runtime-Paket unter `public/editor-runtime/`.

# SPA-Navigation und View-Ladevorgang

Die Navigation wird über `public/app.js` initialisiert: Klicks auf `.nav-button[data-view]` rufen `loadViewAndController()` auf. Dort werden

1. ggf. der aktuelle Controller „unmounted“,
2. die View (HTML) geladen und in `#content` eingesetzt,
3. Fragmente innerhalb der View geladen,
4. die Section-Headline gesetzt,
5. der Controller dynamisch importiert und `mount(ctx)` aufgerufen.

Kurzform der Abfolge (aus `loadViewAndController()`):

```js
if (currentController?.unmount) currentController.unmount(root);
contentElement.innerHTML = html;
await loadFragments(contentElement);
const module = await import(controllerPath);
module.mount?.(ctx);
```

# Welche Datei triggert was?

- **`public/app.js`**: registriert die Navigation und triggert `loadViewAndController()` beim Klick auf `.nav-button[data-view]`.
- **`public/view-loader.js`**: lädt die View-HTML, Fragments, baut `ctx`, ruft `mount()`/`unmount()` im Controller.
- **Controller (`public/controllers/*.controller.js`)**: implementieren `mount(ctx)` und optional `unmount(root)`; verwalten View-spezifische Logik sowie Editor-Aufrufe (`openEditor`, `closeEditor`).
- **Editor Runtime (`public/editor-runtime/*`)**: lädt Editor-Shell/Parts aus Manifesten, bindet Actions und verwaltet Disposables.
- **Editor-Manifeste (`public/editors/*.json`)**: definieren Shell und Slots/Parts.

# Lifecycle: mount/unmount

- `loadViewAndController()` ruft vor einem View-Wechsel `currentController.unmount(root)` (falls vorhanden) auf.
- Danach wird die neue View geladen und `module.mount(ctx)` aufgerufen.
- Der Controller muss Event-Listener/Intervalle usw. in `unmount()` entfernen, falls er selbst welche anlegt.

# Wie wird ctx aufgebaut und verwendet?

`ctx` wird in `loadViewAndController()` erzeugt und an `mount(ctx)` übergeben:

- `root`: das `#content`-Element mit der geladenen View
- `viewName`: aus dem View-Dateinamen abgeleitet (z. B. `books`)
- `title`: der Titel der Route
- `navigate(view)`: Hilfsfunktion, die intern auf den passenden `.nav-button` klickt

Beispiel:

```js
const ctx = {
  root: contentElement,
  viewName,
  title,
  navigate: (view) => document.querySelector(`.nav-button[data-view="${view}"]`)?.click()
};
```

# Fragments

## Was ist data-fragment?

`data-fragment` ist ein Attribut für ein Ziel-Element innerhalb einer View, das auf eine HTML-Datei zeigt. `loadFragments(root)` sucht alle `[data-fragment]` innerhalb der View und ruft `loadFragment()` pro Element auf.

**Wichtig:** Der Fragment-Loader verhindert explizit, dass `.view.html` (außer Editor-Views) als Fragment verwendet wird.

## Wann wird es geladen?

Immer nach dem Einsetzen der View-HTML: `loadViewAndController()` ruft `await loadFragments(contentElement)` auf. Aktuell sind im Verzeichnis `public/views/` keine `data-fragment`-Attribute vorhanden; der Mechanismus ist vorbereitet, aber nicht aktiv genutzt.

# Editor-System (Manifest-basiert)

## Was ist Shell / Slot / Part?

- **Shell**: Basis-HTML für den Editor (z. B. `/views/editors/shells/books.shell.html`).
- **Slot**: Platzhalter in der Shell mit `data-editor-slot="<slotName>"`.
- **Part**: Ein Fragment, das in einen Slot geladen wird, definiert in den Manifesten (`public/editors/*.json`).

Manifest-Beispiel (gekürzt):

```json
{
  "shell": "/views/editors/shells/books.shell.html",
  "slots": {
    "header": [{ "name": "book-header", "html": "/views/editors/parts/book-header.part.html" }]
  }
}
```

## Wie arbeitet openEditor / closeEditor?

`openEditor()`:

1. `closeEditor()` wird immer zuerst aufgerufen (es gibt immer nur einen aktiven Editor).
2. Manifest-JSON wird geladen.
3. Shell-HTML wird in den Host gerendert.
4. Für jeden Slot werden Parts gerendert und optional deren Module geladen.
5. Click-Handler für `data-editor-action` wird am Host registriert.
6. Es wird ein Objekt mit `host`, `root`, `slots`, `manifest`, `mode`, `dataContext` zurückgegeben.

`closeEditor()`:

- ruft `disposables.disposeAll()` auf,
- leert das Host-Element,
- setzt `activeEditor` zurück.

## Wie funktionieren data-editor-action Buttons?

`openEditor()` registriert einen Click-Handler auf dem Host. Buttons mit `data-editor-action="confirm"` oder `data-editor-action="cancel"` triggern die entsprechenden Callbacks aus dem `actions`-Objekt. `confirm` ist gegen Mehrfachklicks geschützt (lokales `confirmBusy`).

Beispiel (HTML):

```html
<button class="func-button" data-editor-action="confirm">Speichern</button>
```

## Parts mit optionalem JS-Modul

Ein Part kann neben `html` optional `module` definieren. Wenn vorhanden, wird das Modul dynamisch importiert.

## Wie wird part.module geladen?

`loadPart()` in `component-loader.js` lädt zuerst `part.html`, dann:

```js
if (part.module) {
  const module = await import(part.module);
  module.mount?.({ ...ctx, root: target, part });
}
```

## Was darf mount() zurückgeben (cleanup/dispose)?

`module.mount()` darf:

- nichts zurückgeben,
- eine Funktion zurückgeben (wird als Disposer registriert),
- oder ein Objekt mit `dispose()` zurückgeben.

`loadPart()` fügt den Disposer dem `disposables`-Set hinzu.

## Disposables & Event-Aufräumen

### Prinzip + Beispiele

- `createDisposables()` sammelt Cleanup-Funktionen.
- `addEvent()` liefert einen Disposer (removeEventListener), der in `disposables.add()` abgelegt werden kann.
- `closeEditor()` ruft `disposeAll()` auf und leert den Host.

Beispiel (Controller/Part):

```js
const disposables = createDisposables();
const cleanup = addEvent(button, 'click', onClick);
disposables.add(cleanup);
```

# Bekannte Grenzen / Design-Entscheidungen

- Es kann **nur ein Editor gleichzeitig aktiv** sein: `openEditor()` ruft immer `closeEditor()` auf und nutzt ein globales `activeEditor`.
- Editor-Actions sind auf `confirm`/`cancel` fest verdrahtet.
- Fragments existieren als Mechanismus, werden aber aktuell nicht in Views verwendet.

# Checkliste für neue Views/Editoren

## Schritt-für-Schritt: neue View hinzufügen, neuer Editor via Manifest

**Neue View:**
1. HTML-Datei unter `public/views/<name>.view.html` anlegen.
2. In `public/app.js` eine Route ergänzen (View-Name + Controller + Title).
3. Optional: `data-fragment`-Container in der View platzieren und entsprechende HTML-Dateien erstellen.
4. Controller unter `public/controllers/<name>.controller.js` mit `mount(ctx)` erstellen.
5. In `mount(ctx)` Event-Listener mit Disposables verwalten, falls nötig.

**Neuer Editor (Manifest-basiert):**
1. Shell-HTML in `public/views/editors/shells/<editor>.shell.html` mit `data-editor-slot`-Platzhaltern erstellen.
2. Parts in `public/views/editors/parts/<part>.part.html` anlegen.
3. Manifest unter `public/editors/<editor>.editor.json` erstellen (shell + slots/parts).
4. Optional: JS-Module pro Part unter `public/views/editors/parts/<part>.module.js` (oder an anderer Stelle) und `module` im Manifest eintragen.
5. Im Controller `openEditor({ host, manifestPath, mode, dataContext, actions })` verwenden.
6. `actions.confirm` und `actions.cancel` implementieren; Editor-Buttons müssen `data-editor-action` tragen.
