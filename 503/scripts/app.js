/**
 * ===================================
 * 主应用入口 - app.js
 * ===================================
 * 初始化各模块、绑定全局事件、管理Tab切换
 */

const App = {
    /**
     * 当前激活的Tab
     */
    currentTab: 'todo',

    /**
     * 初始化应用
     */
    init() {
        // 显示加载动画
        this.showLoading();

        // 初始化各模块
        ThemeManager.init();
        QuickAccess.init();
        DataManager.bindEvents();

        // 初始化工具模块
        TodoApp.init();
        PasswordApp.init();
        AccountApp.init();
        ConverterApp.init();
        LotteryApp.init();
        PomodoroApp.init();
        HabitApp.init();
        StatsApp.init();

        // 绑定导航事件
        this.bindNavEvents();

        // 绑定键盘快捷键
        this.bindKeyboardShortcuts();

        // 隐藏加载动画
        setTimeout(() => {
            this.hideLoading();
        }, 500);

        console.log('生活效率工具箱已初始化');
    },

    /**
     * 显示加载动画
     */
    showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    },

    /**
     * 隐藏加载动画
     */
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    },

    /**
     * 绑定导航Tab切换事件
     */
    bindNavEvents() {
        const tabs = document.querySelectorAll('.nav-tab');

        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });
    },

    /**
     * 切换Tab
     * @param {string} tabName - Tab名称
     */
    switchTab(tabName) {
        // 更新Tab按钮状态
        document.querySelectorAll('.nav-tab').forEach(tab => {
            const isActive = tab.dataset.tab === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive);
        });

        // 更新面板显示
        document.querySelectorAll('.tool-panel').forEach(panel => {
            const isActive = panel.id === `${tabName}-panel`;
            panel.classList.toggle('active', isActive);
        });

        // 切换到统计面板时刷新数据
        const refreshTabs = ['todo', 'password', 'account', 'converter', 'lottery', 'pomodoro', 'habit'];
        if (refreshTabs.includes(tabName)) {
            StatsApp.refresh();
        }

        this.currentTab = tabName;

        // 记录快捷访问
        if (['todo', 'password', 'account', 'converter', 'lottery', 'pomodoro', 'habit'].includes(tabName)) {
            QuickAccess.addRecent(tabName, '访问工具');
        }

        // 添加页面过渡动画
        const activePanel = document.querySelector('.tool-panel.active');
        if (activePanel) {
            activePanel.style.animation = 'none';
            activePanel.offsetHeight; // 触发重排
            activePanel.style.animation = 'fadeIn 0.3s ease';
        }
    },

    /**
     * 绑定全局键盘快捷键
     */
    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + 数字键 切换Tab (1-8)
            if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '8') {
                e.preventDefault();
                const tabs = ['todo', 'password', 'account', 'converter', 'lottery', 'pomodoro', 'habit', 'about'];
                const index = parseInt(e.key, 10) - 1;
                if (tabs[index]) {
                    this.switchTab(tabs[index]);
                }
            }

            // Ctrl/Cmd + D 切换主题
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                ThemeManager.toggle();
            }

            // Ctrl/Cmd + E 导出数据
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                DataManager.exportData();
            }

            // Escape 关闭下拉菜单
            if (e.key === 'Escape') {
                document.querySelectorAll('.dropdown.open').forEach(d => {
                    d.classList.remove('open');
                });
            }
        });
    },

    /**
     * 获取当前Tab名称
     * @returns {string} 当前Tab名称
     */
    getCurrentTab() {
        return this.currentTab;
    }
};

// DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// 暴露到全局
window.App = App;
