import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configFilePath = path.join(__dirname, 'secrets.json');

async function ensureConfigFile() {
    try {
        await fs.access(configFilePath);
    } catch {
        await fs.writeFile(configFilePath, JSON.stringify({ openai: null, openlibrary: null, google_books: null }, null, 2));
    }
}

export async function getApiKeyStatus() {
    await ensureConfigFile();
    const config = JSON.parse(await fs.readFile(configFilePath, 'utf-8'));
    return {
        openai: { present: !!config.openai },
        openlibrary: { present: !!config.openlibrary },
        google_books: { present: !!config.google_books }
    };
}

export async function getApiKey(service) {
    await ensureConfigFile();
    const config = JSON.parse(await fs.readFile(configFilePath, 'utf-8'));
    return config[service] || null;
}

export async function setApiKey(service, key) {
    if (!['openai', 'openlibrary', 'google_books'].includes(service)) {
        throw new Error('Invalid service name');
    }
    const config = JSON.parse(await fs.readFile(configFilePath, 'utf-8'));
    config[service] = key;
    await fs.writeFile(configFilePath, JSON.stringify(config, null, 2));
}

export async function deleteApiKey(service) {
    if (!['openai', 'openlibrary', 'google_books'].includes(service)) {
        throw new Error('Invalid service name');
    }
    const config = JSON.parse(await fs.readFile(configFilePath, 'utf-8'));
    config[service] = null;
    await fs.writeFile(configFilePath, JSON.stringify(config, null, 2));
}
