// migration_2.js
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

const PRODUCTS_PATH = getDataFilePath('products.json');

console.log('Starting migration for default_cost...');

try {
    console.log(`Reading ${PRODUCTS_PATH}...`);
    const rawProducts = fs.readFileSync(PRODUCTS_PATH);
    const products = JSON.parse(rawProducts);

    let productsNeedsUpdate = false;

    for (const barcode in products) {
        if (products[barcode] && typeof products[barcode] === 'object' && !products[barcode].hasOwnProperty('default_cost')) {
            // This is the format we expect { name: "...", category_id: "..." }
            products[barcode].default_cost = 0; // Add the new field
            productsNeedsUpdate = true;
        }
    }

    if (productsNeedsUpdate) {
        console.log('Updating products.json to include default_cost...');
        fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(products, null, 2));
        console.log('... products.json migration complete!');
    } else {
        console.log('... products.json already has default_cost field. Skipping.');
    }

} catch (err) {
    console.error('Error migrating products.json:', err.message);
}

console.log('Migration finished.');