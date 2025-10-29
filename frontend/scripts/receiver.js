import { loadData, processTransaction, deleteProduct, clearLog } from './_api.js';
import { navigateTo } from './route_handler.js';

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

// --- 2. DISPLAY FUNCTIONS ---
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
    const productName = itemNames[barcodeToDelete] || 'this product';
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
        showToast('Product deleted successfully');
    } catch (err) {
        console.error('Error deleting product:', err);
        alert('Could not delete product: ' + err.message);
    } finally {
        deleteModal.style.display = 'none';
        barcodeToDelete = null;
    }
}

function updateInventoryDisplay() {
    inventoryDisplay.innerHTML = '';
    for (const itemCode in inventoryStock) {
        const itemName = itemNames[itemCode] || "Unknown Item";
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
                const stockLevel = stockLevels[size];
                const sizeItem = document.createElement('li');
                if (stockLevel === 0) {
                    sizeItem.className = 'out-of-stock';
                    sizeItem.innerHTML = `${size}: <span>${stockLevel}</span> <span class="out-of-stock-label">(Out of Stock)</span>`;
                } else if (stockLevel < LOW_STOCK_THRESHOLD) {
                    sizeItem.className = 'low-stock';
                    sizeItem.innerHTML = `${size}: <span>${stockLevel}</span> <span class="low-stock-label">(Low Stock)</span>`;
                } else { sizeItem.innerHTML = `${size}: <span>${stockLevel}</span>`; }
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
        alert('Could not load data. Check logs.');
    }
}

async function clearTransactionLog() {
    if (confirm('Are you sure...?')) {
        try {
            await clearLog();
            sellLogData = [];
            renderSellLog();
        } catch (err) {
            console.error('Error clearing log:', err);
            alert('Could not clear log.');
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
    let errorOccurred = false;

    if ((transactionMode === 'add' || transactionMode === 'cut') && (!amountOrNewStock || amountOrNewStock < 1)) {
        showToast('Please enter a valid amount > 0 for Add/Cut.');
        errorOccurred = true;
    } else if (transactionMode === 'adjust' && (isNaN(amountOrNewStock) || amountOrNewStock < 0)) {
        showToast('Please enter a valid stock level >= 0 for Adjust.');
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
            const payload = { lookupValue, amount: amountOrNewStock, mode: transactionMode, size: transactionSize };
            const result = await processTransaction(payload);
            const { itemCode, size, newStockLevel } = result.updatedItem;
            if (!inventoryStock[itemCode]) inventoryStock[itemCode] = {};
            inventoryStock[itemCode][size] = newStockLevel;
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
            if (err.message.includes('Not enough stock')) { showToast(err.message); } else {
                const newLogItem = document.createElement('li');
                newLogItem.textContent = 'Error: ' + err.message;
                newLogItem.className = 'error';
                scanLog.append(newLogItem);
                scanLog.scrollTop = scanLog.scrollHeight;
            }
            errorOccurred = true;
        }
    }
    barcodeInput.value = '';
}

function validationToastShown(mode, amount) { return ((mode === 'add' || mode === 'cut') && (!amount || amount < 1)) || (mode === 'adjust' && (isNaN(amount) || amount < 0)); }

// --- 5. EVENT LISTENERS ---
barcodeInput.addEventListener('input', () => {
    clearTimeout(scanDebounceTimer);
    scanDebounceTimer = setTimeout(processScan, 100);
});
scanForm.addEventListener('submit', (event) => { event.preventDefault(); });
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

// --- 6. INITIALIZE ---
loadAllData();