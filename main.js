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

// --- MODIFIED loadFile FUNCTION ---
function loadFile(filePath) {
    ensureFileExists(filePath, filePath.endsWith('transactions.json') ? '[]' : '{}');
    try {
        const rawData = fs.readFileSync(filePath);
        if (rawData.length === 0) { // File is empty
            return filePath.endsWith('transactions.json') ? [] : {};
        }

        const data = JSON.parse(rawData);

        // --- THIS IS THE FIX ---
        // If we expect an array but get an object (or null/string/etc.), return an empty array.
        if (filePath.endsWith('transactions.json') && !Array.isArray(data)) {
            console.warn(`Warning: ${filePath} was corrupted (not an array). Resetting to [].`);
            return []; // Force it to be an array
        }
        // --- END FIX ---

        return data;
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return filePath.endsWith('transactions.json') ? [] : {};
    }
}
// --- END MODIFICATION ---

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

    ipcMain.handle('add-product', async(event, productData) => {
        const { productName, principalCode, typeCode, category_id } = productData || {};
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
            category_id: category_id || 'cat_0'
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
        return { barcode, name: product.name };
    });

    ipcMain.handle('update-product', async(event, args) => {
        const { barcode, productName } = args || {};
        if (!barcode || !productName) throw JSON.stringify({ message: 'error_barcode_name_required' });
        const products = loadFile(PRODUCTS_PATH);
        if (!products[barcode]) throw JSON.stringify({ message: 'error_product_not_found' });

        products[barcode].name = productName;

        saveFile(PRODUCTS_PATH, products);
        return { success: true, updatedProduct: { barcode, name: productName } };
    });

    ipcMain.handle('process-transaction', async(event, args) => {
        const { lookupValue, amount, mode, size, cost } = args;

        if ((mode === 'add' || mode === 'adjust') && (isNaN(cost) || cost < 0)) {
            throw JSON.stringify({ message: 'error_invalid_cost' });
        }

        const inventory = loadFile(INVENTORY_PATH);
        const transactions = loadFile(TRANSACTIONS_PATH);
        const products = loadFile(PRODUCTS_PATH);

        const itemName = products[lookupValue] ? products[lookupValue].name : 'Unknown Item';

        if (!inventory[lookupValue]) {
            throw JSON.stringify({
                message: 'error_item_not_found',
                context: { itemCode: lookupValue }
            });
        }
        if (!inventory[lookupValue][size]) {
            inventory[lookupValue][size] = { stock: 0, cost: 0 };
        }

        let currentStock = inventory[lookupValue][size].stock;
        let newStock, logType, transactionAmount = amount;

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
            transactionAmount = newStock - currentStock;
        }

        let newCost;
        if (mode === 'add' || mode === 'adjust') {
            newCost = cost;
        } else { // 'cut'
            newCost = inventory[lookupValue][size].cost || 0;
        }

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

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}

app.whenReady().then(init);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});