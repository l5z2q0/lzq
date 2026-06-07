function updateStats() {
    const todos = Toolbox.getFromStorage(Toolbox.STORAGE_KEYS.TODOS, []);
    const accounts = Toolbox.getFromStorage(Toolbox.STORAGE_KEYS.ACCOUNTS, []);
    const calcCount = Toolbox.getFromStorage(Toolbox.STORAGE_KEYS.CALC_COUNT, 0);
    
    const totalTodos = todos.length;
    const completedTodos = todos.filter(t => t.completed).length;
    const completionRate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
    
    const totalIncome = accounts.filter(a => a.type === 'income').reduce((sum, a) => sum + a.amount, 0);
    const totalExpense = accounts.filter(a => a.type === 'expense').reduce((sum, a) => sum + a.amount, 0);
    
    document.getElementById('stats-todo-total').textContent = totalTodos;
    document.getElementById('stats-todo-completed').textContent = completedTodos;
    document.getElementById('stats-todo-rate').textContent = `${completionRate}%`;
    document.getElementById('stats-calc-count').textContent = calcCount;
    document.getElementById('stats-account-income').textContent = `¥${totalIncome.toFixed(2)}`;
    document.getElementById('stats-account-expense').textContent = `¥${totalExpense.toFixed(2)}`;
    
    document.getElementById('progress-text').textContent = `${completionRate}%`;
    document.getElementById('progress-bar').style.width = `${completionRate}%`;
    
    const maxAmount = Math.max(totalIncome, totalExpense, 1);
    const incomeHeight = Math.min((totalIncome / maxAmount) * 100, 100);
    const expenseHeight = Math.min((totalExpense / maxAmount) * 100, 100);
    
    document.getElementById('bar-income').style.height = `${incomeHeight}%`;
    document.getElementById('bar-expense').style.height = `${expenseHeight}%`;
}