import { loadData, getBarcodeFromUrl } from './_api.js';
// 1. Import i18n functions
import { initializeI18n, setLanguage, t } from './i18n.js';

const historyTableBody = document.getElementById('historyTableBody');
const historyDateFilter = document.getElementById('historyDateFilter');
const clearHistoryFilterBtn = document.getElementById('clearHistoryFilter');

const productBarcode = getBarcodeFromUrl();
let fullItemHistory = [];
let currentHistoryFilterDate = null;

async function loadItemHistory() {
    if (!productBarcode) {
        // 2. Use translation key for error
        historyTableBody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">${t('error_no_barcode_specified')}</td></tr>`;
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
        // 3. Use translation key for error
        historyTableBody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">${t('error_loading_history')}</td></tr>`;
    }
}

function renderHistoryTable() {
    historyTableBody.innerHTML = '';
    const historyToDisplay = fullItemHistory.filter(entry => { if (!currentHistoryFilterDate) return true; const entryDate = new Date(entry.timestamp); return entryDate.toISOString().split('T')[0] === currentHistoryFilterDate; });
    if (historyToDisplay.length === 0) {
        // 4. Use translation keys for empty message
        const message = currentHistoryFilterDate ? t('history_no_transactions_date') : t('history_no_transactions_item');
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

// 5. Add language switcher listeners
// Add language switcher listeners
const langEnButton = document.getElementById('lang-en');
if (langEnButton) {
    langEnButton.addEventListener('click', () => setLanguage('en'));
}

const langThButton = document.getElementById('lang-th');
if (langThButton) {
    langThButton.addEventListener('click', () => setLanguage('th'));
}

// 6. Create new init function
async function initializeApp() {
    await initializeI18n();
    loadItemHistory();
}

initializeApp();