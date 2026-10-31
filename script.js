// Global variables to store application data
let budget = 0;      // monthly budget
let expenses = [];   // all expenses, newest added first
let editingBudget = false;  // budget form open in the overview
let highlightId = null;     // history row to flash after the next render

// Category metadata (used by the list, breakdown, search and CSV export)
// Icons are <symbol>s in index.html (#cat-food, ...); colours are .cat-* classes in style.css
const CATEGORIES = {
    food: { name: 'Food & Dining' },
    transport: { name: 'Transportation' },
    entertainment: { name: 'Entertainment' },
    shopping: { name: 'Shopping' },
    bills: { name: 'Bills & Utilities' },
    health: { name: 'Health & Medical' },
    education: { name: 'Education' },
    other: { name: 'Other' }
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

function getCategoryKey(category) {
    return CATEGORIES[category] ? category : 'other';
}

function getCategoryIcon(category) {
    return `<svg class="cat-icon" aria-hidden="true"><use href="#cat-${getCategoryKey(category)}"/></svg>`;
}

// Icon on a round blob in the category's colour
function getCategoryBadge(category) {
    return `<span class="cat-blob cat-${getCategoryKey(category)}">${getCategoryIcon(category)}</span>`;
}

// Emoji and headline for the vibe check card, per pace state
const VIBES = {
    unset: { emoji: '✨', title: 'No budget yet' },
    ok: { emoji: '😎', title: 'On track, no stress' },
    ahead: { emoji: '👀', title: 'Spending kinda fast' },
    over: { emoji: '💀', title: 'Over budget' }
};

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
    $('noteBudget').textContent = budget > 0 ? formatCurrency(budget) : 'Not set';
    const monthCount = getMonthExpenses().length;
    $('noteSerial').textContent = `${monthCount} ${monthCount === 1 ? 'spend' : 'spends'} logged this month`;

    overview.classList.toggle('is-unset', budget === 0);
    overview.classList.toggle('is-over', budget > 0 && remaining < 0);

    if (budget === 0) {
        animateAmount($('remainingBudget'), spent);
        $('remainingCaption').textContent = 'spent';
        $('spentSummary').textContent = 'No monthly budget set';
    } else if (remaining < 0) {
        animateAmount($('remainingBudget'), -remaining);
        $('remainingCaption').textContent = 'over budget';
        $('spentSummary').textContent = `Spent ${formatCurrency(spent)} of ${formatCurrency(budget)}`;
    } else {
        animateAmount($('remainingBudget'), remaining);
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
    // Clip a full-width fill so its stripes stay put as it grows
    $('meterFill').style.clipPath = `inset(0 ${100 - Math.min(usedShare, 1) * 100}% 0 0 round 999px)`;
    $('meterToday').style.left = `${monthShare * 100}%`;
    $('meterToday').classList.toggle('at-start', monthShare < 0.15);
    $('meterToday').classList.toggle('at-end', monthShare > 0.85);
    $('meterTodayLabel').textContent = `Day ${day} of ${daysInMonth}`;

    $('paceMessage').textContent = getPaceMessage(spent, remaining, day, daysInMonth, ahead);
    const state = budget === 0 ? 'unset' : remaining < 0 ? 'over' : ahead ? 'ahead' : 'ok';
    $('paceMessage').dataset.state = state;
    overview.dataset.vibe = state;
    $('vibeEmoji').textContent = VIBES[state].emoji;
    $('vibeTitle').textContent = VIBES[state].title;

    // Budget is edited in place; the form stays open until one is set
    const showForm = budget === 0 || editingBudget;
    $('budgetForm').hidden = !showForm;
    $('budgetDisplay').hidden = showForm;
    $('budgetButton').textContent = budget > 0 ? 'Save' : 'Set';
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
        return `At this rate you'll spend ${formatCurrency(Math.round(projected))} by the end of the month.`;
    }
    const daysLeft = daysInMonth - day + 1; // include today
    if (daysLeft === 1) {
        return `Last day of the month, with ${formatCurrency(remaining)} left to spend.`;
    }
    return `You can spend about ${formatCurrency(Math.floor(remaining / daysLeft))} a day for the rest of the month.`;
}

