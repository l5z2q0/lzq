/**
 * ===================================
 * 统计面板模块 - stats.js
 * ===================================
 * 功能：展示各工具使用频次、数据统计可视化
 * 数据来源：LocalStorage
 */

const StatsApp = {
    // 统计数据键名
    STATS_KEY: Utils.STORAGE_KEYS.STATS,

    // 完成历史记录（用于计算完成率）
    completionHistory: [],

    /**
     * 初始化统计面板
     */
    init() {
        this.render();
    },

    /**
     * 获取统计数据
     * @returns {Object} 统计数据
     */
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

    /**
     * 保存统计数据
     * @param {Object} stats - 统计数据
     */
    saveStats(stats) {
        Utils.setStorage(this.STATS_KEY, stats);
    },

    /**
     * 记录待办完成事件
     * @param {boolean} completed - 是否完成
     */
    recordCompletion(completed) {
        const stats = this.getStats();
        stats.totalCompletions = (stats.totalCompletions || 0) + (completed ? 1 : 0);

        // 记录完成历史（最近30天）
        const history = stats.completionHistory || [];
        const today = Utils.formatDate(new Date(), 'YYYY-MM-DD');

        const todayEntry = history.find(h => h.date === today);
        if (todayEntry) {
            todayEntry.count++;
        } else {
            history.push({ date: today, count: 1 });
        }

        // 只保留最近30天
        stats.completionHistory = history.slice(-30);
        this.saveStats(stats);
    },

    /**
     * 获取待办完成率
     * @returns {number} 完成率百分比
     */
    getCompletionRate() {
        const todoStats = TodoApp.getStats();
        if (todoStats.total === 0) return 0;
        return Math.round((todoStats.completed / todoStats.total) * 100);
    },

    /**
     * 获取总使用次数
     * @returns {number} 使用次数
     */
    getTotalUsage() {
        const stats = this.getStats();
        return (stats.todoUsage || 0) + (stats.passwordUsage || 0) +
               (stats.accountUsage || 0) + (stats.converterUsage || 0) +
               (stats.lotteryUsage || 0) + (stats.pomodoroUsage || 0) +
               (stats.habitUsage || 0);
    },

    /**
     * 获取各工具使用分布
     * @returns {Object} 使用次数分布
     */
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

    /**
     * 获取最近7天的完成趋势
     * @returns {Array} 每日完成数
     */
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

    /**
     * 渲染统计面板
     */
    render() {
        const grid = document.getElementById('stats-grid');
        if (!grid) return;

        const stats = this.getStats();
        const todoStats = TodoApp.getStats();
        const accountStats = AccountApp.getStats();
        const distribution = this.getUsageDistribution();
        const completionRate = todoStats.completionRate;

        // 获取番茄钟统计
        const pomodoroStats = PomodoroApp?.stats || { todayFocusMinutes: 0, totalCount: 0 };

        grid.innerHTML = `
            <!-- 总使用次数 -->
            <div class="stat-card">
                <div class="stat-icon">🚀</div>
                <div class="stat-info">
                    <div class="stat-label">总使用次数</div>
                    <div class="stat-value" data-countup="${this.getTotalUsage()}">${this.getTotalUsage()}</div>
                </div>
            </div>

            <!-- 待办完成率 -->
            <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-info">
                    <div class="stat-label">待办完成率</div>
                    <div class="stat-value">${completionRate}%</div>
                </div>
            </div>

            <!-- 待办总数 -->
            <div class="stat-card">
                <div class="stat-icon">📝</div>
                <div class="stat-info">
                    <div class="stat-label">待办总数</div>
                    <div class="stat-value">${todoStats.total}</div>
                </div>
            </div>

            <!-- 本月收支 -->
            <div class="stat-card">
                <div class="stat-icon">💰</div>
                <div class="stat-info">
                    <div class="stat-label">本月余额</div>
                    <div class="stat-value" style="color: ${accountStats.balance >= 0 ? 'var(--income)' : 'var(--expense)'}">
                        ¥${accountStats.balance.toFixed(0)}
                    </div>
                </div>
            </div>

            <!-- 待办使用 -->
            <div class="stat-card">
                <div class="stat-icon">✏️</div>
                <div class="stat-info">
                    <div class="stat-label">待办使用</div>
                    <div class="stat-value">${distribution.todo}次</div>
                </div>
            </div>

            <!-- 密码使用 -->
            <div class="stat-card">
                <div class="stat-icon">🔐</div>
                <div class="stat-info">
                    <div class="stat-label">密码生成</div>
                    <div class="stat-value">${distribution.password}次</div>
                </div>
            </div>

            <!-- 记账使用 -->
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-info">
                    <div class="stat-label">记账记录</div>
                    <div class="stat-value">${distribution.account}次</div>
                </div>
            </div>

            <!-- 收支统计 -->
            <div class="stat-card">
                <div class="stat-icon">📈</div>
                <div class="stat-info">
                    <div class="stat-label">本月支出</div>
                    <div class="stat-value" style="color: var(--expense)">¥${accountStats.expense.toFixed(0)}</div>
                </div>
            </div>

            <!-- 单位换算使用 -->
            <div class="stat-card">
                <div class="stat-icon">🔄</div>
                <div class="stat-info">
                    <div class="stat-label">单位换算</div>
                    <div class="stat-value">${distribution.converter}次</div>
                </div>
            </div>

            <!-- 抽奖使用 -->
            <div class="stat-card">
                <div class="stat-icon">🎲</div>
                <div class="stat-info">
                    <div class="stat-label">随机抽奖</div>
                    <div class="stat-value">${distribution.lottery}次</div>
                </div>
            </div>

            <!-- 番茄钟统计 -->
            <div class="stat-card">
                <div class="stat-icon">🍅</div>
                <div class="stat-info">
                    <div class="stat-label">番茄钟使用</div>
                    <div class="stat-value">${distribution.pomodoro}次</div>
                </div>
            </div>

            <!-- 今日专注 -->
            <div class="stat-card">
                <div class="stat-icon">⏱️</div>
                <div class="stat-info">
                    <div class="stat-label">今日专注</div>
                    <div class="stat-value">${pomodoroStats.todayFocusMinutes}分钟</div>
                </div>
            </div>

            <!-- 习惯打卡 -->
            <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-info">
                    <div class="stat-label">习惯打卡</div>
                    <div class="stat-value">${distribution.habit}次</div>
                </div>
            </div>
        `;
    },

    /**
     * 数字滚动动画
     */
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

    /**
     * 刷新统计数据
     */
    refresh() {
        this.render();
        this.animateCountUp();
    }
};

// 暴露到全局
window.StatsApp = StatsApp;
