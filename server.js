// --- 1. Setup ---
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const app = express();
const PORT = 3001; // <-- This is the only change
const APP_NAME = 'BarcodeInventorySystem';

// --- 2. File Paths ---
const INVENTORY_PATH = getDataFilePath('inventory.json');
const TRANSACTIONS_PATH = getDataFilePath('transactions.json');
const PRODUCTS_PATH = getDataFilePath('products.json');
const CATEGORIES_PATH = getDataFilePath('categories.json');

console.log('Using data files:');
console.log('  INVENTORY_PATH ->', INVENTORY_PATH);
console.log('  TRANSACTIONS_PATH ->', TRANSACTIONS_PATH);
console.log('  PRODUCTS_PATH ->', PRODUCTS_PATH);
console.log('  CATEGORIES_PATH ->', CATEGORIES_PATH);

// --- 3. Middleware ---
app.use(express.json());
app.use(cors());
app.use('/locales', express.static(path.join(__dirname, 'frontend/locales')));
app.use(express.static(path.join(__dirname, 'frontend')));

// --- 4. Helper Functions ---
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

function ensureFileExists(filePath, defaultContent) {
    if (!fs.existsSync(filePath)) {
        console.log(`Creating initial data file: ${filePath}`);
        fs.writeFileSync(filePath, defaultContent);
    }
}

ensureFileExists(INVENTORY_PATH, '{}');
ensureFileExists(TRANSACTIONS_PATH, '[]');
ensureFileExists(PRODUCTS_PATH, '{}');
ensureFileExists(CATEGORIES_PATH, '{"cat_0": "Default"}');

function getDataFilePath(filename) {
    const localDataDir = path.join(__dirname, 'app-data');
    if (fs.existsSync(localDataDir)) {
        return path.join(localDataDir, filename);
    }
    const appDataDir = getAppDataPath();
    const dataDir = path.join(appDataDir, 'app-data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`Created application data directory: ${dataDir}`);
    }
    return path.join(dataDir, filename);
}

function loadFile(filePath) {
    const rawData = fs.readFileSync(filePath);
    if (rawData.length === 0) {
        return filePath.endsWith('transactions.json') ? [] : {};
    }

    try {
        const data = JSON.parse(rawData);

        if (filePath.endsWith('transactions.json') && !Array.isArray(data)) {
            console.warn(`Warning: ${filePath} was corrupted (not an array). Resetting to [].`);
            return [];
        }

        return data;
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return filePath.endsWith('transactions.json') ? [] : {};
    }
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
app.get('/edit-product/:barcode', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'frontend', 'edit_product.html'));
    } catch (err) {
        console.error("Error serving edit page:", err);
        res.status(500).send('Server Error');
    }
});
app.get('/reports', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'reports.html'));
});
app.get('/categories', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'categories.html'));
});


// API Routes
app.put('/api/product/:barcode', (req, res) => {
    try {
        const { barcode } = req.params;
        const { productName, default_cost, sizeCosts } = req.body;

        if (!productName) {
            return res.status(400).json({ message: 'error_name_empty' });
        }

        const products = loadFile(PRODUCTS_PATH);
        const inventory = loadFile(INVENTORY_PATH);

        if (!products[barcode]) {
            return res.status(404).json({ message: 'error_product_not_found' });
        }

        products[barcode].name = productName;
        products[barcode].default_cost = parseFloat(default_cost) || 0;

        if (!inventory[barcode]) {
            inventory[barcode] = {};
        }

        if (sizeCosts) {
            for (const size in sizeCosts) {
                const newCost = parseFloat(sizeCosts[size]) || 0;
                const currentStock = (inventory[barcode][size] && inventory[barcode][size].stock) ? inventory[barcode][size].stock : 0;
                inventory[barcode][size] = {
                    stock: currentStock,
                    cost: newCost
                };
            }
        }

        saveFile(PRODUCTS_PATH, products);
        saveFile(INVENTORY_PATH, inventory);

        res.status(200).json({ message: 'Product updated successfully', updatedProduct: products[barcode] });

    } catch (err) {
        console.error("Error updating product:", err);
        res.status(500).json({ message: 'Server error updating product.' });
    }
});

