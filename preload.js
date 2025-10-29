const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Functions the frontend can call
    loadData: () => ipcRenderer.invoke('load-data'),
    processTransaction: (args) => ipcRenderer.invoke('process-transaction', args),
    addProduct: (args) => ipcRenderer.invoke('add-product', args),
    deleteProduct: (barcode) => ipcRenderer.invoke('delete-product', barcode),
    clearLog: () => ipcRenderer.invoke('clear-log'),
    getProduct: (barcode) => ipcRenderer.invoke('get-product', barcode), // For edit page
    updateProduct: (args) => ipcRenderer.invoke('update-product', args), // For edit page
});