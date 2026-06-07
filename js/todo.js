let todos = [];
let currentFilter = 'all';

function loadTodos() {
    todos = Toolbox.getFromStorage(Toolbox.STORAGE_KEYS.TODOS, []);
}

function saveTodos() {
    Toolbox.saveToStorage(Toolbox.STORAGE_KEYS.TODOS, todos);
}

function addTodo(text) {
    if (!text.trim()) return;
    
    const newTodo = {
        id: Date.now(),
        text: text.trim(),
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    todos.unshift(newTodo);
    saveTodos();
    renderTodos();
}

function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        saveTodos();
        renderTodos();
    }
}

function deleteTodo(id) {
    todos = todos.filter(t => t.id !== id);
    saveTodos();
    renderTodos();
}

function clearCompleted() {
    todos = todos.filter(t => !t.completed);
    saveTodos();
    renderTodos();
}

function filterTodos(filter) {
    currentFilter = filter;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-blue-500', 'text-white');
        btn.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300', 'hover:bg-gray-300', 'dark:hover:bg-gray-600');
    });
    
    const activeBtn = document.getElementById(`filter-${filter}`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300', 'hover:bg-gray-300', 'dark:hover:bg-gray-600');
        activeBtn.classList.add('active', 'bg-blue-500', 'text-white');
    }
    
    renderTodos();
}

function getFilteredTodos() {
    switch (currentFilter) {
        case 'active':
            return todos.filter(t => !t.completed);
        case 'completed':
            return todos.filter(t => t.completed);
        default:
            return todos;
    }
}

function renderTodos() {
    const list = document.getElementById('todo-list');
    const filteredTodos = getFilteredTodos();
    
    if (filteredTodos.length === 0) {
        list.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-8">暂无待办事项</p>';
        return;
    }
    
    list.innerHTML = filteredTodos.map(todo => `
        <div class="todo-item ${todo.completed ? 'completed' : ''} flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <input type="checkbox" ${todo.completed ? 'checked' : ''} 
                   class="w-5 h-5 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-blue-500 focus:ring-blue-500 cursor-pointer"
                   onclick="toggleTodo(${todo.id})">
            <span class="flex-1 text-gray-800 dark:text-white todo-text">${todo.text}</span>
            <button onclick="deleteTodo(${todo.id})" 
                    class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function exportTodos() {
    Toolbox.exportData('todos_backup.json', {
        todos,
        exportTime: new Date().toISOString()
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadTodos();
    renderTodos();

    const input = document.getElementById('todo-input');
    const addBtn = document.getElementById('add-todo');
    
    addBtn.addEventListener('click', () => {
        addTodo(input.value);
        input.value = '';
    });
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTodo(input.value);
            input.value = '';
        }
    });
    
    document.getElementById('filter-all').addEventListener('click', () => filterTodos('all'));
    document.getElementById('filter-active').addEventListener('click', () => filterTodos('active'));
    document.getElementById('filter-completed').addEventListener('click', () => filterTodos('completed'));
    
    document.getElementById('clear-completed').addEventListener('click', clearCompleted);
    document.getElementById('todo-export').addEventListener('click', exportTodos);
});