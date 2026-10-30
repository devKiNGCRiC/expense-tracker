// Global variables to store application data
let budget = 0;      // monthly budget
let expenses = [];   // all expenses, newest added first

// Category metadata (used by the list, breakdown, search and CSV export)
const CATEGORIES = {
    food: { icon: '🍽️', name: 'Food & Dining' },
    transport: { icon: '🚗', name: 'Transportation' },
    entertainment: { icon: '🎬', name: 'Entertainment' },
    shopping: { icon: '🛍️', name: 'Shopping' },
    bills: { icon: '💡', name: 'Bills & Utilities' },
    health: { icon: '🏥', name: 'Health & Medical' },
    education: { icon: '📚', name: 'Education' },
    other: { icon: '📦', name: 'Other' }
};

// DOM Elements
const $ = id => document.getElementById(id);
const expenseForm = $('expenseForm');
const expensesList = $('expensesList');
const budgetInput = $('budgetInput');
const searchInput = $('searchInput');
const categoryFilter = $('categoryFilter');
const sortFilter = $('sortFilter');

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadFromStorage();
    resetDateField();
    renderAll();
});

/* ---------- Dates & formatting ---------- */

// Today's date as YYYY-MM-DD in the user's timezone
// (toISOString() uses UTC, which gives the wrong day around midnight)
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Parse YYYY-MM-DD as a local date (new Date('YYYY-MM-DD') treats it as UTC)
function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// Short date for list rows, e.g. "31 Oct" (year added when it isn't this year)
function formatDate(dateString) {
    const date = parseLocalDate(dateString);
    const options = { day: 'numeric', month: 'short' };
    if (date.getFullYear() !== new Date().getFullYear()) {
        options.year = 'numeric';
    }
    return date.toLocaleDateString('en-IN', options);
}

// Format currency in Indian format
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
}

// Escape user-provided text before inserting it into HTML
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML.replace(/"/g, '&quot;');
}

function getCategoryIcon(category) {
    return (CATEGORIES[category] || CATEGORIES.other).icon;
}

function getCategoryName(category) {
    return (CATEGORIES[category] || CATEGORIES.other).name;
}

/* ---------- Monthly budget ---------- */

// Expenses dated in the current calendar month
function getMonthExpenses(now = new Date()) {
    const monthKey = getLocalDateString(now).slice(0, 7); // "YYYY-MM"
    return expenses.filter(expense => expense.date.startsWith(monthKey));
}

function sumAmounts(list) {
    return list.reduce((sum, expense) => sum + expense.amount, 0);
}

function getMonthSpent() {
    return sumAmounts(getMonthExpenses());
}

function renderOverview() {
    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const spent = getMonthSpent();
    const remaining = budget - spent;
    const usedShare = budget > 0 ? spent / budget : 0;
    const monthShare = day / daysInMonth;

    const overview = $('overview');
    const meter = $('budgetMeter');

    $('monthLabel').textContent = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    overview.classList.toggle('is-unset', budget === 0);
    overview.classList.toggle('is-over', budget > 0 && remaining < 0);

    if (budget === 0) {
        $('remainingBudget').textContent = formatCurrency(spent);
        $('remainingCaption').textContent = 'spent';
        $('spentSummary').textContent = 'No monthly budget set';
    } else if (remaining < 0) {
        $('remainingBudget').textContent = formatCurrency(-remaining);
        $('remainingCaption').textContent = 'over budget';
        $('spentSummary').textContent = `Spent ${formatCurrency(spent)} of ${formatCurrency(budget)}`;
    } else {
        $('remainingBudget').textContent = formatCurrency(remaining);
        $('remainingCaption').textContent = 'left';
        $('spentSummary').textContent = `Spent ${formatCurrency(spent)} of ${formatCurrency(budget)}`;
    }

    // Meter: fill shows budget used, the tick shows how far through the month we are
    const ahead = budget > 0 && usedShare > monthShare * 1.1 && remaining >= 0;
    meter.classList.toggle('is-ahead', ahead);
    meter.classList.toggle('is-over', budget > 0 && remaining < 0);
    meter.setAttribute('aria-valuenow', String(Math.round(usedShare * 100)));
    meter.setAttribute('aria-valuetext', budget > 0
        ? `${Math.round(usedShare * 100)}% of budget used, day ${day} of ${daysInMonth}`
        : 'No budget set');
    $('meterFill').style.width = `${Math.min(usedShare, 1) * 100}%`;
    $('meterToday').style.left = `${monthShare * 100}%`;
    $('meterToday').classList.toggle('at-start', monthShare < 0.15);
    $('meterToday').classList.toggle('at-end', monthShare > 0.85);
    $('meterTodayLabel').textContent = `Day ${day} of ${daysInMonth}`;

    $('paceMessage').textContent = getPaceMessage(spent, remaining, day, daysInMonth, ahead);

    // Budget form reflects the current value
    $('budgetButton').textContent = budget > 0 ? 'Update budget' : 'Set budget';
    if (document.activeElement !== budgetInput) {
        budgetInput.value = budget > 0 ? String(budget) : '';
    }

    renderBreakdown();
}

