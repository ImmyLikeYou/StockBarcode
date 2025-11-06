import { loadData, getCategories } from './_api.js'; // Import getCategories
import { initializeI18n, setLanguage, t, parseError } from './i18n.js';

const reportTableBody = document.getElementById('reportTableBody');
const inventorySummaryTableBody = document.getElementById('inventorySummaryTableBody');

// --- NEW: Filter elements ---
const summaryFilterCategory = document.getElementById('summaryFilterCategory');
const summarySearchInput = document.getElementById('summarySearchInput');
const summaryClearButton = document.getElementById('summaryClearButton');
const summaryExportButton = document.getElementById('summaryExportButton'); // New Export Button

// --- NEW: Store for all data ---
let allCategories = {};
let fullReportData = [];
let currentFilteredReportData = []; // Store filtered data for export

/**
 * Renders the "Inventory Value Summary" table based on the current filters.
 */
function renderInventorySummaryReport() {
    if (!inventorySummaryTableBody) return;

    const filterType = summaryFilterCategory.value;
    const searchTerm = summarySearchInput.value.toLowerCase();

    // 1. Filter the data
    const filteredData = fullReportData.filter(item => {
        if (!searchTerm) return true; // No search term, show all

        if (filterType === 'all') {
            return item.name.toLowerCase().includes(searchTerm) ||
                item.size.toLowerCase().includes(searchTerm) ||
                item.categoryName.toLowerCase().includes(searchTerm);
        }
        if (filterType === 'name') {
            return item.name.toLowerCase().includes(searchTerm);
        }
        if (filterType === 'size') {
            return item.size.toLowerCase().includes(searchTerm);
        }
        // Check if filterType is a category ID (e.g., "cat_12345")
        if (filterType.startsWith('cat_')) {
            return item.categoryId === filterType &&
                (item.name.toLowerCase().includes(searchTerm) ||
                    item.size.toLowerCase().includes(searchTerm));
        }
        return false;
    });

    // --- NEW: Store filtered data for export ---
    currentFilteredReportData = filteredData;

    // 2. Render the table
    inventorySummaryTableBody.innerHTML = '';
    let grandTotalValue = 0;
    // REMOVED grandTotalRevenue and grandTotalProfit

    if (filteredData.length === 0) {
        // UPDATED: Colspan is now 5
        inventorySummaryTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">${t('reports_no_data')}</td></tr>`;
        return;
    }

    filteredData.forEach(item => {
        grandTotalValue += item.totalValue;

        const row = document.createElement('tr');
        // UPDATED: Removed revenue/profit cells
        row.innerHTML = `
            <td>${item.categoryName}</td>
            <td>${item.name} (${item.size})</td>
            <td style="text-align: right;">${item.stock}</td>
            <td style="text-align: right;">${item.cost.toFixed(2)}</td>
            <td style="text-align: right;">${item.totalValue.toFixed(2)}</td> 
        `;
        inventorySummaryTableBody.appendChild(row);
    });

    // 3. Add footer row for Grand Total
    let footer = inventorySummaryTableBody.parentNode.querySelector('tfoot');
    if (!footer) {
        footer = document.createElement('tfoot');
        inventorySummaryTableBody.parentNode.appendChild(footer);
    }
    // UPDATED: Colspan is now 4, removed revenue/profit
    footer.innerHTML = `
        <tr>
            <td colspan="4" style="text-align: right; font-weight: bold;">${t('reports_table_total_value')}:</td>
            <td style="text-align: right; font-weight: bold;">${grandTotalValue.toFixed(2)}</td>
        </tr>
    `;
}


/**
 * Generates the "Inventory Value Summary" data and populates filters.
 */
