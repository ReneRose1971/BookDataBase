# Modal-Editor-Migration (Trefferliste externe Suche)

## Bestandsaufnahme (kurz)

- Trefferliste + Buttons: `public/views/search.view.html` (Tabellen-UI), Controller in `public/controllers/search.controller.js`.
- Editor-Manifeste: `public/editors/search-import-author.editor.json` und `public/editors/search-import-book.editor.json` (Shell/Parts unter `public/views/editors/...`).
- ViewLoader: `public/view-loader.js` lädt Views in `#content`, lädt Fragmente und mountet Controller via `mount(ctx)`.

## Vorher / Nachher

**Vorher**
- Klick auf „Autor übernehmen“/„Buch übernehmen“ öffnete den Editor am Ende der Trefferliste (Scroll nötig).
- Editor wurde im Trefferlisten-View in einen festen Slot gerendert.

**Nachher**
- Klick auf „Autor übernehmen“/„Buch übernehmen“ öffnet den jeweiligen Editor in einem Modal-Dialog.
- Modal-Shell ist eine eigene View mit Controller und lädt den Editor als Child-View über den ViewLoader.

## Neue/Geänderte Dateien

**Neu**
- `public/views/modal/modal-shell.view.html`
- `public/controllers/modal-shell.controller.js`
- `public/views/search-import-author.view.html`
- `public/controllers/search-import-author.controller.js`
- `public/views/search-import-book.view.html`
- `public/controllers/search-import-book.controller.js`

**Geändert**
- `public/view-loader.js` (neues `loadViewInto`-API)
- `public/controllers/search.controller.js` (Modal-Aufruf statt Inline-Editor)
- `public/views/search.view.html` (Editor-Slot entfernt)
- `public/css/components.css` (Modal-Layout)

## Modal-Shell Aufbau

- **Backdrop**: eigenes Overlay-Element mit `data-modal-backdrop`.
- **Dialog**: `role="dialog"`, `aria-modal="true"`, Titel per `aria-labelledby`.
- **Header**: Titel + Close-Button.
- **Body**: Mountpoint für Child-Views (`data-modal-body`).

## Child-View Laden & Dispose

- `modal-shell.controller.js` nutzt `loadViewInto(...)`, um Child-Views in den Body zu laden.
- Rückgabewert von `loadViewInto` enthält `dispose()`, das Controller-Unmount und DOM-Cleanup ausführt.
- Beim Schließen des Modals:
  - Child-View wird disposed,
  - Event-Listener werden entfernt,
  - Modal wird aus dem DOM entfernt,
  - Fokus geht zurück auf den Auslöser.

## Wichtiger Hinweis

- Controller müssen DOM-Selektoren **relativ zum View-Root** verwenden (kein `document.querySelector`).
- Editor-Controller (Autor/Buch) arbeiten ausschließlich mit `root`/`host` und unterstützen das Schließen über `ctx.modal.close()`.
