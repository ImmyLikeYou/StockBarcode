const { app } = require('electron');

// --- Handle Squirrel installer events for shortcuts ---
if (require('electron-squirrel-startup')) {
    app.quit();
}

// --- Import the rest of the modules ---
const {
    BrowserWindow,
    ipcMain,
    dialog
} = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
// --- REMOVED: promisify and execFile are no longer needed ---

let mainWindow;
let isDev = false;

// --- Data Handling ---
const APP_NAME = 'BarcodeInventorySystem';
// --- ADDED: Get app version from package.json ---
const appVersion = require('./package.json').version;

function getAppDataPath() {
    const basePath = app.getPath('userData');
    return path.join(basePath, 'app-data');
}

async function getDataFilePath(filename) {
    const dataDir = getAppDataPath();
    try {
        await fs.mkdir(dataDir, {
            recursive: true
        });
    } catch (e) {
        console.error("Failed to create app data directory", e);
        dialog.showErrorBox(
            'Fatal Error: Cannot Create Data Directory',
            `Failed to create the application data directory at: ${dataDir}\n\nPlease check permissions and restart the app.\n\nError: ${e.message}`
        );
        app.quit();
    }
    return path.join(dataDir, filename);
}

async function ensureFileExists(filePath, defaultContent) {
    try {
        await fs.access(filePath);
    } catch {
        await fs.writeFile(filePath, defaultContent);
    }
}

