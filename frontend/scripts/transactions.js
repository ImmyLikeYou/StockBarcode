import { loadData } from './_api.js';
import { initializeI18n, setLanguage, t, parseError } from './i18n.js';

const transactionTableBody = document.getElementById('transactionTableBody');
const exportButton = document.getElementById('exportButton');
const graphCanvas = document.getElementById('transactionChart');

const searchCategory = document.getElementById('searchCategory');
const searchNameInput = document.getElementById('searchNameInput');
const searchDateInput = document.getElementById('searchDateInput');
const searchTypeInput = document.getElementById('searchTypeInput');
const suggestionsDiv = document.getElementById('suggestions');

let allTransactions = [];
let filteredTransactions = [];
let transactionChart = null;
let uniqueItemNames = [];

// --- NEW: Store inventory and product data here ---
let currentInventory = {};
let currentProducts = {};

/**
 * Fetches transaction, inventory, and product data.
 */
async function loadTransactionData() {
    try {
        const data = await loadData();
        // --- NEW: Store all data ---
        allTransactions = data.transactions || [];
        currentInventory = data.inventory || {};
        currentProducts = data.products || {};

        if (!Array.isArray(allTransactions)) {
            allTransactions = [];
        }

        allTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const nameSet = new Set();
        allTransactions.forEach(t => {
            const baseName = t.itemName.replace(/\s\(.+\)$/, '');
            nameSet.add(baseName);
        });
        uniqueItemNames = Array.from(nameSet).sort();

        applyFilter();
    } catch (err) {
        console.error('Error loading transaction data:', err);
        const { key, context } = parseError(err);
        transactionTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">${t(key, context) || t('error_loading_transactions')}</td></tr>`;
    }
}

/**
 * Handles changes in the search category dropdown.
 */
function handleCategoryChange() {
    const category = searchCategory.value;
    searchNameInput.style.display = 'none';
    searchDateInput.style.display = 'none';
    searchTypeInput.style.display = 'none';
    suggestionsDiv.style.display = 'none';

    if (category === 'name') {
        searchNameInput.style.display = 'inline-block';
        searchNameInput.value = '';
    } else if (category === 'date') {
        searchDateInput.style.display = 'inline-block';
        searchDateInput.value = '';
    } else if (category === 'type') {
        searchTypeInput.style.display = 'inline-block';
        searchTypeInput.value = '';
    }
    applyFilter();
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
        searchTerm = searchDateInput.value;
    } else if (category === 'type') {
        searchTerm = searchTypeInput.value.toLowerCase();
    }

    if (!searchTerm) {
        filteredTransactions = [...allTransactions];
    } else {
        filteredTransactions = allTransactions.filter(entry => {
            if (category === 'name') {
                return entry.itemName.toLowerCase().includes(searchTerm);
            } else if (category === 'date') {
                return entry.timestamp.startsWith(searchTerm);
            } else if (category === 'type') {
                return entry.type.toLowerCase().includes(searchTerm);
            }
            return false;
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
    suggestionsDiv.innerHTML = '';

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
            const index = name.toLowerCase().indexOf(inputText);
            const highlighted = name.substring(0, index) +
                `<span class="highlight">${name.substring(index, index + inputText.length)}</span>` +
                name.substring(index + inputText.length);
            div.innerHTML = highlighted;
            div.addEventListener('click', () => {
                searchNameInput.value = name;
                suggestionsDiv.style.display = 'none';
                applyFilter();
            });
            suggestionsDiv.appendChild(div);
        });
        suggestionsDiv.style.display = 'block';
    } else {
        suggestionsDiv.style.display = 'none';
    }
}

// --- THIS IS THE FIXED RENDER FUNCTION ---
function renderTable() {
    transactionTableBody.innerHTML = '';
    if (filteredTransactions.length === 0) {
        transactionTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center;">${t('transactions_no_match')}</td></tr>`;
        return;
    }
    const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };

    let grandTotalCost = 0;

    filteredTransactions.forEach(entry => {
        const entryDate = new Date(entry.timestamp);
        const dateStr = entryDate.toLocaleDateString(undefined, dateOptions);
        const timeStr = entryDate.toLocaleTimeString(undefined, timeOptions);

        // --- THIS IS THE FIX ---
        let costEach = parseFloat(entry.cost);
        const amount = parseFloat(entry.amount) || 0;

        // 1. If cost wasn't saved (old data), try to find it
        if (isNaN(costEach) || costEach === 0) {
            try {
                // Extract size from item name, e.g., "T-Shirt (S)" -> "S"
                const sizeMatch = entry.itemName.match(/\(([^)]+)\)$/);
                if (sizeMatch && entry.itemCode && currentInventory[entry.itemCode] && currentInventory[entry.itemCode][sizeMatch[1]]) {
                    costEach = parseFloat(currentInventory[entry.itemCode][sizeMatch[1]].cost) || 0;
                }
            } catch (e) {
                console.warn("Could not find fallback cost for old transaction:", e);
                costEach = 0; // Default to 0 if anything fails
            }
        }

        // 2. Check if totalCost was saved (new data), otherwise calculate it
        let totalCost = (entry.totalCost !== undefined && entry.totalCost !== null) ?
            parseFloat(entry.totalCost) :
            (costEach * amount); // Calculate for old data

        // 3. Add to grand total
        grandTotalCost += (isNaN(totalCost) ? 0 : totalCost);
        // --- END FIX ---

        const row = document.createElement('tr');
        row.className = (entry.type === 'Added') ? 'log-add' : (entry.type === 'Cut' ? 'log-cut' : 'log-adjust');

        row.innerHTML = `
            <td>${dateStr}</td>
            <td>${timeStr}</td>
            <td>${entry.itemName}</td>
            <td>${entry.type}</td>
            <td style="text-align: right;">${amount}</td>
            <td style="text-align: right;">${costEach.toFixed(2)}</td>
            <td style="text-align: right;">${totalCost.toFixed(2)}</td>
            <td style="text-align: right;">${entry.newStock}</td>
        `;
        transactionTableBody.appendChild(row);
    });

    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.style.backgroundColor = '#f8f9fa';
    totalRow.innerHTML = `
        <td colspan="6" style="text-align: right;">Grand Total Cost:</td>
        <td style="text-align: right;">${grandTotalCost.toFixed(2)}</td>
        <td></td>
    `;
    transactionTableBody.appendChild(totalRow);
}


