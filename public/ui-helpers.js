export function enableSingleRowSelection(tbody, onSelect) {
    tbody.addEventListener('click', (event) => {
        const row = event.target.closest('tr');
        console.log('Clicked row:', row); // Debugging line
        if (!row) return;

        const selectedClass = 'selected';
        const previouslySelected = tbody.querySelector(`.${selectedClass}`);
        if (previouslySelected) {
            previouslySelected.classList.remove(selectedClass);
        }

        row.classList.add(selectedClass);
        const id = row.dataset.id;
        console.log('Row dataset ID:', id); // Debugging line
        if (id) onSelect(id);
    });
}

export async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

export function confirmDanger(message) {
    return window.confirm(message);
}