async function loadFile(filePath) {
    try {
        await ensureFileExists(filePath, filePath.endsWith('transactions.json') ? '[]' : '{}');
        const rawData = await fs.readFile(filePath);
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

async function saveFile(filePath, data) {
    const tempPath = filePath + ".tmp";
    try {
        await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
        await fs.rename(tempPath, filePath);
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        try {
            await fs.unlink(tempPath);
        } catch (unlinkError) {
            console.error(`Error deleting temp file ${tempPath}:`, unlinkError);
        }
    }
}

// --- MODIFIED: MIGRATION SYSTEM ---
/**
 * Checks data version and runs any pending migration scripts.
 */
async function runMigrations() {
    const SETTINGS_PATH = await getDataFilePath('settings.json');
    let currentVersion = '0.0.0';

    try {
        const settingsData = await fs.readFile(SETTINGS_PATH, 'utf8');
        currentVersion = JSON.parse(settingsData).dataVersion || '0.0.0';
    } catch (e) {
        console.log('No settings.json found, assuming first-time run.');
    }

    if (currentVersion === appVersion) {
        console.log('Data version is up to date.');
        return; // No migration needed
    }

    console.log(`Data version mismatch. App: ${appVersion}, Data: ${currentVersion}. Running migrations...`);

    try {
        // --- Migration 1: Restructure inventory.json and products.json ---
        if (currentVersion < '1.0.1') {
            console.log('Running migration_1.js...');
            require('./migration.js'); // <-- FIXED: Run script directly
            console.log('...migration_1.js complete.');
        }

        // --- Migration 2: Add default_cost to products.json ---
        if (currentVersion < '1.0.2') {
            console.log('Running migration_2.js...');
            require('./migration_2.js'); // <-- FIXED: Run script directly
            console.log('...migration_2.js complete.');
        }

        // --- Migration 3: Rename ONE_SIZE to F in inventory.json ---
        if (currentVersion < '1.0.3') {
            console.log('Running migration_3.js...');
            require('./migration_3.js'); // <-- FIXED: Run script directly
            console.log('...migration_3.js complete.');
        }

        // --- Add future migrations here ---

        // 4. Update settings file with new version
        await saveFile(SETTINGS_PATH, {
            dataVersion: appVersion
        });
        console.log(`Migration complete. Data version updated to ${appVersion}.`);

    } catch (err) {
        console.error('CRITICAL MIGRATION FAILED:', err);
        dialog.showErrorBox(
            'Migration Failed',
            `Failed to update application data. Please report this error.\n\nError: ${err.message}`
        );
        app.quit();
    }
}
// --- END MIGRATION SYSTEM ---


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

    let entryFile = candidates.find((p) => {
        try {
            return require('fs').existsSync(p); // Use sync fs just for this check
        } catch {
            return false;
        }
    });

    if (!entryFile) {
        console.error('❌ Frontend not found. Looked in:');
        candidates.forEach((p) => console.error('   -', p));
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'assets', 'icon.png'), // <-- Icon path
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (entryFile) {
        mainWindow.loadFile(entryFile).catch((err) => {
            console.error('❌ Failed to load HTML file:', err);
            mainWindow.loadURL('data:text/html,<h2>UI failed to load</h2>');
        });
    } else {
        mainWindow.loadURL('data:text/html,<h2>Frontend not found</h2>');
    }

    if (isDev) mainWindow.webContents.openDevTools({
        mode: 'detach'
    });
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

    await runMigrations();

    const INVENTORY_PATH = await getDataFilePath('inventory.json');
    const TRANSACTIONS_PATH = await getDataFilePath('transactions.json');
    const PRODUCTS_PATH = await getDataFilePath('products.json');
    const CATEGORIES_PATH = await getDataFilePath('categories.json');

    // --- IPC handlers ---
    // (All handlers remain the same)
    ipcMain.handle('load-data', async() => ({
        inventory: await loadFile(INVENTORY_PATH),
        transactions: await loadFile(TRANSACTIONS_PATH),
        products: await loadFile(PRODUCTS_PATH),
    }));

    ipcMain.handle('get-categories', async() => {
        return await loadFile(CATEGORIES_PATH);
    });

    ipcMain.handle('add-category', async(event, categoryName) => {
        if (!categoryName) {
            throw JSON.stringify({
                message: 'error_category_name_empty'
            });
        }
        const categories = await loadFile(CATEGORIES_PATH);
        const newId = `cat_${Date.now()}`;
        categories[newId] = categoryName;
        await saveFile(CATEGORIES_PATH, categories);
        return {
            id: newId,
            name: categoryName
        };
    });

    ipcMain.handle('update-category', async(event, {
        id,
        newName
    }) => {
        if (!id || !newName) {
            throw JSON.stringify({
                message: 'error_category_name_empty'
            });
        }
        if (id === 'cat_0') {
            throw JSON.stringify({
                message: 'error_category_delete_default'
            });
        }
        const categories = await loadFile(CATEGORIES_PATH);
        if (!categories[id]) {
            throw JSON.stringify({
                message: 'Category not found'
            });
        }
        categories[id] = newName;
        await saveFile(CATEGORIES_PATH, categories);
        return {
            id,
            name: newName
        };
    });

    ipcMain.handle('delete-category', async(event, {
        id
    }) => {
        if (!id) {
            throw JSON.stringify({
                message: 'Category ID is required'
            });
        }
        if (id === 'cat_0') {
            throw JSON.stringify({
                message: 'error_category_delete_default'
            });
        }

        const categories = await loadFile(CATEGORIES_PATH);
        const products = await loadFile(PRODUCTS_PATH);

        if (!categories[id]) {
            throw JSON.stringify({
                message: 'Category not found'
            });
        }

        delete categories[id];

        for (const barcode in products) {
            if (products[barcode].category_id === id) {
                products[barcode].category_id = 'cat_0';
            }
        }

        await saveFile(CATEGORIES_PATH, categories);
        await saveFile(PRODUCTS_PATH, products);

        return {
            success: true,
            message: 'Category deleted and products reassigned.'
        };
    });


    ipcMain.handle('add-product', async(event, productData) => {
        const {
            productName,
            principalCode,
            typeCode,
            category_id,
            default_cost
        } = productData || {};
        if (!productName || !principalCode || !typeCode || principalCode.length !== 4 || typeCode.length !== 4) {
            throw JSON.stringify({
                message: 'error_invalid_data'
            });
        }

        const products = await loadFile(PRODUCTS_PATH);
        const inventory = await loadFile(INVENTORY_PATH);
        const newId = (Object.keys(products).length + 1).toString().padStart(4, '0');
        const newBarcode = `${principalCode}${typeCode}${newId}`;

        if (products[newBarcode]) {
            throw JSON.stringify({
                message: 'error_barcode_collision'
            });
        }

        products[newBarcode] = {
            name: productName,
            category_id: category_id || 'cat_0',
            default_cost: parseFloat(default_cost) || 0
        };
        inventory[newBarcode] = {};

        await saveFile(PRODUCTS_PATH, products);
        await saveFile(INVENTORY_PATH, inventory);

        return {
            name: productName,
            barcode: newBarcode
        };
    });

    ipcMain.handle('delete-product', async(event, barcode) => {
        if (!barcode) throw JSON.stringify({
            message: 'error_barcode_required'
        });
        const products = await loadFile(PRODUCTS_PATH);
        const inventory = await loadFile(INVENTORY_PATH);
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
            await saveFile(PRODUCTS_PATH, products);
            await saveFile(INVENTORY_PATH, inventory);
            return {
                success: true,
                message: 'Product deleted successfully'
            };
        }
        throw JSON.stringify({
            message: 'error_product_not_found'
        });
    });

    ipcMain.handle('clear-log', async() => {
        await saveFile(TRANSACTIONS_PATH, []);
        return {
            success: true
        };
    });

    ipcMain.handle('get-product', async(event, barcode) => {
        if (!barcode) throw JSON.stringify({
            message: 'error_barcode_required'
        });
        const products = await loadFile(PRODUCTS_PATH);
        const product = products[barcode];
        if (!product) throw JSON.stringify({
            message: 'error_product_not_found'
        });
        return product;
    });

    ipcMain.handle('update-product', async(event, args) => {
        const {
            barcode,
            productName,
            default_cost,
            sizeCosts
        } = args || {};

        if (!barcode || !productName) {
            throw JSON.stringify({
                message: 'error_barcode_name_required'
            });
        }

        const products = await loadFile(PRODUCTS_PATH);
        const inventory = await loadFile(INVENTORY_PATH);

        if (!products[barcode]) {
            throw JSON.stringify({
                message: 'error_product_not_found'
            });
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

        await saveFile(PRODUCTS_PATH, products);
        await saveFile(INVENTORY_PATH, inventory);

        return {
            success: true,
            updatedProduct: products[barcode]
        };
    });

    ipcMain.handle('process-transaction', async(event, args) => {
        const {
            lookupValue,
            amount,
            mode,
            size,
            totalSalesPrice
        } = args;

        const inventory = await loadFile(INVENTORY_PATH);
        const transactions = await loadFile(TRANSACTIONS_PATH);
        const products = await loadFile(PRODUCTS_PATH);

        const product = products[lookupValue];
        const itemName = product ? product.name : 'Unknown Item';

        if (!inventory[lookupValue]) {
            throw JSON.stringify({
                message: 'error_item_not_found',
                context: {
                    itemCode: lookupValue
                }
            });
        }

        if (!inventory[lookupValue][size]) {
            const defaultCost = (product && product.default_cost) ? product.default_cost : 0;
            inventory[lookupValue][size] = {
                stock: 0,
                cost: defaultCost
            };
        }

        let currentStock = inventory[lookupValue][size].stock;
        let newStock, logType, transactionAmount, totalCost;
        transactionAmount = (mode === 'adjust') ? (amount - currentStock) : amount;


        if (mode === 'cut') {
            if (currentStock < amount) {
                throw JSON.stringify({
                    message: 'error_not_enough_stock',
                    context: {
                        item: `${itemName} (${size})`,
                        stock: currentStock
                    }
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

        const finalSalesPrice = (logType === 'Cut') ? (totalSalesPrice || 0) : 0;

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
            totalCost: totalCost,
            totalSales: finalSalesPrice
        };

        transactions.push(newTransaction);
        await saveFile(INVENTORY_PATH, inventory);
        await saveFile(TRANSACTIONS_PATH, transactions);

        let message = `OK: ${logType} ${amount} ${itemName} (${size}). New stock: ${newStock}`;
        if (mode === 'adjust') {
            message = `OK: ${logType} ${itemName} (${size}) stock to ${newStock}.`;
        }

        return {
            success: true,
            message: message,
            newTransaction,
            updatedItem: {
                itemCode: lookupValue,
                size,
                newStockLevel: newStock,
                newCost: newCost
            },
        };
    });

    ipcMain.handle('delete-transaction', async(event, {
        timestamp
    }) => {
        if (!timestamp) {
            throw JSON.stringify({
                message: 'Transaction timestamp is required'
            });
        }

        const transactions = await loadFile(TRANSACTIONS_PATH);
        const inventory = await loadFile(INVENTORY_PATH);

        let transactionFound = false;
        let transactionIndex = -1;
        let tx;

        for (let i = 0; i < transactions.length; i++) {
            if (transactions[i].timestamp === timestamp) {
                tx = transactions[i];
                transactionIndex = i;
                transactionFound = true;
                break;
            }
        }

        if (!transactionFound) {
            throw JSON.stringify({
                message: 'error_delete_transaction'
            });
        }

        const sizeMatch = tx.itemName.match(/\(([^)]+)\)$/);
        const size = sizeMatch ? sizeMatch[1] : null;

        if (!size || !inventory[tx.itemCode] || !inventory[tx.itemCode][size]) {
            console.error(`Could not find inventory item for ${tx.itemCode} (${size}) to revert stock.`);
            throw JSON.stringify({
                message: 'error_item_not_found_in_inventory'
            });
        }

        inventory[tx.itemCode][size].stock -= tx.amount;
        transactions.splice(transactionIndex, 1);

        await saveFile(INVENTORY_PATH, inventory);
        await saveFile(TRANSACTIONS_PATH, transactions);

        return {
            success: true,
            message: 'Transaction deleted and stock reverted.'
        };
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}

// --- Use .then() and .catch() for the top-level async init ---
app.whenReady().then(init).catch(err => {
    console.error("Failed to initialize app:", err);
    app.quit();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});