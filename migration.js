// migration.js
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- This helper logic is copied from your main.js/server.js ---
const APP_NAME = 'BarcodeInventorySystem';

function getAppDataPath() {
    const platform = os.platform();
    let basePath;
    if (platform === 'win32') {
        basePath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    } else if (platform === 'darwin') {
        basePath = path.join(os.homedir(), 'Library', 'Application Support');
    } else {
        basePath = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    }
    return path.join(basePath, APP_NAME);
}

function getDataFilePath(filename) {
    const localDataDir = path.join(__dirname, 'app-data');
    if (fs.existsSync(localDataDir)) {
        console.log('Found local app-data (dev) folder.');
        return path.join(localDataDir, filename);
    }
    const appDataDir = getAppDataPath();
    const dataDir = path.join(appDataDir, 'app-data');
    if (fs.existsSync(dataDir)) {
        console.log(`Found production app-data folder at: ${dataDir}`);
        return path.join(dataDir, filename);
    }
    console.error('CRITICAL: Could not find app-data directory.');
    process.exit(1);
}
// --- End of helper logic ---

const INVENTORY_PATH = getDataFilePath('inventory.json');
const PRODUCTS_PATH = getDataFilePath('products.json');

console.log('Starting migration...');

// 1. Migrate products.json
try {
    console.log(`Reading ${PRODUCTS_PATH}...`);
    const rawProducts = fs.readFileSync(PRODUCTS_PATH);
    const products = JSON.parse(rawProducts);

    let productsNeedsUpdate = false;
    const newProducts = {};

    for (const barcode in products) {
        if (typeof products[barcode] === 'string') {
            // This is the OLD format
            newProducts[barcode] = {
                name: products[barcode],
                category_id: null // Set category to null for now
            };
            productsNeedsUpdate = true;
        } else {
            // This is already the NEW format, just copy it
            newProducts[barcode] = products[barcode];
        }
    }

    if (productsNeedsUpdate) {
        console.log('Updating products.json to new format...');
        fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(newProducts, null, 2));
        console.log('... products.json migration complete!');
    } else {
        console.log('... products.json is already in the new format. Skipping.');
    }

} catch (err) {
    console.error('Error migrating products.json:', err.message);
}

// 2. Migrate inventory.json
try {
    console.log(`Reading ${INVENTORY_PATH}...`);
    const rawInventory = fs.readFileSync(INVENTORY_PATH);
    const inventory = JSON.parse(rawInventory);

    let inventoryNeedsUpdate = false;
    const newInventory = {};

    for (const barcode in inventory) {
        newInventory[barcode] = {};
        const sizes = inventory[barcode];
        for (const size in sizes) {
            if (typeof sizes[size] === 'number') {
                // This is the OLD format (e.g., "S": 10)
                newInventory[barcode][size] = {
                    stock: sizes[size], // The old number is the stock
                    cost: 0 // Default cost to 0
                };
                inventoryNeedsUpdate = true;
            } else {
                // This is already the NEW format, just copy it
                newInventory[barcode][size] = sizes[size];
            }
        }
    }

    if (inventoryNeedsUpdate) {
        console.log('Updating inventory.json to new format...');
        fs.writeFileSync(INVENTORY_PATH, JSON.stringify(newInventory, null, 2));
        console.log('... inventory.json migration complete!');
    } else {
        console.log('... inventory.json is already in the new format. Skipping.');
    }

} catch (err) {
    console.error('Error migrating inventory.json:', err.message);
}

console.log('Migration finished.');