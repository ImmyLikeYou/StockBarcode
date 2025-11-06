import { loadData, deleteTransaction } from './_api.js';
import { initializeI18n, setLanguage, t, parseError } from './i18n.js';
import { navigateTo } from './route_handler.js';

const transactionTableBody = document.getElementById('transactionTableBody');
const exportButton = document.getElementById('exportButton');
const graphCanvas = document.getElementById('transactionChart');

// Get Summary Box elements
const summaryAddedEl = document.getElementById('summary-added');
const summaryCutEl = document.getElementById('summary-cut');
const summaryNetEl = document.getElementById('summary-net');

const searchCategory = document.getElementById('searchCategory');
const searchNameInput = document.getElementById('searchNameInput');
const searchDateInput = document.getElementById('searchDateInput');
const searchTypeInput = document.getElementById('searchTypeInput');
const suggestionsDiv = document.getElementById('suggestions');
// --- NEW: Toast Elements ---
const toastElement = document.getElementById('toastNotification');
const toastMessageSpan = document.getElementById('toastMessage');
let toastTimeout = null;

// --- NEW: Modal Elements ---
const deleteModal = document.getElementById('deleteTransactionModal');
const deleteTransactionText = document.getElementById('deleteTransactionText');
const deleteTransactionTimestamp = document.getElementById('deleteTransactionTimestamp');
const cancelDeleteTxBtn = document.getElementById('cancelDeleteTxBtn');
const confirmDeleteTxBtn = document.getElementById('confirmDeleteTxBtn');
// --- END NEW ---

let allTransactions = [];
let filteredTransactions = [];
let transactionChart = null;
let uniqueItemNames = [];

let currentInventory = {};
let currentProducts = {};

// --- NEW: Toast function (from receiver.js) ---
function showToast(message, type = 'success') {
    if (toastTimeout) { clearTimeout(toastTimeout); }
    toastMessageSpan.textContent = message;
    // Basic type styling
    toastElement.style.backgroundColor = type === 'error' ? '#dc3545' : '#28a745';
    toastElement.className = "toast show";
    toastTimeout = setTimeout(() => {
        toastElement.className = toastElement.className.replace(" show", "");
        toastTimeout = null;
    }, 2500);
}

/**
 * Fetches transaction, inventory, and product data.
 */
