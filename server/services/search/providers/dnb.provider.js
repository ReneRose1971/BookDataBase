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

function createDnbError(message, code, details) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
}

function escapeCqlTerm(value) {
    if (typeof value !== "string") {
        return "";
    }
    return value.replace(/"/g, '\\"').trim();
}

function buildDnbQuery(title) {
    const escaped = escapeCqlTerm(title);
    if (!escaped) {
        return "";
    }
    return `title all "${escaped}*"`;
}

export async function searchDnb(title, { limit = 10, startRecord = 1, fetcher = fetch, signal } = {}) {
    if (!title) {
        return { items: [], totalItems: null, requestUrl: null, status: 200, statusText: "No query", limit };
    }

    const url = new URL("https://services.dnb.de/sru/dnb");
    url.searchParams.set("version", "1.1");
    url.searchParams.set("operation", "searchRetrieve");
    url.searchParams.set("query", buildDnbQuery(title));
    url.searchParams.set("maximumRecords", String(limit));
    url.searchParams.set("recordSchema", "dc");
    if (typeof startRecord === "number" && startRecord > 1) {
        url.searchParams.set("startRecord", String(startRecord));
    }

    let response;
    try {
        response = await fetcher(url.toString(), { signal });
    } catch (error) {
        throw createDnbError("DNB_UNAVAILABLE", "DNB_UNAVAILABLE", {
            requestUrl: url.toString(),
            message: error?.message
        });
    }

    const responseText = await response.text();
    if (!response.ok) {
        throw createDnbError("DNB_UNAVAILABLE", "DNB_UNAVAILABLE", {
            status: response.status,
            statusText: response.statusText,
            bodySnippet: responseText.slice(0, 500),
            requestUrl: url.toString()
        });
    }

    let data;
    try {
        data = parser.parse(responseText);
    } catch (error) {
        throw createDnbError("DNB_BAD_RESPONSE", "DNB_BAD_RESPONSE", {
            requestUrl: url.toString(),
            bodySnippet: responseText.slice(0, 500)
        });
    }

    const records = arrayify(data?.searchRetrieveResponse?.records?.record);
    return {
        items: records.map(mapRecordToItem).filter(Boolean),
        totalItems: Number(data?.searchRetrieveResponse?.numberOfRecords) || null,
        requestUrl: url.toString(),
        status: response.status,
        statusText: response.statusText,
        limit,
        startRecord
    };
}