function renderChart() {
    if (!graphCanvas) return;
    const ctx = graphCanvas.getContext('2d');
    const dailyData = {};
    filteredTransactions.forEach(entry => {
        const dateStr = entry.timestamp.split('T')[0];
        if (!dailyData[dateStr]) dailyData[dateStr] = { in: 0, out: 0 };
        const amount = parseFloat(entry.amount) || 0;
        if (entry.type === 'Added') dailyData[dateStr].in += amount;
        else if (entry.type === 'Cut') dailyData[dateStr].out += amount;
    });
    const sortedDates = Object.keys(dailyData).sort();
    const labels = sortedDates;
    const dataIn = sortedDates.map(date => dailyData[date].in);
    const dataOut = sortedDates.map(date => dailyData[date].out);
    if (transactionChart) transactionChart.destroy();

    transactionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                    label: t('transactions_graph_legend_in'),
                    data: dataIn,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                },
                {
                    label: t('transactions_graph_legend_out'),
                    data: dataOut,
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Amount' } }, x: { title: { display: true, text: 'Date' } } }, plugins: { title: { display: true, text: 'Daily Stock Transactions (In/Out)' } } }
    });
}

function exportToCsv() {
    if (filteredTransactions.length === 0) { alert(t('transactions_no_export_data')); return; }

    const headers = ["Date", "Time", "Item Name", "Type", "Amount", "Cost (ea.)", "Total Cost", "New Stock Level"];
    const csvRows = [headers.join(",")];

    const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };

    // We re-use the same logic from renderTable to get the correct costs
    filteredTransactions.forEach(entry => {
        const entryDate = new Date(entry.timestamp);
        const dateStr = entryDate.toLocaleDateString(undefined, dateOptions);
        const timeStr = entryDate.toLocaleTimeString(undefined, timeOptions);

        let costEach = parseFloat(entry.cost);
        const amount = parseFloat(entry.amount) || 0;
        if (isNaN(costEach) || costEach === 0) {
            try {
                const sizeMatch = entry.itemName.match(/\(([^)]+)\)$/);
                if (sizeMatch && entry.itemCode && currentInventory[entry.itemCode] && currentInventory[entry.itemCode][sizeMatch[1]]) {
                    costEach = parseFloat(currentInventory[entry.itemCode][sizeMatch[1]].cost) || 0;
                }
            } catch (e) {
                costEach = 0;
            }
        }
        const totalCost = (entry.totalCost !== undefined && entry.totalCost !== null) ?
            parseFloat(entry.totalCost) :
            (costEach * amount);

        const values = [
            `"${dateStr}"`,
            `"${timeStr}"`,
            `"${entry.itemName.replace(/"/g, '""')}"`,
            entry.type,
            amount,
            costEach.toFixed(2),
            totalCost.toFixed(2),
            entry.newStock
        ];
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
searchNameInput.addEventListener('input', () => {
    applyFilter();
    showSuggestions();
});
searchDateInput.addEventListener('change', applyFilter);
searchTypeInput.addEventListener('input', applyFilter);
exportButton.addEventListener('click', exportToCsv);

document.addEventListener('click', (event) => {
    if (!searchNameInput.contains(event.target) && !suggestionsDiv.contains(event.target)) {
        suggestionsDiv.style.display = 'none';
    }
});

const langEnButton = document.getElementById('lang-en');
if (langEnButton) {
    langEnButton.addEventListener('click', () => setLanguage('en'));
}
const langThButton = document.getElementById('lang-th');
if (langThButton) {
    langThButton.addEventListener('click', () => setLanguage('th'));
}

// --- Initial Load ---
async function initializeApp() {
    await initializeI18n();
    handleCategoryChange();
    loadTransactionData();
}

initializeApp();