async function loadTransactionData() {
    try {
        const data = await loadData();
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
        // UPDATED: Colspan is now 11
        transactionTableBody.innerHTML = `<tr><td colspan="11" style="color: red; text-align: center;">${t(key, context) || t('error_loading_transactions')}</td></tr>`;
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


function renderTable() {
    transactionTableBody.innerHTML = '';

    // --- MODIFIED: Added new total variables ---
    let totalAdded = 0;
    let totalCut = 0;
    let grandTotalCost = 0;
    let totalAddValue = 0;
    let totalCutValue = 0;
    let grandTotalSales = 0; // <-- NEW
    let grandTotalProfit = 0; // <-- NEW
    // --- END MODIFICATION ---

    if (filteredTransactions.length === 0) {
        // UPDATED: Colspan is now 11
        transactionTableBody.innerHTML = `<tr><td colspan="11" style="text-align: center;">${t('transactions_no_match')}</td></tr>`;
        // --- Reset summary box if no data ---
        summaryAddedEl.textContent = 0;
        summaryCutEl.textContent = 0;
        summaryNetEl.textContent = 0;
        summaryNetEl.className = 'summary-value summary-adjust'; // Reset color
        return;
    }

    const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };

    filteredTransactions.forEach(entry => {
        const entryDate = new Date(entry.timestamp);
        const dateStr = entryDate.toLocaleDateString(undefined, dateOptions);
        const timeStr = entryDate.toLocaleTimeString(undefined, timeOptions);

        let costEach = parseFloat(entry.cost);
        const amount = parseFloat(entry.amount) || 0;

        // --- Update summary totals based on type ---
        if (entry.type === 'Added') {
            totalAdded += amount;
        } else if (entry.type === 'Cut') {
            totalCut += amount;
        } else if (entry.type === 'Adjusted') {
            if (amount > 0) {
                totalAdded += amount;
            } else {
                totalCut += Math.abs(amount);
            }
        }

        // 1. If cost wasn't saved (old data), try to find it
        if (isNaN(costEach) || costEach === 0) {
            try {
                const sizeMatch = entry.itemName.match(/\(([^)]+)\)$/);
                if (sizeMatch && entry.itemCode && currentInventory[entry.itemCode] && currentInventory[entry.itemCode][sizeMatch[1]]) {
                    costEach = parseFloat(currentInventory[entry.itemCode][sizeMatch[1]].cost) || 0;
                }
            } catch (e) {
                console.warn("Could not find fallback cost for old transaction:", e);
                costEach = 0;
            }
        }

        // 2. Check if totalCost was saved (new data), otherwise calculate it
        let totalCost = (entry.totalCost !== undefined && entry.totalCost !== null) ?
            parseFloat(entry.totalCost) :
            (entry.type === 'Cut' ? (costEach * amount * -1) : (costEach * amount));

        const safeTotalCost = isNaN(totalCost) ? 0 : totalCost;

        // --- NEW: Get Sales and Profit ---
        const totalSales = (entry.type === 'Cut' && entry.totalSales) ? parseFloat(entry.totalSales) : 0;
        const profit = (totalSales > 0) ? totalSales + safeTotalCost : 0; // safeTotalCost is negative for cuts

        if (entry.type === 'Added') {
            totalAddValue += safeTotalCost;
        } else if (entry.type === 'Cut') {
            totalCutValue += safeTotalCost;
            grandTotalSales += totalSales; // <-- ADD
            grandTotalProfit += profit; // <-- ADD
        } else if (entry.type === 'Adjusted') {
            if (amount > 0) {
                totalAddValue += safeTotalCost;
            } else {
                totalCutValue += safeTotalCost;
            }
        }

        grandTotalCost += safeTotalCost;

        const row = document.createElement('tr');
        row.className = (entry.type === 'Added') ? 'log-add' : (entry.type === 'Cut' ? 'log-cut' : 'log-adjust');
        row.setAttribute('data-barcode', entry.itemCode);

        // UPDATED: Added new cells
        row.innerHTML = `
            <td>${dateStr}</td>
            <td>${timeStr}</td>
            <td class="clickable-cell">${entry.itemName}</td> 
            <td>${entry.type}</td>
            <td style="text-align: right;">${amount}</td>
            <td style="text-align: right;">${costEach.toFixed(2)}</td>
            <td style="text-align: right;">${safeTotalCost.toFixed(2)}</td>
            <td style="text-align: right; color: blue;">${totalSales.toFixed(2)}</td>
            <td style="text-align: right; color: ${profit >= 0 ? 'green' : '#b92100'};">${profit.toFixed(2)}</td>
            <td style="text-align: right;">${entry.newStock}</td>
            <td style="text-align: center;">
                <button class="delete-btn" 
                        data-timestamp="${entry.timestamp}" 
                        data-item-name="${entry.itemName}"
                        title="${t('transactions_table_delete')}">
                    &times;
                </button>
            </td>
        `;
        transactionTableBody.appendChild(row);
    });

    // --- MODIFIED: Add all footer rows ---
    const addRow = document.createElement('tr');
    addRow.style.fontWeight = 'bold';
    addRow.style.backgroundColor = '#f8f9fa';
    addRow.innerHTML = `
        <td colspan="6" style="text-align: right; color: green;">${t('transactions_table_total_add')}</td>
        <td style="text-align: right; color: green;">${totalAddValue.toFixed(2)}</td>
        <td colspan="4"></td>
    `;
    transactionTableBody.appendChild(addRow);

    const cutRow = document.createElement('tr');
    cutRow.style.fontWeight = 'bold';
    cutRow.style.backgroundColor = '#f8f9fa';
    cutRow.innerHTML = `
        <td colspan="6" style="text-align: right; color: #b92100;">${t('transactions_table_total_cut')}</td>
        <td style="text-align: right; color: #b92100;">${totalCutValue.toFixed(2)}</td>
        <td style="text-align: right; color: blue;">${t('transactions_table_total_sales')}</td>
        <td style="text-align: right; color: ${grandTotalProfit >= 0 ? 'green' : '#b92100'};">${t('transactions_table_total_profit')}</td>
        <td colspan="2"></td>
    `;
    transactionTableBody.appendChild(cutRow);

    const cutRowValues = document.createElement('tr');
    cutRowValues.style.fontWeight = 'bold';
    cutRowValues.style.backgroundColor = '#f8f9fa';
    cutRowValues.innerHTML = `
        <td colspan="7"></td>
        <td style="text-align: right; color: blue;">${grandTotalSales.toFixed(2)}</td>
        <td style="text-align: right; color: ${grandTotalProfit >= 0 ? 'green' : '#b92100'};">${grandTotalProfit.toFixed(2)}</td>
        <td colspan="2"></td>
    `;
    transactionTableBody.appendChild(cutRowValues);

    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.style.backgroundColor = '#f0f0f0';
    totalRow.innerHTML = `
        <td colspan="6" style="text-align: right;">${t('transactions_table_grand_total')}</td>
        <td style="text-align: right;">${grandTotalCost.toFixed(2)}</td>
        <td colspan="4"></td>
    `;
    transactionTableBody.appendChild(totalRow);
    // --- END MODIFICATION ---


    // --- Update Summary Box text content ---
    const netChange = totalAdded - totalCut;
    summaryAddedEl.textContent = totalAdded;
    summaryCutEl.textContent = totalCut;
    summaryNetEl.textContent = netChange;

    if (netChange > 0) {
        summaryNetEl.className = 'summary-value summary-add';
    } else if (netChange < 0) {
        summaryNetEl.className = 'summary-value summary-cut';
    } else {
        summaryNetEl.className = 'summary-value summary-adjust';
    }
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

    // Phase 1: Use machine-readable headers
    const headers = [
        "timestamp",
        "barcode",
        "product_name",
        "size",
        "type",
        "amount_changed",
        "cost_each",
        "total_cost",
        "total_sales", // <-- NEW
        "profit", // <-- NEW
        "new_stock_level"
    ];
    const csvRows = [headers.join(",")];

    // Function to ensure CSV cell is safe
    const escapeCsvCell = (cell) => {
        const strCell = String(cell);
        if (strCell.includes(',')) {
            return `"${strCell.replace(/"/g, '""')}"`;
        }
        return strCell;
    };

    filteredTransactions.forEach(entry => {
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
            (entry.type === 'Cut' ? (costEach * amount * -1) : (costEach * amount));

        const safeTotalCost = isNaN(totalCost) ? 0 : totalCost;

        // --- NEW: Get Sales and Profit ---
        const totalSales = (entry.type === 'Cut' && entry.totalSales) ? parseFloat(entry.totalSales) : 0;
        const profit = (totalSales > 0) ? totalSales + safeTotalCost : 0;

        // Split Product Name and Size
        const sizeMatch = entry.itemName.match(/\(([^)]+)\)$/);
        const size = sizeMatch ? sizeMatch[1] : 'N/A';
        const productName = sizeMatch ? entry.itemName.replace(sizeMatch[0], '').trim() : entry.itemName;

        // Use raw, unformatted data
        const values = [
            entry.timestamp,
            entry.itemCode,
            escapeCsvCell(productName),
            escapeCsvCell(size),
            entry.type,
            amount,
            costEach.toFixed(2),
            safeTotalCost.toFixed(2),
            totalSales.toFixed(2), // <-- NEW
            profit.toFixed(2), // <-- NEW
            entry.newStock
        ];
        csvRows.push(values.join(","));
    });

    // Add the UTF-8 BOM character at the beginning for Thai encoding in Excel
    const csvString = "\uFEFF" + csvRows.join("\n");

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "transactions_export.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
// --- NEW: Modal and Delete Logic ---
function showModal(modal) {
    modal.style.display = 'flex';
}

