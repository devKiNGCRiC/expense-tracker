// Global variables to store application data
let budget = 0;
let expenses = [];
let totalExpenses = 0;

// DOM Elements
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const expenseForm = document.getElementById('expenseForm');
const expensesList = document.getElementById('expensesList');
const budgetInput = document.getElementById('budgetInput');

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load data from localStorage
    loadFromStorage();
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expenseDate').value = today;
    
    // Initialize display
    updateBudgetDisplay();
    displayExpenses();
    
    console.log('Expense Tracker initialized successfully!');
});

// Mobile Navigation Toggle
hamburger.addEventListener('click', function() {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a nav link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function() {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Set Budget Function
function setBudget() {
    const budgetValue = parseFloat(budgetInput.value);
    
    if (isNaN(budgetValue) || budgetValue <= 0) {
        showAlert('Please enter a valid budget amount', 'error');
        return;
    }
    
    budget = budgetValue;
    budgetInput.value = '';
    updateBudgetDisplay();
    saveToStorage(); // Save data to localStorage
    showAlert('Budget set successfully!', 'success');
}

// Add Expense Function
expenseForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const title = document.getElementById('expenseTitle').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value;
    const date = document.getElementById('expenseDate').value;
    
    // Validation
    if (!title || isNaN(amount) || amount <= 0 || !category || !date) {
        showAlert('Please fill in all fields with valid data', 'error');
        return;
    }
    
    if (budget === 0) {
        showAlert('Please set your budget first!', 'error');
        return;
    }
    
    // Create expense object
    const expense = {
        id: Date.now(), // Simple ID generation
        title: title,
        amount: amount,
        category: category,
        date: date,
        timestamp: new Date().toISOString() // Used for precise sorting when dates are same
    };
    
    // Add to expenses array
    expenses.unshift(expense); // Add to beginning of array
    totalExpenses += amount;
    
    // Update display
    updateBudgetDisplay();
    displayExpenses();
    
    // Clear form
    expenseForm.reset();
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    
    saveToStorage(); // Save data to localStorage
    showAlert(`Expense "${title}" added successfully!`, 'success');
    
    // Check budget warning
    checkBudgetWarning();
});

// Update Budget Display
function updateBudgetDisplay() {
    document.getElementById('totalBudget').textContent = `₹${budget.toLocaleString('en-IN')}`;
    document.getElementById('totalExpenses').textContent = `₹${totalExpenses.toLocaleString('en-IN')}`;
    
    const remaining = budget - totalExpenses;
    const remainingElement = document.getElementById('remainingBudget');
    remainingElement.textContent = `₹${remaining.toLocaleString('en-IN')}`;
    
    // Color coding for remaining budget
    if (remaining < 0) {
        remainingElement.style.color = '#ff6b6b';
    } else if (remaining < budget * 0.2) {
        remainingElement.style.color = '#ffd93d';
    } else {
        remainingElement.style.color = '#51cf66';
    }
}

// Display Expenses
function displayExpenses(expensesToShow = expenses) {
    if (expensesToShow.length === 0) {
        expensesList.innerHTML = '<p class="no-expenses">No expenses found. Start tracking your spending!</p>';
        return;
    }
    
    const expensesHTML = expensesToShow.map(expense => {
        const categoryIcon = getCategoryIcon(expense.category);
        const formattedDate = formatDate(expense.date);
        
        return `
            <div class="expense-item fade-in">
                <div class="expense-info">
                    <div class="expense-title">${expense.title}</div>
                    <div class="expense-details">
                        <span>${categoryIcon} ${getCategoryName(expense.category)}</span>
                        <span>📅 ${formattedDate}</span>
                    </div>
                </div>
                <div class="expense-amount">₹${expense.amount.toLocaleString('en-IN')}</div>
                <button class="delete-btn" onclick="deleteExpense(${expense.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
    
    expensesList.innerHTML = expensesHTML;
}

// Get Category Icon
function getCategoryIcon(category) {
    const icons = {
        'food': '🍽️',
        'transport': '🚗',
        'entertainment': '🎬',
        'shopping': '🛍️',
        'bills': '💡',
        'health': '🏥',
        'education': '📚',
        'other': '📦'
    };
    return icons[category] || '📦';
}

// Get Category Name
function getCategoryName(category) {
    const names = {
        'food': 'Food & Dining',
        'transport': 'Transportation',
        'entertainment': 'Entertainment',
        'shopping': 'Shopping',
        'bills': 'Bills & Utilities',
        'health': 'Health & Medical',
        'education': 'Education',
        'other': 'Other'
    };
    return names[category] || 'Other';
}

// Format Date
function formatDate(dateString) {
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString('en-IN', options);
}

// Delete Expense
function deleteExpense(id) {
    const expenseIndex = expenses.findIndex(expense => expense.id === id);
    
    if (expenseIndex !== -1) {
        const deletedExpense = expenses[expenseIndex];
        totalExpenses -= deletedExpense.amount;
        expenses.splice(expenseIndex, 1);
        
        updateBudgetDisplay();
        displayExpenses();
        saveToStorage(); // Save data to localStorage
        
        showAlert(`Expense "${deletedExpense.title}" deleted successfully!`, 'success');
    }
}

// Filter Expenses (works with search and sort)
function filterExpenses() {
    // Use the search function which handles all filtering
    searchExpenses();
}

// Sort Expenses (DSA Feature - updated to work with search/filter)
function sortExpenses() {
    const sortType = document.getElementById('sortFilter').value;
    
    if (sortType) {
        const sortNames = {
            'date-newest': 'Date & Time (Newest First)',
            'date-oldest': 'Date & Time (Oldest First)', 
            'amount-highest': 'Amount (Highest First)',
            'amount-lowest': 'Amount (Lowest First)',
            'category': 'Category (A-Z)',
            'title': 'Title (A-Z)'
        };
        showAlert(`📊 Expenses sorted by: ${sortNames[sortType]}`, 'info');
    }
    
    // Use the search function which handles all filtering and sorting
    searchExpenses();
}

// Clear All Expenses
function clearAllExpenses() {
    if (expenses.length === 0) {
        showAlert('No expenses to clear!', 'info');
        return;
    }
    
    if (confirm('Are you sure you want to clear all expenses? This action cannot be undone.')) {
        expenses = [];
        totalExpenses = 0;
        updateBudgetDisplay();
        displayExpenses();
        saveToStorage(); // Save data to localStorage
        showAlert('All expenses cleared successfully!', 'success');
    }
}

// Check Budget Warning
function checkBudgetWarning() {
    const remaining = budget - totalExpenses;
    const percentage = (totalExpenses / budget) * 100;
    
    if (remaining <= 0) {
        showAlert('⚠️ Budget exceeded! You have overspent your monthly budget.', 'error');
    } else if (percentage >= 80) {
        showAlert('⚠️ Budget Warning! You have used 80% of your monthly budget.', 'warning');
    } else if (percentage >= 50) {
        showAlert('💡 Budget Alert: You have used 50% of your monthly budget.', 'info');
    }
}

// Show Alert Function
function showAlert(message, type = 'info') {
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transform: translateX(400px);
        transition: transform 0.3s ease;
    `;
    
    // Set background color based on type
    const colors = {
        'success': '#51cf66',
        'error': '#ff6b6b',
        'warning': '#ffd93d',
        'info': '#667eea'
    };
    alert.style.background = colors[type] || colors.info;
    
    // Set alert content
    alert.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; margin-left: 10px;">
                ×
            </button>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(alert);
    
    // Animate in
    setTimeout(() => {
        alert.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (alert.parentElement) {
                    alert.remove();
                }
            }, 300);
        }
    }, 4000);
}

