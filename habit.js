/**
 * ===================================
 * 习惯打卡模块 - habit.js
 * ===================================
 * 功能：习惯添加、打卡记录、日历视图、统计
 * 数据持久化：LocalStorage
 */

const HabitApp = {
    habits: [],
    checkins: {},
    currentMonth: new Date(),

    init() {
        this.loadData();
        this.bindEvents();
        this.render();
    },

    loadData() {
        const habits = Utils.getStorage(Utils.STORAGE_KEYS.HABITS);
        const checkins = Utils.getStorage(Utils.STORAGE_KEYS.HABIT_CHECKINS);

        this.habits = Array.isArray(habits) ? habits : [];
        this.checkins = checkins || {};
    },

    saveData() {
        Utils.setStorage(Utils.STORAGE_KEYS.HABITS, this.habits);
        Utils.setStorage(Utils.STORAGE_KEYS.HABIT_CHECKINS, this.checkins);
    },

    recordUsage() {
        const stats = StatsApp.getStats();
        stats.habitUsage = (stats.habitUsage || 0) + 1;
        StatsApp.saveStats(stats);
    },

    bindEvents() {
        const addBtn = document.getElementById('add-habit-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.toggleAddSection());
        }

        const confirmBtn = document.getElementById('confirm-add-habit');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.addHabit());
        }

        const prevBtn = document.getElementById('habit-prev-month');
        const nextBtn = document.getElementById('habit-next-month');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.changeMonth(-1));
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.changeMonth(1));
        }
    },

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

    deleteHabit(id) {
        if (!confirm('确定要删除这个习惯吗？')) return;

        this.habits = this.habits.filter(h => h.id !== id);

        Object.keys(this.checkins).forEach(key => {
            if (key.startsWith(id)) {
                delete this.checkins[key];
            }
        });

        this.saveData();
        this.render();
        Utils.showToast('已删除', 'success');
    },

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

    isCheckedIn(habitId, date) {
        return !!this.checkins[`${habitId}_${date}`];
    },

    changeMonth(delta) {
        this.currentMonth = new Date(
            this.currentMonth.getFullYear(),
            this.currentMonth.getMonth() + delta,
            1
        );
        this.renderCalendar();
    },

    getMonthInfo() {
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        return { year, month, firstDay, daysInMonth };
    },

    renderCalendar() {
        const container = document.getElementById('habit-calendar-days');
        const monthDisplay = document.getElementById('habit-current-month');

        if (!container) return;

        const { year, month, firstDay, daysInMonth } = this.getMonthInfo();

        if (monthDisplay) {
            monthDisplay.textContent = `${year}年${month + 1}月`;
        }

        let html = '';

        for (let i = 0; i < firstDay; i++) {
            html += '<div class="habit-day empty"></div>';
        }

        const today = Utils.formatDate(new Date(), 'YYYY-MM-DD');

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const isFuture = dateStr > today;

            html += `<div class="habit-day ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}" data-date="${dateStr}">`;
            html += `<span class="habit-day-num">${day}</span>`;

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

    renderStats() {
        const grid = document.getElementById('habit-stats-grid');
        if (!grid) return;

        const { year, month } = this.getMonthInfo();
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

        const monthCheckins = {};
        Object.keys(this.checkins).forEach(key => {
            if (key.endsWith(monthStr)) {
                const habitId = key.split('_')[0];
                monthCheckins[habitId] = (monthCheckins[habitId] || 0) + 1;
            }
        });

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
        const activeDays = isCurrentMonth ? today.getDate() : daysInMonth;

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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    render() {
        this.renderCalendar();
        this.renderHabitList();
        this.renderStats();
    }
};

window.HabitApp = HabitApp;