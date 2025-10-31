import { loadData, processTransaction, deleteProduct, clearLog, getCategories } from './_api.js';
import { navigateTo } from './route_handler.js';
import { initializeI18n, setLanguage, t, parseError, getCurrentLanguage } from './i18n.js';

// --- 1. CONFIGURATION ---
const LOW_STOCK_THRESHOLD = 10;
let allProducts = {}; // This is the variable we are using
let allCategories = {};
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

// --- Manual Entry Elements ---
const manualSearchInput = document.getElementById('manualSearchInput');
const manualSuggestionsDiv = document.getElementById('manualSuggestions');
const manualSubmitButton = document.getElementById('manualSubmitButton');
let uniqueItemNames = []; // Will be { name: "...", barcode: "..." }
let manualSelectedBarcode = null;

// --- Inventory Search Elements ---
const inventorySearchInput = document.getElementById('inventorySearchInput');
const inventoryCategoryFilter = document.getElementById('inventoryCategoryFilter');


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
    event.preventDefault(); // Stop the <details> from toggling
    event.stopPropagation(); // Stop click from bubbling
    const button = event.target;
    barcodeToDelete = button.dataset.barcode;
    const productName = allProducts[barcodeToDelete] ? allProducts[barcodeToDelete].name : 'this product'; // --- CORRECTED ---
    itemToDeleteNameSpan.textContent = `"${productName}"`;
    deleteModal.style.display = 'flex';
}
async function executeDelete() {
    if (!barcodeToDelete) return;
    try {
        await deleteProduct(barcodeToDelete);
        delete inventoryStock[barcodeToDelete];
        delete allProducts[barcodeToDelete]; // --- CORRECTED ---
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
    const currentLang = getCurrentLanguage();

    const sizeOrder = ["F", "M", "L", "XL", "2L", "3L", "4L", "5L", "6L", "3XL", "4XL", "5XL", "6XL"];

    for (const itemCode in inventoryStock) {
        const product = allProducts[itemCode]; // --- CORRECTED ---
        const itemName = product ? product.name : "Unknown Item";
        const categoryId = (product && product.category_id) ? product.category_id : 'cat_0';
        const stockLevels = inventoryStock[itemCode];

        const newItemDisplay = document.createElement('details');
        newItemDisplay.open = true;
        newItemDisplay.dataset.productName = itemName.toLowerCase();
        newItemDisplay.dataset.categoryId = categoryId;

        const summary = document.createElement('summary');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'product-name';
        nameSpan.textContent = itemName;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-product-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.dataset.barcode = itemCode;
        deleteBtn.title = t('modal_delete_confirm');
        deleteBtn.addEventListener('click', handleDeleteProduct);

        summary.appendChild(nameSpan);
        summary.appendChild(deleteBtn);
        newItemDisplay.appendChild(summary);

        const stockEntries = Object.keys(stockLevels);

        if (stockEntries.length === 0) {
            const noSizeSpan = document.createElement('span');
            noSizeSpan.className = 'no-sizes';
            noSizeSpan.textContent = '(No sizes added yet)';
            newItemDisplay.appendChild(noSizeSpan);
        } else {
            const sizeList = document.createElement('ul');
            sizeList.className = 'size-list';

            const sortedSizes = stockEntries.sort((a, b) => {
                const indexA = sizeOrder.indexOf(a);
                const indexB = sizeOrder.indexOf(b);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });

            for (const size of sortedSizes) {
                const stockLevel = stockLevels[size].stock;
                const costLevel = stockLevels[size].cost || 0;
                const costString = costLevel.toFixed(2);

                const sizeItem = document.createElement('li');

                const stockText = `${size}: <span class="stock-level">${stockLevel}</span>`;
                const costText = `<span class="cost-display">(Cost: ${costString})</span>`;

                if (stockLevel === 0) {
                    sizeItem.className = 'out-of-stock';
                    sizeItem.innerHTML = `${stockText} ${costText} <span class="stock-label">(Out of Stock)</span>`;
                } else if (stockLevel < LOW_STOCK_THRESHOLD) {
                    sizeItem.className = 'low-stock';
                    sizeItem.innerHTML = `${stockText} ${costText} <span class="stock-label">(Low Stock)</span>`;
                } else {
                    sizeItem.innerHTML = `${stockText} ${costText}`;
                }
                sizeList.appendChild(sizeItem);
            }
            newItemDisplay.appendChild(sizeList);
        }
        inventoryDisplay.appendChild(newItemDisplay);
    }

    filterInventoryDisplay();
}

function populateInventoryCategoryFilter() {
    while (inventoryCategoryFilter.options.length > 1) {
        inventoryCategoryFilter.remove(1);
    }

    const sortedCategories = Object.entries(allCategories)
        .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));

    for (const [id, name] of sortedCategories) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        inventoryCategoryFilter.appendChild(option);
    }
}

