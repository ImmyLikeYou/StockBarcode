import { loadData, getRouteHref } from './_api.js';

const itemTableBody = document.getElementById('itemTableBody');
const tempCanvas = document.getElementById('tempCanvas');

function saveBarcodeAsPng(barcodeValue) { /* ... same PNG generation logic as before ... */
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
        JsBarcode(tempSvg, barcodeValue, { format: "EAN13", displayValue: true, text: barcodeValue, fontSize: 18, width: 2, height: 100, margin: 10 });
        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(tempSvg);
        const ctx = tempCanvas.getContext('2d');
        const img = new Image();
        img.onload = function() {
            const barcodeWidth = (barcodeValue.length * 11 + 35) * 2;
            const barcodeHeight = 100;
            const margin = 10;
            tempCanvas.width = barcodeWidth + margin * 2;
            tempCanvas.height = barcodeHeight + 18 + margin * 2;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            ctx.drawImage(img, 0, 0);
            const downloadLink = document.createElement('a');
            downloadLink.href = tempCanvas.toDataURL('image/png');
            downloadLink.download = `${barcodeValue}.png`;
            downloadLink.click();
        };
        img.src = 'data:image/svg+xml;base64,' + window.btoa(svgString);
    } catch (e) {
        console.error("Error generating barcode PNG:", e);
        alert("Could not generate barcode PNG: " + e.message);
    }
}

async function loadProductData() {
    try {
        const data = await loadData();
        const products = data.products;

        itemTableBody.innerHTML = '';

        for (const barcode in products) {
            const productName = products[barcode];
            const newRow = document.createElement('tr');

            const barcodeCell = document.createElement('td');
            barcodeCell.textContent = barcode;
            barcodeCell.className = 'barcode-cell';
            const nameCell = document.createElement('td');
            nameCell.textContent = productName;

            const downloadCell = document.createElement('td');
            downloadCell.className = 'download-cell';
            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = 'PNG';
            downloadBtn.className = 'download-btn';
            downloadBtn.dataset.barcode = barcode;
            downloadBtn.addEventListener('click', (event) => { saveBarcodeAsPng(event.target.dataset.barcode); });
            downloadCell.appendChild(downloadBtn);
            const editCell = document.createElement('td');
            editCell.className = 'edit-cell';
            const editLink = document.createElement('a');
            editLink.setAttribute('href', getRouteHref(`/edit-product/${barcode}`));
            editLink.textContent = 'Edit';
            editLink.className = 'edit-btn';
            editCell.appendChild(editLink);
            const historyCell = document.createElement('td');
            historyCell.className = 'history-cell';
            const historyLink = document.createElement('a');
            historyLink.setAttribute('href', getRouteHref(`/item-history/${barcode}`));
            historyLink.textContent = 'History';
            historyLink.className = 'history-btn';
            historyCell.appendChild(historyLink);

            newRow.appendChild(barcodeCell);
            newRow.appendChild(nameCell);
            newRow.appendChild(downloadCell);
            newRow.appendChild(editCell);
            newRow.appendChild(historyCell);
            itemTableBody.appendChild(newRow);
        }

    } catch (err) {
        console.error('Error loading product data:', err);
        itemTableBody.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center;">Error loading products.</td></tr>`;
    }
}
loadProductData();