// edit_product.js
import { getProduct, updateProduct } from './_api.js';
import { navigateTo, getRouteParams } from './route_handler.js';
// 1. Import i18n functions - THE FIX IS HERE (added parseError)
import { initializeI18n, setLanguage, t, parseError } from './i18n.js';

const editForm = document.getElementById('editProductForm');
const productBarcodeEl = document.getElementById('productBarcode');
const productNameInput = document.getElementById('productName');
const messageDiv = document.getElementById('message');

const routeParams = getRouteParams();
const productBarcodeValue = routeParams.barcode;

// --- Load product details on page load ---
async function loadProductDetails(barcode) {
    if (!barcode) {
        showMessage(t('error_no_barcode'), 'error');
        editForm.style.display = 'none';
        return;
    }

    try {
        const productData = await getProduct(barcode);
        productBarcodeEl.value = productData.barcode;
        productNameInput.value = productData.name;
    } catch (err) {
        console.error('Error loading product details:', err);
        // This block will now work because parseError is imported
        const { key, context } = parseError(err);
        showMessage(t(key, context), 'error');
        editForm.style.display = 'none';
    }
}

// --- Handle form submission ---
editForm.addEventListener('submit', async(event) => {
    event.preventDefault();
    messageDiv.style.display = 'none';

    const barcode = productBarcodeEl.value.trim();
    const newName = productNameInput.value.trim();

    if (!barcode || !newName) {
        showMessage(t('error_name_empty'), 'error');
        return;
    }

    try {
        await updateProduct({ barcode, productName: newName });
        showMessage(t('success_product_updated'), 'success');
        setTimeout(() => {
            navigateTo('/item-list');
        }, 1500);
    } catch (err) {
        console.error('Error updating product:', err);
        // This block will also now work
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