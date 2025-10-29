import { loadData } from './_api.js';

const transactionTableBody = document.getElementById('transactionTableBody');
const exportButton = document.getElementById('exportButton');
const graphCanvas = document.getElementById('transactionChart');

// Search elements
const searchCategory = document.getElementById('searchCategory');
const searchNameInput = document.getElementById('searchNameInput');
const searchDateInput = document.getElementById('searchDateInput');
const searchTypeInput = document.getElementById('searchTypeInput');
const suggestionsDiv = document.getElementById('suggestions');

let allTransactions = [];
let filteredTransactions = [];
let transactionChart = null;
let uniqueItemNames = []; // For autocomplete

/**
 * Fetches transaction data and populates unique item names.
 */
async function loadTransactionData() {
    try {
        const data = await loadData();
        allTransactions = data.transactions || [];
        allTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Populate unique item names for suggestions (extract base name without size)
        const nameSet = new Set();
        allTransactions.forEach(t => {
            const baseName = t.itemName.replace(/\s\(.+\)$/, ''); // Remove size like " (S)"
            nameSet.add(baseName);
        });
        uniqueItemNames = Array.from(nameSet).sort(); // Convert Set to sorted Array

        applyFilter(); // Initial display
    } catch (err) {
        console.error('Error loading transaction data:', err);
        transactionTableBody.innerHTML = '<tr><td colspan="6" style="color: red; text-align: center;">Error loading transactions.</td></tr>'; // Updated colspan
    }
}

/**
 * Handles changes in the search category dropdown.
 */
function handleCategoryChange() {
    const category = searchCategory.value;
    // Hide all inputs first
    searchNameInput.style.display = 'none';
    searchDateInput.style.display = 'none';
    searchTypeInput.style.display = 'none';
    suggestionsDiv.style.display = 'none'; // Hide suggestions

    // Show the relevant input
    if (category === 'name') {
        searchNameInput.style.display = 'inline-block';
        searchNameInput.value = ''; // Clear previous value
    } else if (category === 'date') {
        searchDateInput.style.display = 'inline-block';
        searchDateInput.value = ''; // Clear previous value
    } else if (category === 'type') {
        searchTypeInput.style.display = 'inline-block';
        searchTypeInput.value = ''; // Clear previous value
    }
    applyFilter(); // Re-filter when category changes
}

/**
 * Filters transactions based on the selected category and input value.
 */
function applyFilter() {
    const category = searchCategory.value;
    let searchTerm = '';

    if (category === 'name') {
        searchTerm = searchNameInput.value.toLowerCase();
    } else if (category === 'date') {
        searchTerm = searchDateInput.value; // Keep as YYYY-MM-DD
    } else if (category === 'type') {
        searchTerm = searchTypeInput.value.toLowerCase();
    }

    if (!searchTerm) {
        filteredTransactions = [...allTransactions];
    } else {
        filteredTransactions = allTransactions.filter(entry => {
            if (category === 'name') {
                // Check if base item name includes the term
                return entry.itemName.toLowerCase().includes(searchTerm);
            } else if (category === 'date') {
                // Compare only the date part of the timestamp
                return entry.timestamp.startsWith(searchTerm);
            } else if (category === 'type') {
                return entry.type.toLowerCase().includes(searchTerm);
            }
            return false; // Should not happen
        });
    }

    renderTable();
    renderChart();
}

/**
 * Shows autocomplete suggestions for item names.
 */
function showSuggestions() {
    const inputText = searchNameInput.value.toLowerCase();
    suggestionsDiv.innerHTML = ''; // Clear previous suggestions

    if (!inputText) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    const matchingNames = uniqueItemNames.filter(name =>
        name.toLowerCase().includes(inputText)
    );

    if (matchingNames.length > 0) {
        matchingNames.forEach(name => {
            const div = document.createElement('div');
            // Highlight the matching part
            const index = name.toLowerCase().indexOf(inputText);
            const highlighted = name.substring(0, index) +
                `<span class="highlight">${name.substring(index, index + inputText.length)}</span>` +
                name.substring(index + inputText.length);
            div.innerHTML = highlighted;
            div.addEventListener('click', () => {
                searchNameInput.value = name; // Fill input with selected name
                suggestionsDiv.style.display = 'none'; // Hide suggestions
                applyFilter(); // Trigger filter
            });
            suggestionsDiv.appendChild(div);
        });
        suggestionsDiv.style.display = 'block';
    } else {
        suggestionsDiv.style.display = 'none';
    }
}

