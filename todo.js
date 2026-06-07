/**
 * ===================================
 * 待办清单模块 - todo.js
 * ===================================
 * 功能：添加、完成、编辑、删除待办事项
 * 数据持久化：LocalStorage
 */

const TodoApp = {
    todos: [],
    currentFilter: 'all',
    priorities: {
        normal: { label: '普通', class: 'normal' },
        important: { label: '重要', class: 'important' },
        urgent: { label: '紧急', class: 'urgent' }
    },

    init() {
        this.loadData();
        this.bindEvents();
        this.render();
    },

    loadData() {
        const saved = Utils.getStorage(Utils.STORAGE_KEYS.TODO);
        this.todos = Array.isArray(saved) ? saved : [];
    },

    saveData() {
        Utils.setStorage(Utils.STORAGE_KEYS.TODO, this.todos);
    },

    recordUsage() {
        const stats = StatsApp.getStats();
        stats.todoUsage = (stats.todoUsage || 0) + 1;
        StatsApp.saveStats(stats);
    },

    bindEvents() {
        const addBtn = document.getElementById('add-todo');
        const input = document.getElementById('todo-input');
        const prioritySelect = document.getElementById('todo-priority');

        if (addBtn && input) {
            addBtn.addEventListener('click', () => this.addTodo());
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addTodo();
                }
            });
        }

        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.setFilter(filter);
            });
        });

        const clearBtn = document.getElementById('clear-completed');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearCompleted());
        }
    },

    addTodo() {
        const input = document.getElementById('todo-input');
        const prioritySelect = document.getElementById('todo-priority');

        if (!input || !prioritySelect) return;

        const text = input.value.trim();
        const priority = prioritySelect.value;

        if (!text) {
            Utils.showToast('请输入待办内容', 'error');
            return;
        }

        const todo = {
            id: Utils.generateId(),
            text,
            priority,
            completed: false,
            createdAt: Date.now()
        };

        this.todos.push(todo);
        this.saveData();
        this.render();

        this.recordUsage();
        QuickAccess.addRecent('todo', '添加待办');

        input.value = '';
        input.focus();

        Utils.showToast('添加成功', 'success');
    },

    toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            this.saveData();
            this.render();
            StatsApp.recordCompletion(todo.completed);
            QuickAccess.addRecent('todo', todo.completed ? '完成任务' : '取消完成');
        }
    },

    deleteTodo(id) {
        const index = this.todos.findIndex(t => t.id === id);
        if (index > -1) {
            this.todos.splice(index, 1);
            this.saveData();
            this.render();
            Utils.showToast('已删除', 'success');
        }
    },

    editTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (!todo) return;

        const newText = prompt('编辑待办内容：', todo.text);
        if (newText && newText.trim()) {
            todo.text = newText.trim();
            this.saveData();
            this.render();
            Utils.showToast('已更新', 'success');
        }
    },

    setFilter(filter) {
        this.currentFilter = filter;

        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        this.render();
    },

    clearCompleted() {
        const completedCount = this.todos.filter(t => t.completed).length;

        if (completedCount === 0) {
            Utils.showToast('没有已完成的待办', 'info');
            return;
        }

        if (confirm(`确定要清除 ${completedCount} 项已完成的待办吗？`)) {
            this.todos = this.todos.filter(t => !t.completed);
            this.saveData();
            this.render();
            Utils.showToast(`已清除 ${completedCount} 项`, 'success');
        }
    },

    getFilteredTodos() {
        switch (this.currentFilter) {
            case 'active':
                return this.todos.filter(t => !t.completed);
            case 'completed':
                return this.todos.filter(t => t.completed);
            default:
                return this.todos;
        }
    },

    render() {
        const list = document.getElementById('todo-list');
        const countEl = document.getElementById('todo-count');

        if (!list) return;

        const filtered = this.getFilteredTodos();

        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <p style="font-size: 3rem; margin-bottom: 12px;">📋</p>
                    <p>${this.currentFilter === 'all' ? '暂无待办事项' : '没有符合条件的事项'}</p>
                </div>
            `;
        } else {
            list.innerHTML = filtered.map(todo => this.renderTodoItem(todo)).join('');
        }

        if (countEl) {
            const activeCount = this.todos.filter(t => !t.completed).length;
            const completedCount = this.todos.filter(t => t.completed).length;
            countEl.textContent = `${activeCount} 项待办${completedCount > 0 ? `，${completedCount} 项已完成` : ''}`;
        }

        this.bindListEvents();
    },

    renderTodoItem(todo) {
        const priority = this.priorities[todo.priority] || this.priorities.normal;
        const dateStr = Utils.formatDate(todo.createdAt, 'MM-DD HH:mm');

        return `
            <div class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
                <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" data-action="toggle" title="${todo.completed ? '取消完成' : '标记完成'}"></div>
                <div class="todo-content">
                    <div class="todo-text">${this.escapeHtml(todo.text)}</div>
                    <div class="todo-meta">
                        <span class="todo-priority ${priority.class}">${priority.label}</span>
                        <span class="todo-date">${dateStr}</span>
                    </div>
                </div>
                <div class="todo-actions">
                    <button data-action="edit" title="编辑">✏️</button>
                    <button class="delete-btn" data-action="delete" title="删除">🗑️</button>
                </div>
            </div>
        `;
    },

    bindListEvents() {
        const list = document.getElementById('todo-list');
        if (!list) return;

        list.addEventListener('click', (e) => {
            const target = e.target;
            const item = target.closest('.todo-item');

            if (!item) return;

            const id = item.dataset.id;
            const action = target.dataset.action;

            switch (action) {
                case 'toggle':
                    this.toggleTodo(id);
                    break;
                case 'edit':
                    this.editTodo(id);
                    break;
                case 'delete':
                    this.deleteTodo(id);
                    break;
            }
        });
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    getStats() {
        const total = this.todos.length;
        const completed = this.todos.filter(t => t.completed).length;
        const active = total - completed;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
            total,
            completed,
            active,
            completionRate
        };
    }
};

window.TodoApp = TodoApp;