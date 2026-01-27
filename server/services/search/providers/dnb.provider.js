import { XMLParser } from "fast-xml-parser";
import { SearchSource, createSearchResultItem } from "../../../models/search.models.js";

const parser = new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    trimValues: true
});

function arrayify(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function pickFirst(value) {
    if (Array.isArray(value)) {
        return value.find((entry) => typeof entry === "string" && entry.trim()) || value[0] || "";
    }
    return typeof value === "string" ? value : "";
}

function extractYear(value) {
    const text = pickFirst(value);
    if (!text) return null;
    const match = text.match(/\d{4}/);
    return match ? Number(match[0]) : null;
}

function extractIsbn(identifiers = []) {
    const values = arrayify(identifiers)
        .map((entry) => (typeof entry === "string" ? entry : ""))
        .filter(Boolean);
    const isbnMatch = values
        .map((entry) => entry.replace(/[^0-9Xx]/g, ""))
        .find((entry) => entry.length === 13 || entry.length === 10);
    return isbnMatch || null;
}

function extractExternalId(identifiers = [], recordIdentifier = "") {
    const candidates = [...arrayify(identifiers), recordIdentifier].filter(Boolean);
    for (const entry of candidates) {
        if (typeof entry !== "string") continue;
        const match = entry.match(/d-nb\.info\/(\d+)/);
        if (match) {
            return match[1];
        }
    }
    return recordIdentifier || null;
}

function getRecordDcPayload(recordData) {
    if (!recordData || typeof recordData !== "object") {
        return null;
    }
    if (recordData.dc) {
        return recordData.dc;
    }
    const key = Object.keys(recordData).find((entry) => entry.toLowerCase().endsWith("dc"));
    return key ? recordData[key] : null;
}

function mapRecordToItem(record) {
    const recordData = record?.recordData;
    const dc = getRecordDcPayload(recordData);
    if (!dc) {
        return null;
    }

    const title = pickFirst(dc.title);
    if (!title) {
        return null;
    }

    const authors = arrayify(dc.creator).filter(Boolean);
    const identifiers = arrayify(dc.identifier).filter(Boolean);
    const publisher = pickFirst(dc.publisher) || null;
    const year = extractYear(dc.date);
    const recordIdentifier = record?.recordIdentifier || "";

    return createSearchResultItem({
        title,
        authors,
        isbn: extractIsbn(identifiers),
        year,
        publisher,
        externalId: extractExternalId(identifiers, recordIdentifier),
        source: SearchSource.DNB,
        rawPayload: {
            identifier: recordIdentifier || null,
            source: "dnb"
        }
    });
}

function createDnbError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

export async function searchDnb(title, { limit = 10, fetcher = fetch, timeoutMs = 8000 } = {}) {
    if (!title) {
        return [];
    }

    const url = new URL("https://services.dnb.de/sru/dnb");
    url.searchParams.set("version", "1.1");
    url.searchParams.set("operation", "searchRetrieve");
    url.searchParams.set("query", `title all "${title}"`);
    url.searchParams.set("maximumRecords", String(limit));
    url.searchParams.set("recordSchema", "dc");

    console.log('DNB Query URL:', url.toString());

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
        response = await fetcher(url.toString(), { signal: controller.signal });
        console.log('DNB Response:', response);
    } catch (error) {
        console.error('DNB Fetch Error:', error);
        throw createDnbError("DNB_UNAVAILABLE", "DNB_UNAVAILABLE");
    } finally {
        clearTimeout(timeout);
    }

    if (!response.ok) {
        throw createDnbError("DNB_UNAVAILABLE", "DNB_UNAVAILABLE");
    }

    const text = await response.text();
    let data;
    try {
        data = parser.parse(text);
    } catch (error) {
        throw createDnbError("DNB_BAD_RESPONSE", "DNB_BAD_RESPONSE");
    }

    const records = arrayify(data?.searchRetrieveResponse?.records?.record);
    return records.map(mapRecordToItem).filter(Boolean);
}
