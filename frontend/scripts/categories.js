import { getCategories, addCategory, updateCategory, deleteCategory } from './_api.js'; // --- MODIFIED
import { initializeI18n, setLanguage, t, parseError } from './i18n.js';

const categoryList = document.getElementById('categoryList');
const addCategoryForm = document.getElementById('addCategoryForm');
const categoryNameInput = document.getElementById('categoryName');
const errorMessage = document.getElementById('errorMessage');

// --- NEW: Modal Elements ---
const editModal = document.getElementById('editCategoryModal');
const editForm = document.getElementById('editCategoryForm');
const editCategoryId = document.getElementById('editCategoryId');
const editCategoryName = document.getElementById('editCategoryName');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const deleteModal = document.getElementById('deleteCategoryModal');
const deleteCategoryId = document.getElementById('deleteCategoryId');
const deleteCategoryText = document.getElementById('deleteCategoryText');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

/**
 * Fetches categories from the backend and displays them in the list.
 */
async function loadCategories() {
    try {
        const categories = await getCategories();
        categoryList.innerHTML = ''; // Clear "Loading..."

        const categoryIds = Object.keys(categories);
        if (categoryIds.length === 0) {
            categoryList.innerHTML = `<li>No categories created yet.</li>`;
            return;
        }

        const sortedCategories = categoryIds
            .filter(id => id !== 'cat_0')
            .sort((a, b) => categories[a].localeCompare(categories[b]));

        if (categories['cat_0']) {
            sortedCategories.unshift('cat_0');
        }

        // Render list
        for (const id of sortedCategories) {
            const name = categories[id];
            const li = document.createElement('li');
            li.dataset.id = id;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'category-name';
            nameSpan.textContent = name;
            li.appendChild(nameSpan);

            // --- NEW: Add action buttons ---
            if (id !== 'cat_0') { // Don't allow editing/deleting "Default"
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'category-actions';

                const editBtn = document.createElement('button');
                editBtn.className = 'edit-btn';
                editBtn.textContent = t('categories_edit_button');
                editBtn.dataset.id = id;
                editBtn.dataset.name = name;
                editBtn.addEventListener('click', handleEditClick);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.textContent = t('categories_delete_button');
                deleteBtn.dataset.id = id;
                deleteBtn.dataset.name = name;
                deleteBtn.addEventListener('click', handleDeleteClick);

                actionsDiv.appendChild(editBtn);
                actionsDiv.appendChild(deleteBtn);
                li.appendChild(actionsDiv);
            } else {
                nameSpan.style.fontStyle = 'italic'; // Make "Default" look special
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

// --- NEW: Modal and Edit/Delete Logic ---

function showModal(modal) {
    modal.style.display = 'flex';
}

function hideModal(modal) {
    modal.style.display = 'none';
}

// -- Edit ---
function handleEditClick(event) {
    const id = event.target.dataset.id;
    const name = event.target.dataset.name;

    editCategoryId.value = id;
    editCategoryName.value = name;
    showModal(editModal);
}

async function handleSaveCategory(event) {
    event.preventDefault();
    const id = editCategoryId.value;
    const newName = editCategoryName.value.trim();

    if (!newName) {
        alert(t('error_category_name_empty'));
        return;
    }

    try {
        await updateCategory(id, newName);
        hideModal(editModal);
        await loadCategories(); // Refresh list
    } catch (err) {
        console.error('Error updating category:', err);
        const { key, context } = parseError(err);
        alert(t(key, context));
    }
}

// -- Delete ---
function handleDeleteClick(event) {
    const id = event.target.dataset.id;
    const name = event.target.dataset.name;

    deleteCategoryId.value = id;
    deleteCategoryText.textContent = t('modal_delete_category_text', { name: name });
    showModal(deleteModal);
}

async function handleConfirmDelete() {
    const id = deleteCategoryId.value;

    try {
        await deleteCategory(id);
        hideModal(deleteModal);
        await loadCategories(); // Refresh list
    } catch (err) {
        console.error('Error deleting category:', err);
        const { key, context } = parseError(err);
        alert(t(key, context));
    }
}


// --- EVENT LISTENERS ---
addCategoryForm.addEventListener('submit', handleAddCategory);
editForm.addEventListener('submit', handleSaveCategory);
cancelEditBtn.addEventListener('click', () => hideModal(editModal));
confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
cancelDeleteBtn.addEventListener('click', () => hideModal(deleteModal));

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
    await initializeI18n();
    await loadCategories();
}

initializeApp();