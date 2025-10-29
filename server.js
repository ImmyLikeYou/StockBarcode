// --- 1. Setup ---
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const app = express();
const PORT = 3000;
// --- NEW: Define an application name for the folder ---
const APP_NAME = 'BarcodeInventorySystem';

// --- 2. File Paths ---
const INVENTORY_PATH = getDataFilePath('inventory.json');
const TRANSACTIONS_PATH = getDataFilePath('transactions.json');
const PRODUCTS_PATH = getDataFilePath('products.json');

console.log('Using data files:');
console.log('  INVENTORY_PATH ->', INVENTORY_PATH);
console.log('  TRANSACTIONS_PATH ->', TRANSACTIONS_PATH);
console.log('  PRODUCTS_PATH ->', PRODUCTS_PATH);

// --- 3. Middleware ---
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'frontend'))); // Serves all files in /frontend

// --- 4. Helper Functions ---
function getAppDataPath() {
    const platform = os.platform();
    let basePath;

    if (platform === 'win32') { // Windows
        basePath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    } else if (platform === 'darwin') { // macOS
        basePath = path.join(os.homedir(), 'Library', 'Application Support');
    } else { // Linux and other Unix-like
        basePath = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    }

    // Create a subfolder for your application
    return path.join(basePath, APP_NAME);
}
// --- Helper to get the correct path, whether running from source or packaged ---
function ensureFileExists(filePath, defaultContent) {
    if (!fs.existsSync(filePath)) {
        console.log(`Creating initial data file: ${filePath}`);
        fs.writeFileSync(filePath, defaultContent);
    }
}
ensureFileExists(INVENTORY_PATH, '{}');
ensureFileExists(TRANSACTIONS_PATH, '[]');
ensureFileExists(PRODUCTS_PATH, '{}');

function getDataFilePath(filename) {
    // Prefer a local ./app-data folder when present (useful for development).
    const localDataDir = path.join(__dirname, 'app-data');
    if (fs.existsSync(localDataDir)) {
        return path.join(localDataDir, filename);
    }

    const appDataDir = getAppDataPath(); // Get e.g., C:\Users\User\AppData\Roaming\BarcodeInventorySystem
    const dataDir = path.join(appDataDir, 'app-data'); // Add our subfolder

    // Create the necessary directories if they don't exist
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`Created application data directory: ${dataDir}`);
    }

    return path.join(dataDir, filename);
}

function getDataPath(filename) {
    // process.pkg is set when running inside a pkg executable
    const basePath = process.pkg ? path.dirname(process.execPath) : __dirname;
    const dataDir = path.join(basePath, 'app-data');

    // Create the app-data directory next to the executable if it doesn't exist
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }

    return path.join(dataDir, filename);
}

function loadFile(filePath) {
    // Ensure file exists before reading (use the specific defaults)
    if (filePath.endsWith('inventory.json')) ensureFileExists(filePath, '{}');
    else if (filePath.endsWith('transactions.json')) ensureFileExists(filePath, '[]');
    else if (filePath.endsWith('products.json')) ensureFileExists(filePath, '{}');

    const rawData = fs.readFileSync(filePath);
    return rawData.length === 0 ? (filePath.endsWith('transactions.json') ? [] : {}) : JSON.parse(rawData);
}

function saveFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// --- 5. API Endpoints (Routes) ---

// View Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'barcode_receiver.html'));
});

app.get('/add-product', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'add_product.html'));
});

app.get('/item-list', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'item_list.html'));
});

app.get('/transactions', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'transactions.html'));
});
app.get('/item-history/:barcode', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'frontend', 'item_history.html'));
    } catch (err) {
        console.error("Error serving item history page:", err);
        res.status(500).send('Server Error');
    }
});
// Serve the "Edit Product" page as static HTML
app.get('/edit-product/:barcode', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'frontend', 'edit_product.html'));
    } catch (err) {
        console.error("Error serving edit page:", err);
        res.status(500).send('Server Error');
    }
});
app.put('/api/product/:barcode', (req, res) => {
    try {
        const { barcode } = req.params;
        const { productName } = req.body; // Get new name from request body

        if (!productName) {
            return res.status(400).json({ message: 'Product name is required.' });
        }

        const products = loadFile(PRODUCTS_PATH);

        if (!products[barcode]) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // Update the name
        products[barcode] = productName;
        saveFile(PRODUCTS_PATH, products);

        res.status(200).json({ message: 'Product updated successfully', updatedProduct: { barcode, name: productName } });

    } catch (err) {
        console.error("Error updating product:", err);
        res.status(500).json({ message: 'Server error updating product.' });
    }
});
app.get('/reports', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'reports.html'));
});

// API: get product details by barcode
app.get('/api/product/:barcode', (req, res) => {
    try {
        const { barcode } = req.params;
        const products = loadFile(PRODUCTS_PATH);
        const productName = products[barcode];
        if (!productName) return res.status(404).json({ message: 'Product not found' });
        res.json({ barcode, name: productName });
    } catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).json({ message: 'Server error' });
    }
});
// API Route: /api/data
app.get('/api/data', (req, res) => {
    try {
        const inventory = loadFile(INVENTORY_PATH);
        const transactions = loadFile(TRANSACTIONS_PATH);
        const products = loadFile(PRODUCTS_PATH);
        res.json({ inventory, transactions, products });
    } catch (err) {
        console.error('Error loading data:', err);
        res.status(500).json({ message: 'Error loading data from files.' });
    }
});

