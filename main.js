const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let isDev = false;

// --- Data Handling ---
const APP_NAME = 'BarcodeInventorySystem';

function getAppDataPath() {
    const basePath = app.getPath('userData');
    return path.join(basePath, 'app-data');
}

function getDataFilePath(filename) {
    const dataDir = getAppDataPath();
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    return path.join(dataDir, filename);
}

function ensureFileExists(filePath, defaultContent) {
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, defaultContent);
}

function loadFile(filePath) {
    ensureFileExists(filePath, filePath.endsWith('transactions.json') ? '[]' : '{}');
    try {
        const rawData = fs.readFileSync(filePath);
        if (rawData.length === 0) {
            return filePath.endsWith('transactions.json') ? [] : {};
        }

        const data = JSON.parse(rawData);

        if (filePath.endsWith('transactions.json') && !Array.isArray(data)) {
            console.warn(`Warning: ${filePath} was corrupted (not an array). Resetting to [].`);
            return [];
        }

        return data;
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return filePath.endsWith('transactions.json') ? [] : {};
    }
}

function saveFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
    }
}

// --- Window ---
function createWindow() {
    const isPackaged = app.isPackaged;

    const candidates = [];
    if (isPackaged) {
        candidates.push(path.join(process.resourcesPath, 'frontend', 'barcode_receiver.html'));
        candidates.push(path.join(process.resourcesPath, 'app.asar', 'frontend', 'barcode_receiver.html'));
        candidates.push(path.join(process.resourcesPath, 'app', 'frontend', 'barcode_receiver.html'));
    }
    candidates.push(path.join(__dirname, 'frontend', 'barcode_receiver.html'));

    let entryFile = candidates.find((p) => fs.existsSync(p));
    if (!entryFile) {
        console.error('❌ Frontend not found. Looked in:');
        candidates.forEach((p) => console.error('   -', p));
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (entryFile && fs.existsSync(entryFile)) {
        mainWindow.loadFile(entryFile).catch((err) => {
            console.error('❌ Failed to load HTML file:', err);
            mainWindow.loadURL('data:text/html,<h2>UI failed to load</h2>');
        });
    } else {
        mainWindow.loadURL('data:text/html,<h2>Frontend not found</h2>');
    }

    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

// --- Main logic ---
async function init() {
    try {
        isDev = require('electron-is-dev');
    } catch (err) {
        console.warn('Could not require electron-is-dev, inferring isDev from app.isPackaged and NODE_ENV');
        try {
            isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
        } catch (e) {
            isDev = false;
        }
    }

    const INVENTORY_PATH = getDataFilePath('inventory.json');
    const TRANSACTIONS_PATH = getDataFilePath('transactions.json');
    const PRODUCTS_PATH = getDataFilePath('products.json');
    const CATEGORIES_PATH = getDataFilePath('categories.json');

    ensureFileExists(INVENTORY_PATH, '{}');
    ensureFileExists(TRANSACTIONS_PATH, '[]');
    ensureFileExists(PRODUCTS_PATH, '{}');
    ensureFileExists(CATEGORIES_PATH, '{"cat_0": "Default"}');


    ipcMain.handle('load-data', async() => ({
        inventory: loadFile(INVENTORY_PATH),
        transactions: loadFile(TRANSACTIONS_PATH),
        products: loadFile(PRODUCTS_PATH),
    }));

    ipcMain.handle('get-categories', async() => {
        return loadFile(CATEGORIES_PATH);
    });

    ipcMain.handle('add-category', async(event, categoryName) => {
        if (!categoryName) {
            throw JSON.stringify({ message: 'error_category_name_empty' });
        }
        const categories = loadFile(CATEGORIES_PATH);
        const newId = `cat_${Date.now()}`;
        categories[newId] = categoryName;
        saveFile(CATEGORIES_PATH, categories);
        return { id: newId, name: categoryName };
    });

    // --- NEW: Update Category ---
    ipcMain.handle('update-category', async(event, { id, newName }) => {
        if (!id || !newName) {
            throw JSON.stringify({ message: 'error_category_name_empty' });
        }
        if (id === 'cat_0') {
            throw JSON.stringify({ message: 'error_category_delete_default' });
        }
        const categories = loadFile(CATEGORIES_PATH);
        if (!categories[id]) {
            throw JSON.stringify({ message: 'Category not found' });
        }
        categories[id] = newName;
        saveFile(CATEGORIES_PATH, categories);
        return { id, name: newName };
    });

    // --- NEW: Delete Category (and re-assign products) ---
    ipcMain.handle('delete-category', async(event, { id }) => {
        if (!id) {
            throw JSON.stringify({ message: 'Category ID is required' });
        }
        if (id === 'cat_0') {
            throw JSON.stringify({ message: 'error_category_delete_default' });
        }

        const categories = loadFile(CATEGORIES_PATH);
        const products = loadFile(PRODUCTS_PATH);

        if (!categories[id]) {
            throw JSON.stringify({ message: 'Category not found' });
        }

        // 1. Delete the category
        delete categories[id];

        // 2. Re-assign products to 'Default' (cat_0)
        for (const barcode in products) {
            if (products[barcode].category_id === id) {
                products[barcode].category_id = 'cat_0';
            }
        }

        // 3. Save both files
        saveFile(CATEGORIES_PATH, categories);
        saveFile(PRODUCTS_PATH, products);

        return { success: true, message: 'Category deleted and products reassigned.' };
    });


    ipcMain.handle('add-product', async(event, productData) => {
        const { productName, principalCode, typeCode, category_id, default_cost } = productData || {};
        if (!productName || !principalCode || !typeCode || principalCode.length !== 4 || typeCode.length !== 4) {
            throw JSON.stringify({ message: 'error_invalid_data' });
        }

        const products = loadFile(PRODUCTS_PATH);
        const inventory = loadFile(INVENTORY_PATH);
        const newId = (Object.keys(products).length + 1).toString().padStart(4, '0');
        const newBarcode = `${principalCode}${typeCode}${newId}`;

        if (products[newBarcode]) {
            throw JSON.stringify({ message: 'error_barcode_collision' });
        }

        products[newBarcode] = {
            name: productName,
            category_id: category_id || 'cat_0',
            default_cost: parseFloat(default_cost) || 0
        };
        inventory[newBarcode] = {};

        saveFile(PRODUCTS_PATH, products);
        saveFile(INVENTORY_PATH, inventory);

        return { name: productName, barcode: newBarcode };
    });

    ipcMain.handle('delete-product', async(event, barcode) => {
        if (!barcode) throw JSON.stringify({ message: 'error_barcode_required' });
        const products = loadFile(PRODUCTS_PATH);
        const inventory = loadFile(INVENTORY_PATH);
        let deleted = false;

        if (products[barcode]) {
            delete products[barcode];
            deleted = true;
        }
        if (inventory[barcode]) {
            delete inventory[barcode];
            deleted = true;
        }

        if (deleted) {
            saveFile(PRODUCTS_PATH, products);
            saveFile(INVENTORY_PATH, inventory);
            return { success: true, message: 'Product deleted successfully' };
        }
        throw JSON.stringify({ message: 'error_product_not_found' });
    });

    ipcMain.handle('clear-log', async() => {
        saveFile(TRANSACTIONS_PATH, []);
        return { success: true };
    });

    ipcMain.handle('get-product', async(event, barcode) => {
        if (!barcode) throw JSON.stringify({ message: 'error_barcode_required' });
        const products = loadFile(PRODUCTS_PATH);
        const product = products[barcode];
        if (!product) throw JSON.stringify({ message: 'error_product_not_found' });
        return product;
    });

    ipcMain.handle('update-product', async(event, args) => {
        const { barcode, productName, default_cost, sizeCosts } = args || {};

        if (!barcode || !productName) {
            throw JSON.stringify({ message: 'error_barcode_name_required' });
        }

        const products = loadFile(PRODUCTS_PATH);
        const inventory = loadFile(INVENTORY_PATH);

        if (!products[barcode]) {
            throw JSON.stringify({ message: 'error_product_not_found' });
        }

        products[barcode].name = productName;
        products[barcode].default_cost = parseFloat(default_cost) || 0;

        if (!inventory[barcode]) {
            inventory[barcode] = {};
        }

        for (const size in sizeCosts) {
            const newCost = parseFloat(sizeCosts[size]) || 0;
            const currentStock = (inventory[barcode][size] && inventory[barcode][size].stock) ? inventory[barcode][size].stock : 0;
            inventory[barcode][size] = {
                stock: currentStock,
                cost: newCost
            };
        }

        saveFile(PRODUCTS_PATH, products);
        saveFile(INVENTORY_PATH, inventory);

        return { success: true, updatedProduct: products[barcode] };
    });

    ipcMain.handle('process-transaction', async(event, args) => {
        const { lookupValue, amount, mode, size } = args;

        const inventory = loadFile(INVENTORY_PATH);
        const transactions = loadFile(TRANSACTIONS_PATH);
        const products = loadFile(PRODUCTS_PATH);

        const product = products[lookupValue];
        const itemName = product ? product.name : 'Unknown Item';

        if (!inventory[lookupValue]) {
            throw JSON.stringify({
                message: 'error_item_not_found',
                context: { itemCode: lookupValue }
            });
        }

        if (!inventory[lookupValue][size]) {
            const defaultCost = (product && product.default_cost) ? product.default_cost : 0;
            inventory[lookupValue][size] = { stock: 0, cost: defaultCost };
        }

        let currentStock = inventory[lookupValue][size].stock;
        let newStock, logType, transactionAmount, totalCost;
        transactionAmount = (mode === 'adjust') ? (amount - currentStock) : amount;


        if (mode === 'cut') {
            if (currentStock < amount) {
                throw JSON.stringify({
                    message: 'error_not_enough_stock',
                    context: { item: `${itemName} (${size})`, stock: currentStock }
                });
            }
            newStock = currentStock - amount;
            logType = 'Cut';
        } else if (mode === 'add') {
            newStock = currentStock + amount;
            logType = 'Added';
        } else { // adjust
            newStock = amount;
            logType = 'Adjusted';
        }

        const newCost = inventory[lookupValue][size].cost || 0;

        totalCost = (logType === 'Cut') ? (newCost * transactionAmount * -1) : (newCost * transactionAmount);

        inventory[lookupValue][size] = {
            stock: newStock,
            cost: newCost
        };

        const newTransaction = {
            timestamp: new Date().toISOString(),
            itemCode: lookupValue,
            itemName: `${itemName} (${size})`,
            amount: transactionAmount,
            type: logType,
            newStock,
            cost: newCost,
            totalCost: totalCost
        };

        transactions.push(newTransaction);
        saveFile(INVENTORY_PATH, inventory);
        saveFile(TRANSACTIONS_PATH, transactions);

        let message = `OK: ${logType} ${amount} ${itemName} (${size}). New stock: ${newStock}`;
        if (mode === 'adjust') {
            message = `OK: ${logType} ${itemName} (${size}) stock to ${newStock}.`;
        }

        return {
            success: true,
            message: message,
            newTransaction,
            updatedItem: { itemCode: lookupValue, size, newStockLevel: newStock, newCost: newCost },
        };
    });
    ipcMain.handle('delete-transaction', async(event, { timestamp }) => {
        if (!timestamp) {
            throw JSON.stringify({ message: 'Transaction timestamp is required' });
        }

        const transactions = loadFile(TRANSACTIONS_PATH);
        const inventory = loadFile(INVENTORY_PATH);

        let transactionFound = false;
        let transactionIndex = -1;
        let tx; // The transaction to be deleted

        // 1. Find the transaction
        for (let i = 0; i < transactions.length; i++) {
            if (transactions[i].timestamp === timestamp) {
                tx = transactions[i];
                transactionIndex = i;
                transactionFound = true;
                break;
            }
        }

        if (!transactionFound) {
            throw JSON.stringify({ message: 'error_delete_transaction' });
        }

        // 2. Revert the stock change
        const sizeMatch = tx.itemName.match(/\(([^)]+)\)$/);
        const size = sizeMatch ? sizeMatch[1] : null;

        if (!size || !inventory[tx.itemCode] || !inventory[tx.itemCode][size]) {
            // This should not happen if data is consistent, but it's a good safeguard
            console.error(`Could not find inventory item for ${tx.itemCode} (${size}) to revert stock.`);
            throw JSON.stringify({ message: 'error_item_not_found_in_inventory' });
        }

        // This works for "Added" (amount is +), "Cut" (amount is -), and "Adjusted" (amount is delta)
        // Reverting is as simple as subtracting the transaction's "amount"
        inventory[tx.itemCode][size].stock -= tx.amount;

        // 3. Remove the transaction from the log
        transactions.splice(transactionIndex, 1);

        // 4. Save both files
        saveFile(INVENTORY_PATH, inventory);
        saveFile(TRANSACTIONS_PATH, transactions);

        return { success: true, message: 'Transaction deleted and stock reverted.' };
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}

app.whenReady().then(init);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});