// renderTable, renderChart, exportToCsv functions remain the same as before
// Make sure renderTable has colspan="6" for error/empty messages

function renderTable() {
    transactionTableBody.innerHTML = '';
    if (filteredTransactions.length === 0) {
        transactionTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No matching transactions found.</td></tr>';
        return;
    }
    const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    filteredTransactions.forEach(entry => {
        const entryDate = new Date(entry.timestamp);
        const dateStr = entryDate.toLocaleDateString(undefined, dateOptions);
        const timeStr = entryDate.toLocaleTimeString(undefined, timeOptions);
        const row = document.createElement('tr');
        row.className = (entry.type === 'Added') ? 'log-add' : 'log-cut';
        row.innerHTML = `<td>${dateStr}</td><td>${timeStr}</td><td>${entry.itemName}</td><td>${entry.type}</td><td>${entry.amount}</td><td>${entry.newStock}</td>`;
        transactionTableBody.appendChild(row);
    });
}

function renderChart() {
    if (!graphCanvas) return;
    const ctx = graphCanvas.getContext('2d');
    const dailyData = {};
    filteredTransactions.forEach(entry => {
        const dateStr = entry.timestamp.split('T')[0];
        if (!dailyData[dateStr]) dailyData[dateStr] = { in: 0, out: 0 };
        if (entry.type === 'Added') dailyData[dateStr].in += entry.amount;
        else dailyData[dateStr].out += entry.amount;
    });
    const sortedDates = Object.keys(dailyData).sort();
    const labels = sortedDates;
    const dataIn = sortedDates.map(date => dailyData[date].in);
    const dataOut = sortedDates.map(date => dailyData[date].out);
    if (transactionChart) transactionChart.destroy();
    transactionChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Stock Added', data: dataIn, backgroundColor: 'rgba(75, 192, 192, 0.6)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1 }, { label: 'Stock Cut', data: dataOut, backgroundColor: 'rgba(255, 99, 132, 0.6)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Amount' } }, x: { title: { display: true, text: 'Date' } } }, plugins: { title: { display: true, text: 'Daily Stock Transactions (In/Out)' } } }
    });
}

function exportToCsv() {
    if (filteredTransactions.length === 0) { alert("No data to export."); return; }
    const headers = ["Date", "Time", "Item Name", "Type", "Amount", "New Stock Level"];
    const csvRows = [headers.join(",")];
    const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    filteredTransactions.forEach(entry => {
        const entryDate = new Date(entry.timestamp);
        const dateStr = entryDate.toLocaleDateString(undefined, dateOptions);
        const timeStr = entryDate.toLocaleTimeString(undefined, timeOptions);
        const values = [`"${dateStr}"`, `"${timeStr}"`, `"${entry.itemName.replace(/"/g, '""')}"`, entry.type, entry.amount, entry.newStock];
        csvRows.push(values.join(","));
    });
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "transactions.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// --- Event Listeners ---
searchCategory.addEventListener('change', handleCategoryChange);
// Add listeners to trigger filter when inputs change
searchNameInput.addEventListener('input', () => {
    applyFilter();
    showSuggestions(); // Show suggestions as user types
});
searchDateInput.addEventListener('change', applyFilter); // 'change' is better for date input
searchTypeInput.addEventListener('input', applyFilter);
exportButton.addEventListener('click', exportToCsv);

// Hide suggestions if user clicks outside
document.addEventListener('click', (event) => {
    if (!searchNameInput.contains(event.target) && !suggestionsDiv.contains(event.target)) {
        suggestionsDiv.style.display = 'none';
    }
});


// --- Initial Load ---
handleCategoryChange(); // Set initial input visibility
loadTransactionData();