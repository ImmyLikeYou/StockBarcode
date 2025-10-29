// edit_product.js
import { getProduct, updateProduct } from './_api.js';
import { navigateTo, getRouteParams } from './route_handler.js';

const editForm = document.getElementById('editProductForm');
const productBarcodeEl = document.getElementById('productBarcode');
const productNameInput = document.getElementById('productName');
const messageDiv = document.getElementById('message');

const routeParams = getRouteParams();
const productBarcodeValue = routeParams.barcode;

// --- Load product details on page load ---
async function loadProductDetails(barcode) {
    if (!barcode) {
        showMessage('Error: No barcode specified in URL.', 'error');
        editForm.style.display = 'none';
        return;
    }

    try {
        const productData = await getProduct(barcode);
        productBarcodeEl.value = productData.barcode;
        productNameInput.value = productData.name;
    } catch (err) {
        console.error('Error loading product details:', err);
        showMessage('Error: ' + err.message, 'error');
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
        showMessage('Product name cannot be empty.', 'error');
        return;
    }

    try {
        await updateProduct({ barcode, productName: newName });
        showMessage('✅ Product name updated successfully!', 'success');
        setTimeout(() => {
            navigateTo('/item-list');
        }, 1500);
    } catch (err) {
        console.error('Error updating product:', err);
        showMessage('Error: ' + err.message, 'error');
    }
});

// --- Message helper ---
function showMessage(msg, type) {
    messageDiv.textContent = msg;
    messageDiv.className = type;
    messageDiv.style.display = 'block';
}

// --- Run on startup ---
loadProductDetails(productBarcodeValue);