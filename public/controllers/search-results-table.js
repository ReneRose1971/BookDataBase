import { createDisposables, addEvent } from '../editor-runtime/disposables.js';

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORT = { key: 'title', dir: 'asc' };
const FILTER_DEBOUNCE_MS = 200;

export function mapSourceLabel(source) {
    switch (source) {
        case 'local':
            return 'Lokal';
        case 'google_books':
            return 'Google Books';
        case 'open_library':
            return 'Open Library';
        case 'dnb':
            return 'DNB';
        case 'cover_scan':
            return 'Cover Scan';
        default:
            console.warn('Unknown provider/source:', source);
            return source ? `Unbekannt: ${source}` : 'Unbekannt';
    }
}

export function normalizeTitle(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatAuthor(author) {
    if (!author) return '';
    if (author.fullName) return author.fullName;
    return [author.firstName, author.lastName].filter(Boolean).join(' ');
}

function formatAuthors(authors = []) {
    if (!Array.isArray(authors) || authors.length === 0) return '';
    return authors.map(formatAuthor).filter(Boolean).join(', ');
}

function normalizeSortValue(value) {
    return String(value ?? '')
        .trim()
        .toLocaleLowerCase('de-DE')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeFilterText(value) {
    return String(value ?? '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .trim();
}

function buildFilterHaystack(item) {
    if (!item) return '';
    const authorText = formatAuthors(item.authors);
    const parts = [
        item.title,
        authorText,
        item.isbn,
        item.publisher,
        item.year,
        item.externalId
    ].filter(Boolean);
    return normalizeFilterText(parts.join(' '));
}

function getFilteredItems(items, activeFilterText) {
    const needle = normalizeFilterText(activeFilterText);
    if (!needle) {
        return { filteredItems: [...items], isFilterActive: false };
    }
    return {
        filteredItems: items.filter((item) => buildFilterHaystack(item).includes(needle)),
        isFilterActive: true
    };
}

function getAuthorSortValue(authors) {
    if (Array.isArray(authors) && authors.length > 0) {
        const firstAuthor = authors[0];
        if (typeof firstAuthor === 'string') {
            return firstAuthor;
        }
        return formatAuthor(firstAuthor);
    }
    if (typeof authors === 'string') {
        return authors;
    }
    return '';
}

export function createSearchResultsTable({ rootElement, onImportAuthor, onImportBook }) {
    let itemsById = new Map();
    let itemIndexById = new Map();
    let allItems = [];
    let cachedLists = [];
    let filterText = '';
    let filterDebounceTimer = null;
    let filteredItemsCache = [];
    let sortState = { ...DEFAULT_SORT };
    let paging = { pageSize: DEFAULT_PAGE_SIZE, page: 1 };
    let isLoading = false;
    const disposables = createDisposables();

    function setLoading(loading) {
        isLoading = Boolean(loading);
        renderResultsSummary(allItems.length, filteredItemsCache.length, Boolean(filterText));
    }

    function getSortKey(item) {
        if (sortState?.key === 'author') {
            return normalizeSortValue(getAuthorSortValue(item.authors));
        }
        return normalizeSortValue(item.title);
    }

    function getSortedItems(items) {
        if (!sortState?.key) {
            return [...items];
        }
        const direction = sortState.dir === 'desc' ? -1 : 1;
        return items
            .map((item, idx) => ({ item, idx, key: getSortKey(item) }))
            .sort((a, b) => {
                const primary = a.key.localeCompare(b.key, 'de', { sensitivity: 'base' });
                if (primary !== 0) {
                    return primary * direction;
                }
                return (a.idx - b.idx) * direction;
            })
            .map((entry) => entry.item);
    }

    function getTotalPages(totalCount) {
        if (totalCount === 0) {
            return 0;
        }
        return Math.ceil(totalCount / paging.pageSize);
    }

    function clampPage(page, totalPages) {
        if (totalPages === 0) {
            return 1;
        }
        return Math.min(Math.max(page, 1), totalPages);
    }

    function getPagedItems(items) {
        const totalCount = items.length;
        const totalPages = getTotalPages(totalCount);
        paging.page = clampPage(paging.page, totalPages);
        if (totalPages === 0) {
            return { pagedItems: [], totalCount, totalPages };
        }
        const startIndex = (paging.page - 1) * paging.pageSize;
        const endIndex = startIndex + paging.pageSize;
        return {
            pagedItems: items.slice(startIndex, endIndex),
            totalCount,
            totalPages
        };
    }

    function renderResultsSummary(totalCount, filteredCount, isFilterActive) {
        const summaryElement = rootElement?.querySelector('[data-search-results-summary]');
        if (!summaryElement) return;
        const loadingSuffix = isLoading ? ' (lädt …)' : '';
        if (isFilterActive) {
            summaryElement.textContent = `Treffer: ${totalCount}${loadingSuffix} — Gefiltert: ${filteredCount}`;
        } else {
            summaryElement.textContent = `Treffer: ${totalCount}${loadingSuffix}`;
        }
    }

    function renderPagination(totalPages) {
        const paginationElement = rootElement?.querySelector('[data-search-pagination]');
        const infoElement = rootElement?.querySelector('[data-search-pagination-info]');
        if (!paginationElement || !infoElement) return;
        if (totalPages === 0) {
            paginationElement.style.display = 'none';
            return;
        }
        paginationElement.style.display = '';
        infoElement.textContent = `Seite ${paging.page} von ${totalPages}`;
        const disableFirst = paging.page <= 1;
        const disableLast = paging.page >= totalPages;
        setPaginationButtonState('first', disableFirst);
        setPaginationButtonState('prev', disableFirst);
        setPaginationButtonState('next', disableLast);
        setPaginationButtonState('last', disableLast);
    }

    function setPaginationButtonState(action, disabled) {
        const button = rootElement?.querySelector(`[data-page-action="${action}"]`);
        if (button) {
            button.disabled = disabled;
        }
    }

    function renderSortIndicators() {
        const headers = rootElement?.querySelectorAll('[data-sort-key]') || [];
        headers.forEach((header) => {
            const key = header.getAttribute('data-sort-key');
            const indicator = header.querySelector('[data-sort-indicator]');
            if (!indicator) return;
            if (sortState?.key === key) {
                indicator.textContent = sortState.dir === 'desc' ? '▼' : '▲';
            } else {
                indicator.textContent = '';
            }
        });
    }

    function renderItems(items = [], totalCount = 0) {
        const listElement = rootElement?.querySelector('[data-search-results-body]');
        if (!listElement) return;
        if (!Array.isArray(items) || items.length === 0) {
            const emptyText = totalCount === 0 ? 'Keine Ergebnisse geladen.' : 'Keine Treffer auf dieser Seite.';
            listElement.innerHTML = `
                <tr>
                    <td colspan="5">${emptyText}</td>
                </tr>
            `;
            return;
        }

        listElement.innerHTML = items.map((item) => {
            const authorText = formatAuthors(item.authors);
            const sourceText = mapSourceLabel(item.source);
            return `
                <tr data-result-id="${escapeHtml(item.itemId)}">
                    <td>${escapeHtml(sourceText)}</td>
                    <td>${escapeHtml(item.title)}</td>
                    <td>${escapeHtml(authorText)}</td>
                    <td>${item.isbn ? escapeHtml(item.isbn) : ''}</td>
                    <td class="search-actions-cell">
                        <button class="btn" data-action="import-book" data-item-id="${escapeHtml(item.itemId)}">Buch importieren</button>
                        <button class="btn" data-action="import-author" data-item-id="${escapeHtml(item.itemId)}">Autor importieren</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function updateResultsView(items = allItems) {
        const { filteredItems, isFilterActive } = getFilteredItems(items, filterText);
        filteredItemsCache = filteredItems;
        const sortedItems = getSortedItems(filteredItems);
        const { pagedItems, totalCount, totalPages } = getPagedItems(sortedItems);
        renderResultsSummary(allItems.length, totalCount, isFilterActive);
        renderPagination(totalPages);
        renderSortIndicators();
        renderItems(pagedItems, totalCount);
    }

    function updateItems(items = [], { replace = false } = {}) {
        if (replace) {
            allItems = [];
            itemsById = new Map();
            itemIndexById = new Map();
        }
        if (!Array.isArray(items)) {
            cachedLists = [...allItems];
            return;
        }
        items.forEach((item) => {
            if (!item?.itemId) return;
            if (itemIndexById.has(item.itemId)) {
                const index = itemIndexById.get(item.itemId);
                allItems[index] = item;
                itemsById.set(item.itemId, item);
            } else {
                itemIndexById.set(item.itemId, allItems.length);
                allItems.push(item);
                itemsById.set(item.itemId, item);
            }
        });
        cachedLists = [...allItems];
    }

    function handleSortChange(key) {
        if (sortState.key !== key) {
            sortState = { key, dir: 'asc' };
        } else {
            sortState = { key, dir: sortState.dir === 'asc' ? 'desc' : 'asc' };
        }
        updateResultsView();
    }

    function handlePageAction(action) {
        const totalPages = getTotalPages(filteredItemsCache.length);
        if (totalPages === 0) return;
        switch (action) {
            case 'first':
                paging.page = 1;
                break;
            case 'prev':
                paging.page = Math.max(1, paging.page - 1);
                break;
            case 'next':
                paging.page = Math.min(totalPages, paging.page + 1);
                break;
            case 'last':
                paging.page = totalPages;
                break;
            default:
                return;
        }
        updateResultsView();
    }

    function handlePageSizeChange(event) {
        const nextSize = Number(event.target?.value || DEFAULT_PAGE_SIZE);
        paging.pageSize = Number.isNaN(nextSize) ? DEFAULT_PAGE_SIZE : nextSize;
        paging.page = clampPage(paging.page, getTotalPages(filteredItemsCache.length));
        updateResultsView();
    }

    function updateFilterControls() {
        const filterInput = rootElement?.querySelector('[data-search-filter-input]');
        const clearButton = rootElement?.querySelector('[data-search-filter-clear]');
        const normalizedFilter = normalizeFilterText(filterText);
        const hasFilter = Boolean(normalizedFilter);
        if (clearButton) {
            clearButton.disabled = !hasFilter;
        }
        if (filterInput && filterInput.value !== filterText) {
            filterInput.value = filterText;
        }
    }

    function applyFilterText(nextText) {
        filterText = nextText;
        paging.page = 1;
        updateFilterControls();
        updateResultsView();
    }

    function handleFilterInput(event) {
        const nextText = event.target?.value ?? '';
        if (filterDebounceTimer) {
            clearTimeout(filterDebounceTimer);
        }
        filterDebounceTimer = setTimeout(() => {
            applyFilterText(nextText);
        }, FILTER_DEBOUNCE_MS);
    }

    function handleFilterClear() {
        if (filterDebounceTimer) {
            clearTimeout(filterDebounceTimer);
            filterDebounceTimer = null;
        }
        applyFilterText('');
        const filterInput = rootElement?.querySelector('[data-search-filter-input]');
        if (filterInput) {
            filterInput.focus();
        }
    }

    function handleRootClick(event) {
        const sortTarget = event.target?.closest?.('[data-sort-key]');
        if (sortTarget) {
            const sortKey = sortTarget.getAttribute('data-sort-key');
            if (sortKey) {
                handleSortChange(sortKey);
                return;
            }
        }

        const pageAction = event.target?.getAttribute('data-page-action');
        if (pageAction) {
            handlePageAction(pageAction);
            return;
        }

        const actionButton = event.target?.closest?.('[data-action]');
        if (!actionButton) return;
        const action = actionButton.getAttribute('data-action');
        const itemId = actionButton.getAttribute('data-item-id');
        if (!action || !itemId) return;
        const item = itemsById.get(itemId);
        if (!item) return;
        if (action === 'import-author' && typeof onImportAuthor === 'function') {
            onImportAuthor(item, actionButton);
        } else if (action === 'import-book' && typeof onImportBook === 'function') {
            onImportBook(item, actionButton);
        }
    }

    function init() {
        const pageSizeSelect = rootElement?.querySelector('[data-page-size]');
        const filterInput = rootElement?.querySelector('[data-search-filter-input]');
        const filterClearButton = rootElement?.querySelector('[data-search-filter-clear]');

        if (pageSizeSelect) {
            pageSizeSelect.value = String(paging.pageSize);
            disposables.add(addEvent(pageSizeSelect, 'change', (event) => handlePageSizeChange(event)));
        }
        if (filterInput) {
            filterInput.value = filterText;
            disposables.add(addEvent(filterInput, 'input', handleFilterInput));
            disposables.add(addEvent(filterInput, 'keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                }
            }));
        }
        if (filterClearButton) {
            disposables.add(addEvent(filterClearButton, 'click', () => handleFilterClear()));
        }

        disposables.add(addEvent(rootElement, 'click', handleRootClick));
        updateFilterControls();
        updateResultsView();
    }

    function reset() {
        itemsById = new Map();
        itemIndexById = new Map();
        allItems = [];
        cachedLists = [];
        filterText = '';
        filteredItemsCache = [];
        sortState = { ...DEFAULT_SORT };
        paging = { pageSize: DEFAULT_PAGE_SIZE, page: 1 };
        isLoading = false;
        if (filterDebounceTimer) {
            clearTimeout(filterDebounceTimer);
            filterDebounceTimer = null;
        }
        updateFilterControls();
        updateResultsView();
    }

    function dispose() {
        if (filterDebounceTimer) {
            clearTimeout(filterDebounceTimer);
            filterDebounceTimer = null;
        }
        disposables.disposeAll();
    }

    return {
        init,
        dispose,
        reset,
        updateItems,
        updateResultsView,
        setLoading,
        getCachedItems: () => [...cachedLists],
        getAllItems: () => [...allItems]
    };
}