function filterInventoryDisplay() {
    const searchTerm = inventorySearchInput.value.toLowerCase();
    const selectedCategory = inventoryCategoryFilter.value;
    const items = inventoryDisplay.querySelectorAll('details');

    items.forEach(item => {
        const productName = item.dataset.productName;
        const productCategory = item.dataset.categoryId;

        const nameMatches = productName.includes(searchTerm);
        const categoryMatches = (selectedCategory === 'all' || productCategory === selectedCategory);

        if (nameMatches && categoryMatches) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
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
        const [data, categories] = await Promise.all([
            loadData(),
            getCategories()
        ]);

        inventoryStock = data.inventory;
        sellLogData = data.transactions;
        allProducts = data.products; // --- CORRECTED ---
        allCategories = categories;

        populateInventoryCategoryFilter();

        // --- Populate for manual entry suggestions ---
        uniqueItemNames = Object.keys(allProducts).map(barcode => { // --- THIS WAS THE ERROR LINE (Line 235 for you) ---
            return { name: allProducts[barcode].name, barcode: barcode };
        }).sort((a, b) => a.name.localeCompare(b.name));

        updateInventoryDisplay();
        renderSellLog();
    } catch (err) {
        console.error('Error loading data:', err); // --- This was line 249 for you ---
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

    let errorOccurred = false;

    if ((transactionMode === 'add' || transactionMode === 'cut') && (!amountOrNewStock || amountOrNewStock < 1)) {
        showToast(t('error_invalid_amount_add_cut'));
        errorOccurred = true;
    } else if (transactionMode === 'adjust' && (isNaN(amountOrNewStock) || amountOrNewStock < 0)) {
        showToast(t('error_invalid_amount_add_cut'));
        errorOccurred = true;
    } else if (!allProducts.hasOwnProperty(lookupValue)) { // --- CORRECTED ---
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
                size: transactionSize
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

// --- NEW: Manual Entry Logic ---
function showSuggestions() {
    const inputText = manualSearchInput.value.toLowerCase();
    manualSuggestionsDiv.innerHTML = '';

    if (!inputText) {
        manualSuggestionsDiv.style.display = 'none';
        return;
    }

    const matchingNames = uniqueItemNames.filter(item =>
        item.name.toLowerCase().includes(inputText)
    );

    if (matchingNames.length > 0) {
        matchingNames.forEach(item => {
            const div = document.createElement('div');
            const index = item.name.toLowerCase().indexOf(inputText);
            const highlighted = item.name.substring(0, index) +
                `<span class="highlight">${item.name.substring(index, index + inputText.length)}</span>` +
                item.name.substring(index + inputText.length);

            div.innerHTML = highlighted;
            div.addEventListener('click', () => {
                manualSearchInput.value = item.name;
                manualSelectedBarcode = item.barcode; // Store the barcode
                manualSuggestionsDiv.style.display = 'none';
            });
            manualSuggestionsDiv.appendChild(div);
        });
        manualSuggestionsDiv.style.display = 'block';
    } else {
        manualSuggestionsDiv.style.display = 'none';
    }
}

async function handleManualSubmit() {
    const lookupValue = manualSelectedBarcode;
    const transactionMode = document.querySelector('input[name="transactionMode"]:checked').value;
    const transactionSize = document.querySelector('input[name="transactionSize"]:checked').value;
    const amountOrNewStock = parseInt(transactionAmountInput.value, 10);

    let errorOccurred = false;

    if (!lookupValue) {
        showToast(t('inventory_manual_error_no_product'));
        errorOccurred = true;
    } else if ((transactionMode === 'add' || transactionMode === 'cut') && (!amountOrNewStock || amountOrNewStock < 1)) {
        showToast(t('error_invalid_amount_add_cut'));
        errorOccurred = true;
    } else if (transactionMode === 'adjust' && (isNaN(amountOrNewStock) || amountOrNewStock < 0)) {
        showToast(t('error_invalid_amount_add_cut'));
        errorOccurred = true;
    }

    if (!errorOccurred) {
        try {
            const payload = {
                lookupValue,
                amount: amountOrNewStock,
                mode: transactionMode,
                size: transactionSize
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
            newLogItem.textContent = `(Manual) ${result.message}`;
            if (transactionMode === 'add') newLogItem.className = 'match-add';
            else if (transactionMode === 'cut') newLogItem.className = 'match-cut';
            else newLogItem.className = 'match-adjust';
            scanLog.append(newLogItem);
            scanLog.scrollTop = scanLog.scrollHeight;
        } catch (err) {
            console.error('Error processing manual transaction:', err);
            const { key, context } = parseError(err);
            const translatedError = t(key, context);

            if (key === 'error_not_enough_stock') {
                showToast(translatedError);
            } else {
                const newLogItem = document.createElement('li');
                newLogItem.textContent = `(Manual) ${translatedError}`;
                newLogItem.className = 'error';
                scanLog.append(newLogItem);
                scanLog.scrollTop = scanLog.scrollHeight;
            }
            errorOccurred = true;
        }
    }

    // Clear manual inputs
    manualSearchInput.value = '';
    manualSelectedBarcode = null;
    barcodeInput.focus(); // Set focus back to scanner
}
// --- END NEW ---


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
    if (manualSuggestionsDiv && !manualSearchInput.contains(event.target) && !manualSuggestionsDiv.contains(event.target)) {
        manualSuggestionsDiv.style.display = 'none';
    }
});


// --- Manual Entry Listeners ---
manualSearchInput.addEventListener('input', showSuggestions);
manualSearchInput.addEventListener('focus', showSuggestions);
manualSubmitButton.addEventListener('click', handleManualSubmit);

// --- Inventory Search Listener ---
inventorySearchInput.addEventListener('input', filterInventoryDisplay);
inventoryCategoryFilter.addEventListener('change', filterInventoryDisplay);


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
    loadAllData();
}

initializeApp();