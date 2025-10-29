import { loadData, getBarcodeFromUrl } from './_api.js';

const historyTableBody = document.getElementById('historyTableBody');
const historyDateFilter = document.getElementById('historyDateFilter');
const clearHistoryFilterBtn = document.getElementById('clearHistoryFilter');

const productBarcode = getBarcodeFromUrl();
let fullItemHistory = [];
let currentHistoryFilterDate = null;

async function loadItemHistory() {
    if (!productBarcode) {
        historyTableBody.innerHTML = '<tr><td colspan="6" style="color: red; text-align: center;">Error: Product barcode not specified.</td></tr>';
        return;
    }
    try {
        const data = await loadData();
        const allTransactions = data.transactions || [];
        fullItemHistory = allTransactions.filter(entry => entry.itemCode === productBarcode);
        fullItemHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        renderHistoryTable();
    } catch (err) {
        console.error('Error loading item history:', err);
        historyTableBody.innerHTML = '<tr><td colspan="6" style="color: red; text-align: center;">Error loading history.</td></tr>';
    }
}

function renderHistoryTable() {
    historyTableBody.innerHTML = '';
    const historyToDisplay = fullItemHistory.filter(entry => { if (!currentHistoryFilterDate) return true; const entryDate = new Date(entry.timestamp); return entryDate.toISOString().split('T')[0] === currentHistoryFilterDate; });
    if (historyToDisplay.length === 0) {
        const message = currentHistoryFilterDate ? 'No transactions found for this date.' : 'No transaction history found for this item.';
        historyTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">${message}</td></tr>`;
        return;
    }
    const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    historyToDisplay.forEach(entry => {
        const entryDateObj = new Date(entry.timestamp);
        const dateStr = entryDateObj.toLocaleDateString(undefined, dateOptions);
        const timeStr = entryDateObj.toLocaleTimeString(undefined, timeOptions);
        const sizeMatch = entry.itemName.match(/\(([^)]+)\)$/);
        const size = sizeMatch ? sizeMatch[1] : '-';
        const row = document.createElement('tr');
        if (entry.type === 'Added') row.className = 'log-add';
        else if (entry.type === 'Cut') row.className = 'log-cut';
        else if (entry.type === 'Adjusted') row.className = 'log-adjust';
        row.innerHTML = `<td>${dateStr}</td><td>${timeStr}</td><td>${size}</td><td>${entry.type}</td><td>${entry.amount}</td><td>${entry.newStock}</td>`;
        historyTableBody.appendChild(row);
    });
}

historyDateFilter.addEventListener('change', () => {
    currentHistoryFilterDate = historyDateFilter.value;
    renderHistoryTable();
});
clearHistoryFilterBtn.addEventListener('click', () => {
    currentHistoryFilterDate = null;
    historyDateFilter.value = '';
    renderHistoryTable();
});

loadItemHistory();