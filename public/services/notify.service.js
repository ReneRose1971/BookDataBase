export function notify(message) {
    window.alert(message);
}

export function notifySelectionRequired(message = 'Bitte eine Auswahl treffen.') {
    notify(message);
}

export function notifyNotFound(message = 'Eintrag nicht gefunden.') {
    notify(message);
}
