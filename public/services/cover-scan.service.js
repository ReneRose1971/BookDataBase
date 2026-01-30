import { getJson } from '../api/api-client.js';

export async function fetchCoverScanConfig() {
    return getJson('/api/cover-scan/config');
}

export async function extractCoverScan(files) {
    const formData = new FormData();
    files.forEach((file) => {
        formData.append('files', file);
    });

    const response = await fetch('/api/cover-scan/extract', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorMessage = await readErrorMessage(response);
        const error = new Error(errorMessage || 'Fehler beim Cover-Scan.');
        error.status = response.status;
        throw error;
    }

    return response.json();
}

export async function importCoverScan(payload) {
    const response = await fetch('/api/cover-scan/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorMessage = await readErrorMessage(response);
        const error = new Error(errorMessage || 'Fehler beim Import.');
        error.status = response.status;
        throw error;
    }

    return response.json();
}

async function readErrorMessage(response) {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (!text) return '';
    if (contentType.includes('application/json')) {
        try {
            const payload = JSON.parse(text);
            if (payload?.error) {
                return payload.error;
            }
        } catch (error) {
            return text;
        }
    }
    return text;
}