// Calculate Statistics
function getExpenseStats() {
    const stats = {
        totalExpenses: totalExpenses,
        expenseCount: expenses.length,
        averageExpense: expenses.length > 0 ? totalExpenses / expenses.length : 0,
        categoryBreakdown: {},
        dailyAverage: 0
    };
    
    // Calculate category breakdown
    expenses.forEach(expense => {
        if (!stats.categoryBreakdown[expense.category]) {
            stats.categoryBreakdown[expense.category] = 0;
        }
        stats.categoryBreakdown[expense.category] += expense.amount;
    });
    
    // Calculate daily average for current month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = now.getDate();
    
    const monthlyExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= firstDayOfMonth;
    });
    
    const monthlyTotal = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    stats.dailyAverage = daysInMonth > 0 ? monthlyTotal / daysInMonth : 0;
    
    return stats;
}

// Export expenses to CSV (for future use)
function exportExpenses() {
    if (expenses.length === 0) {
        showAlert('No expenses to export!', 'info');
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
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showAlert('Expenses exported successfully!', 'success');
}

// Search expenses (DSA Feature - Linear Search Algorithm)
function searchExpenses() {
    const query = document.getElementById('searchInput').value.trim();
    const selectedCategory = document.getElementById('categoryFilter').value;
    const sortType = document.getElementById('sortFilter').value;
    
    // Start with all expenses
    let filteredExpenses = [...expenses];
    
    // Apply search filter using Linear Search Algorithm
    if (query) {
        // Linear Search Implementation - O(n) time complexity
        filteredExpenses = linearSearchExpenses(filteredExpenses, query);
        
        // Show search feedback
        if (filteredExpenses.length === 0) {
            showAlert(`No expenses found matching "${query}"`, 'info');
        } else if (query.length > 2) { // Only show success for meaningful searches
            showAlert(`🔍 Found ${filteredExpenses.length} expense(s) matching "${query}"`, 'success');
        }
    }
    
    // Apply category filter
    if (selectedCategory) {
        filteredExpenses = filteredExpenses.filter(expense => expense.category === selectedCategory);
    }
    
    // Apply sorting
    if (sortType) {
        applySorting(filteredExpenses, sortType);
    }
    
    displayExpenses(filteredExpenses);
}

// Clear all filters and search
function clearAllFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('sortFilter').value = '';
    displayExpenses(expenses);
    showAlert('🧹 All filters cleared!', 'info');
}

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

