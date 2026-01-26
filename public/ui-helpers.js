export function enableSingleRowSelection(tbody, onSelect) {
    if (!tbody) {
        return () => {};
    }
    const selectedClass = 'selected';
    const handleClick = (event) => {
        const row = event.target.closest('tr');
        if (!row || !tbody.contains(row)) return;
        const id = row.dataset.id;
        if (!id) return;

        const previouslySelected = tbody.querySelector(`.${selectedClass}`);
        if (previouslySelected) {
            previouslySelected.classList.remove(selectedClass);
        }

        row.classList.add(selectedClass);
        if (typeof onSelect === 'function') {
            onSelect(id, row);
        }
    };

    tbody.addEventListener('click', handleClick);
    return () => tbody.removeEventListener('click', handleClick);
}

export async function fetchJson(url, options = {}) {
    const response = await fetch(url, { ...options, cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

export function confirmDanger(message) {
    return window.confirm(message);
}
