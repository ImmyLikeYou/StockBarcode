// edit_product.js
import { getProduct, updateProduct, loadData } from './_api.js';
import { navigateTo, getRouteParams } from './route_handler.js';
import { initializeI18n, setLanguage, t, parseError } from './i18n.js';

// --- MODIFIED: Add new sizes to match your list ---
const ALL_SIZES = ["F", "M", "L", "XL", "2L", "3L", "4L", "5L", "6L", "3XL", "4XL", "5XL", "6XL"];

const editForm = document.getElementById('editProductForm');
const productBarcodeEl = document.getElementById('productBarcode');
const productNameInput = document.getElementById('productName');
const defaultCostInput = document.getElementById('defaultCost');
const sizeCostGridContainer = document.getElementById('size-cost-grid-container');
const messageDiv = document.getElementById('message');

const routeParams = getRouteParams();
const productBarcodeValue = routeParams.barcode; // This is the correct barcode variable

/**
 * Loads product details and inventory costs
 */
async function loadProductDetails(barcode) {
    if (!barcode) {
        showMessage(t('error_no_barcode'), 'error');
        editForm.style.display = 'none';
        return;
    }

    try {
        const [productData, allData] = await Promise.all([
            getProduct(barcode),
            loadData()
        ]);

        const inventoryData = allData.inventory[barcode] || {};

        // 1. Populate main product fields
        productBarcodeEl.value = productBarcodeValue;
        productNameInput.value = productData.name;
        defaultCostInput.value = productData.default_cost || 0;

        // 2. Dynamically create and populate size-cost inputs
        sizeCostGridContainer.innerHTML = ''; // Clear any placeholders
        for (const size of ALL_SIZES) {
            // Get the specific cost for this size, or the default cost if it's not set
            const currentCost = (inventoryData[size] && inventoryData[size].cost !== undefined) ?
                inventoryData[size].cost :
                productData.default_cost || 0;

            const item = document.createElement('div');
            item.className = 'size-cost-item';

            const label = document.createElement('label');
            label.htmlFor = `cost-${size}`;
            label.textContent = `${size} Cost:`; // (This label can be translated later if needed)

            const input = document.createElement('input');
            input.type = 'number';
            input.id = `cost-${size}`;
            input.dataset.size = size; // Store the size
            input.value = currentCost;
            input.min = '0';
            input.step = '0.01';

            item.appendChild(label);
            item.appendChild(input);
            sizeCostGridContainer.appendChild(item);
        }

    } catch (err) {
        console.error('Error loading product details:', err);
        const { key, context } = parseError(err);
        showMessage(t(key, context), 'error');
        editForm.style.display = 'none';
    }
}

/**
 * Handle form submission
 */
editForm.addEventListener('submit', async(event) => {
    event.preventDefault();
    messageDiv.style.display = 'none';

    const barcode = productBarcodeEl.value.trim();
    const newName = productNameInput.value.trim();
    const newDefaultCost = parseFloat(defaultCostInput.value) || 0;

    if (!barcode || !newName) {
        showMessage(t('error_name_empty'), 'error');
        return;
    }

    // --- Gather all size costs ---
    const sizeCosts = {};
    const sizeInputs = sizeCostGridContainer.querySelectorAll('input[data-size]');
    sizeInputs.forEach(input => {
        const size = input.dataset.size;
        sizeCosts[size] = parseFloat(input.value) || 0;
    });

    try {
        await updateProduct({
            barcode: barcode,
            productName: newName,
            default_cost: newDefaultCost,
            sizeCosts: sizeCosts
        });

        showMessage(t('success_product_updated'), 'success');
        setTimeout(() => {
            navigateTo('/item-list');
        }, 1500);
    } catch (err) {
        console.error('Error updating product:', err);
        const { key, context } = parseError(err);
        showMessage(t(key, context), 'error');
    }
});

// --- Message helper ---
function showMessage(msg, type) {
    messageDiv.textContent = msg;
    messageDiv.className = type;
    messageDiv.style.display = 'block';
}

// --- Language Switcher Listeners ---
const langEnButton = document.getElementById('lang-en');
if (langEnButton) {
    langEnButton.addEventListener('click', () => setLanguage('en'));
}

const langThButton = document.getElementById('lang-th');
if (langThButton) {
    langThButton.addEventListener('click', () => setLanguage('th'));
}

// --- Run on startup ---
async function initializeApp() {
    await initializeI18n();
    loadProductDetails(productBarcodeValue);
}

initializeApp();