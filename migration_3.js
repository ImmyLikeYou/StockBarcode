// migration_3.js
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

console.log('Starting migration for ONE_SIZE to F...');

try {
    console.log(`Reading ${INVENTORY_PATH}...`);
    const rawInventory = fs.readFileSync(INVENTORY_PATH);
    const inventory = JSON.parse(rawInventory);

    let inventoryNeedsUpdate = false;

    for (const barcode in inventory) {
        if (inventory[barcode] && inventory[barcode].hasOwnProperty('ONE_SIZE')) {
            // Rename "ONE_SIZE" to "F"
            inventory[barcode]['F'] = inventory[barcode]['ONE_SIZE'];
            delete inventory[barcode]['ONE_SIZE'];
            inventoryNeedsUpdate = true;
        }
    }

    if (inventoryNeedsUpdate) {
        console.log('Updating inventory.json to rename ONE_SIZE to F...');
        fs.writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2));
        console.log('... inventory.json migration complete!');
    } else {
        console.log('... No "ONE_SIZE" found. Skipping.');
    }

} catch (err) {
    console.error('Error migrating inventory.json:', err.message);
}

console.log('Migration finished.');