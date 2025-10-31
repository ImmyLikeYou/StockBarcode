# StockBarcode: Barcode Inventory System

StockBarcode is a comprehensive inventory management application built with Electron and Node.js. It allows for tracking stock levels (Add, Cut, Adjust), managing products, and viewing detailed transaction histories.

This application is designed with a hybrid architecture: it can run as a standalone **desktop app** (using Electron) or as a **local web server** (using Express), sharing the same data and frontend logic.

## Features

This application provides a full suite of tools for managing a product inventory.

### 1. Main Inventory Dashboard
The primary interface for daily operations.
* **Live Inventory View:** A real-time, collapsible, and searchable list of all products.
* **Filter & Search:** Instantly filter the stock list by category and/or search by product name.
* **Barcode Scanning:** A central input field, auto-focused for quick scanning.
* **Manual Entry:** Manually add, cut, or adjust stock using a product search, no scanner required.
* **Transaction Modes:**
    * **Cut Stock:** Decrements stock for an item.
    * **Add Stock:** Increments stock for an item.
    * **Adjust Stock:** Manually sets the stock level to a specific number.
* **Size Selection:** Apply transactions to a wide range of sizes (F, M, L, XL, 2L, 3L, 4L, 5L, 6L, 3XL, 4XL, 5XL, 6XL).
* **Quick Log:** See a running list of successful and failed scans from your current session.

### 2. Product & Category Management
* **Full Category CRUD:** Create, Read, Update, and Delete product categories. Products from deleted categories are safely reassigned to "Default".
* **Add New Products:** A dedicated page to create new items with a name, category, default cost, and 8-digit code to generate a 12-digit barcode.
* **Edit Products:** Update a product's name, default cost, and set **size-specific costs**.
* **Barcode Generation:** Download PNG barcode images for any product.

### 3. Reporting & Transaction Logs
* **Master Transaction Log:** A complete, searchable, and filterable history of all transactions (Add, Cut, Adjust).
* **Transaction Deletion:** Correct mistakes by deleting a transaction, which automatically reverts the stock change.
* **Item History:** View a filterable transaction log for a single specific item.
* **Data Visualization:** The transaction log includes a `Chart.js` bar chart showing stock added vs. stock cut per day.
* **Inventory Value Report:** A filterable report showing current stock levels, cost per item, and total inventory value.
* **Export to CSV:** Export both the main transaction log and the inventory value report to `.csv` files.

### 4. System & Architecture
* **Hybrid Backend:** Runs as a standalone Electron desktop app or as a local Express web server for development.
* **Internationalization (i18n):** Full frontend support for English (en) and Thai (th).
* **Persistent Data:** Uses JSON files stored in the user's application data directory, making it a true desktop app.
* **Data Migrations:** Includes scripts to safely update the user's data structure as new features (like `default_cost`) are added.

## Technical Architecture

This project uses a hybrid architecture to run as either a desktop app or a web server.

* **Backend:**
    1.  **Electron Mode (`main.js`):** When packaged, `main.js` serves as the backend. It uses Electron's `ipcMain` to handle all data logic by reading/writing to local JSON files.
    2.  **Web Server Mode (`server.js`):** For development, `server.js` runs an Express.js server with a REST API that mirrors the Electron backend logic.

* **Frontend API Controller (`frontend/scripts/_api.js`):**
    This file detects which environment it's in. If `window.electronAPI` (from `preload.js`) exists, it sends all requests to the Electron backend. Otherwise, it falls back to using `fetch` against the Express server.

* **Data Storage:**
    All data is stored in `inventory.json`, `products.json`, `transactions.json`, and `categories.json` in the user's OS-specific app data folder.

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

This will start the Express.js server, which you can access at `http://localhost:3001`.

```bash
npm run server
```

### 5\. Build the Application

To build the installable desktop application (e.g., `.exe` or `.deb`), run:

```bash
npm run make
```

The packaged application will be in the `out/` folder.

## Project Structure

```
/
├── frontend/
│   ├── scripts/
│   │   ├── _api.js           # (Controller) Smartly switches between Electron and Web API.
│   │   ├── i18n.js           # Handles all translation logic.
│   │   ├── receiver.js       # (Controller) Logic for the main Inventory page.
│   │   ├── add_product.js    # (Controller) Logic for adding new products.
│   │   ├── item_list.js      # (Controller) Logic for the item list page.
│   │   ├── transactions.js   # (Controller) Logic for the full transaction log/chart.
│   │   └── reports.js        # (Controller) Logic for reports page.
│   │
│   ├── styles/               # (View) CSS files for each page.
│   ├── locales/              # Translation files (en.json, th.json)
│   ├── barcode_receiver.html # (View) Main inventory page.
│   ├── add_product.html      # (View) Add new product page.
│   └── ... (other html files)
│
├── main.js                   # (Model/Backend) The Electron main process.
├── server.js                 # (Model/Backend) The Express.js web server (for dev).
├── preload.js                # (Controller) Secure bridge between Electron frontend and backend.
├── migration.js              # Data migration script.
├── package.json              # Project dependencies and scripts.
└── forge.config.js           # Configuration for building the Electron app.
```

```

### Phase 2: Open Your Local `README.md` File

In your code editor, find and open the `README.md` file that is in the root of your project directory.

### Phase 3: Paste and Save

1.  **Delete** all the existing content in your `README.md` file.
2.  **Paste** the new content you copied from Phase 1.
3.  **Save** the file.

Once you save it, you can follow the Git steps from our previous conversation to commit and push this new `README.md` to your repository. It will look great!
```
