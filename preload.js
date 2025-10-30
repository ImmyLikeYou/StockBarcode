const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Functions the frontend can call
    loadData: () => ipcRenderer.invoke('load-data'),
    processTransaction: (args) => ipcRenderer.invoke('process-transaction', args),
    addProduct: (args) => ipcRenderer.invoke('add-product', args),
    deleteProduct: (barcode) => ipcRenderer.invoke('delete-product', barcode),
    clearLog: () => ipcRenderer.invoke('clear-log'),
    getProduct: (barcode) => ipcRenderer.invoke('get-product', barcode),
    updateProduct: (args) => ipcRenderer.invoke('update-product', args),

    // Category functions
    getCategories: () => ipcRenderer.invoke('get-categories'),
    addCategory: (categoryName) => ipcRenderer.invoke('add-category', categoryName),
    // --- NEW ---
    updateCategory: (args) => ipcRenderer.invoke('update-category', args),
    deleteCategory: (args) => ipcRenderer.invoke('delete-category', args)
});