// API Route: /api/product (POST - Create)
app.post('/api/product', (req, res) => {
    try {
        const { productName, principalCode, typeCode } = req.body;
        if (!productName || !principalCode || !typeCode || principalCode.length !== 4 || typeCode.length !== 4) {
            return res.status(400).json({ message: 'Invalid data. Check all fields.' });
        }

        const products = loadFile(PRODUCTS_PATH);
        const inventory = loadFile(INVENTORY_PATH);
        const newId = (Object.keys(products).length + 1).toString().padStart(4, '0');
        const newBarcode = `${principalCode}${typeCode}${newId}`;

        if (products[newBarcode]) {
            return res.status(500).json({ message: 'Barcode collision. Please try again.' });
        }

        products[newBarcode] = productName;
        inventory[newBarcode] = {}; // Create empty object for sizes

        saveFile(PRODUCTS_PATH, products);
        saveFile(INVENTORY_PATH, inventory);

        res.status(201).json({ name: productName, barcode: newBarcode });
    } catch (err) {
        console.error('Server error creating product:', err);
        res.status(500).json({ message: 'Server error creating product.' });
    }
});

// API Route: /api/product/:barcode (DELETE)
app.delete('/api/product/:barcode', (req, res) => {
    try {
        const { barcode } = req.params;
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
            res.status(200).json({ message: 'Product deleted successfully' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (err) {
        console.error('Server error deleting product:', err);
        res.status(500).json({ message: 'Server error deleting product' });
    }
});

// API Route: /api/transaction (POST)
app.post('/api/transaction', (req, res) => {
    const { lookupValue, amount, mode, size } = req.body;
    if (!lookupValue || isNaN(amount) || !mode || !size ||
        ((mode === 'add' || mode === 'cut') && amount < 1) ||
        (mode === 'adjust' && amount < 0)) {
        return res.status(400).json({ message: 'Error: Invalid data in request.' });
    }
    try {
        const inventory = loadFile(INVENTORY_PATH);
        const transactions = loadFile(TRANSACTIONS_PATH);
        const products = loadFile(PRODUCTS_PATH);
        const itemName = products[lookupValue] || "Unknown Item";

        if (!inventory.hasOwnProperty(lookupValue)) {
            return res.status(404).json({ message: `Error: Item code ${lookupValue} not found in inventory.` });
        }
        if (!inventory[lookupValue].hasOwnProperty(size)) {
            if (mode === 'add' || mode === 'adjust') {
                inventory[lookupValue][size] = 0;
            } else {
                return res.status(404).json({ message: `Error: Size "${size}" not found for ${itemName}. Add/Adjust stock first.` });
            }
        }

        let currentStock = inventory[lookupValue][size]; // Get current stock
        let newStock;
        let logType;
        let transactionAmount = amount;
        let message; // Define message variable outside the if/else

        if (mode === 'cut') {
            // --- NEW CHECK ---
            if (currentStock < amount) {
                // Not enough stock! Send an error response.
                return res.status(400).json({ // Use 400 Bad Request
                    message: `Error: Not enough stock for ${itemName} (${size}). Only ${currentStock} left.`,
                    errorType: 'INSUFFICIENT_STOCK' // Add a custom error type
                });
            }
            // --- END NEW CHECK ---
            newStock = currentStock - amount;
            logType = "Cut";
            message = `OK: ${logType} ${amount} ${itemName} (${size}). New stock: ${newStock}`;
        } else if (mode === 'add') {
            newStock = currentStock + amount;
            logType = "Added";
            message = `OK: ${logType} ${amount} ${itemName} (${size}). New stock: ${newStock}`;
        } else { // mode === 'adjust'
            newStock = amount;
            logType = "Adjusted";
            transactionAmount = newStock - currentStock;
            message = `OK: ${logType} ${itemName} (${size}) stock to ${newStock}.`;
        }

        inventory[lookupValue][size] = newStock; // Update the stock

        const newTransaction = {
            timestamp: new Date().toISOString(),
            itemCode: lookupValue,
            itemName: `${itemName} (${size})`,
            amount: transactionAmount,
            type: logType,
            newStock: newStock
        };
        transactions.push(newTransaction);

        saveFile(INVENTORY_PATH, inventory);
        saveFile(TRANSACTIONS_PATH, transactions);

        res.status(200).json({
            message: message,
            newTransaction: newTransaction,
            updatedItem: { itemCode: lookupValue, size: size, newStockLevel: newStock }
        });
    } catch (err) {
        console.error('Error processing transaction:', err);
        res.status(500).json({ message: 'Error processing transaction' });
    }
});

// API Route: /api/log (DELETE)
app.delete('/api/log', (req, res) => {
    try {
        saveFile(TRANSACTIONS_PATH, []);
        res.status(200).json({ message: 'Transaction log cleared' });
    } catch (err) {
        console.error('Error clearing log:', err);
        res.status(500).json({ message: 'Error clearing log' });
    }
});

// --- 6. Start the Server ---
app.listen(PORT, () => {
    console.log(`Inventory server running on http://localhost:${PORT}`);
});