import { addProduct } from './_api.js';

const addForm = document.getElementById('addProductForm');
const productNameInput = document.getElementById('productName');
const principalCode = document.getElementById('principalCode');
const typeCode = document.getElementById('typeCode');
const resultDiv = document.getElementById('result');
const resultName = document.getElementById('resultName');
const newBarcodeDisplay = document.getElementById('newBarcodeDisplay');
const errorMessage = document.getElementById('errorMessage');
const saveButton = document.getElementById('saveButton');
const tempCanvas = document.getElementById('tempCanvas');
let currentBarcodeValue = '';

addForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    resultDiv.style.display = 'none';
    errorMessage.textContent = '';

    const productData = {
        productName: productNameInput.value, // Use renamed variable
        principalCode: principalCode.value,
        typeCode: typeCode.value
    };

    try {
        const result = await addProduct(productData);


        resultName.textContent = result.name;
        currentBarcodeValue = result.barcode;

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

    } catch (err) {
        console.error('Error creating product:', err);
        errorMessage.textContent = 'Error: ' + err.message;
        resultDiv.style.display = 'block'; // Show error in result div
    }
});

saveButton.addEventListener('click', function() {
    try {
        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(newBarcodeDisplay);
        const ctx = tempCanvas.getContext('2d');
        const img = new Image();

        img.onload = function() {
            const barcodeWidth = (currentBarcodeValue.length * 11 + 35) * 2; // Rough EAN13 estimate
            const barcodeHeight = 100;
            const margin = 10;
            tempCanvas.width = barcodeWidth + margin * 2;
            tempCanvas.height = barcodeHeight + 18 + margin * 2; // Include text height
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height); // White background
            ctx.drawImage(img, 0, 0); // Draw barcode
            const downloadLink = document.createElement('a');
            downloadLink.href = tempCanvas.toDataURL('image/png');
            downloadLink.download = `${currentBarcodeValue}.png`;
            downloadLink.click();
        };
        img.src = 'data:image/svg+xml;base64,' + window.btoa(svgString);

    } catch (e) {
        console.error("Error saving barcode PNG:", e);
        errorMessage.textContent = "Could not save PNG. " + e.message;
        resultDiv.style.display = 'block'; // Show error
    }
});