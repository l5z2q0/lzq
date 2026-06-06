/**
 * ===================================
 * 记账本模块 - account.js
 * ===================================
 * 功能：收入/支出记录、分类管理、月度统计
 * 数据持久化：LocalStorage
 */

const AccountApp = {
    // 记账记录列表
    accounts: [],

    // 当前查看的月份
    currentMonth: Utils.getCurrentMonth(),

    // 分类配置
    categories: {
        income: [
            { id: 'salary', name: '工资', icon: '💼' },
            { id: 'bonus', name: '奖金', icon: '🎁' },
            { id: 'investment', name: '投资收益', icon: '📈' },
            { id: 'gift', name: '礼金', icon: '💝' },
            { id: 'other-income', name: '其他', icon: '💰' }
        ],
        expense: [
            { id: 'food', name: '餐饮', icon: '🍔' },
            { id: 'transport', name: '交通', icon: '🚗' },
            { id: 'shopping', name: '购物', icon: '🛒' },
            { id: 'entertainment', name: '娱乐', icon: '🎮' },
            { id: 'housing', name: '居住', icon: '🏠' },
            { id: 'medical', name: '医疗', icon: '💊' },
            { id: 'education', name: '教育', icon: '📚' },
            { id: 'other-expense', name: '其他', icon: '📦' }
        ]
    },

    /**
     * 初始化记账应用
     */
    init() {
        this.loadData();
        this.bindEvents();
        this.renderCategories();
        this.renderMonthSelector();
        this.render();
    },

    /**
     * 从 LocalStorage 加载数据
     */
    loadData() {
        const saved = Utils.getStorage(Utils.STORAGE_KEYS.ACCOUNTS);
        this.accounts = Array.isArray(saved) ? saved : [];
    },

    /**
     * 保存数据到 LocalStorage
     */
    saveData() {
        Utils.setStorage(Utils.STORAGE_KEYS.ACCOUNTS, this.accounts);
    },

    /**
     * 记录使用统计
     */
    recordUsage() {
        const stats = StatsApp.getStats();
        stats.accountUsage = (stats.accountUsage || 0) + 1;
        StatsApp.saveStats(stats);
    },

    /**
     * 绑定事件监听
     */
    bindEvents() {
        // 添加记录按钮
        const addBtn = document.getElementById('add-account');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addAccount());
        }

        // 类型切换时更新分类
        const typeSelect = document.getElementById('account-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => this.renderCategories());
        }

        // 月份选择
        const monthSelect = document.getElementById('account-month');
        if (monthSelect) {
            monthSelect.addEventListener('change', (e) => {
                this.currentMonth = e.target.value;
                this.render();
            });
        }
    },

    /**
     * 渲染分类下拉框
     */
    renderCategories() {
        const type = document.getElementById('account-type')?.value || 'expense';
        const categorySelect = document.getElementById('account-category');

        if (!categorySelect) return;

        const cats = this.categories[type] || [];

        categorySelect.innerHTML = cats.map(cat => `
            <option value="${cat.id}">${cat.icon} ${cat.name}</option>
        `).join('');
    },

    /**
     * 渲染月份选择器
     */
    renderMonthSelector() {
        const select = document.getElementById('account-month');
        if (!select) return;

        // 生成最近6个月的选项
        const months = [];
        const now = new Date();

        for (let i = 0; i < 6; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const value = `${year}-${String(month).padStart(2, '0')}`;
            const label = `${year}年${month}月`;
            months.push({ value, label });
        }

        select.innerHTML = months.map(m => `
            <option value="${m.value}" ${m.value === this.currentMonth ? 'selected' : ''}>${m.label}</option>
        `).join('');
    },

    /**
     * 添加记账记录
     */
    addAccount() {
        const amountInput = document.getElementById('account-amount');
        const typeSelect = document.getElementById('account-type');
        const categorySelect = document.getElementById('account-category');
        const noteInput = document.getElementById('account-note');

        if (!amountInput || !typeSelect || !categorySelect) return;

        const amount = parseFloat(amountInput.value);

        if (isNaN(amount) || amount <= 0) {
            Utils.showToast('请输入有效金额', 'error');
            return;
        }

        const record = {
            id: Utils.generateId(),
            type: typeSelect.value,
            category: categorySelect.value,
            amount: amount,
            note: noteInput?.value?.trim() || '',
            date: Date.now(),
            month: this.currentMonth
        };

        this.accounts.push(record);
        this.saveData();
        this.render();

        // 记录统计
        this.recordUsage();
        QuickAccess.addRecent('account', '添加记账记录');

        // 清空输入
        amountInput.value = '';
        if (noteInput) noteInput.value = '';

        Utils.showToast('记录已添加', 'success');
    },

    /**
     * 删除记账记录
     * @param {string} id - 记录ID
     */
    deleteAccount(id) {
        const index = this.accounts.findIndex(a => a.id === id);
        if (index > -1) {
            this.accounts.splice(index, 1);
            this.saveData();
            this.render();
            Utils.showToast('已删除', 'success');
        }
    },

    /**
     * 获取当前月份的记录
     * @returns {Array} 当月记录
     */
    getMonthRecords() {
        return this.accounts.filter(a => a.month === this.currentMonth);
    },

    /**
     * 计算月度统计
     * @returns {Object} { income: number, expense: number, balance: number }
     */
    calculateMonthlyStats() {
        const records = this.getMonthRecords();

        const income = records
            .filter(r => r.type === 'income')
            .reduce((sum, r) => sum + r.amount, 0);

        const expense = records
            .filter(r => r.type === 'expense')
            .reduce((sum, r) => sum + r.amount, 0);

        return {
            income: Math.round(income * 100) / 100,
            expense: Math.round(expense * 100) / 100,
            balance: Math.round((income - expense) * 100) / 100
        };
    },

    /**
     * 获取分类统计数据
     * @returns {Object} 各分类金额统计
     */
    getCategoryStats() {
        const records = this.getMonthRecords();
        const stats = {
            income: {},
            expense: {}
        };

        records.forEach(r => {
            if (!stats[r.type][r.category]) {
                stats[r.type][r.category] = 0;
            }
            stats[r.type][r.category] += r.amount;
        });

        return stats;
    },

    /**
     * 渲染摘要卡片
     */
    renderSummary() {
        const stats = this.calculateMonthlyStats();

        const incomeEl = document.getElementById('total-income');
        const expenseEl = document.getElementById('total-expense');
        const balanceEl = document.getElementById('total-balance');

        if (incomeEl) {
            incomeEl.textContent = `¥${stats.income.toFixed(2)}`;
            this.animateValue(incomeEl, stats.income);
        }

        if (expenseEl) {
            expenseEl.textContent = `¥${stats.expense.toFixed(2)}`;
            this.animateValue(expenseEl, stats.expense);
        }

        if (balanceEl) {
            balanceEl.textContent = `¥${stats.balance.toFixed(2)}`;
            balanceEl.style.color = stats.balance >= 0 ? 'var(--income)' : 'var(--expense)';
        }
    },

    /**
     * 数字滚动动画
     * @param {HTMLElement} element - 目标元素
     * @param {number} target - 目标数值
     */
    animateValue(element, target) {
        const current = parseFloat(element.textContent.replace(/[^0-9.-]/g, '')) || 0;
        const diff = target - current;
        const duration = 500;
        const steps = 20;
        const stepValue = diff / steps;
        let step = 0;

        const animate = () => {
            step++;
            const value = current + stepValue * step;
            element.textContent = `¥${value.toFixed(2)}`;

            if (step < steps) {
                requestAnimationFrame(animate);
            } else {
                element.textContent = `¥${target.toFixed(2)}`;
            }
        };

        if (Math.abs(diff) > 1) {
            animate();
        }
    },

    /**
     * 渲染记账列表
     */
    renderList() {
        const list = document.getElementById('account-list');
        if (!list) return;

        const records = this.getMonthRecords().sort((a, b) => b.date - a.date);

        if (records.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <p style="font-size: 3rem; margin-bottom: 12px;">💸</p>
                    <p>本月暂无记账记录</p>
                </div>
            `;
            return;
        }

        list.innerHTML = records.map(record => {
            const category = this.getCategoryInfo(record.type, record.category);
            const dateStr = Utils.formatDate(record.date, 'MM-DD HH:mm');

            return `
                <div class="account-item ${record.type}" data-id="${record.id}">
                    <div class="account-icon">${category?.icon || '📌'}</div>
                    <div class="account-info">
                        <div class="account-category">${category?.name || record.category}</div>
                        ${record.note ? `<div class="account-note-text">${this.escapeHtml(record.note)}</div>` : ''}
                    </div>
                    <div class="account-amount">${record.type === 'income' ? '+' : '-'}¥${record.amount.toFixed(2)}</div>
                    <div class="account-date">${dateStr}</div>
                    <button class="delete-btn btn-icon" data-action="delete" title="删除">🗑️</button>
                </div>
            `;
        }).join('');

        // 绑定删除事件
        list.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.account-item');
                if (item) {
                    this.deleteAccount(item.dataset.id);
                }
            });
        });
    },

    /**
     * 获取分类信息
     * @param {string} type - 类型 income/expense
     * @param {string} categoryId - 分类ID
     * @returns {Object|null} 分类信息
     */
    getCategoryInfo(type, categoryId) {
        const cats = this.categories[type] || [];
        return cats.find(c => c.id === categoryId) || null;
    },

    /**
     * 渲染图表
     */
    renderChart() {
        const container = document.getElementById('chart-container');
        if (!container) return;

        const stats = this.calculateMonthlyStats();
        const catStats = this.getCategoryStats();

        const maxValue = Math.max(stats.income, stats.expense, 1);

        const incomePercent = stats.income > 0 ? (stats.income / maxValue * 100) : 0;
        const expensePercent = stats.expense > 0 ? (stats.expense / maxValue * 100) : 0;

        container.innerHTML = `
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>收入</span>
                    <span>¥${stats.income.toFixed(2)}</span>
                </div>
                <div class="chart-bar-track">
                    <div class="chart-bar-fill income" style="width: ${incomePercent}%"></div>
                </div>
            </div>
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>支出</span>
                    <span>¥${stats.expense.toFixed(2)}</span>
                </div>
                <div class="chart-bar-track">
                    <div class="chart-bar-fill expense" style="width: ${expensePercent}%"></div>
                </div>
            </div>
        `;
    },

    /**
     * 渲染完整界面
     */
    render() {
        this.renderSummary();
        this.renderList();
        this.renderChart();
    },

    /**
     * HTML转义
     * @param {string} text - 原始文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 获取统计数据（供外部使用）
     * @returns {Object} 统计数据
     */
    getStats() {
        const records = this.getMonthRecords();
        const monthlyStats = this.calculateMonthlyStats();

        // 按月汇总收支
        const monthlyData = {};
        this.accounts.forEach(r => {
            if (!monthlyData[r.month]) {
                monthlyData[r.month] = { income: 0, expense: 0 };
            }
            monthlyData[r.month][r.type] += r.amount;
        });

        return {
            ...monthlyStats,
            monthlyData,
            totalRecords: this.accounts.length,
            currentMonthRecords: records.length
        };
    }
};

// 暴露到全局
window.AccountApp = AccountApp;
