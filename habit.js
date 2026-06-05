/**
 * ===================================
 * 习惯打卡模块 - habit.js
 * ===================================
 * 功能：习惯添加、打卡记录、日历视图、统计
 * 数据持久化：LocalStorage
 */

const HabitApp = {
    // 习惯列表
    habits: [],

    // 打卡记录 { 'habitId_date': true }
    checkins: {},

    // 当前查看的月份
    currentMonth: new Date(),

    /**
     * 初始化习惯打卡应用
     */
    init() {
        this.loadData();
        this.bindEvents();
        this.render();
    },

    /**
     * 从 LocalStorage 加载数据
     */
    loadData() {
        const habits = Utils.getStorage(Utils.STORAGE_KEYS.HABITS);
        const checkins = Utils.getStorage(Utils.STORAGE_KEYS.HABIT_CHECKINS);

        this.habits = Array.isArray(habits) ? habits : [];
        this.checkins = checkins || {};
    },

    /**
     * 保存数据到 LocalStorage
     */
    saveData() {
        Utils.setStorage(Utils.STORAGE_KEYS.HABITS, this.habits);
        Utils.setStorage(Utils.STORAGE_KEYS.HABIT_CHECKINS, this.checkins);
    },

    /**
     * 记录使用统计
     */
    recordUsage() {
        const stats = StatsApp.getStats();
        stats.habitUsage = (stats.habitUsage || 0) + 1;
        StatsApp.saveStats(stats);
    },

    /**
     * 绑定事件监听
     */
    bindEvents() {
        // 添加习惯按钮
        const addBtn = document.getElementById('add-habit-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.toggleAddSection());
        }

        // 确认添加
        const confirmBtn = document.getElementById('confirm-add-habit');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.addHabit());
        }

        // 月份切换
        const prevBtn = document.getElementById('habit-prev-month');
        const nextBtn = document.getElementById('habit-next-month');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.changeMonth(-1));
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.changeMonth(1));
        }
    },

    /**
     * 切换添加习惯区域显示
     */
    toggleAddSection() {
        const section = document.getElementById('habit-input-section');
        if (section) {
            const isHidden = section.style.display === 'none';
            section.style.display = isHidden ? 'flex' : 'none';

            if (isHidden) {
                document.getElementById('habit-name-input')?.focus();
            }
        }
    },

    /**
     * 添加新习惯
     */
    addHabit() {
        const nameInput = document.getElementById('habit-name-input');
        const iconSelect = document.getElementById('habit-icon-select');

        if (!nameInput || !iconSelect) return;

        const name = nameInput.value.trim();
        const icon = iconSelect.value;

        if (!name) {
            Utils.showToast('请输入习惯名称', 'error');
            return;
        }

        const habit = {
            id: Utils.generateId(),
            name: name,
            icon: icon,
            createdAt: Date.now()
        };

        this.habits.push(habit);
        this.saveData();

        nameInput.value = '';
        this.toggleAddSection();
        this.render();

        this.recordUsage();
        QuickAccess.addRecent('habit', '添加习惯');

        Utils.showToast('习惯添加成功', 'success');
    },

    /**
     * 删除习惯
     * @param {string} id - 习惯ID
     */
    deleteHabit(id) {
        if (!confirm('确定要删除这个习惯吗？')) return;

        this.habits = this.habits.filter(h => h.id !== id);

        // 删除相关打卡记录
        Object.keys(this.checkins).forEach(key => {
            if (key.startsWith(id)) {
                delete this.checkins[key];
            }
        });

        this.saveData();
        this.render();
        Utils.showToast('已删除', 'success');
    },

    /**
     * 切换打卡状态
     * @param {string} habitId - 习惯ID
     * @param {string} date - 日期字符串 YYYY-MM-DD
     */
    toggleCheckin(habitId, date) {
        const key = `${habitId}_${date}`;

        if (this.checkins[key]) {
            delete this.checkins[key];
        } else {
            this.checkins[key] = true;
            this.recordUsage();
        }

        this.saveData();
        this.render();

        if (!this.checkins[key]) {
            Utils.showToast('已取消打卡', 'info');
        } else {
            Utils.showToast('打卡成功', 'success');
        }
    },

    /**
     * 检查某习惯某日期是否已打卡
     * @param {string} habitId - 习惯ID
     * @param {string} date - 日期字符串
     * @returns {boolean} 是否已打卡
     */
    isCheckedIn(habitId, date) {
        return !!this.checkins[`${habitId}_${date}`];
    },

    /**
     * 切换月份
     * @param {number} delta - 月份变化量
     */
    changeMonth(delta) {
        this.currentMonth = new Date(
            this.currentMonth.getFullYear(),
            this.currentMonth.getMonth() + delta,
            1
        );
        this.renderCalendar();
    },

    /**
     * 获取当前月份日期范围
     * @returns {Object} { year, month, firstDay, daysInMonth }
     */
    getMonthInfo() {
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        return { year, month, firstDay, daysInMonth };
    },

    /**
     * 渲染日历
     */
    renderCalendar() {
        const container = document.getElementById('habit-calendar-days');
        const monthDisplay = document.getElementById('habit-current-month');

        if (!container) return;

        const { year, month, firstDay, daysInMonth } = this.getMonthInfo();

        // 更新月份显示
        if (monthDisplay) {
            monthDisplay.textContent = `${year}年${month + 1}月`;
        }

        // 生成日期格子
        let html = '';

        // 填充空白
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="habit-day empty"></div>';
        }

        // 填充日期
        const today = Utils.formatDate(new Date(), 'YYYY-MM-DD');

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const isFuture = dateStr > today;

            html += `<div class="habit-day ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}" data-date="${dateStr}">`;
            html += `<span class="habit-day-num">${day}</span>`;

            // 渲染每个习惯的打卡状态
            if (!isFuture) {
                html += '<div class="habit-day-checkins">';
                this.habits.forEach(habit => {
                    const checked = this.isCheckedIn(habit.id, dateStr);
                    html += `
                        <div class="habit-day-item ${checked ? 'checked' : ''}"
                             data-habit-id="${habit.id}"
                             title="${habit.icon} ${habit.name}"
                             onclick="HabitApp.toggleCheckin('${habit.id}', '${dateStr}')">
                            ${habit.icon}
                        </div>
                    `;
                });
                html += '</div>';
            }

            html += '</div>';
        }

        container.innerHTML = html;
    },

    /**
     * 渲染习惯列表
     */
    renderHabitList() {
        const list = document.getElementById('habit-list');
        if (!list) return;

        if (this.habits.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <p style="font-size: 3rem; margin-bottom: 12px;">📋</p>
                    <p>暂无习惯，点击上方添加</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.habits.map(habit => {
            const stats = this.getHabitStats(habit.id);
            const streak = this.calculateStreak(habit.id);

            return `
                <div class="habit-item">
                    <div class="habit-item-icon">${habit.icon}</div>
                    <div class="habit-item-info">
                        <div class="habit-item-name">${this.escapeHtml(habit.name)}</div>
                        <div class="habit-item-meta">
                            连续 ${streak} 天 | 本月 ${stats.monthCount} 天
                        </div>
                    </div>
                    <button class="btn btn-icon" onclick="HabitApp.deleteHabit('${habit.id}')" title="删除">🗑️</button>
                </div>
            `;
        }).join('');
    },

    /**
     * 渲染统计数据
     */
    renderStats() {
        const grid = document.getElementById('habit-stats-grid');
        if (!grid) return;

        const { year, month } = this.getMonthInfo();
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

        // 统计当月打卡天数
        const monthCheckins = {};
        Object.keys(this.checkins).forEach(key => {
            if (key.endsWith(monthStr)) {
                const habitId = key.split('_')[0];
                monthCheckins[habitId] = (monthCheckins[habitId] || 0) + 1;
            }
        });

        // 计算当月总天数
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
        const activeDays = isCurrentMonth ? today.getDate() : daysInMonth;

        // 计算完成率
        let totalRate = 0;
        if (this.habits.length > 0) {
            let sumRate = 0;
            this.habits.forEach(habit => {
                const checkinCount = monthCheckins[habit.id] || 0;
                sumRate += (checkinCount / activeDays) * 100;
            });
            totalRate = Math.round(sumRate / this.habits.length);
        }

        grid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">📅</div>
                <div class="stat-info">
                    <div class="stat-label">习惯数量</div>
                    <div class="stat-value">${this.habits.length}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🎯</div>
                <div class="stat-info">
                    <div class="stat-label">本月完成率</div>
                    <div class="stat-value">${totalRate}%</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🔥</div>
                <div class="stat-info">
                    <div class="stat-label">最长连续</div>
                    <div class="stat-value">${this.getLongestStreak()} 天</div>
                </div>
            </div>
        `;
    },

    /**
     * 获取习惯的统计信息
     * @param {string} habitId - 习惯ID
     * @returns {Object} { monthCount, totalCount }
     */
    getHabitStats(habitId) {
        const { year, month } = this.getMonthInfo();
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

        let monthCount = 0;
        let totalCount = 0;

        Object.keys(this.checkins).forEach(key => {
            if (key.startsWith(habitId)) {
                if (key.endsWith(monthStr)) {
                    monthCount++;
                }
                totalCount++;
            }
        });

        return { monthCount, totalCount };
    },

    /**
     * 计算连续打卡天数
     * @param {string} habitId - 习惯ID
     * @returns {number} 连续天数
     */
    calculateStreak(habitId) {
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 365; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = Utils.formatDate(date, 'YYYY-MM-DD');

            if (this.isCheckedIn(habitId, dateStr)) {
                streak++;
            } else if (i > 0) {
                break;
            }
        }

        return streak;
    },

    /**
     * 获取最长连续打卡天数
     * @returns {number} 最长连续天数
     */
    getLongestStreak() {
        let longest = 0;

        this.habits.forEach(habit => {
            const streak = this.calculateStreak(habit.id);
            if (streak > longest) {
                longest = streak;
            }
        });

        return longest;
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
     * 渲染完整界面
     */
    render() {
        this.renderCalendar();
        this.renderHabitList();
        this.renderStats();
    }
};

// 暴露到全局
window.HabitApp = HabitApp;
