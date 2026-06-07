/**
 * ===================================
 * 统计面板模块 - stats.js
 * ===================================
 * 功能：展示各工具使用频次、数据统计可视化
 * 数据来源：LocalStorage
 */

const StatsApp = {
    STATS_KEY: Utils.STORAGE_KEYS.STATS,
    completionHistory: [],

    init() {
        this.render();
    },

    getStats() {
        const saved = Utils.getStorage(this.STATS_KEY) || {};
        return {
            todoUsage: saved.todoUsage || 0,
            passwordUsage: saved.passwordUsage || 0,
            accountUsage: saved.accountUsage || 0,
            converterUsage: saved.converterUsage || 0,
            lotteryUsage: saved.lotteryUsage || 0,
            pomodoroUsage: saved.pomodoroUsage || 0,
            habitUsage: saved.habitUsage || 0,
            totalCompletions: saved.totalCompletions || 0,
            completionHistory: saved.completionHistory || []
        };
    },

    saveStats(stats) {
        Utils.setStorage(this.STATS_KEY, stats);
    },

    recordCompletion(completed) {
        const stats = this.getStats();
        stats.totalCompletions = (stats.totalCompletions || 0) + (completed ? 1 : 0);

        const history = stats.completionHistory || [];
        const today = Utils.formatDate(new Date(), 'YYYY-MM-DD');

        const todayEntry = history.find(h => h.date === today);
        if (todayEntry) {
            todayEntry.count++;
        } else {
            history.push({ date: today, count: 1 });
        }

        stats.completionHistory = history.slice(-30);
        this.saveStats(stats);
    },

    getCompletionRate() {
        const todoStats = TodoApp.getStats();
        if (todoStats.total === 0) return 0;
        return Math.round((todoStats.completed / todoStats.total) * 100);
    },

    getTotalUsage() {
        const stats = this.getStats();
        return (stats.todoUsage || 0) + (stats.passwordUsage || 0) +
               (stats.accountUsage || 0) + (stats.converterUsage || 0) +
               (stats.lotteryUsage || 0) + (stats.pomodoroUsage || 0) +
               (stats.habitUsage || 0);
    },

    getUsageDistribution() {
        const stats = this.getStats();
        return {
            todo: stats.todoUsage || 0,
            password: stats.passwordUsage || 0,
            account: stats.accountUsage || 0,
            converter: stats.converterUsage || 0,
            lottery: stats.lotteryUsage || 0,
            pomodoro: stats.pomodoroUsage || 0,
            habit: stats.habitUsage || 0
        };
    },

    getWeeklyTrend() {
        const stats = this.getStats();
        const history = stats.completionHistory || [];
        const today = new Date();
        const trend = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = Utils.formatDate(d, 'YYYY-MM-DD');

            const entry = history.find(h => h.date === dateStr);
            trend.push({
                date: Utils.formatDate(d, 'MM-DD'),
                count: entry ? entry.count : 0
            });
        }

        return trend;
    },

    render() {
        const grid = document.getElementById('stats-grid');
        if (!grid) return;

        const stats = this.getStats();
        const todoStats = TodoApp.getStats();
        const accountStats = AccountApp.getStats();
        const distribution = this.getUsageDistribution();
        const completionRate = todoStats.completionRate;

        const pomodoroStats = PomodoroApp?.stats || { todayFocusMinutes: 0, totalCount: 0 };

        grid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">🚀</div>
                <div class="stat-info">
                    <div class="stat-label">总使用次数</div>
                    <div class="stat-value" data-countup="${this.getTotalUsage()}">${this.getTotalUsage()}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-info">
                    <div class="stat-label">待办完成率</div>
                    <div class="stat-value">${completionRate}%</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📝</div>
                <div class="stat-info">
                    <div class="stat-label">待办总数</div>
                    <div class="stat-value">${todoStats.total}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">💰</div>
                <div class="stat-info">
                    <div class="stat-label">本月余额</div>
                    <div class="stat-value" style="color: ${accountStats.balance >= 0 ? 'var(--income)' : 'var(--expense)'}">
                        ¥${accountStats.balance.toFixed(0)}
                    </div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">✏️</div>
                <div class="stat-info">
                    <div class="stat-label">待办使用</div>
                    <div class="stat-value">${distribution.todo}次</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🔐</div>
                <div class="stat-info">
                    <div class="stat-label">密码生成</div>
                    <div class="stat-value">${distribution.password}次</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-info">
                    <div class="stat-label">记账记录</div>
                    <div class="stat-value">${distribution.account}次</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📈</div>
                <div class="stat-info">
                    <div class="stat-label">本月支出</div>
                    <div class="stat-value" style="color: var(--expense)">¥${accountStats.expense.toFixed(0)}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🔄</div>
                <div class="stat-info">
                    <div class="stat-label">单位换算</div>
                    <div class="stat-value">${distribution.converter}次</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🎲</div>
                <div class="stat-info">
                    <div class="stat-label">随机抽奖</div>
                    <div class="stat-value">${distribution.lottery}次</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🍅</div>
                <div class="stat-info">
                    <div class="stat-label">番茄钟使用</div>
                    <div class="stat-value">${distribution.pomodoro}次</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⏱️</div>
                <div class="stat-info">
                    <div class="stat-label">今日专注</div>
                    <div class="stat-value">${pomodoroStats.todayFocusMinutes}分钟</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-info">
                    <div class="stat-label">习惯打卡</div>
                    <div class="stat-value">${distribution.habit}次</div>
                </div>
            </div>
        `;
    },

    animateCountUp() {
        const elements = document.querySelectorAll('[data-countup]');

        elements.forEach(el => {
            const target = parseInt(el.dataset.countup, 10);
            if (isNaN(target) || target === 0) return;

            let current = 0;
            const increment = Math.ceil(target / 30);
            const duration = 1000;
            const stepTime = duration / 30;

            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                el.textContent = current;
            }, stepTime);
        });
    },

    refresh() {
        this.render();
        this.animateCountUp();
    }
};

window.StatsApp = StatsApp;