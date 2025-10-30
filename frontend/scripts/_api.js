/**
 * Shared API helper that provides a consistent interface for both Electron IPC and server REST modes.
 * Uses electronAPI (from preload) when available, otherwise falls back to server REST endpoints.
 */

/** @type {boolean} Whether we're running in Electron with IPC available */
const hasElectronAPI = !!(window && window.electronAPI);

/**
 * Load all data (inventory, products, transactions) from main process or server.
 * @returns {Promise<{inventory: Object, products: Object, transactions: Array}>}
 */
export async function loadData() {
    if (hasElectronAPI && window.electronAPI.loadData) {
        return await window.electronAPI.loadData();
    }
    const resp = await fetch('/api/data');
    if (!resp.ok) throw new Error('Failed to fetch data from server');
    return await resp.json();
}

/**
 * --- NEW: Load all categories ---
 * @returns {Promise<Object>} e.g., {"cat_1": "T-Shirts"}
 */
export async function getCategories() {
    if (hasElectronAPI && window.electronAPI.getCategories) {
        return await window.electronAPI.getCategories();
    }
    const resp = await fetch('/api/categories');
    if (!resp.ok) throw new Error('Failed to fetch categories from server');
    return await resp.json();
}

/**
 * --- NEW: Add a new category ---
 * @param {string} categoryName - The name for the new category
 * @returns {Promise<{id: string, name: string}>}
 */
export async function addCategory(categoryName) {
    if (hasElectronAPI && window.electronAPI.addCategory) {
        return await window.electronAPI.addCategory(categoryName);
    }
    const resp = await fetch('/api/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryName })
    });
    if (!resp.ok) {
        const errObj = await resp.json().catch(() => ({}));
        const err = new Error(errObj.message || 'Server error creating category');
        err.serverResponse = errObj;
        throw err;
    }
    return await resp.json();
}


/**
 * Process a transaction (add/cut/adjust stock).
 * @param {Object} payload - The transaction details
 * @param {string} payload.lookupValue - The product barcode
 * @param {number} payload.amount - Amount to add/cut or new stock level for adjust
 * @param {('add'|'cut'|'adjust')} payload.mode - Transaction type
 * @param {string} payload.size - Product size
 * @returns {Promise<{updatedItem: Object, newTransaction: Object, message: string}>}
 */
export async function processTransaction(payload) {
    if (hasElectronAPI && window.electronAPI.processTransaction) {
        return await window.electronAPI.processTransaction(payload);
    }
    const resp = await fetch('/api/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!resp.ok) {
        const errObj = await resp.json().catch(() => ({}));
        const err = new Error(errObj.message || 'Server error processing transaction');
        err.serverResponse = errObj;
        throw err;
    }
    return await resp.json();
}

/**
 * Add a new product.
 * @param {Object} productData - The product details
 * @param {string} productData.productName - Product name/description
 * @param {string} productData.principalCode - First 4 digits of barcode
 * @param {string} productData.typeCode - Next 4 digits of barcode
 * @returns {Promise<{barcode: string, name: string}>}
 */
export async function addProduct(productData) {
    if (hasElectronAPI && window.electronAPI.addProduct) {
        return await window.electronAPI.addProduct(productData);
    }
    const resp = await fetch('/api/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
    });
    if (!resp.ok) {
        const errObj = await resp.json().catch(() => ({}));
        const err = new Error(errObj.message || 'Server error creating product');
        err.serverResponse = errObj;
        throw err;
    }
    return await resp.json();
}

/**
 * Delete a product and its inventory.
 * @param {string} barcode - Product barcode to delete
 * @returns {Promise<void>}
 */
export async function deleteProduct(barcode) {
    if (hasElectronAPI && window.electronAPI.deleteProduct) {
        return await window.electronAPI.deleteProduct(barcode);
    }
    const resp = await fetch(`/api/product/${encodeURIComponent(barcode)}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error('Failed to delete product on server');
}

/**
 * Clear the transaction log.
 * @returns {Promise<void>}
 */
export async function clearLog() {
    if (hasElectronAPI && window.electronAPI.clearLog) {
        return await window.electronAPI.clearLog();
    }
    const resp = await fetch('/api/log', { method: 'DELETE' });
    if (!resp.ok) throw new Error('Failed to clear log on server');
}

/**
 * Get details for a specific product.
 * @param {string} barcode - Product barcode to look up
 * @returns {Promise<{barcode: string, name: string}>}
 */
export async function getProduct(barcode) {
    if (hasElectronAPI && window.electronAPI.getProduct) {
        return await window.electronAPI.getProduct(barcode);
    }
    const resp = await fetch(`/api/product/${encodeURIComponent(barcode)}`);
    if (!resp.ok) {
        const errObj = await resp.json().catch(() => ({}));
        throw new Error(errObj.message || 'Product not found');
    }
    return await resp.json();
}

/**
 * Update a product's details.
 * @param {Object} payload - The update details
 * @param {string} payload.barcode - Product barcode
 * @param {string} payload.productName - New product name/description
 * @returns {Promise<void>}
 */
export async function updateProduct(payload) {
    if (hasElectronAPI && window.electronAPI.updateProduct) {
        return await window.electronAPI.updateProduct(payload);
    }
    const resp = await fetch(`/api/product/${encodeURIComponent(payload.barcode)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: payload.productName })
    });
    if (!resp.ok) {
        const errObj = await resp.json().catch(() => ({}));
        throw new Error(errObj.message || 'Server error updating product');
    }
}

/**
 * Get link href for a route, returning either server route (http) or local file (file://).
 * @param {string} route - Server-style route (e.g., '/item-list' or '/edit-product/123')
 * @returns {string} Protocol-appropriate href value
 */
export function getRouteHref(route) {
    if (location.protocol !== 'file:') return route;

    // Convert kebab-case URLs to snake_case filenames
    const routeMap = {
        '/': 'barcode_receiver.html',
        '/add-product': 'add_product.html',
        '/edit-product': 'edit_product.html',
        '/item-list': 'item_list.html',
        '/item-history': 'item_history.html',
        '/transactions': 'transactions.html',
        '/reports': 'reports.html',
        '/categories': 'categories.html' // --- NEW ---
    };

    // Handle parameterized routes
    if (route.startsWith('/edit-product/')) {
        const barcode = route.split('/').pop();
        return `edit_product.html?barcode=${encodeURIComponent(barcode)}`;
    }
    if (route.startsWith('/item-history/')) {
        const barcode = route.split('/').pop();
        return `item_history.html?barcode=${encodeURIComponent(barcode)}`;
    }

    // Handle basic routes
    const base = route.split('?')[0].replace(/\/$/, '');
    return routeMap[base] || route;
}

/**
 * Parse a barcode from URL, supporting query params, pathname segments, and hash.
 * @returns {string|null} Extracted barcode or null if not found
 */
export function getBarcodeFromUrl() {
    // Try query parameter first
    const params = new URLSearchParams(window.location.search);
    let bc = params.get('barcode');
    if (bc) return bc;

    // Try pathname segment
    const path = window.location.pathname || '';
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 0) {
        const last = parts[parts.length - 1];
        // Skip if last part looks like page name
        if (!last.match(/^(edit-product|item-history)(\.html)?$/i)) {
            return last;
        }
    }

    // Finally try hash
    if (window.location.hash) {
        return window.location.hash.replace('#', '');
    }

    return null;
}