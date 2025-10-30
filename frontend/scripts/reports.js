import { loadData } from './_api.js';
// 1. Import i18n functions
import { initializeI18n, setLanguage, t } from './i18n.js';

const reportTableBody = document.getElementById('reportTableBody');

/**
 * Fetches all data and generates the 'Most Active Items' report.
 */
async function generateMostActiveReport() {
    try {
        const data = await loadData();
        const allTransactions = data.transactions || [];
        const products = data.products || {}; // Get product names

        // 1. Count transactions per itemCode
        const transactionCounts = {}; // { itemCode: count }
        allTransactions.forEach(entry => {
            if (!transactionCounts[entry.itemCode]) {
                transactionCounts[entry.itemCode] = 0;
            }
            transactionCounts[entry.itemCode]++;
        });

        // 2. Convert counts to an array of objects for sorting
        const reportData = [];
        for (const itemCode in transactionCounts) {
            reportData.push({
                barcode: itemCode,
                name: products[itemCode] || `Unknown (${itemCode})`, // Get name or use placeholder
                count: transactionCounts[itemCode]
            });
        }

        // 3. Sort by count, descending (most active first)
        reportData.sort((a, b) => b.count - a.count);

        // 4. Render the table
        renderReportTable(reportData);

    } catch (err) {
        console.error('Error generating report:', err);
        // 2. Use translation key for error
        reportTableBody.innerHTML = `<tr><td colspan="4" style="color: red; text-align: center;">${t('error_generating_report')}</td></tr>`;
    }
}

/**
 * Renders the report table.
 * @param {Array} reportData - Sorted array of {barcode, name, count}.
 */
function renderReportTable(reportData) {
    reportTableBody.innerHTML = ''; // Clear loading message

    if (reportData.length === 0) {
        // 3. Use translation key for empty message
        reportTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">${t('reports_no_data')}</td></tr>`;
        return;
    }

    reportData.forEach((item, index) => {
        const rank = index + 1; // Rank starts at 1

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

// 4. Add language switcher listeners
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
// 5. Create new init function
async function initializeApp() {
    await initializeI18n();
    generateMostActiveReport();
}

initializeApp();