// Get expenses by date range
function getExpensesByDateRange(startDate, endDate) {
    return expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return expenseDate >= start && expenseDate <= end;
    });
}

// Format currency in Indian format
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Validate input fields
function validateExpenseInput(title, amount, category, date) {
    const errors = [];
    
    if (!title.trim()) {
        errors.push('Title is required');
    }
    
    if (isNaN(amount) || amount <= 0) {
        errors.push('Amount must be a valid positive number');
    }
    
    if (!category) {
        errors.push('Category is required');
    }
    
    if (!date) {
        errors.push('Date is required');
    } else {
        const expenseDate = new Date(date);
        const today = new Date();
        if (expenseDate > today) {
            errors.push('Expense date cannot be in the future');
        }
    }
    
    return errors;
}

// Local Storage functions - Now ENABLED for data persistence

function saveToStorage() {
    try {
        localStorage.setItem('expenseTracker', JSON.stringify({
            budget: budget,
            expenses: expenses,
            totalExpenses: totalExpenses
        }));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem('expenseTracker');
        if (saved) {
            const data = JSON.parse(saved);
            budget = data.budget || 0;
            expenses = data.expenses || [];
            totalExpenses = data.totalExpenses || 0;
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        // Reset data on error
        budget = 0;
        expenses = [];
        totalExpenses = 0;
    }
}

function clearStorage() {
    try {
        localStorage.removeItem('expenseTracker');
    } catch (error) {
        console.error('Error clearing localStorage:', error);
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl+N or Cmd+N to focus on expense title input
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.getElementById('expenseTitle').focus();
        showAlert('Quick Add: Start typing your expense!', 'info');
    }
    
    // Escape to close mobile menu
    if (e.key === 'Escape') {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    }
});

// Input formatting for amount field
document.getElementById('expenseAmount').addEventListener('input', function(e) {
    let value = e.target.value;
    // Remove any non-digit characters except decimal point
    value = value.replace(/[^\d.]/g, '');
    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }
    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) {
        value = parts[0] + '.' + parts[1].substring(0, 2);
    }
    e.target.value = value;
});

// Budget input formatting
budgetInput.addEventListener('input', function(e) {
    let value = e.target.value;
    value = value.replace(/[^\d.]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts[1] && parts[1].length > 2) {
        value = parts[0] + '.' + parts[1].substring(0, 2);
    }
    e.target.value = value;
});

// Console welcome message
console.log(`
🎉 Welcome to Personal Expense Tracker!
📊 Track your expenses smartly and manage your budget effectively.
💡 Keyboard Shortcuts:
   • Ctrl/Cmd + N: Quick add expense
   • Escape: Close mobile menu
🚀 Built with HTML5, CSS3, and Vanilla JavaScript
`);

// Add some sample data for demonstration (remove in production)
function addSampleData() {
    if (expenses.length === 0) {
        const sampleExpenses = [
            { id: 1, title: 'Lunch at office', amount: 150, category: 'food', date: '2025-09-01' },
            { id: 2, title: 'Uber ride', amount: 80, category: 'transport', date: '2025-08-31' },
            { id: 3, title: 'Movie tickets', amount: 300, category: 'entertainment', date: '2025-08-30' },
            { id: 4, title: 'Grocery shopping', amount: 1200, category: 'shopping', date: '2025-08-29' }
        ];
        
        expenses = sampleExpenses;
        totalExpenses = sampleExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        budget = 15000; // Sample budget
        
        updateBudgetDisplay();
        displayExpenses();
    }
}

// Uncomment the next line to see sample data (for demo purposes)
// addSampleData();