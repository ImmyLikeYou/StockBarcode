import { loadData } from './_api.js';
import { initializeI18n, setLanguage, t, parseError } from './i18n.js';

const reportTableBody = document.getElementById('reportTableBody');
// --- NEW: Get new table body ---
const inventorySummaryTableBody = document.getElementById('inventorySummaryTableBody');


/**
 * NEW: Generates the "Inventory Value Summary" report.
 */
async function generateInventorySummaryReport() {
    if (!inventorySummaryTableBody) return; // In case element isn't on the page

    try {
        const data = await loadData();
        const inventory = data.inventory || {};
        const products = data.products || {};

        const reportData = [];
        let grandTotalValue = 0;

        // Loop through all barcodes in inventory
        for (const barcode in inventory) {
            const productName = products[barcode] ? products[barcode].name : "Unknown";
            const sizes = inventory[barcode];

            // Loop through all sizes for that barcode
            for (const size in sizes) {
                const stockData = sizes[size];
                const stock = stockData.stock || 0;
                const cost = stockData.cost || 0;
                const totalValue = stock * cost;

                if (stock > 0) { // Only show items that are in stock
                    reportData.push({
                        name: `${productName} (${size})`,
                        stock: stock,
                        cost: cost,
                        totalValue: totalValue
                    });
                    grandTotalValue += totalValue;
                }
            }
        }

        // Sort by item name
        reportData.sort((a, b) => a.name.localeCompare(b.name));

        // Render the table
        inventorySummaryTableBody.innerHTML = ''; // Clear loading

        if (reportData.length === 0) {
            inventorySummaryTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">${t('reports_no_data')}</td></tr>`;
            return;
        }

        reportData.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name}</td>
                <td style="text-align: right;">${item.stock}</td>
                <td style="text-align: right;">${item.cost.toFixed(2)}</td>
                <td style="text-align: right;">${item.totalValue.toFixed(2)}</td> 
            `;
            inventorySummaryTableBody.appendChild(row);
        });

        // Add footer row for Grand Total
        let footer = inventorySummaryTableBody.parentNode.querySelector('tfoot');
        if (!footer) {
            footer = document.createElement('tfoot');
            inventorySummaryTableBody.parentNode.appendChild(footer);
        }
        footer.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: right; font-weight: bold;">Grand Total Value:</td>
                <td style="text-align: right; font-weight: bold;">${grandTotalValue.toFixed(2)}</td>
            </tr>
        `;

    } catch (err) {
        console.error('Error generating inventory summary report:', err);
        const { key, context } = parseError(err);
        inventorySummaryTableBody.innerHTML = `<tr><td colspan="4" style="color: red; text-align: center;">${t(key, context) || t('error_generating_report')}</td></tr>`;
    }
}


/**
 * Fetches all data and generates the 'Most Active Items' report.
 */
async function generateMostActiveReport() {
    if (!reportTableBody) return; // Don't run if element isn't here

    try {
        const data = await loadData();
        const allTransactions = data.transactions || [];
        const products = data.products || {};

        if (!Array.isArray(allTransactions)) {
            reportTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">${t('reports_no_data')}</td></tr>`;
            return;
        }

        const transactionCounts = {};
        allTransactions.forEach(entry => {
            if (!transactionCounts[entry.itemCode]) {
                transactionCounts[entry.itemCode] = 0;
            }
            transactionCounts[entry.itemCode]++;
        });

        const reportData = [];
        for (const itemCode in transactionCounts) {
            reportData.push({
                barcode: itemCode,
                name: products[itemCode] ? products[itemCode].name : `Unknown (${itemCode})`, // Use new product structure
                count: transactionCounts[itemCode]
            });
        }

        reportData.sort((a, b) => b.count - a.count);

        renderReportTable(reportData);

    } catch (err) {
        console.error('Error generating report:', err);
        const { key, context } = parseError(err);
        reportTableBody.innerHTML = `<tr><td colspan="4" style="color: red; text-align: center;">${t(key, context) || t('error_generating_report')}</td></tr>`;
    }
}

/**
 * Renders the "Most Active" report table.
 */
function renderReportTable(reportData) {
    reportTableBody.innerHTML = '';

    if (reportData.length === 0) {
        reportTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">${t('reports_no_data')}</td></tr>`;
        return;
    }

    reportData.forEach((item, index) => {
        const rank = index + 1;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${rank}</td>
            <td>${item.name}</td>
            <td>${item.barcode}</td>
            <td>${item.count}</td> 
        `;
        reportTableBody.appendChild(row);
    });
}

// Add language switcher listeners
const langEnButton = document.getElementById('lang-en');
if (langEnButton) {
    langEnButton.addEventListener('click', () => setLanguage('en'));
}
const langThButton = document.getElementById('lang-th');
if (langThButton) {
    langThButton.addEventListener('click', () => setLanguage('th'));
}

// --- Initial Load ---
async function initializeApp() {
    await initializeI18n();
    generateMostActiveReport();
    generateInventorySummaryReport(); // --- NEW: Call the new report function ---
}

initializeApp();