function hideModal(modal) {
    modal.style.display = 'none';
}

function handleDeleteClick(event) {
    const timestamp = event.target.dataset.timestamp;
    const itemName = event.target.dataset.itemName;

    deleteTransactionTimestamp.value = timestamp;
    deleteTransactionText.textContent = t('modal_delete_transaction_text', { name: itemName });
    showModal(deleteModal);
}
async function handleConfirmDelete() {
    const timestamp = deleteTransactionTimestamp.value;

    try {
        await deleteTransaction(timestamp);
        hideModal(deleteModal);
        showToast(t('toast_transaction_deleted'), 'success');
        // Reload all data to ensure inventory and logs are in sync
        await loadTransactionData();
    } catch (err) {
        console.error('Error deleting transaction:', err);
        const { key, context } = parseError(err);
        hideModal(deleteModal);
        showToast(t(key, context) || t('error_delete_transaction'), 'error');
    }
}


// --- Event Listeners ---

// MODIFIED: Use event delegation for history and delete
transactionTableBody.addEventListener('click', (event) => {
    const target = event.target;

    // Check for delete button click
    if (target.classList.contains('delete-btn')) {
        handleDeleteClick(event);
        return;
    }

    // Check for item name click (for history)
    const row = target.closest('tr');
    if (row && row.dataset.barcode && target.classList.contains('clickable-cell')) {
        const barcode = row.dataset.barcode;
        navigateTo(`/item-history/${barcode}`);
    }
});

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
    // NEW: Hide delete modal on outside click
    if (event.target == deleteModal) {
        hideModal(deleteModal);
    }
});

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
    // NEW: Hide delete modal on outside click
    if (event.target == deleteModal) {
        hideModal(deleteModal);
    }
});
// --- NEW: Modal Button Listeners ---
cancelDeleteTxBtn.addEventListener('click', () => hideModal(deleteModal));
confirmDeleteTxBtn.addEventListener('click', handleConfirmDelete);
// --- END NEW ---

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