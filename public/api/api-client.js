async function request(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    let payload = null;

    if (response.status !== 204) {
        const text = await response.text();
        if (text) {
            if (isJson) {
                try {
                    payload = JSON.parse(text);
                } catch (error) {
                    payload = text;
                }
            } else {
                payload = text;
            }
        }
    }

    if (!response.ok) {
        const message = payload && typeof payload === 'object' && payload.error
            ? payload.error
            : (typeof payload === 'string' && payload ? payload : `HTTP error! status: ${response.status}`);
        const error = new Error(message);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload;
}

export async function getJson(url) {
    return request(url);
}

export async function postJson(url, body) {
    return request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

export async function putJson(url, body) {
    return request(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

export async function deleteJson(url) {
    return request(url, { method: 'DELETE' });
}

export function getErrorPayload(error) {
    return error && typeof error === 'object' ? error.payload : null;
}

export function getErrorMessage(error, fallback = 'Ein Fehler ist aufgetreten.') {
    const payload = getErrorPayload(error);
    if (payload && typeof payload === 'object' && payload.error) {
        return payload.error;
    }
    if (typeof payload === 'string' && payload.trim().length > 0) {
        return payload;
    }
    if (error && error.message) {
        return error.message;
    }
    return fallback;
}