function getPaceMessage(spent, remaining, day, daysInMonth, ahead) {
    if (budget === 0) {
        return 'Set a monthly budget to see how much you have left.';
    }
    if (remaining < 0) {
        return `You've spent ${formatCurrency(-remaining)} more than your budget this month.`;
    }
    if (ahead) {
        const projected = (spent / day) * daysInMonth;
        return `Spending ahead of pace. At this rate you'll spend ${formatCurrency(Math.round(projected))} by the end of the month.`;
    }
    const daysLeft = daysInMonth - day + 1; // include today
    return `On track. You can spend about ${formatCurrency(Math.floor(remaining / daysLeft))} a day for the rest of the month.`;
}

// This month's spending per category, largest first
function renderBreakdown() {
    const list = $('categoryBreakdown');
    const monthExpenses = getMonthExpenses();
    const total = sumAmounts(monthExpenses);

    if (monthExpenses.length === 0) {
        list.innerHTML = '<li class="breakdown-empty">Nothing spent this month yet.</li>';
        return;
    }

    const totals = {};
    monthExpenses.forEach(expense => {
        totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    });

    const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const largest = rows[0][1];

    list.innerHTML = rows.map(([category, amount]) => `
        <li class="breakdown-row">
            <span class="breakdown-name">${getCategoryIcon(category)} ${getCategoryName(category)}</span>
            <span class="breakdown-bar" style="width: ${(amount / largest) * 100}%" aria-hidden="true"></span>
            <span class="breakdown-amount">
                <span class="breakdown-share">${Math.round((amount / total) * 100)}%</span>
                ${formatCurrency(amount)}
            </span>
        </li>
    `).join('');
}

// Set Budget Function
function setBudget() {
    const budgetValue = Math.round(parseFloat(budgetInput.value) * 100) / 100;

    if (isNaN(budgetValue) || budgetValue <= 0) {
        budgetInput.setAttribute('aria-invalid', 'true');
        showToast('Enter a budget greater than ₹0.', 'error');
        budgetInput.focus();
        return;
    }

    budgetInput.removeAttribute('aria-invalid');
    budget = budgetValue;
    saveToStorage();
    budgetInput.blur();
    renderOverview();
    showToast(`Monthly budget set to ${formatCurrency(budget)}.`, 'success');
}

$('budgetForm').addEventListener('submit', function(e) {
    e.preventDefault();
    setBudget();
});

/* ---------- Add / delete ---------- */

function resetDateField() {
    const today = getLocalDateString();
    $('expenseDate').value = today;
    $('expenseDate').max = today;
}

expenseForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const title = $('expenseTitle').value.trim();
    const amount = Math.round(parseFloat($('expenseAmount').value) * 100) / 100;
    const category = $('expenseCategory').value;
    const date = $('expenseDate').value;

    // Validation: mark every invalid field, focus the first one
    expenseForm.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    const errors = validateExpenseInput(title, amount, category, date);
    if (errors.length > 0) {
        errors.forEach(error => $(error.field).setAttribute('aria-invalid', 'true'));
        $(errors[0].field).focus();
        showToast(errors[0].message, 'error');
        return;
    }

    const spentBefore = getMonthSpent();

    const expense = {
        id: Date.now(), // Simple ID generation
        title: title,
        amount: amount,
        category: category,
        date: date,
        timestamp: new Date().toISOString() // Used for precise sorting when dates are same
    };

    expenses.unshift(expense);
    saveToStorage();

    expenseForm.reset();
    resetDateField();
    $('expenseTitle').focus(); // ready for the next one

    renderAll();
    showToast(`Added "${title}" (${formatCurrency(amount)}).`, 'success');
    checkBudgetWarning(spentBefore, getMonthSpent());
});