app.get('/api/product/:barcode', (req, res) => {
    try {
        const { barcode } = req.params;
        const products = loadFile(PRODUCTS_PATH);
        const product = products[barcode];
        if (!product) return res.status(404).json({ message: 'error_product_not_found' });
        res.json(product);
    } catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

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

app.get('/api/categories', (req, res) => {
    try {
        const categories = loadFile(CATEGORIES_PATH);
        res.json(categories);
    } catch (err) {
        console.error('Error loading categories:', err);
        res.status(500).json({ message: 'Error loading categories.' });
    }
});

app.post('/api/category', (req, res) => {
    try {
        const { categoryName } = req.body;
        if (!categoryName) {
            return res.status(400).json({ message: 'error_category_name_empty' });
        }
        const categories = loadFile(CATEGORIES_PATH);
        const newId = `cat_${Date.now()}`;
        categories[newId] = categoryName;
        saveFile(CATEGORIES_PATH, categories);
        res.status(201).json({ id: newId, name: categoryName });
    } catch (err) {
        console.error('Server error creating category:', err);
        res.status(500).json({ message: 'Server error creating category.' });
    }
});

// --- NEW: Update Category ---
app.put('/api/category/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { newName } = req.body;

        if (!newName) {
            return res.status(400).json({ message: 'error_category_name_empty' });
        }
        if (id === 'cat_0') {
            return res.status(403).json({ message: 'error_category_delete_default' });
        }

        const categories = loadFile(CATEGORIES_PATH);
        if (!categories[id]) {
            return res.status(404).json({ message: 'Category not found' });
        }

        categories[id] = newName;
        saveFile(CATEGORIES_PATH, categories);
        res.status(200).json({ id, name: newName });
    } catch (err) {
        console.error('Server error updating category:', err);
        res.status(500).json({ message: 'Server error updating category' });
    }
});

// --- NEW: Delete Category ---
app.delete('/api/category/:id', (req, res) => {
    try {
        const { id } = req.params;
        if (id === 'cat_0') {
            return res.status(403).json({ message: 'error_category_delete_default' });
        }

        const categories = loadFile(CATEGORIES_PATH);
        const products = loadFile(PRODUCTS_PATH);

        if (!categories[id]) {
            return res.status(404).json({ message: 'Category not found' });
        }

        delete categories[id];

        for (const barcode in products) {
            if (products[barcode].category_id === id) {
                products[barcode].category_id = 'cat_0'; // Re-assign to Default
            }
        }

        saveFile(CATEGORIES_PATH, categories);
        saveFile(PRODUCTS_PATH, products);

        res.status(200).json({ success: true, message: 'Category deleted and products reassigned.' });
    } catch (err) {
        console.error('Server error deleting category:', err);
        res.status(500).json({ message: 'Server error deleting category' });
    }
});

app.post('/api/product', (req, res) => {
    try {
        const { productName, principalCode, typeCode, category_id, default_cost } = req.body;
        if (!productName || !principalCode || !typeCode || principalCode.length !== 4 || typeCode.length !== 4) {
            return res.status(400).json({ message: 'error_invalid_data' });
        }

        const products = loadFile(PRODUCTS_PATH);
        const inventory = loadFile(INVENTORY_PATH);
        const newId = (Object.keys(products).length + 1).toString().padStart(4, '0');
        const newBarcode = `${principalCode}${typeCode}${newId}`;

        if (products[newBarcode]) {
            return res.status(500).json({ message: 'error_barcode_collision' });
        }

        products[newBarcode] = {
            name: productName,
            category_id: category_id || 'cat_0',
            default_cost: parseFloat(default_cost) || 0
        };
        inventory[newBarcode] = {};

        saveFile(PRODUCTS_PATH, products);
        saveFile(INVENTORY_PATH, inventory);

        res.status(201).json({ name: productName, barcode: newBarcode });
    } catch (err) {
        console.error('Server error creating product:', err);
        res.status(500).json({ message: 'Server error creating product.' });
    }
});

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
            res.status(404).json({ message: 'error_product_not_found' });
        }
    } catch (err) {
        console.error('Server error deleting product:', err);
        res.status(500).json({ message: 'Server error deleting product' });
    }
});

