/**
 * ===================================
 * 番茄专注计时器模块 - pomodoro.js
 * ===================================
 * 功能：专注/休息计时、进度展示、统计记录
 * 数据持久化：LocalStorage
 */

const PomodoroApp = {
    // 计时器状态
    isRunning: false,
    isPaused: false,
    currentMode: 'focus', // focus / break

    // 时间设置（分钟）
    focusTime: 25,
    breakTime: 5,

    // 剩余时间（秒）
    remainingSeconds: 25 * 60,

    // 定时器
    timer: null,

    // 统计数据
    stats: {
        todayFocusMinutes: 0,
        totalCount: 0,
        lastDate: null
    },

    /**
     * 初始化番茄钟
     */
    init() {
        this.loadData();
        this.loadSettings();
        this.bindEvents();
        this.render();
    },

    /**
     * 从 LocalStorage 加载数据和设置
     */
    loadData() {
        const saved = Utils.getStorage(Utils.STORAGE_KEYS.POMODORO_STATS);
        if (saved) {
            this.stats = saved;
        }

        // 检查是否新的一天，重置今日数据
        const today = Utils.formatDate(new Date(), 'YYYY-MM-DD');
        if (this.stats.lastDate !== today) {
            this.stats.todayFocusMinutes = 0;
            this.stats.lastDate = today;
            this.saveData();
        }
    },

    /**
     * 加载用户设置
     */
    loadSettings() {
        const savedFocus = Utils.getStorage('pomodoro_focus_time');
        const savedBreak = Utils.getStorage('pomodoro_break_time');

        this.focusTime = savedFocus || 25;
        this.breakTime = savedBreak || 5;

        const focusInput = document.getElementById('pomodoro-focus-time');
        const breakInput = document.getElementById('pomodoro-break-time');

        if (focusInput) focusInput.value = this.focusTime;
        if (breakInput) breakInput.value = this.breakTime;

        this.remainingSeconds = this.focusTime * 60;
    },

    /**
     * 保存数据和设置
     */
    saveData() {
        Utils.setStorage(Utils.STORAGE_KEYS.POMODORO_STATS, this.stats);
    },

    /**
     * 记录使用统计
     */
    recordUsage() {
        const stats = StatsApp.getStats();
        stats.pomodoroUsage = (stats.pomodoroUsage || 0) + 1;
        StatsApp.saveStats(stats);
    },

    /**
     * 绑定事件监听
     */
    bindEvents() {
        // 模式切换
        document.querySelectorAll('[data-pomodoro-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.pomodoroMode;
                this.setMode(mode);
            });
        });

        // 开始按钮
        const startBtn = document.getElementById('pomodoro-start');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.start());
        }

        // 暂停按钮
        const pauseBtn = document.getElementById('pomodoro-pause');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.pause());
        }

        // 重置按钮
        const resetBtn = document.getElementById('pomodoro-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }

        // 时长设置
        const focusInput = document.getElementById('pomodoro-focus-time');
        const breakInput = document.getElementById('pomodoro-break-time');

        if (focusInput) {
            focusInput.addEventListener('change', (e) => {
                this.focusTime = parseInt(e.target.value, 10) || 25;
                Utils.setStorage('pomodoro_focus_time', this.focusTime);
                if (this.currentMode === 'focus' && !this.isRunning) {
                    this.remainingSeconds = this.focusTime * 60;
                    this.render();
                }
            });
        }

        if (breakInput) {
            breakInput.addEventListener('change', (e) => {
                this.breakTime = parseInt(e.target.value, 10) || 5;
                Utils.setStorage('pomodoro_break_time', this.breakTime);
                if (this.currentMode === 'break' && !this.isRunning) {
                    this.remainingSeconds = this.breakTime * 60;
                    this.render();
                }
            });
        }
    },

    /**
     * 设置模式
     * @param {string} mode - 模式：focus / break
     */
    setMode(mode) {
        if (this.isRunning) {
            Utils.showToast('请先停止计时', 'info');
            return;
        }

        this.currentMode = mode;

        // 更新按钮状态
        document.querySelectorAll('[data-pomodoro-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.pomodoroMode === mode);
        });

        // 设置时间
        this.remainingSeconds = mode === 'focus' ? this.focusTime * 60 : this.breakTime * 60;

        // 更新按钮文字
        const startBtn = document.getElementById('pomodoro-start');
        if (startBtn) {
            startBtn.textContent = '▶ 开始';
        }

        this.render();
    },

    /**
     * 开始计时
     */
    start() {
        if (this.isRunning && !this.isPaused) return;

        this.isRunning = true;
        this.isPaused = false;

        const startBtn = document.getElementById('pomodoro-start');
        const pauseBtn = document.getElementById('pomodoro-pause');

        if (startBtn) startBtn.textContent = '▶ 进行中...';
        if (pauseBtn) pauseBtn.disabled = false;

        this.recordUsage();
        QuickAccess.addRecent('pomodoro', '启动番茄钟');

        this.timer = setInterval(() => {
            this.remainingSeconds--;

            if (this.remainingSeconds <= 0) {
                this.complete();
            }

            this.render();
        }, 1000);
    },

    /**
     * 暂停计时
     */
    pause() {
        if (!this.isRunning) return;

        this.isPaused = true;
        clearInterval(this.timer);

        const startBtn = document.getElementById('pomodoro-start');
        const pauseBtn = document.getElementById('pomodoro-pause');

        if (startBtn) startBtn.textContent = '▶ 继续';
        if (pauseBtn) pauseBtn.disabled = true;

        this.isRunning = false;
    },

    /**
     * 重置计时器
     */
    reset() {
        clearInterval(this.timer);
        this.isRunning = false;
        this.isPaused = false;

        this.remainingSeconds = this.currentMode === 'focus'
            ? this.focusTime * 60
            : this.breakTime * 60;

        const startBtn = document.getElementById('pomodoro-start');
        const pauseBtn = document.getElementById('pomodoro-pause');

        if (startBtn) startBtn.textContent = '▶ 开始';
        if (pauseBtn) pauseBtn.disabled = true;

        this.render();
    },

    /**
     * 完成一个番茄
     */
    complete() {
        clearInterval(this.timer);
        this.isRunning = false;
        this.isPaused = false;

        // 如果是专注模式，记录数据
        if (this.currentMode === 'focus') {
            this.stats.todayFocusMinutes += this.focusTime;
            this.stats.totalCount++;
            this.saveData();
        }

        // 弹出提醒
        this.showNotification();

        // 自动切换到下一模式
        this.currentMode = this.currentMode === 'focus' ? 'break' : 'focus';
        document.querySelectorAll('[data-pomodoro-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.pomodoroMode === this.currentMode);
        });

        this.remainingSeconds = this.currentMode === 'focus'
            ? this.focusTime * 60
            : this.breakTime * 60;

        const startBtn = document.getElementById('pomodoro-start');
        const pauseBtn = document.getElementById('pomodoro-pause');

        if (startBtn) startBtn.textContent = '▶ 开始';
        if (pauseBtn) pauseBtn.disabled = true;

        this.render();
        StatsApp.refresh();
    },

    /**
     * 显示完成通知
     */
    showNotification() {
        const message = this.currentMode === 'focus'
            ? `🎉 专注 ${this.focusTime} 分钟完成！休息一下吧~`
            : '☕ 休息结束！开始新一轮专注吧！';

        Utils.showToast(message, 'success');
    },

    /**
     * 渲染界面
     */
    render() {
        // 渲染时间显示
        const timeDisplay = document.getElementById('pomodoro-time');
        if (timeDisplay) {
            const minutes = Math.floor(this.remainingSeconds / 60);
            const seconds = this.remainingSeconds % 60;
            timeDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        // 渲染进度环
        const ring = document.getElementById('pomodoro-ring');
        if (ring) {
            const totalSeconds = this.currentMode === 'focus'
                ? this.focusTime * 60
                : this.breakTime * 60;
            const progress = this.remainingSeconds / totalSeconds;
            const circumference = 2 * Math.PI * 90;
            const offset = circumference * (1 - progress);
            ring.style.strokeDasharray = circumference;
            ring.style.strokeDashoffset = offset;
            ring.style.stroke = this.currentMode === 'focus' ? 'var(--accent)' : 'var(--success)';
        }

        // 渲染统计
        const todayFocusEl = document.getElementById('pomodoro-today-focus');
        const totalCountEl = document.getElementById('pomodoro-total-count');

        if (todayFocusEl) {
            todayFocusEl.textContent = `${this.stats.todayFocusMinutes} 分钟`;
        }

        if (totalCountEl) {
            totalCountEl.textContent = `${this.stats.totalCount} 次`;
        }
    },

    /**
     * 获取专注时长（供统计使用）
     * @returns {number} 专注分钟数
     */
    getTotalFocusMinutes() {
        return this.stats.todayFocusMinutes;
    }
};

// 暴露到全局
window.PomodoroApp = PomodoroApp;
