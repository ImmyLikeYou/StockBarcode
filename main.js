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

    ipcMain.handle('load-data', async() => ({
        inventory: loadFile(INVENTORY_PATH),
        transactions: loadFile(TRANSACTIONS_PATH),
        products: loadFile(PRODUCTS_PATH),
    }));

    ipcMain.handle('add-product', async(event, productData) => {
        const { productName, principalCode, typeCode } = productData || {};
        if (!productName || !principalCode || !typeCode || principalCode.length !== 4 || typeCode.length !== 4) {
            // 1. Throw JSON string
            throw JSON.stringify({ message: 'error_invalid_data' });
        }

        const products = loadFile(PRODUCTS_PATH);
        const inventory = loadFile(INVENTORY_PATH);
        const newId = (Object.keys(products).length + 1).toString().padStart(4, '0');
        const newBarcode = `${principalCode}${typeCode}${newId}`;

        if (products[newBarcode]) {
            // 2. Throw JSON string
            throw JSON.stringify({ message: 'error_barcode_collision' });
        }

        products[newBarcode] = productName;
        inventory[newBarcode] = {};

        saveFile(PRODUCTS_PATH, products);
        saveFile(INVENTORY_PATH, inventory);

        return { name: productName, barcode: newBarcode };
    });

    ipcMain.handle('delete-product', async(event, barcode) => {
        // 3. Throw JSON string
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
        // 4. Throw JSON string
        throw JSON.stringify({ message: 'error_product_not_found' });
    });

    ipcMain.handle('clear-log', async() => {
        saveFile(TRANSACTIONS_PATH, []);
        return { success: true };
    });

    ipcMain.handle('get-product', async(event, barcode) => {
        // 5. Throw JSON string
        if (!barcode) throw JSON.stringify({ message: 'error_barcode_required' });
        const products = loadFile(PRODUCTS_PATH);
        const productName = products[barcode];
        // 6. Throw JSON string
        if (!productName) throw JSON.stringify({ message: 'error_product_not_found' });
        return { barcode, name: productName };
    });

    ipcMain.handle('update-product', async(event, args) => {
        const { barcode, productName } = args || {};
        // 7. Throw JSON string
        if (!barcode || !productName) throw JSON.stringify({ message: 'error_barcode_name_required' });
        const products = loadFile(PRODUCTS_PATH);
        // 8. Throw JSON string
        if (!products[barcode]) throw JSON.stringify({ message: 'error_product_not_found' });
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

        if (!inventory[lookupValue]) {
            // 9. Throw JSON string with context
            throw JSON.stringify({
                message: 'error_item_not_found',
                context: { itemCode: lookupValue }
            });
        }
        if (!inventory[lookupValue][size]) inventory[lookupValue][size] = 0;

        let currentStock = inventory[lookupValue][size];
        let newStock, logType, transactionAmount = amount;

        if (mode === 'cut') {
            if (currentStock < amount) {
                // 10. Throw JSON string with context
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

        let message = `OK: ${logType} ${amount} ${itemName} (${size}). New stock: ${newStock}`;
        if (mode === 'adjust') {
            message = `OK: ${logType} ${itemName} (${size}) stock to ${newStock}.`;
        }

        return {
            success: true,
            message: message,
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