let accounts = [];

function loadAccounts() {
    accounts = Toolbox.getFromStorage(Toolbox.STORAGE_KEYS.ACCOUNTS, []);
}

function saveAccounts() {
    Toolbox.saveToStorage(Toolbox.STORAGE_KEYS.ACCOUNTS, accounts);
}

function addAccount(amount, desc, type) {
    if (!amount || amount <= 0) return;
    
    const newAccount = {
        id: Date.now(),
        amount: parseFloat(amount),
        desc: desc || (type === 'income' ? '收入' : '支出'),
        type: type,
        createdAt: new Date().toISOString()
    };
    
    accounts.unshift(newAccount);
    saveAccounts();
    renderAccounts();
    updateSummary();
}

function deleteAccount(id) {
    accounts = accounts.filter(a => a.id !== id);
    saveAccounts();
    renderAccounts();
    updateSummary();
}

function updateSummary() {
    const income = accounts.filter(a => a.type === 'income').reduce((sum, a) => sum + a.amount, 0);
    const expense = accounts.filter(a => a.type === 'expense').reduce((sum, a) => sum + a.amount, 0);
    const balance = income - expense;
    
    document.getElementById('total-income').textContent = `¥${income.toFixed(2)}`;
    document.getElementById('total-expense').textContent = `¥${expense.toFixed(2)}`;
    document.getElementById('balance').textContent = `¥${balance.toFixed(2)}`;
    document.getElementById('record-count').textContent = accounts.length;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function renderAccounts() {
    const list = document.getElementById('account-list');
    
    if (accounts.length === 0) {
        list.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-8">暂无记账记录</p>';
        return;
    }
    
    list.innerHTML = accounts.map(account => `
        <div class="account-item flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full flex items-center justify-center ${account.type === 'income' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}">
                    <i class="fas ${account.type === 'income' ? 'fa-plus' : 'fa-minus'} ${account.type === 'income' ? 'text-green-600' : 'text-red-600'}"></i>
                </div>
                <div>
                    <div class="text-gray-800 dark:text-white font-medium">${account.desc}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">${formatDate(account.createdAt)}</div>
                </div>
            </div>
            <div class="${account.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} font-bold">
                ${account.type === 'income' ? '+' : '-'}¥${account.amount.toFixed(2)}
            </div>
            <button onclick="deleteAccount(${account.id})" 
                    class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function exportAccounts() {
    Toolbox.exportData('accounts_backup.json', {
        accounts,
        exportTime: new Date().toISOString()
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadAccounts();
    renderAccounts();
    updateSummary();

    const amountInput = document.getElementById('account-amount');
    const descInput = document.getElementById('account-desc');
    const typeSelect = document.getElementById('account-type');
    const addBtn = document.getElementById('add-account');
    
    addBtn.addEventListener('click', () => {
        addAccount(amountInput.value, descInput.value, typeSelect.value);
        amountInput.value = '';
        descInput.value = '';
    });
    
    amountInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addAccount(amountInput.value, descInput.value, typeSelect.value);
            amountInput.value = '';
            descInput.value = '';
        }
    });
    
    document.getElementById('account-export').addEventListener('click', exportAccounts);
});