// This month's spending per category, largest first
function renderBreakdown() {
    const list = $('categoryBreakdown');
    const strip = $('breakdownStrip');
    const monthExpenses = getMonthExpenses();
    const total = sumAmounts(monthExpenses);

    if (monthExpenses.length === 0) {
        strip.hidden = true;
        list.innerHTML = '<li class="breakdown-empty">Nothing spent this month yet.</li>';
        return;
    }

    const totals = {};
    monthExpenses.forEach(expense => {
        totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    });

    const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const largest = rows[0][1];

    // One strip for the whole budget: a coloured segment per category, the rest left blank
    const scale = Math.max(budget, total);
    strip.hidden = false;
    strip.innerHTML = rows.map(([category, amount]) =>
        `<span class="cat-${getCategoryKey(category)}" style="width: ${(amount / scale) * 100}%"></span>`
    ).join('');

    list.innerHTML = rows.map(([category, amount]) => `
        <li class="breakdown-row cat-${getCategoryKey(category)}">
            <span class="breakdown-name">${getCategoryBadge(category)} ${getCategoryName(category)}</span>
            <span class="breakdown-amount">
                <span class="breakdown-share">${Math.round((amount / total) * 100)}%</span>
                ${formatCurrency(amount)}
            </span>
            <span class="breakdown-bar" style="clip-path: inset(0 ${100 - (amount / largest) * 100}% 0 0 round 999px)" aria-hidden="true"></span>
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
    editingBudget = false;
    saveToStorage();
    renderOverview();
    $('editBudgetButton').focus();
    showToast(`Monthly budget set to ${formatCurrency(budget)}.`, 'success');
}

$('budgetForm').addEventListener('submit', function(e) {
    e.preventDefault();
    setBudget();
});

$('editBudgetButton').addEventListener('click', function() {
    editingBudget = true;
    renderOverview();
    budgetInput.focus();
    budgetInput.select();
});

// Escape cancels editing (only when there's a budget to fall back to)
budgetInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && budget > 0) {
        editingBudget = false;
        budgetInput.removeAttribute('aria-invalid');
        budgetInput.blur();
        renderOverview();
        $('editBudgetButton').focus();
    }
});

// Count the big amount from its previous value to the new one
function animateAmount(el, to) {
    const from = el.dataset.value === undefined ? null : Number(el.dataset.value);
    el.dataset.value = String(to);
    if (el._frame) {
        cancelAnimationFrame(el._frame);
    }

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (from === null || from === to || reduceMotion || typeof requestAnimationFrame !== 'function') {
        el.textContent = formatCurrency(to);
        return;
    }

    const duration = 650;
    const start = performance.now();
    const step = now => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        el.textContent = formatCurrency(progress < 1 ? Math.round(from + (to - from) * eased) : to);
        el._frame = progress < 1 ? requestAnimationFrame(step) : null;
    };
    el._frame = requestAnimationFrame(step);
}

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
    const checkedCategory = expenseForm.querySelector('input[name="expenseCategory"]:checked');
    const category = checkedCategory ? checkedCategory.value : '';
    const date = $('expenseDate').value;

    // Validation: mark every invalid field, focus the first one
    expenseForm.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    const errors = validateExpenseInput(title, amount, category, date);
    if (errors.length > 0) {
        errors.forEach(error => $(error.field).setAttribute('aria-invalid', 'true'));
        // The category "field" is a chip group; focus its first radio instead
        const firstInvalid = $(errors[0].field);
        (firstInvalid.matches('input, select') ? firstInvalid : firstInvalid.querySelector('input')).focus();
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
    highlightId = expense.id;
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
            highlightId = deletedExpense.id;
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
    // Apply sorting (default: date, newest first)
    applySorting(filteredExpenses, sortType || 'date-newest');

    const filtersOn = hasActiveFilters();
    $('clearFiltersButton').hidden = !filtersOn;
    $('clearAllButton').disabled = expenses.length === 0;
    $('exportButton').disabled = expenses.length === 0;

    displayExpenses(filteredExpenses, filtersOn, sortType || 'date-newest');
}

function displayExpenses(expensesToShow, filtersOn, sortType) {
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

    // In date order, break the history into months with a subtotal for each
    const groupByMonth = sortType === 'date-newest' || sortType === 'date-oldest';
    const monthTotals = {};
    if (groupByMonth) {
        expensesToShow.forEach(expense => {
            const key = expense.date.slice(0, 7);
            monthTotals[key] = (monthTotals[key] || 0) + expense.amount;
        });
    }
    let currentMonth = null;

    // Running balance per month, like a passbook: budget minus spending so far
    const showBalance = budget > 0;
    const balances = showBalance ? getRunningBalances() : null;
    $('history').classList.toggle('has-balance', showBalance);
    const balanceCell = value => {
        const text = value < 0 ? `${formatCurrency(-value)} over` : `${formatCurrency(value)} left`;
        return `<span class="expense-balance${value < 0 ? ' is-negative' : ''}">${text}</span>`;
    };

    expensesList.innerHTML = expensesToShow.map(expense => {
        let monthHeader = '';
        const monthKey = expense.date.slice(0, 7);
        if (groupByMonth && monthKey !== currentMonth) {
            currentMonth = monthKey;
            const monthName = parseLocalDate(`${monthKey}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            monthHeader = `
        <li class="ledger-month">
            <span>${monthName}</span>
            <span>${formatCurrency(monthTotals[monthKey])} spent</span>
            ${showBalance ? balanceCell(budget - sumAmounts(expenses.filter(e => e.date.startsWith(monthKey)))) : ''}
        </li>`;
        }
        return monthHeader + `
        <li class="expense-item${expense.id === highlightId ? ' is-new' : ''}">
            ${getCategoryBadge(expense.category)}
            <div class="expense-info">
                <div class="expense-title">${escapeHTML(expense.title)}</div>
                <div class="expense-meta">
                    <span class="expense-category">${getCategoryName(expense.category)}</span>
                    <span class="expense-date">${formatDate(expense.date)}</span>
                </div>
            </div>
            <div class="expense-money">
                <span class="expense-amount">−${formatCurrency(expense.amount)}</span>
                ${showBalance ? balanceCell(balances.get(expense.id)) : ''}
            </div>
            <span class="expense-action">
                <button type="button" class="delete-btn" data-id="${expense.id}" aria-label="Delete ${escapeHTML(expense.title)}">
                    <i class="fas fa-trash" aria-hidden="true"></i>
                </button>
            </span>
        </li>`;
    }).join('');
}

// Balance left after each expense within its own month, in the order spent
function getRunningBalances() {
    const balances = new Map();
    const byMonth = {};
    expenses.forEach(expense => {
        const key = expense.date.slice(0, 7);
        (byMonth[key] = byMonth[key] || []).push(expense);
    });
    Object.values(byMonth).forEach(monthList => {
        let left = budget;
        applySorting(monthList, 'date-oldest');
        monthList.forEach(expense => {
            left -= expense.amount;
            balances.set(expense.id, left);
        });
    });
    return balances;
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
    highlightId = null; // only flash on the render right after the change
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
// (closest() also covers the chip group, where the radio is inside the invalid element)
const clearInvalid = e => {
    const invalid = e.target.closest('[aria-invalid]');
    if (invalid) {
        invalid.removeAttribute('aria-invalid');
    }
};
expenseForm.addEventListener('input', clearInvalid);
expenseForm.addEventListener('change', clearInvalid);

// Alt+N jumps to the add form
// (Ctrl+N opens a new browser window and can't be overridden in most browsers)
document.addEventListener('keydown', function(e) {
    if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        $('add').scrollIntoView({ block: 'start' });
        $('expenseTitle').focus({ preventScroll: true });
    }
});
