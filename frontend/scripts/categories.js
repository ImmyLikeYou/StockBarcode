import { getCategories, addCategory } from './_api.js';
import { initializeI18n, setLanguage, t, parseError } from './i18n.js';

const categoryList = document.getElementById('categoryList');
const addCategoryForm = document.getElementById('addCategoryForm');
const categoryNameInput = document.getElementById('categoryName');
const errorMessage = document.getElementById('errorMessage');

/**
 * Fetches categories from the backend and displays them in the list.
 */
async function loadCategories() {
    try {
        const categories = await getCategories();
        categoryList.innerHTML = ''; // Clear "Loading..."

        // Check if any categories exist
        const categoryIds = Object.keys(categories);
        if (categoryIds.length === 0) {
            categoryList.innerHTML = `<li>No categories created yet.</li>`; // This should be translated too
            return;
        }

        // Sort categories by name, but keep "Default" (cat_0) at the top
        const sortedCategories = categoryIds
            .filter(id => id !== 'cat_0') // Remove default
            .sort((a, b) => categories[a].localeCompare(categories[b])); // Sort by name

        // Add "Default" back to the beginning
        if (categories['cat_0']) {
            sortedCategories.unshift('cat_0');
        }

        // Render list
        for (const id of sortedCategories) {
            const name = categories[id];
            const li = document.createElement('li');
            li.textContent = name;
            li.dataset.id = id;
            if (id === 'cat_0') {
                li.style.fontStyle = 'italic'; // Make "Default" look special
            }
            categoryList.appendChild(li);
        }

    } catch (err) {
        console.error('Error loading categories:', err);
        const { key, context } = parseError(err);
        errorMessage.textContent = t(key, context);
    }
}

/**
 * Handles the submission of the "Add Category" form.
 */
async function handleAddCategory(event) {
    event.preventDefault();
    errorMessage.textContent = '';
    const categoryName = categoryNameInput.value.trim();

    if (!categoryName) {
        errorMessage.textContent = t('error_category_name_empty');
        return;
    }

    try {
        await addCategory(categoryName);
        categoryNameInput.value = ''; // Clear the input
        await loadCategories(); // Refresh the list
    } catch (err) {
        console.error('Error adding category:', err);
        const { key, context } = parseError(err);
        errorMessage.textContent = t(key, context);
    }
}


// --- EVENT LISTENERS ---
addCategoryForm.addEventListener('submit', handleAddCategory);

const langEnButton = document.getElementById('lang-en');
if (langEnButton) {
    langEnButton.addEventListener('click', () => setLanguage('en'));
}

const langThButton = document.getElementById('lang-th');
if (langThButton) {
    langThButton.addEventListener('click', () => setLanguage('th'));
}

// --- INITIALIZE ---
async function initializeApp() {
    await initializeI18n(); // Load translations
    await loadCategories(); // Load categories
}

initializeApp();