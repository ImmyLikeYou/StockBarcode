// This variable will hold all our translations
let translations = {};

/**
 * Gets the current language from localStorage or defaults to 'en'
 */
export function getCurrentLanguage() {
    return localStorage.getItem('lang') || 'en';
}

/**
 * Saves the user's language choice and reloads the page
 */
export function setLanguage(lang) {
    if (getCurrentLanguage() === lang) return; // Don't reload if lang is the same
    localStorage.setItem('lang', lang);
    window.location.reload();
}

/**
 * Fetches the correct language JSON file
 */
async function loadTranslations() {
    const lang = getCurrentLanguage();
    try {
        // We check the protocol. In Electron (file:), we must adjust the path.
        const isFileProtocol = window.location.protocol === 'file:';
        const path = isFileProtocol ? `locales/${lang}.json` : `/locales/${lang}.json`;

        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Could not load ${lang}.json`);
        }
        translations = await response.json();
    } catch (err) {
        console.error('Error loading translation file:', err);
        // Fallback to English if Thai file fails
        if (lang !== 'en') {
            console.warn('Falling back to English.');
            const response = await fetch(isFileProtocol ? 'locales/en.json' : '/locales/en.json');
            translations = await response.json();
        }
    }
}

/**
 * The main translation function.
 * @param {string} key - The key from the JSON file (e.g., "nav_inventory")
 * @param {object} replacements - An object for replacing variables (e.g., { item: "T-Shirt" })
 * @returns {string} The translated text
 */
export function t(key, replacements = {}) {
    let text = translations[key] || key; // Return the key itself if not found

    // Replace variables like {item} or {stock}
    if (replacements) {
        for (const placeholder in replacements) {
            text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), replacements[placeholder]);
        }
    }

    return text;
}

/**
 * Finds all elements with a 'data-i18n-key' attribute and sets their text
 */
function applyTranslationsToPage() {
    // Update page title
    const titleElement = document.querySelector('title[data-i18n-key]');
    if (titleElement) {
        document.title = t(titleElement.getAttribute('data-i18n-key'));
    }

    // Update elements with data-i18n-key
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-key');
        const translatedText = t(key);

        // Check for specific attributes to translate, like 'placeholder' or 'title'
        if (element.hasAttribute('data-i18n-placeholder')) {
            element.placeholder = translatedText;
        } else if (element.hasAttribute('data-i18n-title')) {
            element.title = translatedText;
        } else {
            // Set innerHTML to allow for entities like &larr;
            element.innerHTML = translatedText;
        }
    });

    // Highlight the active language button
    // Highlight the active language button
    const currentLang = getCurrentLanguage();
    const activeButton = document.getElementById(`lang-${currentLang}`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
}
/**
 * Main function to load translations and apply them.
 * Call this from all your page scripts.
 */
export async function initializeI18n() {
    await loadTranslations();
    // Wait for the DOM to be fully loaded before applying translations
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyTranslationsToPage);
    } else {
        applyTranslationsToPage();
    }
}
/**
 * Parses an error from either the Electron backend (string/JSON) or the Server backend (object).
 * @param {Error} err - The error object from a catch block.
 * @returns {{key: string, context: object|undefined}}
 */
export function parseError(err) {
    let key = err.message;
    let context;

    if (err.serverResponse) {
        // Server (fetch) error - already a clean object
        key = err.serverResponse.message || 'error_generic';
        context = err.serverResponse.context;
    } else {
        // Electron (IPC) error
        try {
            // Try to parse it as our custom JSON error string
            const parsedError = JSON.parse(err.message);
            key = parsedError.message;
            context = parsedError.context;
        } catch (e) {
            // It's a wrapped string error, e.g., "Error: ...: Error: error_key"
            // Get the text *after* the last "Error: "
            const parts = err.message.split('Error: ');
            key = parts[parts.length - 1] || err.message;
        }
    }

    // Handle generic "Error: " prefix if it's still there
    if (key.startsWith('Error: ')) {
        key = key.substring(7);
    }

    return { key, context };
}