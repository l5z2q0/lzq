/**
 * ===================================
 * 应用主入口 - app.js
 * ===================================
 * 负责应用初始化、模块加载、导航切换等核心逻辑
 */

const App = {
    currentTab: 'todo',
    
    init() {
        this.bindEvents();
        this.loadTheme();
        this.hideLoading();
        this.updateRecentList();
    },
    
    bindEvents() {
        this.bindNavTabs();
        this.bindThemeToggle();
        this.bindDataManagement();
        this.bindDropdowns();
    },
    
    bindNavTabs() {
        const tabs = document.querySelectorAll('.nav-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.dataset.tab;
                this.switchTab(targetTab);
            });
        });
    },
    
    switchTab(tabId) {
        const activeTab = document.querySelector('.nav-tab.active');
        const activePanel = document.querySelector('.tool-panel.active');
        
        if (activeTab) activeTab.classList.remove('active');
        if (activePanel) activePanel.classList.remove('active');
        
        const newTab = document.querySelector(`[data-tab="${tabId}"]`);
        const newPanel = document.getElementById(`${tabId}-panel`);
        
        if (newTab) newTab.classList.add('active');
        if (newPanel) newPanel.classList.add('active');
        
        this.currentTab = tabId;
        this.addToRecent(tabId);
        this.updateRecentList();
        
        if (tabId === 'habit') {
            HabitApp.refreshCalendar();
        }
    },
    
    bindThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        const themeIcon = document.getElementById('theme-icon');
        
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.dataset.theme || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            document.documentElement.dataset.theme = newTheme;
            themeIcon.textContent = newTheme === 'light' ? '🌙' : '☀️';
            
            Utils.setStorage(Utils.STORAGE_KEYS.THEME, newTheme);
        });
    },
    
    loadTheme() {
        const savedTheme = Utils.getStorage(Utils.STORAGE_KEYS.THEME) || 'light';
        document.documentElement.dataset.theme = savedTheme;
        
        const themeIcon = document.getElementById('theme-icon');
        themeIcon.textContent = savedTheme === 'light' ? '🌙' : '☀️';
    },
    
    bindDataManagement() {
        const exportBtn = document.getElementById('export-data');
        const importBtn = document.getElementById('import-data');
        const importFile = document.getElementById('import-file');
        
        exportBtn.addEventListener('click', () => this.exportData());
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', (e) => this.importData(e));
    },
    
    exportData() {
        const data = {
            todos: Utils.getStorage(Utils.STORAGE_KEYS.TODO) || [],
            passwordHistory: Utils.getStorage(Utils.STORAGE_KEYS.PASSWORD_HISTORY) || [],
            accounts: Utils.getStorage(Utils.STORAGE_KEYS.ACCOUNTS) || [],
            converter: Utils.getStorage(Utils.STORAGE_KEYS.CONVERTER) || [],
            lottery: Utils.getStorage(Utils.STORAGE_KEYS.LOTTERY) || [],
            pomodoroStats: Utils.getStorage(Utils.STORAGE_KEYS.POMODORO_STATS) || {},
            habits: Utils.getStorage(Utils.STORAGE_KEYS.HABITS) || [],
            habitCheckins: Utils.getStorage(Utils.STORAGE_KEYS.HABIT_CHECKINS) || {},
            theme: Utils.getStorage(Utils.STORAGE_KEYS.THEME) || 'light',
            stats: Utils.getStorage(Utils.STORAGE_KEYS.STATS) || {},
            recent: Utils.getStorage(Utils.STORAGE_KEYS.RECENT) || []
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `life-toolbox-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        Utils.showToast('数据导出成功！');
    },
    
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.todos) Utils.setStorage(Utils.STORAGE_KEYS.TODO, data.todos);
                if (data.passwordHistory) Utils.setStorage(Utils.STORAGE_KEYS.PASSWORD_HISTORY, data.passwordHistory);
                if (data.accounts) Utils.setStorage(Utils.STORAGE_KEYS.ACCOUNTS, data.accounts);
                if (data.converter) Utils.setStorage(Utils.STORAGE_KEYS.CONVERTER, data.converter);
                if (data.lottery) Utils.setStorage(Utils.STORAGE_KEYS.LOTTERY, data.lottery);
                if (data.pomodoroStats) Utils.setStorage(Utils.STORAGE_KEYS.POMODORO_STATS, data.pomodoroStats);
                if (data.habits) Utils.setStorage(Utils.STORAGE_KEYS.HABITS, data.habits);
                if (data.habitCheckins) Utils.setStorage(Utils.STORAGE_KEYS.HABIT_CHECKINS, data.habitCheckins);
                if (data.theme) Utils.setStorage(Utils.STORAGE_KEYS.THEME, data.theme);
                if (data.stats) Utils.setStorage(Utils.STORAGE_KEYS.STATS, data.stats);
                if (data.recent) Utils.setStorage(Utils.STORAGE_KEYS.RECENT, data.recent);
                
                Utils.showToast('数据导入成功！');
                location.reload();
            } catch (err) {
                Utils.showToast('导入失败：无效的JSON文件');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },
    
    bindDropdowns() {
        const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
        
        dropdownToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = toggle.parentElement;
                const isOpen = dropdown.classList.contains('open');
                
                document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
                
                if (!isOpen) {
                    dropdown.classList.add('open');
                }
            });
        });
        
        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
        });
    },
    
    addToRecent(tabId) {
        let recent = Utils.getStorage(Utils.STORAGE_KEYS.RECENT) || [];
        recent = recent.filter(id => id !== tabId);
        recent.unshift(tabId);
        recent = recent.slice(0, 5);
        Utils.setStorage(Utils.STORAGE_KEYS.RECENT, recent);
    },
    
    updateRecentList() {
        const recent = Utils.getStorage(Utils.STORAGE_KEYS.RECENT) || [];
        const list = document.getElementById('recent-list');
        const tabNames = {
            todo: '待办清单',
            password: '密码生成',
            account: '记账本',
            converter: '单位换算',
            lottery: '随机抽签',
            pomodoro: '番茄钟',
            habit: '习惯打卡',
            about: '关于我'
        };
        
        if (recent.length === 0) {
            list.innerHTML = '<span class="empty-tip">暂无记录</span>';
            return;
        }
        
        list.innerHTML = recent.map(id => `
            <button class="dropdown-item" data-tab="${id}">
                ${tabNames[id] || id}
            </button>
        `).join('');
        
        list.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchTab(e.currentTarget.dataset.tab);
                document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
            });
        });
    },
    
    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 500);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
    
    if (typeof TodoApp !== 'undefined') TodoApp.init();
    if (typeof PasswordApp !== 'undefined') PasswordApp.init();
    if (typeof AccountApp !== 'undefined') AccountApp.init();
    if (typeof ConverterApp !== 'undefined') ConverterApp.init();
    if (typeof LotteryApp !== 'undefined') LotteryApp.init();
    if (typeof PomodoroApp !== 'undefined') PomodoroApp.init();
    if (typeof HabitApp !== 'undefined') HabitApp.init();
    if (typeof StatsApp !== 'undefined') StatsApp.init();
});