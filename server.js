// --- 1. Setup ---
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises; // <-- Use promises-based fs
const path = require('path');
const os = require('os');
const app = express();
const PORT = 3001;
const APP_NAME = 'BarcodeInventorySystem';

// --- 2. File Paths (Must be resolved before async routes) ---
// We use sync methods here ONLY to set up initial paths.
// All route handling will use async.
function getSyncAppDataPath() {
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

function getSyncDataFilePath(filename) {
    const localDataDir = path.join(__dirname, 'app-data');
    if (require('fs').existsSync(localDataDir)) {
        return path.join(localDataDir, filename);
    }
    const appDataDir = getSyncAppDataPath();
    const dataDir = path.join(appDataDir, 'app-data');
    if (!require('fs').existsSync(dataDir)) {
        require('fs').mkdirSync(dataDir, {
            recursive: true
        });
        console.log(`Created application data directory: ${dataDir}`);
    }
    return path.join(dataDir, filename);
}

const INVENTORY_PATH = getSyncDataFilePath('inventory.json');
const TRANSACTIONS_PATH = getSyncDataFilePath('transactions.json');
const PRODUCTS_PATH = getSyncDataFilePath('products.json');
const CATEGORIES_PATH = getSyncDataFilePath('categories.json');

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

// --- 4. Helper Functions (Async) ---

async function ensureFileExists(filePath, defaultContent) { // <-- Make async
    try {
        await fs.access(filePath);
    } catch {
        console.log(`Creating initial data file: ${filePath}`);
        await fs.writeFile(filePath, defaultContent);
    }
}

async function loadFile(filePath) { // <-- Make async
    try {
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
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return filePath.endsWith('transactions.json') ? [] : {};
    }
}

// --- NEW: Atomic Save Function ---
async function saveFile(filePath, data) { // <-- Make async and atomic
    const tempPath = filePath + ".tmp";
    try {
        await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
        await fs.rename(tempPath, filePath);
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        // If rename fails, try to delete the temp file
        try {
            await fs.unlink(tempPath);
        } catch (unlinkError) {
            console.error(`Error deleting temp file ${tempPath}:`, unlinkError);
        }
    }
}

// --- 5. API Endpoints (Routes) ---

// View Routes (remain synchronous)
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
    res.sendFile(path.join(__dirname, 'frontend', 'item_history.html'));
});
app.get('/edit-product/:barcode', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'edit_product.html'));
});
app.get('/reports', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'reports.html'));
});
app.get('/categories', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'categories.html'));
});


// API Routes (convert to async and use await)
app.put('/api/product/:barcode', async (req, res) => { // <-- async
    try {
        const {
            barcode
        } = req.params;
        // REMOVED sales_price
        const {
            productName,
            default_cost,
            sizeCosts
        } = req.body;

        if (!productName) {
            return res.status(400).json({
                message: 'error_name_empty'
            });
        }

        const products = await loadFile(PRODUCTS_PATH); // <-- await
        const inventory = await loadFile(INVENTORY_PATH); // <-- await

        if (!products[barcode]) {
            return res.status(404).json({
                message: 'error_product_not_found'
            });
        }

        products[barcode].name = productName;
        products[barcode].default_cost = parseFloat(default_cost) || 0;
        // REMOVED sales_price

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

        await saveFile(PRODUCTS_PATH, products); // <-- await
        await saveFile(INVENTORY_PATH, inventory); // <-- await

        res.status(200).json({
            message: 'Product updated successfully',
            updatedProduct: products[barcode]
        });

    } catch (err) {
        console.error("Error updating product:", err);
        res.status(500).json({
            message: 'Server error updating product.'
        });
    }
});

