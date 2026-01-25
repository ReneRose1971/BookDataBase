import { getApiKeyStatus, setApiKey, deleteApiKey } from "../../config/config-store.js";

export async function getStatus() {
    return getApiKeyStatus();
}

export async function saveKey(type, key) {
    return setApiKey(type, key);
}

export async function removeKey(type) {
    return deleteApiKey(type);
}
