import { XMLParser } from "fast-xml-parser";
import {
    SearchSource,
    createSearchResultItem,
    normalizeContainsInput
} from "../../../models/search.models.js";

const DNB_PAGE_SIZE = 100;

const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: true
});

function arrayify(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function getTextValue(value) {
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number") {
        return String(value);
    }
    if (value && typeof value === "object") {
        if (typeof value["#text"] === "string") {
            return value["#text"];
        }
        if (typeof value.text === "string") {
            return value.text;
        }
    }
    return "";
}

function pickFirst(value) {
    if (Array.isArray(value)) {
        const firstText = value.map(getTextValue).find((entry) => entry.trim());
        return firstText || getTextValue(value[0]) || "";
    }
    return getTextValue(value);
}

function extractYear(value) {
    const text = pickFirst(value);
    if (!text) return null;
    const match = text.match(/\d{4}/);
    return match ? Number(match[0]) : null;
}

function extractIsbn(identifiers = []) {
    const values = arrayify(identifiers)
        .map(getTextValue)
        .filter(Boolean);
    const isbnMatch = values
        .map((entry) => entry.replace(/[^0-9Xx]/g, ""))
        .find((entry) => entry.length === 13 || entry.length === 10);
    return isbnMatch || null;
}

function extractExternalId(identifiers = [], recordIdentifier = "") {
    const candidates = [...arrayify(identifiers), recordIdentifier].map(getTextValue).filter(Boolean);
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

function getMarcRecord(recordData) {
    if (!recordData || typeof recordData !== "object") {
        return null;
    }
    if (recordData.record) {
        return recordData.record;
    }
    if (recordData.datafield || recordData.controlfield) {
        return recordData;
    }
    return null;
}

function getMarcSubfieldTexts(field, codes = []) {
    const codeSet = new Set(codes);
    return arrayify(field?.subfield)
        .filter((subfield) => codeSet.has(subfield?.["@_code"]))
        .map(getTextValue)
        .filter(Boolean);
}

function extractMarcTitle(recordData) {
    const record = getMarcRecord(recordData);
    if (!record) {
        return "";
    }
    const datafields = arrayify(record.datafield);
    const titleField = datafields.find((field) => field?.["@_tag"] === "245");
    if (!titleField) {
        return "";
    }
    const titleParts = [
        ...getMarcSubfieldTexts(titleField, ["a"]),
        ...getMarcSubfieldTexts(titleField, ["b"]),
        ...getMarcSubfieldTexts(titleField, ["n"]),
        ...getMarcSubfieldTexts(titleField, ["p"])
    ];
    const title = titleParts.join(" ").replace(/\s+/g, " ").trim();
    return title.replace(/[\s\/:;]+$/g, "").trim();
}

function extractMarcAuthors(recordData) {
    const record = getMarcRecord(recordData);
    if (!record) {
        return [];
    }
    const datafields = arrayify(record.datafield);
    const authorTags = ["100", "700"];
    const authors = [];
    for (const field of datafields) {
        if (!authorTags.includes(field?.["@_tag"])) continue;
        authors.push(...getMarcSubfieldTexts(field, ["a"]));
    }
    return authors.map((author) => author.replace(/[\s,;]+$/g, "").trim()).filter(Boolean);
}

function extractMarcPublisher(recordData) {
    const record = getMarcRecord(recordData);
    if (!record) {
        return null;
    }
    const datafields = arrayify(record.datafield);
    const publisherField = datafields.find((field) => field?.["@_tag"] === "264")
        || datafields.find((field) => field?.["@_tag"] === "260");
    if (!publisherField) {
        return null;
    }
    return pickFirst(getMarcSubfieldTexts(publisherField, ["b"])) || null;
}

function extractMarcYear(recordData) {
    const record = getMarcRecord(recordData);
    if (!record) {
        return null;
    }
    const datafields = arrayify(record.datafield);
    const yearField = datafields.find((field) => field?.["@_tag"] === "264")
        || datafields.find((field) => field?.["@_tag"] === "260");
    if (!yearField) {
        return null;
    }
    return extractYear(getMarcSubfieldTexts(yearField, ["c"]));
}

function extractMarcIdentifiers(recordData) {
    const record = getMarcRecord(recordData);
    if (!record) {
        return [];
    }
    const datafields = arrayify(record.datafield);
    const isbnFields = datafields.filter((field) => field?.["@_tag"] === "020");
    return isbnFields.flatMap((field) => getMarcSubfieldTexts(field, ["a"]));
}

function extractRecordTitle(record) {
    const recordData = record?.recordData;
    const dc = getRecordDcPayload(recordData);
    if (dc) {
        const dcTitle = pickFirst(dc.title);
        if (dcTitle) {
            return dcTitle;
        }
    }
    return extractMarcTitle(recordData);
}

function mapRecordToItem(record, titleOverride = "") {
    const recordData = record?.recordData;
    const dc = getRecordDcPayload(recordData);
    const title = titleOverride || (dc ? pickFirst(dc.title) : "");
    if (!title) {
        return null;
    }

    const authors = dc
        ? arrayify(dc.creator).map(getTextValue).filter(Boolean)
        : extractMarcAuthors(recordData);
    const identifiers = dc
        ? arrayify(dc.identifier).map(getTextValue).filter(Boolean)
        : extractMarcIdentifiers(recordData);
    const publisher = dc ? pickFirst(dc.publisher) || null : extractMarcPublisher(recordData);
    const year = dc ? extractYear(dc.date) : extractMarcYear(recordData);
    const recordIdentifier = getTextValue(record?.recordIdentifier || "");

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
    return value.replace(/"/g, "\\\"").trim();
}

function buildDnbQuery(title, { index = "WOE", mode = "prefix" } = {}) {
    const escaped = escapeCqlTerm(title);
    if (!escaped) {
        return { query: "", indexUsed: index, queryMode: mode };
    }
    if (mode === "exact") {
        return { query: `${index}="${escaped}"`, indexUsed: index, queryMode: mode };
    }
    return { query: `${index}=${escaped}*`, indexUsed: index, queryMode: mode };
}

function logDnbRequest({ requestUrl, status, numberOfRecords, returnedRecords, indexUsed, queryMode }) {
    const totalLabel = typeof numberOfRecords === "number" ? numberOfRecords : "n/a";
    console.info(
        `[DNB SRU] url=${requestUrl} status=${status} numberOfRecords=${totalLabel} returnedRecords=${returnedRecords} index=${indexUsed} mode=${queryMode}`
    );
}

async function fetchDnbPage({ query, startRecord, maximumRecords, recordSchema, fetcher, signal, indexUsed, queryMode }) {
    const url = new URL("https://services.dnb.de/sru/dnb");
    url.searchParams.set("version", "1.1");
    url.searchParams.set("operation", "searchRetrieve");
    url.searchParams.set("query", query);
    url.searchParams.set("maximumRecords", String(maximumRecords));
    url.searchParams.set("recordSchema", recordSchema);
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
    const totalRecordsRaw = data?.searchRetrieveResponse?.numberOfRecords;
    const totalRecords = typeof totalRecordsRaw === "string" || typeof totalRecordsRaw === "number"
        ? Number(totalRecordsRaw)
        : null;
    const returnedRecords = records.length;

    logDnbRequest({
        requestUrl: url.toString(),
        status: response.status,
        numberOfRecords: totalRecords,
        returnedRecords,
        indexUsed,
        queryMode
    });

    return {
        records,
        totalRecords,
        returnedRecords,
        requestUrl: url.toString(),
        status: response.status,
        statusText: response.statusText
    };
}

export async function searchDnb(
    title,
    {
        limit = 10,
        startRecord = 1,
        fetcher = fetch,
        signal,
        pageSize = DNB_PAGE_SIZE,
        fetchAllPages = true
    } = {}
) {
    if (!title) {
        return {
            items: [],
            totalItems: null,
            requestUrl: null,
            status: 200,
            statusText: "No query",
            limit,
            providerMeta: {
                indexUsed: "WOE",
                queryMode: "prefix",
                pagesFetched: 0,
                recordsTotal: null
            }
        };
    }

    const normalizedQuery = normalizeContainsInput(title);
    const { query, indexUsed, queryMode } = buildDnbQuery(title, { index: "WOE", mode: "prefix" });
    if (!query) {
        return {
            items: [],
            totalItems: null,
            requestUrl: null,
            status: 200,
            statusText: "No query",
            limit,
            providerMeta: {
                indexUsed,
                queryMode,
                pagesFetched: 0,
                recordsTotal: null
            }
        };
    }

    const maximumRecords = Math.max(1, Math.min(pageSize, 100));
    let currentStart = typeof startRecord === "number" && startRecord > 0 ? startRecord : 1;
    let items = [];
    let totalRecords = null;
    let pagesFetched = 0;
    let requestUrl = null;
    let status = 200;
    let statusText = "OK";

    while (true) {
        const pageResult = await fetchDnbPage({
            query,
            startRecord: currentStart,
            maximumRecords,
            recordSchema: "MARC21-xml",
            fetcher,
            signal,
            indexUsed,
            queryMode
        });

        pagesFetched += 1;
        requestUrl = pageResult.requestUrl;
        status = pageResult.status;
        statusText = pageResult.statusText;
        totalRecords = typeof pageResult.totalRecords === "number" ? pageResult.totalRecords : totalRecords;

        for (const record of pageResult.records) {
            const recordTitle = extractRecordTitle(record);
            if (!recordTitle) {
                continue;
            }
            if (normalizedQuery && !normalizeContainsInput(recordTitle).includes(normalizedQuery)) {
                continue;
            }
            const item = mapRecordToItem(record, recordTitle);
            if (item) {
                items.push(item);
            }
        }

        if (typeof limit === "number" && limit > 0 && items.length >= limit) {
            items = items.slice(0, limit);
            break;
        }

        if (!fetchAllPages) {
            break;
        }

        if (pageResult.returnedRecords === 0) {
            break;
        }

        if (typeof totalRecords === "number") {
            if (currentStart + maximumRecords > totalRecords) {
                break;
            }
        }

        currentStart += maximumRecords;
        if (typeof totalRecords === "number" && currentStart > totalRecords) {
            break;
        }
    }

    return {
        items,
        totalItems: totalRecords,
        requestUrl,
        status,
        statusText,
        limit,
        startRecord,
        providerMeta: {
            indexUsed,
            queryMode,
            pagesFetched,
            recordsTotal: totalRecords
        }
    };
}
