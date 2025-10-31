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
 * Load all categories
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
 * Add a new category
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

// --- NEW: Update Category ---
/**
 * Update an existing category.
 * @param {string} id - The ID of the category to update (e.g., "cat_123")
 * @param {string} newName - The new name for the category
 * @returns {Promise<{id: string, name: string}>}
 */
export async function updateCategory(id, newName) {
    if (hasElectronAPI && window.electronAPI.updateCategory) {
        return await window.electronAPI.updateCategory({ id, newName });
    }
    const resp = await fetch(`/api/category/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName })
    });
    if (!resp.ok) {
        const errObj = await resp.json().catch(() => ({}));
        const err = new Error(errObj.message || 'Server error updating category');
        err.serverResponse = errObj;
        throw err;
    }
    return await resp.json();
}

// --- NEW: Delete Category ---
/**
 * Delete a category.
 * @param {string} id - The ID of the category to delete
 * @returns {Promise<Object>}
 */
export async function deleteCategory(id) {
    if (hasElectronAPI && window.electronAPI.deleteCategory) {
        return await window.electronAPI.deleteCategory({ id });
    }
    const resp = await fetch(`/api/category/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
    if (!resp.ok) {
        const errObj = await resp.json().catch(() => ({}));
        const err = new Error(errObj.message || 'Server error deleting category');
        err.serverResponse = errObj;
        throw err;
    }
    return await resp.json();
}

/**
 * Process a transaction (add/cut/adjust stock).
 * @param {Object} payload - The transaction details
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
 * @returns {Promise<Object>} The full product object
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
 * Update a product's details and size-specific costs.
 * @param {Object} payload - The update details
 * @returns {Promise<void>}
 */
export async function updateProduct(payload) {
    if (hasElectronAPI && window.electronAPI.updateProduct) {
        return await window.electronAPI.updateProduct(payload);
    }

    const resp = await fetch(`/api/product/${encodeURIComponent(payload.barcode)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

    const routeMap = {
        '/': 'barcode_receiver.html',
        '/add-product': 'add_product.html',
        '/edit-product': 'edit_product.html',
        '/item-list': 'item_list.html',
        '/item-history': 'item_history.html',
        '/transactions': 'transactions.html',
        '/reports': 'reports.html',
        '/categories': 'categories.html'
    };

    if (route.startsWith('/edit-product/')) {
        const barcode = route.split('/').pop();
        return `edit_product.html?barcode=${encodeURIComponent(barcode)}`;
    }
    if (route.startsWith('/item-history/')) {
        const barcode = route.split('/').pop();
        return `item_history.html?barcode=${encodeURIComponent(barcode)}`;
    }

    const base = route.split('?')[0].replace(/\/$/, '');
    return routeMap[base] || route;
}

/**
 * Parse a barcode from URL, supporting query params, pathname segments, and hash.
 * @returns {string|null} Extracted barcode or null if not found
 */
export function getBarcodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    let bc = params.get('barcode');
    if (bc) return bc;

    const path = window.location.pathname || '';
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 0) {
        const last = parts[parts.length - 1];
        if (!last.match(/^(edit-product|item-history)(\.html)?$/i)) {
            return last;
        }
    }

    if (window.location.hash) {
        return window.location.hash.replace('#', '');
    }

    return null;
}

/**
 * --- NEW: Delete a single transaction. ---
 * @param {string} timestamp - The ISO timestamp of the transaction to delete.
 * @returns {Promise<Object>}
 */
export async function deleteTransaction(timestamp) {
    if (hasElectronAPI && window.electronAPI.deleteTransaction) {
        return await window.electronAPI.deleteTransaction({ timestamp });
    }
    const resp = await fetch(`/api/transaction/${encodeURIComponent(timestamp)}`, {
        method: 'DELETE'
    });
    if (!resp.ok) {
        const errObj = await resp.json().catch(() => ({}));
        const err = new Error(errObj.message || 'Server error deleting transaction');
        err.serverResponse = errObj;
        throw err;
    }
    return await resp.json();
}