// Validate input fields; returns [{ field, message }]
function validateExpenseInput(title, amount, category, date) {
    const errors = [];

    if (!title) {
        errors.push({ field: 'expenseTitle', message: 'Enter what the expense was for.' });
    }
    if (isNaN(amount) || amount <= 0) {
        errors.push({ field: 'expenseAmount', message: 'Enter an amount greater than ₹0.' });
    }
    if (!category) {
        errors.push({ field: 'expenseCategory', message: 'Choose a category.' });
    }
    if (!date) {
        errors.push({ field: 'expenseDate', message: 'Choose the date of the expense.' });
    } else if (date > getLocalDateString()) { // YYYY-MM-DD strings compare correctly
        errors.push({ field: 'expenseDate', message: 'The date can\'t be in the future.' });
    }

    return errors;
}

// Warn once when this month's spending crosses 50%, 80% or 100% of the budget
function checkBudgetWarning(spentBefore, spentAfter) {
    if (budget === 0) {
        return;
    }
    const crossed = threshold => spentBefore < budget * threshold && spentAfter >= budget * threshold;

    if (crossed(1)) {
        showToast('You\'ve gone over this month\'s budget.', 'error');
    } else if (crossed(0.8)) {
        showToast('You\'ve used 80% of this month\'s budget.', 'warning');
    } else if (crossed(0.5)) {
        showToast('You\'ve used half of this month\'s budget.', 'info');
    }
}

// Delete button clicks (event delegation - one listener for the whole list)
expensesList.addEventListener('click', function(e) {
    const button = e.target.closest('.delete-btn');
    if (button) {
        deleteExpense(Number(button.dataset.id));
    }
});

// Delete Expense (with undo)
function deleteExpense(id) {
    const expenseIndex = expenses.findIndex(expense => expense.id === id);
    if (expenseIndex === -1) {
        return;
    }

    const [deletedExpense] = expenses.splice(expenseIndex, 1);
    saveToStorage();
    renderAll();

    showToast(`Deleted "${deletedExpense.title}".`, 'info', {
        label: 'Undo',
        onClick: () => {
            expenses.splice(Math.min(expenseIndex, expenses.length), 0, deletedExpense);
            saveToStorage();
            renderAll();
        }
    });
}

// Delete all expenses
function clearAllExpenses() {
    if (expenses.length === 0) {
        showToast('There are no expenses to delete.', 'info');
        return;
    }

    if (confirm(`Delete all ${expenses.length} expenses? This can't be undone.`)) {
        expenses = [];
        saveToStorage();
        renderAll();
        showToast('All expenses deleted.', 'success');
    }
}

$('clearAllButton').addEventListener('click', clearAllExpenses);

/* ---------- History: search, filter, sort ---------- */

function hasActiveFilters() {
    return Boolean(searchInput.value.trim() || categoryFilter.value || sortFilter.value);
}

// Apply search -> category filter -> sort, then render
function renderHistory() {
    const query = searchInput.value.trim();
    const selectedCategory = categoryFilter.value;
    const sortType = sortFilter.value;

    // Start with all expenses
    let filteredExpenses = [...expenses];

    // Apply search filter using Linear Search Algorithm - O(n)
    if (query) {
        filteredExpenses = linearSearchExpenses(filteredExpenses, query);
    }

    // Apply category filter
    if (selectedCategory) {
        filteredExpenses = filteredExpenses.filter(expense => expense.category === selectedCategory);
    }

    // Apply sorting
    if (sortType) {
        applySorting(filteredExpenses, sortType);
    }

    const filtersOn = hasActiveFilters();
    $('clearFiltersButton').hidden = !filtersOn;
    $('clearAllButton').disabled = expenses.length === 0;
    $('exportButton').disabled = expenses.length === 0;

    displayExpenses(filteredExpenses, filtersOn);
}