app.get('/api/product/:barcode', async (req, res) => { // <-- async
    try {
        const {
            barcode
        } = req.params;
        const products = await loadFile(PRODUCTS_PATH); // <-- await
        const product = products[barcode];
        if (!product) return res.status(404).json({
            message: 'error_product_not_found'
        });
        res.json(product);
    } catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

app.get('/api/data', async (req, res) => { // <-- async
    try {
        const inventory = await loadFile(INVENTORY_PATH); // <-- await
        const transactions = await loadFile(TRANSACTIONS_PATH); // <-- await
        const products = await loadFile(PRODUCTS_PATH); // <-- await
        res.json({
            inventory,
            transactions,
            products
        });
    } catch (err) {
        console.error('Error loading data:', err);
        res.status(500).json({
            message: 'Error loading data from files.'
        });
    }
});

app.get('/api/categories', async (req, res) => { // <-- async
    try {
        const categories = await loadFile(CATEGORIES_PATH); // <-- await
        res.json(categories);
    } catch (err) {
        console.error('Error loading categories:', err);
        res.status(500).json({
            message: 'Error loading categories.'
        });
    }
});

app.post('/api/category', async (req, res) => { // <-- async
    try {
        const {
            categoryName
        } = req.body;
        if (!categoryName) {
            return res.status(400).json({
                message: 'error_category_name_empty'
            });
        }
        const categories = await loadFile(CATEGORIES_PATH); // <-- await
        const newId = `cat_${Date.now()}`;
        categories[newId] = categoryName;
        await saveFile(CATEGORIES_PATH, categories); // <-- await
        res.status(201).json({
            id: newId,
            name: categoryName
        });
    } catch (err) {
        console.error('Server error creating category:', err);
        res.status(500).json({
            message: 'Server error creating category.'
        });
    }
});

app.put('/api/category/:id', async (req, res) => { // <-- async
    try {
        const {
            id
        } = req.params;
        const {
            newName
        } = req.body;

        if (!newName) {
            return res.status(400).json({
                message: 'error_category_name_empty'
            });
        }
        if (id === 'cat_0') {
            return res.status(403).json({
                message: 'error_category_delete_default'
            });
        }

        const categories = await loadFile(CATEGORIES_PATH); // <-- await
        if (!categories[id]) {
            return res.status(404).json({
                message: 'Category not found'
            });
        }

        categories[id] = newName;
        await saveFile(CATEGORIES_PATH, categories); // <-- await
        res.status(200).json({
            id,
            name: newName
        });
    } catch (err) {
        console.error('Server error updating category:', err);
        res.status(500).json({
            message: 'Server error updating category'
        });
    }
});

app.delete('/api/category/:id', async (req, res) => { // <-- async
    try {
        const {
            id
        } = req.params;
        if (id === 'cat_0') {
            return res.status(403).json({
                message: 'error_category_delete_default'
            });
        }

        const categories = await loadFile(CATEGORIES_PATH); // <-- await
        const products = await loadFile(PRODUCTS_PATH); // <-- await

        if (!categories[id]) {
            return res.status(404).json({
                message: 'Category not found'
            });
        }

        delete categories[id];

        for (const barcode in products) {
            if (products[barcode].category_id === id) {
                products[barcode].category_id = 'cat_0'; // Re-assign to Default
            }
        }

        await saveFile(CATEGORIES_PATH, categories); // <-- await
        await saveFile(PRODUCTS_PATH, products); // <-- await

        res.status(200).json({
            success: true,
            message: 'Category deleted and products reassigned.'
        });
    } catch (err) {
        console.error('Server error deleting category:', err);
        res.status(500).json({
            message: 'Server error deleting category'
        });
    }
});

app.post('/api/product', async (req, res) => { // <-- async
    try {
        // REMOVED sales_price
        const {
            productName,
            principalCode,
            typeCode,
            category_id,
            default_cost
        } = req.body;
        if (!productName || !principalCode || !typeCode || principalCode.length !== 4 || typeCode.length !== 4) {
            return res.status(400).json({
                message: 'error_invalid_data'
            });
        }

        const products = await loadFile(PRODUCTS_PATH); // <-- await
        const inventory = await loadFile(INVENTORY_PATH); // <-- await
        const newId = (Object.keys(products).length + 1).toString().padStart(4, '0');
        const newBarcode = `${principalCode}${typeCode}${newId}`;

        if (products[newBarcode]) {
            return res.status(500).json({
                message: 'error_barcode_collision'
            });
        }

        products[newBarcode] = {
            name: productName,
            category_id: category_id || 'cat_0',
            default_cost: parseFloat(default_cost) || 0
            // REMOVED sales_price
        };
        inventory[newBarcode] = {};

        await saveFile(PRODUCTS_PATH, products); // <-- await
        await saveFile(INVENTORY_PATH, inventory); // <-- await

        res.status(201).json({
            name: productName,
            barcode: newBarcode
        });
    } catch (err) {
        console.error('Server error creating product:', err);
        res.status(500).json({
            message: 'Server error creating product.'
        });
    }
});

app.delete('/api/product/:barcode', async (req, res) => { // <-- async
    try {
        const {
            barcode
        } = req.params;
        const products = await loadFile(PRODUCTS_PATH); // <-- await
        const inventory = await loadFile(INVENTORY_PATH); // <-- await
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
            await saveFile(PRODUCTS_PATH, products); // <-- await
            await saveFile(INVENTORY_PATH, inventory); // <-- await
            res.status(200).json({
                message: 'Product deleted successfully'
            });
        } else {
            res.status(404).json({
                message: 'error_product_not_found'
            });
        }
    } catch (err) {
        console.error('Server error deleting product:', err);
        res.status(500).json({
            message: 'Server error deleting product'
        });
    }
});

app.post('/api/transaction', async (req, res) => { // <-- async
    // --- ADD totalSalesPrice ---
    const {
        lookupValue,
        amount,
        mode,
        size,
        totalSalesPrice
    } = req.body;

    if (!lookupValue || isNaN(amount) || !mode || !size ||
        ((mode === 'add' || mode === 'cut') && amount < 1) ||
        (mode === 'adjust' && amount < 0)) {
        return res.status(400).json({
            message: 'error_invalid_data'
        });
    }

    try {
        const inventory = await loadFile(INVENTORY_PATH); // <-- await
        const transactions = await loadFile(TRANSACTIONS_PATH); // <-- await
        const products = await loadFile(PRODUCTS_PATH); // <-- await

        const product = products[lookupValue];
        const itemName = product ? product.name : "Unknown Item";

        if (!inventory.hasOwnProperty(lookupValue)) {
            return res.status(404).json({
                message: 'error_item_not_found',
                context: {
                    itemCode: lookupValue
                }
            });
        }

        if (!inventory[lookupValue].hasOwnProperty(size)) {
            const defaultCost = (product && product.default_cost) ? product.default_cost : 0;
            if (mode === 'add' || mode === 'adjust') {
                inventory[lookupValue][size] = {
                    stock: 0,
                    cost: defaultCost
                };
            } else {
                return res.status(404).json({
                    message: 'error_size_not_found',
                    context: {
                        size: size,
                        item: itemName
                    }
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
                    context: {
                        item: `${itemName} (${size})`,
                        stock: currentStock
                    }
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

        // --- ADD salesPrice logic ---
        // Only save a sales price if it was a 'Cut' transaction
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
            newStock: newStock,
            cost: newCost,
            totalCost: totalCost,
            totalSales: finalSalesPrice // <-- ADD THIS
        };
        transactions.push(newTransaction);

        await saveFile(INVENTORY_PATH, inventory); // <-- await
        await saveFile(TRANSACTIONS_PATH, transactions); // <-- await

        let message = `OK: ${logType} ${amount} ${itemName} (${size}). New stock: ${newStock}`;
        if (mode === 'adjust') {
            message = `OK: ${logType} ${itemName} (${size}) stock to ${newStock}.`;
        }

        res.status(200).json({
            message: message,
            newTransaction: newTransaction,
            updatedItem: {
                itemCode: lookupValue,
                size: size,
                newStockLevel: newStock,
                newCost: newCost
            }
        });
    } catch (err) {
        console.error('Error processing transaction:', err);
        res.status(500).json({
            message: 'Error processing transaction'
        });
    }
});

app.delete('/api/log', async (req, res) => { // <-- async
    try {
        await saveFile(TRANSACTIONS_PATH, []); // <-- await
        res.status(200).json({
            message: 'Transaction log cleared'
        });
    } catch (err) {
        console.error('Error clearing log:', err);
        res.status(500).json({
            message: 'Error clearing log'
        });
    }
});

app.delete('/api/transaction/:timestamp', async (req, res) => { // <-- async
    try {
        const {
            timestamp
        } = req.params;
        if (!timestamp) {
            return res.status(400).json({
                message: 'Transaction timestamp is required'
            });
        }

        const transactions = await loadFile(TRANSACTIONS_PATH); // <-- await
        const inventory = await loadFile(INVENTORY_PATH); // <-- await

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
            return res.status(404).json({
                message: 'error_delete_transaction'
            });
        }

        const sizeMatch = tx.itemName.match(/\(([^)]+)\)$/);
        const size = sizeMatch ? sizeMatch[1] : null;

        if (!size || !inventory[tx.itemCode] || !inventory[tx.itemCode][size]) {
            console.error(`Could not find inventory item for ${tx.itemCode} (${size}) to revert stock.`);
            return res.status(500).json({
                message: 'error_item_not_found_in_inventory'
            });
        }

        inventory[tx.itemCode][size].stock -= tx.amount;
        transactions.splice(transactionIndex, 1);

        await saveFile(INVENTORY_PATH, inventory); // <-- await
        await saveFile(TRANSACTIONS_PATH, transactions); // <-- await

        res.status(200).json({
            success: true,
            message: 'Transaction deleted and stock reverted.'
        });

    } catch (err) {
        console.error('Error deleting transaction:', err);
        res.status(500).json({
            message: 'Server error deleting transaction'
        });
    }
});

// --- 6. Start the Server ---
// We must ensure the files exist before starting the server.
async function startServer() {
    await ensureFileExists(INVENTORY_PATH, '{}');
    await ensureFileExists(TRANSACTIONS_PATH, '[]');
    await ensureFileExists(PRODUCTS_PATH, '{}');
    await ensureFileExists(CATEGORIES_PATH, '{"cat_0": "Default"}');

    app.listen(PORT, () => {
        console.log(`Inventory server running on http://localhost:${PORT}`);
    });
}

startServer();