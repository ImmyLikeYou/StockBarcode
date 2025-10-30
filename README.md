# StockBarcode: Barcode Inventory System

StockBarcode is a comprehensive inventory management application built with Electron and Node.js. It allows for tracking stock levels (Add, Cut, Adjust), managing products, and viewing detailed transaction histories.

This application is designed with a hybrid architecture: it can run as a standalone **desktop app** (using Electron) or as a **local web server** (using Express), sharing the same data and frontend logic.

## Features

This application provides a full suite of tools for managing a product inventory.

### 1. Main Inventory Dashboard
The primary interface for daily operations.
* **Live Inventory View:** See a real-time list of all products and their current stock levels, broken down by size (S, M, L, XL, One Size).
* **Barcode Scanning:** A central input field, auto-focused for quick scanning.
* **Transaction Modes:**
    * **Cut Stock:** Decrements stock for a scanned item.
    * **Add Stock:** Increments stock for a scanned item.
    * **Adjust Stock:** Manually sets the stock level for a scanned item to a specific number.
* **Size Selection:** Choose which size (S, M, L, etc.) the transaction should apply to.
* **Quick Log:** See a running list of successful and failed scans from your current session.
* **Full Transaction Log:** View and filter the complete history of all transactions.
* **Product Deletion:** Remove a product (and all its inventory) from the system with a confirmation modal.

### 2. Product Management
* **Add New Products:** A dedicated page to create new items.
    * Assign a "Stock Barcode" (Product Name), a 4-digit "Principal Code", and a 4-digit "Type Code".
    * The system automatically generates a unique 12-digit EAN-13 compliant barcode.
    * A preview of the new barcode is generated on-screen.
* **Download Barcodes:** Save a PNG image of any newly created barcode.

### 3. Item List & History
* **View All Products:** A table listing every product, its name, and its 12-digit barcode.
* **Edit Product:** Update the name ("Stock Barcode") associated with a barcode.
* **Download Barcode PNG:** Download a PNG file for any existing product's barcode.
* **View Item History:** Click "History" on any item to see a dedicated, filterable transaction log just for that single product.

### 4. Full Transaction Log
* **Master Log:** A complete, searchable history of *all* transactions (Add, Cut, Adjust) in the system, sorted by most recent first.
* **Advanced Search & Filter:**
    * Search by **Item Name** (with an autocomplete suggestion box).
    * Filter by **Date**.
    * Filter by **Transaction Type** (Add or Cut).
* **Export to CSV:** Download the currently filtered transaction list as a `.csv` file.
* **Data Visualization:** A bar chart (using Chart.js) shows a visual summary of stock added vs. stock cut per day.

### 5. Reporting
* **Most Active Items:** A simple report page that ranks all products by their total number of transactions, showing you which items are most frequently scanned.

## Technical Architecture

This project uses a clever hybrid architecture to allow it to run as either a desktop app or a web server.

* **Hybrid Backend:**
    1.  **Electron Mode (`main.js`):** When packaged as a desktop app, `main.js` serves as the backend. It uses Electron's `ipcMain` to listen for events from the frontend (e.g., `process-transaction`). It handles all data logic by reading from and writing to JSON files in the user's local app data directory.
    2.  **Web Server Mode (`server.js`):** For development, `server.js` runs an Express.js web server. It creates a REST API (e.g., `POST /api/transaction`) that performs the *exact same logic* as `main.js`, allowing the app to be tested in a standard web browser.

* **Frontend API Controller (`frontend/scripts/_api.js`):**
    This file is the brain of the frontend. It detects which environment it's in:
    * If `window.electronAPI` exists (exposed by `preload.js`), it sends all requests to the Electron backend (`main.js`).
    * If not, it falls back to using standard `fetch` requests for the Express.js REST API (`server.js`).

* **Data Storage:**
    All data is stored in three JSON files: `inventory.json`, `products.json`, and `transactions.json`. This provides a simple, persistent database for the application.

* **Modular Views:**
    The `frontend` is organized by feature, with each page having its own HTML, CSS (`frontend/styles`), and JavaScript (`frontend/scripts`) file, making the project easy to maintain.

## How to Run

### 1. Install Dependencies
```bash
npm install
````

### 2\. Run in Development Mode

This is the recommended way to develop. It starts both the Electron app and the Express web server concurrently.

```bash
npm run dev
```

### 3\. Run Only the Electron App

This will launch the standalone desktop application.

```bash
npm run start
```

### 4\. Run Only the Web Server

This will start the Express.js server, which you can access at `http://localhost:3000`.

```bash
npm run server
```

### 5\. Build the Application

To build the installable desktop application (e.g., `.exe` or `.dmg`), run:

```bash
npm run make
```

The packaged application will be in the `out/` folder.

## Project Structure

Here is a simplified overview of the key files in the project.

```
/
├── frontend/
│   ├── scripts/
│   │   ├── _api.js           # (Controller) Smartly switches between Electron and Web API.
│   │   ├── receiver.js       # (Controller) Logic for the main Inventory page.
│   │   ├── add_product.js    # (Controller) Logic for adding new products.
│   │   ├── item_list.js      # (Controller) Logic for the item list page.
│   │   └── transactions.js   # (Controller) Logic for the full transaction log/chart.
│   │
│   ├── styles/               # (View) CSS files for each page.
│   │   ├── receiver.css
│   │   └── ...
│   │
│   ├── barcode_receiver.html # (View) Main inventory page.
│   ├── add_product.html      # (View) Add new product page.
│   ├── item_list.html        # (View) View all products.
│   ├── transactions.html     # (View) View all transactions.
│   └── reports.html          # (View) Reports page.
│
├── main.js                   # (Model/Backend) The Electron main process. Handles all logic for the desktop app.
├── server.js                 # (Model/Backend) The Express.js web server. Handles all logic for the web version.
├── preload.js                # (Controller) The secure bridge connecting `main.js` to the frontend.
├── package.json              # Project dependencies and scripts.
└── forge.config.js           # Configuration for building the Electron app.
```

```

### Phase 2: Open Your Local README.md File

In your code editor (like VS Code), find and open the `README.md` file that is in the root of your `StockBarcode` project directory.

### Phase 3: Paste and Save

1.  Delete all the existing content in your `README.md` file.
2.  Paste the new content you copied from Phase 1.
3.  Save the file.

Once you save it, you can commit and push this change to your GitHub repository, and your project's homepage will be updated.
```