function displayExpenses(expensesToShow, filtersOn) {
    const summary = $('resultSummary');
    const shownTotal = formatCurrency(sumAmounts(expensesToShow));

    if (expenses.length === 0) {
        summary.textContent = '';
        expensesList.innerHTML = '<li class="no-expenses">No expenses yet. Add your first one above.</li>';
        return;
    }

    if (expensesToShow.length === 0) {
        summary.textContent = `0 of ${expenses.length} expenses shown`;
        expensesList.innerHTML = `
            <li class="no-expenses">
                No expenses match these filters.<br>
                <button type="button" class="btn btn-ghost" data-action="clear-filters">Clear filters</button>
            </li>`;
        return;
    }

    const noun = expensesToShow.length === 1 ? 'expense' : 'expenses';
    summary.textContent = filtersOn
        ? `${expensesToShow.length} of ${expenses.length} expenses shown, totalling ${shownTotal}`
        : `${expensesToShow.length} ${noun}, ${shownTotal} in total`;

    expensesList.innerHTML = expensesToShow.map(expense => `
        <li class="expense-item">
            <span class="expense-date">${formatDate(expense.date)}</span>
            <div class="expense-info">
                <div class="expense-title">${escapeHTML(expense.title)}</div>
                <div class="expense-category">${getCategoryIcon(expense.category)} ${getCategoryName(expense.category)}</div>
            </div>
            <span class="expense-amount">${formatCurrency(expense.amount)}</span>
            <button type="button" class="delete-btn" data-id="${expense.id}" aria-label="Delete ${escapeHTML(expense.title)}">
                <i class="fas fa-trash" aria-hidden="true"></i>
            </button>
        </li>
    `).join('');
}

// Clear all filters and search
function clearAllFilters() {
    searchInput.value = '';
    categoryFilter.value = '';
    sortFilter.value = '';
    renderHistory();
    searchInput.focus();
}

searchInput.addEventListener('input', renderHistory);
categoryFilter.addEventListener('change', renderHistory);
sortFilter.addEventListener('change', renderHistory);
$('clearFiltersButton').addEventListener('click', clearAllFilters);
expensesList.addEventListener('click', function(e) {
    if (e.target.closest('[data-action="clear-filters"]')) {
        clearAllFilters();
    }
});

// Linear Search Algorithm Implementation
function linearSearchExpenses(expensesArray, searchQuery) {
    const query = searchQuery.toLowerCase();
    const results = [];

    // Linear search through array - O(n) time complexity
    for (let i = 0; i < expensesArray.length; i++) {
        const expense = expensesArray[i];

        // Search in multiple fields (title, category name)
        const titleMatch = expense.title.toLowerCase().includes(query);
        const categoryMatch = getCategoryName(expense.category).toLowerCase().includes(query);
        const amountMatch = expense.amount.toString().includes(query);

        // If any field matches, add to results
        if (titleMatch || categoryMatch || amountMatch) {
            results.push(expense);
        }
    }

    return results;
}