app.post('/api/transaction', (req, res) => {
    const { lookupValue, amount, mode, size } = req.body;

    if (!lookupValue || isNaN(amount) || !mode || !size ||
        ((mode === 'add' || mode === 'cut') && amount < 1) ||
        (mode === 'adjust' && amount < 0)) {
        return res.status(400).json({ message: 'error_invalid_data' });
    }

    try {
        const inventory = loadFile(INVENTORY_PATH);
        const transactions = loadFile(TRANSACTIONS_PATH);
        const products = loadFile(PRODUCTS_PATH);

        const product = products[lookupValue];
        const itemName = product ? product.name : "Unknown Item";

        if (!inventory.hasOwnProperty(lookupValue)) {
            return res.status(404).json({
                message: 'error_item_not_found',
                context: { itemCode: lookupValue }
            });
        }

        if (!inventory[lookupValue].hasOwnProperty(size)) {
            const defaultCost = (product && product.default_cost) ? product.default_cost : 0;
            if (mode === 'add' || mode === 'adjust') {
                inventory[lookupValue][size] = { stock: 0, cost: defaultCost };
            } else {
                return res.status(404).json({
                    message: 'error_size_not_found',
                    context: { size: size, item: itemName }
                });
            }
        }

        let currentStock = inventory[lookupValue][size].stock;
        let newStock;
        let logType;
        let transactionAmount;
        let totalCost;
        transactionAmount = (mode === 'adjust') ? (amount - currentStock) : amount;

        if (mode === 'cut') {
            if (currentStock < amount) {
                return res.status(400).json({
                    message: 'error_not_enough_stock',
                    errorType: 'INSUFFICIENT_STOCK',
                    context: { item: `${itemName} (${size})`, stock: currentStock }
                });
            }
            newStock = currentStock - amount;
            logType = "Cut";
        } else if (mode === 'add') {
            newStock = currentStock + amount;
            logType = "Added";
        } else { // mode === 'adjust'
            newStock = amount;
            logType = "Adjusted";
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
            newStock: newStock,
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

        res.status(200).json({
            message: message,
            newTransaction: newTransaction,
            updatedItem: { itemCode: lookupValue, size: size, newStockLevel: newStock, newCost: newCost }
        });
    } catch (err) {
        console.error('Error processing transaction:', err);
        res.status(500).json({ message: 'Error processing transaction' });
    }
});

app.delete('/api/log', (req, res) => {
    try {
        saveFile(TRANSACTIONS_PATH, []);
        res.status(200).json({ message: 'Transaction log cleared' });
    } catch (err) {
        console.error('Error clearing log:', err);
        res.status(500).json({ message: 'Error clearing log' });
    }
});
app.delete('/api/transaction/:timestamp', (req, res) => {
    try {
        const { timestamp } = req.params;
        if (!timestamp) {
            return res.status(400).json({ message: 'Transaction timestamp is required' });
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
            return res.status(404).json({ message: 'error_delete_transaction' });
        }

        // 2. Revert the stock change
        const sizeMatch = tx.itemName.match(/\(([^)]+)\)$/);
        const size = sizeMatch ? sizeMatch[1] : null;

        if (!size || !inventory[tx.itemCode] || !inventory[tx.itemCode][size]) {
            console.error(`Could not find inventory item for ${tx.itemCode} (${size}) to revert stock.`);
            return res.status(500).json({ message: 'error_item_not_found_in_inventory' });
        }

        // 3. Revert the stock change
        inventory[tx.itemCode][size].stock -= tx.amount;

        // 4. Remove the transaction from the log
        transactions.splice(transactionIndex, 1);

        // 5. Save both files
        saveFile(INVENTORY_PATH, inventory);
        saveFile(TRANSACTIONS_PATH, transactions);

        res.status(200).json({ success: true, message: 'Transaction deleted and stock reverted.' });

    } catch (err) {
        console.error('Error deleting transaction:', err);
        res.status(500).json({ message: 'Server error deleting transaction' });
    }
});

// --- 6. Start the Server ---
app.listen(PORT, () => {
    console.log(`Inventory server running on http://localhost:${PORT}`);
});