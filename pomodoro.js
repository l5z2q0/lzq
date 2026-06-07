/**
 * ===================================
 * 番茄专注计时器模块 - pomodoro.js
 * ===================================
 * 功能：专注/休息计时、进度展示、统计记录
 * 数据持久化：LocalStorage
 */

const PomodoroApp = {
    isRunning: false,
    isPaused: false,
    currentMode: 'focus',
    focusTime: 25,
    breakTime: 5,
    remainingSeconds: 25 * 60,
    timer: null,
    stats: {
        todayFocusMinutes: 0,
        totalCount: 0,
        lastDate: null
    },

    init() {
        this.loadData();
        this.loadSettings();
        this.bindEvents();
        this.render();
    },

    loadData() {
        const saved = Utils.getStorage(Utils.STORAGE_KEYS.POMODORO_STATS);
        if (saved) {
            this.stats = saved;
        }

        const today = Utils.formatDate(new Date(), 'YYYY-MM-DD');
        if (this.stats.lastDate !== today) {
            this.stats.todayFocusMinutes = 0;
            this.stats.lastDate = today;
            this.saveData();
        }
    },

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

    saveData() {
        Utils.setStorage(Utils.STORAGE_KEYS.POMODORO_STATS, this.stats);
    },

    recordUsage() {
        const stats = StatsApp.getStats();
        stats.pomodoroUsage = (stats.pomodoroUsage || 0) + 1;
        StatsApp.saveStats(stats);
    },

    bindEvents() {
        document.querySelectorAll('[data-pomodoro-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.pomodoroMode;
                this.setMode(mode);
            });
        });

        const startBtn = document.getElementById('pomodoro-start');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.start());
        }

        const pauseBtn = document.getElementById('pomodoro-pause');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.pause());
        }

        const resetBtn = document.getElementById('pomodoro-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }

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

    setMode(mode) {
        if (this.isRunning) {
            Utils.showToast('请先停止计时', 'info');
            return;
        }

        this.currentMode = mode;

        document.querySelectorAll('[data-pomodoro-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.pomodoroMode === mode);
        });

        this.remainingSeconds = mode === 'focus' ? this.focusTime * 60 : this.breakTime * 60;

        const startBtn = document.getElementById('pomodoro-start');
        if (startBtn) {
            startBtn.textContent = '▶ 开始';
        }

        this.render();
    },

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

    complete() {
        clearInterval(this.timer);
        this.isRunning = false;
        this.isPaused = false;

        if (this.currentMode === 'focus') {
            this.stats.todayFocusMinutes += this.focusTime;
            this.stats.totalCount++;
            this.saveData();
        }

        this.showNotification();

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

    showNotification() {
        const message = this.currentMode === 'focus'
            ? `🎉 专注 ${this.focusTime} 分钟完成！休息一下吧~`
            : '☕ 休息结束！开始新一轮专注吧！';

        Utils.showToast(message, 'success');
    },

    render() {
        const timeDisplay = document.getElementById('pomodoro-time');
        if (timeDisplay) {
            const minutes = Math.floor(this.remainingSeconds / 60);
            const seconds = this.remainingSeconds % 60;
            timeDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

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

        const todayFocusEl = document.getElementById('pomodoro-today-focus');
        const totalCountEl = document.getElementById('pomodoro-total-count');

        if (todayFocusEl) {
            todayFocusEl.textContent = `${this.stats.todayFocusMinutes} 分钟`;
        }

        if (totalCountEl) {
            totalCountEl.textContent = `${this.stats.totalCount} 次`;
        }
    },

    getTotalFocusMinutes() {
        return this.stats.todayFocusMinutes;
    }
};

window.PomodoroApp = PomodoroApp;