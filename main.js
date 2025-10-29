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
        return rawData.length === 0 ?
            (filePath.endsWith('transactions.json') ? [] : {}) :
            JSON.parse(rawData);
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

    // ✅ Correct frontend path for dev and packaged builds
    // Locate frontend files robustly for both dev and packaged builds.
    // Common places to check:
    // - development: __dirname/frontend
    // - packaged: process.resourcesPath/frontend
    // - packaged in asar: process.resourcesPath/app.asar/frontend
    const candidates = [];
    if (isPackaged) {
        candidates.push(path.join(process.resourcesPath, 'frontend', 'barcode_receiver.html'));
        candidates.push(path.join(process.resourcesPath, 'app.asar', 'frontend', 'barcode_receiver.html'));
        candidates.push(path.join(process.resourcesPath, 'app', 'frontend', 'barcode_receiver.html'));
    }
    // Always include the source-folder fallback (useful when running `electron-forge start`)
    candidates.push(path.join(__dirname, 'frontend', 'barcode_receiver.html'));

    // Pick the first candidate that exists
    let entryFile = candidates.find((p) => fs.existsSync(p));
    if (!entryFile) {
        // For debugging, log where we looked
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
    // Use CommonJS require for 'electron-is-dev' in the Electron main process
    // (avoids potential issues with dynamic ESM import in this environment)
    try {
        isDev = require('electron-is-dev');
    } catch (err) {
        // Fallback: if we can't require the helper, infer from app.isPackaged and NODE_ENV
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

    ipcMain.handle('load-data', async() => ({
        inventory: loadFile(INVENTORY_PATH),
        transactions: loadFile(TRANSACTIONS_PATH),
        products: loadFile(PRODUCTS_PATH),
    }));

    // IPC: Add new product (mirrors server /api/product)
    ipcMain.handle('add-product', async(event, productData) => {
        const { productName, principalCode, typeCode } = productData || {};
        if (!productName || !principalCode || !typeCode || principalCode.length !== 4 || typeCode.length !== 4) {
            throw new Error('Invalid data. Check all fields.');
        }

        const products = loadFile(PRODUCTS_PATH);
        const inventory = loadFile(INVENTORY_PATH);
        const newId = (Object.keys(products).length + 1).toString().padStart(4, '0');
        const newBarcode = `${principalCode}${typeCode}${newId}`;

        if (products[newBarcode]) {
            throw new Error('Barcode collision. Please try again.');
        }

        products[newBarcode] = productName;
        inventory[newBarcode] = {};

        saveFile(PRODUCTS_PATH, products);
        saveFile(INVENTORY_PATH, inventory);

        return { name: productName, barcode: newBarcode };
    });

    // IPC: Delete a product and its inventory
    ipcMain.handle('delete-product', async(event, barcode) => {
        if (!barcode) throw new Error('Barcode is required');
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
        throw new Error('Product not found');
    });

    // IPC: Clear transaction log
    ipcMain.handle('clear-log', async() => {
        saveFile(TRANSACTIONS_PATH, []);
        return { success: true };
    });

    // IPC: Get product details
    ipcMain.handle('get-product', async(event, barcode) => {
        if (!barcode) throw new Error('Barcode is required');
        const products = loadFile(PRODUCTS_PATH);
        const productName = products[barcode];
        if (!productName) throw new Error('Product not found');
        return { barcode, name: productName };
    });

    // IPC: Update product details
    ipcMain.handle('update-product', async(event, args) => {
        const { barcode, productName } = args || {};
        if (!barcode || !productName) throw new Error('Barcode and productName are required');
        const products = loadFile(PRODUCTS_PATH);
        if (!products[barcode]) throw new Error('Product not found');
        products[barcode] = productName;
        saveFile(PRODUCTS_PATH, products);
        return { success: true, updatedProduct: { barcode, name: productName } };
    });

    ipcMain.handle('process-transaction', async(event, args) => {
        const { lookupValue, amount, mode, size } = args;
        const inventory = loadFile(INVENTORY_PATH);
        const transactions = loadFile(TRANSACTIONS_PATH);
        const products = loadFile(PRODUCTS_PATH);
        const itemName = products[lookupValue] || 'Unknown Item';

        if (!inventory[lookupValue]) throw new Error(`Item code ${lookupValue} not found in inventory.`);
        if (!inventory[lookupValue][size]) inventory[lookupValue][size] = 0;

        let currentStock = inventory[lookupValue][size];
        let newStock, logType, transactionAmount = amount;

        if (mode === 'cut') {
            if (currentStock < amount) throw new Error(`Not enough stock. Only ${currentStock} left.`);
            newStock = currentStock - amount;
            logType = 'Cut';
        } else if (mode === 'add') {
            newStock = currentStock + amount;
            logType = 'Added';
        } else {
            newStock = amount;
            logType = 'Adjusted';
            transactionAmount = newStock - currentStock;
        }

        inventory[lookupValue][size] = newStock;
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

        return {
            success: true,
            newTransaction,
            updatedItem: { itemCode: lookupValue, size, newStockLevel: newStock },
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