async function generateInventorySummaryReport() {
    if (!inventorySummaryTableBody) return; // In case element isn't on the page

    try {
        // --- MODIFIED: Load all data including categories ---
        const [data, categories] = await Promise.all([
            loadData(),
            getCategories()
        ]);
        allCategories = categories;
        const inventory = data.inventory || {};
        const products = data.products || {};

        fullReportData = []; // Clear previous data

        // Loop through all barcodes in inventory
        for (const barcode in inventory) {
            const product = products[barcode];
            if (!product) continue; // Skip if product doesn't exist

            const productName = product.name;
            const categoryId = product.category_id || 'cat_0';
            const categoryName = allCategories[categoryId] || 'N/A';
            // REMOVED salesPrice
            const sizes = inventory[barcode];

            // Loop through all sizes for that barcode
            for (const size in sizes) {
                const stockData = sizes[size];
                const stock = stockData.stock || 0;
                const cost = stockData.cost || 0;
                const totalValue = stock * cost;
                // REMOVED totalRevenue and totalProfit

                if (stock > 0) { // Only show items that are in stock
                    fullReportData.push({
                        barcode: barcode,
                        name: productName,
                        size: size,
                        stock: stock,
                        cost: cost,
                        totalValue: totalValue,
                        // REMOVED sales_price, totalRevenue, totalProfit
                        categoryId: categoryId,
                        categoryName: categoryName
                    });
                }
            }
        }

        // Sort by item name
        fullReportData.sort((a, b) => a.name.localeCompare(b.name));

        // --- NEW: Populate category dropdown ---
        populateCategoryFilter();

        // --- MODIFIED: Call the render function ---
        renderInventorySummaryReport();

    } catch (err) {
        console.error('Error generating inventory summary report:', err);
        const { key, context } = parseError(err);
        // UPDATED: Colspan is now 5
        inventorySummaryTableBody.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center;">${t(key, context) || t('error_generating_report')}</td></tr>`;
    }
}

/**
 * --- NEW: Populates the category filter dropdown ---
 */
function populateCategoryFilter() {
    // Clear existing category options (but keep All, Name, Size)
    while (summaryFilterCategory.options.length > 3) {
        summaryFilterCategory.remove(3);
    }

    // Add an option group for categories
    const optGroup = document.createElement('optgroup');
    optGroup.label = t('nav_categories'); // "Categories"

    const sortedCategories = Object.entries(allCategories)
        .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));

    sortedCategories.forEach(([id, name]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        optGroup.appendChild(option);
    });
    summaryFilterCategory.appendChild(optGroup);
}

/**
 * --- NEW: Exports the summary table to CSV ---
 */
function exportSummaryToCsv() {
    if (currentFilteredReportData.length === 0) {
        alert(t('transactions_no_export_data'));
        return;
    }

    // UPDATED: Removed sales/profit headers
    const headers = [
        "barcode",
        "product_name",
        "size",
        "category_id",
        "category_name",
        "current_stock",
        "cost_each",
        "total_value"
    ];
    const csvRows = [headers.join(",")];

    // Function to ensure CSV cell is safe
    const escapeCsvCell = (cell) => {
        const strCell = String(cell);
        if (strCell.includes(',')) {
            return `"${strCell.replace(/"/g, '""')}"`;
        }
        return strCell;
    };

    let grandTotalValue = 0;

    // Use the *currently filtered* data
    currentFilteredReportData.forEach(item => {
        grandTotalValue += item.totalValue;

        // UPDATED: Removed sales/profit values
        const values = [
            item.barcode,
            escapeCsvCell(item.name),
            escapeCsvCell(item.size),
            item.categoryId,
            escapeCsvCell(item.categoryName),
            item.stock,
            item.cost.toFixed(2),
            item.totalValue.toFixed(2)
        ];
        csvRows.push(values.join(","));
    });

    // UPDATED: Simplified footer
    csvRows.push(""); // Blank line
    csvRows.push(`,,,,,,${t('reports_table_total_value')}:,${grandTotalValue.toFixed(2)}`);

    // Add the UTF-8 BOM character
    const csvString = "\uFEFF" + csvRows.join("\n");

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "inventory_value_summary.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

// --- NEW: Add event listeners for filters ---
summarySearchInput.addEventListener('input', renderInventorySummaryReport);
summaryFilterCategory.addEventListener('change', renderInventorySummaryReport);
summaryClearButton.addEventListener('click', () => {
    summarySearchInput.value = '';
    summaryFilterCategory.value = 'all';
    renderInventorySummaryReport();
});
// --- NEW: Add event listener for export ---
summaryExportButton.addEventListener('click', exportSummaryToCsv);


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
    generateInventorySummaryReport(); // This now builds the data and renders the table
}

initializeApp();