import { addProduct, getCategories } from './_api.js';
import { initializeI18n, setLanguage, t, parseError } from './i18n.js';

/**
 * Loads categories into the dropdown.
 * We pass the elements as arguments because this runs inside initializeApp.
 */
async function loadCategories(categorySelect, errorMessage) {
    try {
        const categories = await getCategories();
        categorySelect.innerHTML = '';

        const sortedCategories = Object.entries(categories)
            .filter(([id, name]) => id !== 'cat_0')
            .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));

        if (categories['cat_0']) {
            sortedCategories.unshift(['cat_0', categories['cat_0']]);
        }

        for (const [id, name] of sortedCategories) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            categorySelect.appendChild(option);
        }
    } catch (err) {
        console.error('Error loading categories:', err);
        const { key, context } = parseError(err);
        errorMessage.textContent = t(key, context);
    }
}


/**
 * Main function to set up the page.
 */
async function initializeApp() {
    // 1. Wait for translations to load (this also waits for DOMContentLoaded)
    await initializeI18n();

    // 2. NOW it's safe to get all elements
    const addForm = document.getElementById('addProductForm');
    const productNameInput = document.getElementById('productName');
    const principalCode = document.getElementById('principalCode');
    const typeCode = document.getElementById('typeCode');
    const categorySelect = document.getElementById('productCategory');
    const defaultCostInput = document.getElementById('defaultCost');
    const resultDiv = document.getElementById('result');
    const resultName = document.getElementById('resultName');
    const newBarcodeDisplay = document.getElementById('newBarcodeDisplay');
    const errorMessage = document.getElementById('errorMessage');
    const saveButton = document.getElementById('saveButton');
    const tempCanvas = document.getElementById('tempCanvas');
    let currentBarcodeValue = ''; // This variable will be "closed over" by the listeners

    // 3. Load categories into the dropdown
    await loadCategories(categorySelect, errorMessage);

    // 4. Attach all event listeners
    addForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        resultDiv.style.display = 'none';
        errorMessage.textContent = '';

        const productData = {
            productName: productNameInput.value,
            principalCode: principalCode.value,
            typeCode: typeCode.value,
            category_id: categorySelect.value,
            default_cost: parseFloat(defaultCostInput.value) || 0
        };

        try {
            const result = await addProduct(productData);

            resultName.textContent = result.name;
            currentBarcodeValue = result.barcode; // Set the shared variable

            JsBarcode(newBarcodeDisplay, currentBarcodeValue, {
                format: "EAN13",
                displayValue: true,
                text: currentBarcodeValue,
                fontSize: 18,
                width: 2,
                height: 100,
                margin: 10
            });

            resultDiv.style.display = 'block';
            addForm.reset();
            categorySelect.value = 'cat_0';
            defaultCostInput.value = '0';

        } catch (err) {
            console.error('Error creating product:', err);
            const { key, context } = parseError(err);
            errorMessage.textContent = t(key, context);
            resultDiv.style.display = 'block';
        }
    });

    saveButton.addEventListener('click', function() {
        try {
            const serializer = new XMLSerializer();
            let svgString = serializer.serializeToString(newBarcodeDisplay);
            const ctx = tempCanvas.getContext('2d');
            const img = new Image();

            img.onload = function() {
                const barcodeWidth = (currentBarcodeValue.length * 11 + 35) * 2;
                const barcodeHeight = 100;
                const margin = 10;
                tempCanvas.width = barcodeWidth + margin * 2;
                tempCanvas.height = barcodeHeight + 18 + margin * 2;
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                ctx.drawImage(img, 0, 0);
                const downloadLink = document.createElement('a');
                downloadLink.href = tempCanvas.toDataURL('image/png');
                downloadLink.download = `${currentBarcodeValue}.png`;
                downloadLink.click();
            };
            img.src = 'data:image/svg+xml;base64,' + window.btoa(svgString);

        } catch (e) {
            console.error("Error saving barcode PNG:", e);
            errorMessage.textContent = t('error_save_png', { message: e.message });
            resultDiv.style.display = 'block';
        }
    });

    // 5. Attach language listeners
    const langEnButton = document.getElementById('lang-en');
    if (langEnButton) {
        langEnButton.addEventListener('click', () => setLanguage('en'));
    }

    const langThButton = document.getElementById('lang-th');
    if (langThButton) {
        langThButton.addEventListener('click', () => setLanguage('th'));
    }
}

// --- Run the initializer ---
initializeApp();