// Helper function to apply sorting to any array
function applySorting(expensesArray, sortType) {
    switch(sortType) {
        case 'date-newest':
            // Primary sort: Date (newest first), Secondary sort: Timestamp (latest first)
            expensesArray.sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);

                // If dates are different, sort by date
                if (dateA.getTime() !== dateB.getTime()) {
                    return dateB - dateA; // Newest date first
                }

                // If dates are same, sort by timestamp (latest added first)
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            break;
        case 'date-oldest':
            // Primary sort: Date (oldest first), Secondary sort: Timestamp (earliest first)
            expensesArray.sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);

                // If dates are different, sort by date
                if (dateA.getTime() !== dateB.getTime()) {
                    return dateA - dateB; // Oldest date first
                }

                // If dates are same, sort by timestamp (earliest added first)
                return new Date(a.timestamp) - new Date(b.timestamp);
            });
            break;
        case 'amount-highest':
            // Primary sort: Amount (highest first), Secondary sort: Timestamp (latest first)
            expensesArray.sort((a, b) => {
                if (a.amount !== b.amount) {
                    return b.amount - a.amount;
                }
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            break;
        case 'amount-lowest':
            // Primary sort: Amount (lowest first), Secondary sort: Timestamp (latest first)
            expensesArray.sort((a, b) => {
                if (a.amount !== b.amount) {
                    return a.amount - b.amount;
                }
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            break;
        case 'category':
            // Primary sort: Category (A-Z), Secondary sort: Timestamp (latest first)
            expensesArray.sort((a, b) => {
                const categoryCompare = getCategoryName(a.category).localeCompare(getCategoryName(b.category));
                if (categoryCompare !== 0) {
                    return categoryCompare;
                }
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            break;
        case 'title':
            // Primary sort: Title (A-Z), Secondary sort: Timestamp (latest first)
            expensesArray.sort((a, b) => {
                const titleCompare = a.title.toLowerCase().localeCompare(b.title.toLowerCase());
                if (titleCompare !== 0) {
                    return titleCompare;
                }
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            break;
    }
}

function renderAll() {
    renderOverview();
    renderHistory();
}

/* ---------- CSV export ---------- */

function exportExpenses() {
    if (expenses.length === 0) {
        showToast('There are no expenses to export.', 'info');
        return;
    }

    const csvContent = [
        ['Date', 'Title', 'Category', 'Amount'],
        ...expenses.map(expense => [
            expense.date,
            expense.title,
            getCategoryName(expense.category),
            expense.amount
        ])
    ].map(row => row.map(toCSVField).join(',')).join('\r\n');

    // BOM so Excel opens the file as UTF-8 (₹ and emoji stay intact)
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${getLocalDateString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showToast(`Exported ${expenses.length} expenses to CSV.`, 'success');
}

$('exportButton').addEventListener('click', exportExpenses);

// Quote a CSV field when needed and neutralise spreadsheet formulas
function toCSVField(value) {
    let text = String(value);
    if (/^[=+\-@]/.test(text)) {
        text = "'" + text;
    }
    if (/[",\r\n]/.test(text)) {
        text = '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
}

/* ---------- Toasts ---------- */

// Show a short message; optional action = { label, onClick } (e.g. Undo)
function showToast(message, type = 'info', action = null) {
    const container = $('toasts');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    // textContent keeps user input from being parsed as HTML
    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = message;
    toast.appendChild(text);

    if (action) {
        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'toast-action';
        actionBtn.textContent = action.label;
        actionBtn.addEventListener('click', () => {
            action.onClick();
            toast.remove();
        });
        toast.appendChild(actionBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.addEventListener('click', () => toast.remove());
    toast.appendChild(closeBtn);

    // Keep at most 3 on screen
    while (container.children.length >= 3) {
        container.firstElementChild.remove();
    }
    container.appendChild(toast);

    // Toasts with an action stay longer so there's time to use it
    setTimeout(() => toast.remove(), action ? 8000 : 4000);
}

/* ---------- Local storage ---------- */

function saveToStorage() {
    try {
        localStorage.setItem('expenseTracker', JSON.stringify({
            budget: budget,
            expenses: expenses
        }));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        showToast('Couldn\'t save. Your browser may be blocking storage.', 'error');
    }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem('expenseTracker');
        if (saved) {
            const data = JSON.parse(saved);
            budget = Number(data.budget) > 0 ? Number(data.budget) : 0;
            // Drop any malformed records so one bad entry can't break the app
            expenses = Array.isArray(data.expenses)
                ? data.expenses.filter(e => e && typeof e.title === 'string' && Number.isFinite(e.amount) && /^\d{4}-\d{2}-\d{2}$/.test(e.date))
                : [];
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        budget = 0;
        expenses = [];
    }
}

/* ---------- Input helpers & shortcuts ---------- */

// Keep amount inputs to digits with at most one decimal point and 2 decimal places
function sanitizeAmountInput(e) {
    let value = e.target.value.replace(/[^\d.]/g, '');
    const parts = value.split('.');
    if (parts.length > 1) {
        value = parts[0] + '.' + parts.slice(1).join('').substring(0, 2);
    }
    if (value !== e.target.value) {
        e.target.value = value;
    }
    e.target.removeAttribute('aria-invalid');
}

$('expenseAmount').addEventListener('input', sanitizeAmountInput);
budgetInput.addEventListener('input', sanitizeAmountInput);

// Clear the error state as soon as a field is corrected
expenseForm.addEventListener('input', e => e.target.removeAttribute('aria-invalid'));
expenseForm.addEventListener('change', e => e.target.removeAttribute('aria-invalid'));

// Alt+N jumps to the add form
// (Ctrl+N opens a new browser window and can't be overridden in most browsers)
document.addEventListener('keydown', function(e) {
    if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        $('add').scrollIntoView({ block: 'start' });
        $('expenseTitle').focus({ preventScroll: true });
    }
});
