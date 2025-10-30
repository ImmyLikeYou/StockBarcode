import { loadData, processTransaction, deleteProduct, clearLog } from './_api.js';
import { navigateTo } from './route_handler.js';
// --- THIS IS THE FIX: Added getCurrentLanguage ---
import { initializeI18n, setLanguage, t, parseError, getCurrentLanguage } from './i18n.js';

// --- 1. CONFIGURATION ---
const LOW_STOCK_THRESHOLD = 10;
let itemNames = {};
let inventoryStock = {};
let sellLogData = [];
let currentFilterDate = null;
const scanForm = document.getElementById('scanForm');
const barcodeInput = document.getElementById('barcodeInput');
const scanLog = document.getElementById('scanLog');
const inventoryDisplay = document.getElementById('inventory-display');
const sellLogDisplay = document.getElementById('sellLog');
const clearLogButton = document.getElementById('clearLogButton');
const dateFilter = document.getElementById('dateFilter');
const filterButton = document.getElementById('filterButton');
const showAllButton = document.getElementById('showAllButton');
const clearQuickLogButton = document.getElementById('clearQuickLogButton');
const transactionAmountInput = document.getElementById('transactionAmountInput');
const deleteModal = document.getElementById('deleteConfirmationModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const itemToDeleteNameSpan = document.getElementById('itemToDeleteName');
let barcodeToDelete = null;
const toastElement = document.getElementById('toastNotification');
const toastMessageSpan = document.getElementById('toastMessage');
let toastTimeout = null;
let scanDebounceTimer = null;

const costInputContainer = document.getElementById('costInputContainer');
const transactionCostInput = document.getElementById('transactionCostInput');
const transactionModeRadios = document.querySelectorAll('input[name="transactionMode"]');

// --- 2. DISPLAY FUNCTIONS ---

function updateCostInputVisibility() {
    const selectedMode = document.querySelector('input[name="transactionMode"]:checked').value;
    if (selectedMode === 'add' || selectedMode === 'adjust') {
        costInputContainer.style.display = 'block';
    } else { // 'cut'
        costInputContainer.style.display = 'none';
    }
}

function showToast(message) {
    if (toastTimeout) { clearTimeout(toastTimeout); }
    toastMessageSpan.textContent = message;
    toastElement.className = "toast show";
    toastTimeout = setTimeout(() => {
        toastElement.className = toastElement.className.replace(" show", "");
        toastTimeout = null;
    }, 2500);
}

function handleDeleteProduct(event) {
    const button = event.target;
    barcodeToDelete = button.dataset.barcode;
    const productName = itemNames[barcodeToDelete] ? itemNames[barcodeToDelete].name : 'this product';
    itemToDeleteNameSpan.textContent = `"${productName}"`;
    deleteModal.style.display = 'flex';
}
async function executeDelete() {
    if (!barcodeToDelete) return;
    try {
        await deleteProduct(barcodeToDelete);
        delete inventoryStock[barcodeToDelete];
        delete itemNames[barcodeToDelete];
        updateInventoryDisplay();
        showToast(t('toast_product_deleted'));
    } catch (err) {
        console.error('Error deleting product:', err);
        const { key, context } = parseError(err);
        alert(t(key, context));
    } finally {
        deleteModal.style.display = 'none';
        barcodeToDelete = null;
    }
}

function updateInventoryDisplay() {
    inventoryDisplay.innerHTML = '';
    // --- This line (85) will now work ---
    const currentLang = getCurrentLanguage();

    for (const itemCode in inventoryStock) {
        const itemName = itemNames[itemCode] ? itemNames[itemCode].name : "Unknown Item";
        const stockLevels = inventoryStock[itemCode];
        const newItemDisplay = document.createElement('li');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-product-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.dataset.barcode = itemCode;
        deleteBtn.addEventListener('click', handleDeleteProduct);
        newItemDisplay.appendChild(deleteBtn);
        newItemDisplay.append(`${itemName}:`);
        if (Object.keys(stockLevels).length === 0) {
            const noSizeSpan = document.createElement('span');
            noSizeSpan.className = 'no-sizes';
            noSizeSpan.textContent = '(No sizes added yet)';
            newItemDisplay.appendChild(noSizeSpan);
        } else {
            const sizeList = document.createElement('ul');
            for (const size in stockLevels) {
                const stockLevel = stockLevels[size].stock;
                const costLevel = stockLevels[size].cost || 0;
                const costString = costLevel.toFixed(2);

                const sizeItem = document.createElement('li');

                const stockText = `${size}: <span>${stockLevel}</span>`;
                const costText = `<span class="cost-display">(Cost: ${costString})</span>`;

                if (stockLevel === 0) {
                    sizeItem.className = 'out-of-stock';
                    sizeItem.innerHTML = `${stockText} ${costText} <span class="out-of-stock-label">(Out of Stock)</span>`;
                } else if (stockLevel < LOW_STOCK_THRESHOLD) {
                    sizeItem.className = 'low-stock';
                    sizeItem.innerHTML = `${stockText} ${costText} <span class="low-stock-label">(Low Stock)</span>`;
                } else {
                    sizeItem.innerHTML = `${stockText} ${costText}`;
                }
                sizeList.appendChild(sizeItem);
            }
            newItemDisplay.appendChild(sizeList);
        }
        inventoryDisplay.appendChild(newItemDisplay);
    }
}

function renderSellLog() {
    sellLogDisplay.innerHTML = '';
    const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    for (let i = sellLogData.length - 1; i >= 0; i--) {
        const entry = sellLogData[i];
        const entryDate = new Date(entry.timestamp);
        if (currentFilterDate) { const filterDate = new Date(currentFilterDate); if (entryDate.toDateString() !== filterDate.toDateString()) continue; }
        const dateStr = entryDate.toLocaleDateString(undefined, dateOptions);
        const timeStr = entryDate.toLocaleTimeString(undefined, timeOptions);
        const logText = `[${dateStr} ${timeStr}] ${entry.type} ${entry.amount} x ${entry.itemName}. New Stock: ${entry.newStock}`;
        const newLogItem = document.createElement('li');
        newLogItem.textContent = logText;
        newLogItem.className = (entry.type === 'Added') ? 'log-add' : 'log-cut';
        sellLogDisplay.appendChild(newLogItem);
    }
}

// --- 3. API (MAIN PROCESS) FUNCTIONS ---
async function loadAllData() {
    try {
        const data = await loadData();
        inventoryStock = data.inventory;
        sellLogData = data.transactions;
        itemNames = data.products;
        updateInventoryDisplay();
        renderSellLog();
    } catch (err) {
        console.error('Error loading data:', err);
        alert(t('error_load_data'));
    }
}

async function clearTransactionLog() {
    if (confirm(t('confirm_clear_log'))) {
        try {
            await clearLog();
            sellLogData = [];
            renderSellLog();
        } catch (err) {
            console.error('Error clearing log:', err);
            alert(t('error_clear_log'));
        }
    }
}

// --- 4. SCAN PROCESSING LOGIC ---
async function processScan() {
    const scannedValue = barcodeInput.value;
    if (!scannedValue || scannedValue.length < 12 || scannedValue.length > 13) {
        console.log("Scan ignored - incorrect length:", scannedValue);
        barcodeInput.value = '';
        return;
    }

    const lookupValue = scannedValue.substring(0, 12);
    const transactionMode = document.querySelector('input[name="transactionMode"]:checked').value;
    const transactionSize = document.querySelector('input[name="transactionSize"]:checked').value;
    const amountOrNewStock = parseInt(transactionAmountInput.value, 10);
    const cost = parseFloat(transactionCostInput.value) || 0;

    let errorOccurred = false;

    if ((transactionMode === 'add' || transactionMode === 'cut') && (!amountOrNewStock || amountOrNewStock < 1)) {
        showToast(t('error_invalid_amount_add_cut'));
        errorOccurred = true;
    } else if (transactionMode === 'adjust' && (isNaN(amountOrNewStock) || amountOrNewStock < 0)) {
        showToast(t('error_invalid_amount_add_cut'));
        errorOccurred = true;
    } else if ((transactionMode === 'add' || transactionMode === 'adjust') && (isNaN(cost) || cost < 0)) {
        showToast(t('error_invalid_cost'));
        errorOccurred = true;
    } else if (!itemNames.hasOwnProperty(lookupValue)) {
        const newLogItem = document.createElement('li');
        newLogItem.textContent = `Unknown Item: ${scannedValue}`;
        newLogItem.className = 'no-match';
        scanLog.append(newLogItem);
        scanLog.scrollTop = scanLog.scrollHeight;
        errorOccurred = true;
    }

    if (!errorOccurred) {
        try {
            const payload = {
                lookupValue,
                amount: amountOrNewStock,
                mode: transactionMode,
                size: transactionSize,
                cost: cost
            };

            const result = await processTransaction(payload);
            const { itemCode, size, newStockLevel, newCost } = result.updatedItem;

            if (!inventoryStock[itemCode]) inventoryStock[itemCode] = {};
            inventoryStock[itemCode][size] = {
                stock: newStockLevel,
                cost: newCost
            };

            sellLogData.push(result.newTransaction);
            updateInventoryDisplay();
            renderSellLog();
            const newLogItem = document.createElement('li');
            newLogItem.textContent = result.message;
            if (transactionMode === 'add') newLogItem.className = 'match-add';
            else if (transactionMode === 'cut') newLogItem.className = 'match-cut';
            else newLogItem.className = 'match-adjust';
            scanLog.append(newLogItem);
            scanLog.scrollTop = scanLog.scrollHeight;
        } catch (err) {
            console.error('Error processing transaction:', err);
            const { key, context } = parseError(err);
            const translatedError = t(key, context);

            if (key === 'error_not_enough_stock') {
                showToast(translatedError);
            } else {
                const newLogItem = document.createElement('li');
                newLogItem.textContent = translatedError;
                newLogItem.className = 'error';
                scanLog.append(newLogItem);
                scanLog.scrollTop = scanLog.scrollHeight;
            }
            errorOccurred = true;
        }
    }
    barcodeInput.value = '';
    barcodeInput.focus();
}

// --- 5. EVENT LISTENERS ---
barcodeInput.addEventListener('input', () => {
    clearTimeout(scanDebounceTimer);
    scanDebounceTimer = setTimeout(processScan, 100);
});
scanForm.addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(scanDebounceTimer);
    processScan();
});
filterButton.addEventListener('click', () => {
    const dateValue = dateFilter.value;
    if (dateValue) {
        currentFilterDate = new Date(dateValue + 'T00:00:00');
        renderSellLog();
    }
});
showAllButton.addEventListener('click', () => {
    currentFilterDate = null;
    dateFilter.value = '';
    renderSellLog();
});
clearLogButton.addEventListener('click', clearTransactionLog);
clearQuickLogButton.addEventListener('click', () => { scanLog.innerHTML = ''; });
cancelDeleteBtn.addEventListener('click', () => {
    deleteModal.style.display = 'none';
    barcodeToDelete = null;
});
confirmDeleteBtn.addEventListener('click', executeDelete);
window.addEventListener('click', (event) => {
    if (event.target == deleteModal) {
        deleteModal.style.display = 'none';
        barcodeToDelete = null;
    }
});

transactionModeRadios.forEach(radio => {
    radio.addEventListener('change', updateCostInputVisibility);
});

// Add language switcher listeners
const langEnButton = document.getElementById('lang-en');
if (langEnButton) {
    langEnButton.addEventListener('click', () => setLanguage('en'));
}

const langThButton = document.getElementById('lang-th');
if (langThButton) {
    langThButton.addEventListener('click', () => setLanguage('th'));
}


// --- 6. INITIALIZE ---
async function initializeApp() {
    await initializeI18n();
    updateCostInputVisibility();
    loadAllData();
}

initializeApp();