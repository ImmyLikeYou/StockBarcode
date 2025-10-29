// Map of routes to their corresponding HTML files
const routeMap = {
    '/': 'barcode_receiver.html',
    '/add-product': 'add_product.html',
    '/edit-product': 'edit_product.html',
    '/item-list': 'item_list.html',
    '/item-history': 'item_history.html',
    '/transactions': 'transactions.html',
    '/reports': 'reports.html'
};

/**
 * Handle local file navigation in Electron
 * @param {string} href - The href value from the clicked link
 */
// Check if we're running in Electron
const isElectron = window.navigator.userAgent.toLowerCase().includes('electron');

// Function to handle navigation
export function navigateTo(route, params = {}) {
    let finalRoute = route;

    // Add any query parameters
    if (Object.keys(params).length > 0) {
        const queryString = Object.entries(params)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        finalRoute = `${route}${route.includes('?') ? '&' : '?'}${queryString}`;
    }

    if (isElectron) {
        // In Electron, we need to use the file directly
        let targetFile;
        if (route.startsWith('/edit-product/') || route.startsWith('/item-history/')) {
            const base = route.split('/')[1];
            const barcode = route.split('/').pop();
            const htmlFile = routeMap['/' + base];
            targetFile = `${htmlFile}?barcode=${encodeURIComponent(barcode)}`;
        } else {
            targetFile = routeMap[route] || 'barcode_receiver.html';
        }
        window.location.href = targetFile;
    } else {
        // In browser, we use the server routes
        window.location.href = finalRoute;
    }
}

// Function to get current route parameters
export function getRouteParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
}

// Function to get current page name
export function getCurrentPage() {
    if (isElectron) {
        const fileName = window.location.pathname.split('/').pop();
        for (const [route, file] of Object.entries(routeMap)) {
            if (file === fileName) {
                return route;
            }
        }
        return '/';
    }
    return window.location.pathname;
}


// Set up global event listeners for navigation
document.addEventListener('DOMContentLoaded', () => {
    // Handle navigation via data-route attributes
    document.body.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-route]');
        if (link) {
            e.preventDefault();
            const route = link.getAttribute('data-route');
            navigateTo(route);
        }
    });
});