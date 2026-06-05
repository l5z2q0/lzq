/**
 * ===================================
 * 工具函数模块 - utils.js
 * ===================================
 * 提供通用的工具函数、数据存储接口、Toast通知等
 */

const Utils = {
    /**
     * LocalStorage 存储键名
     */
    STORAGE_KEYS: {
        TODO: 'life_toolbox_todos',
        PASSWORD_HISTORY: 'life_toolbox_password_history',
        ACCOUNTS: 'life_toolbox_accounts',
        CONVERTER: 'life_toolbox_converter',
        LOTTERY: 'life_toolbox_lottery',
        POMODORO_STATS: 'life_toolbox_pomodoro_stats',
        HABITS: 'life_toolbox_habits',
        HABIT_CHECKINS: 'life_toolbox_habit_checkins',
        THEME: 'life_toolbox_theme',
        STATS: 'life_toolbox_stats',
        RECENT: 'life_toolbox_recent'
    },

    /**
     * 从 LocalStorage 获取数据
     * @param {string} key - 存储键名
     * @returns {any} 解析后的数据，失败返回 null
     */
    getStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error(`读取存储失败 [${key}]:`, e);
            return null;
        }
    },

    /**
     * 保存数据到 LocalStorage
     * @param {string} key - 存储键名
     * @param {any} value - 要存储的数据
     * @returns {boolean} 是否存储成功
     */
    setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`存储数据失败 [${key}]:`, e);
            return false;
        }
    },

    /**
     * 生成唯一ID
     * @returns {string} 唯一标识符
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    /**
     * 格式化日期
     * @param {Date|number|string} date - 日期对象或时间戳
     * @param {string} format - 格式字符串，默认 'YYYY-MM-DD'
     * @returns {string} 格式化后的日期字符串
     */
    formatDate(date, format = 'YYYY-MM-DD') {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');

        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes);
    },

    /**
     * 获取当前月份的字符串标识
     * @returns {string} 格式：YYYY-MM
     */
    getCurrentMonth() {
        return this.formatDate(new Date(), 'YYYY-MM');
    },

    /**
     * 显示 Toast 通知
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型：'info', 'success', 'error'
     * @param {number} duration - 显示时长（毫秒），默认 3000
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.querySelector('.toast-message').textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    },

    /**
     * 获取指定月份的所有日期
     * @param {string} yearMonth - 格式：YYYY-MM
     * @returns {number} 该月的天数
     */
    getDaysInMonth(yearMonth) {
        const [year, month] = yearMonth.split('-').map(Number);
        return new Date(year, month, 0).getDate();
    },

    /**
     * 获取最近N条记录
     * @param {Array} list - 数据列表
     * @param {number} n - 返回数量
     * @returns {Array} 最近的N条记录
     */
    getRecentItems(list, n = 3) {
        if (!Array.isArray(list)) return [];
        return list.slice(-n).reverse();
    },

    /**
     * 防抖函数
     * @param {Function} func - 要防抖的函数
     * @param {number} wait - 等待时间（毫秒）
     * @returns {Function} 防抖后的函数
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * 深拷贝对象
     * @param {any} obj - 要拷贝的对象
     * @returns {any} 拷贝后的对象
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        return cloned;
    },

    /**
     * 验证JSON数据格式
     * @param {string} jsonString - JSON字符串
     * @returns {boolean} 是否为有效JSON
     */
    isValidJSON(jsonString) {
        try {
            const obj = JSON.parse(jsonString);
            return typeof obj === 'object' && obj !== null;
        } catch {
            return false;
        }
    },

    /**
     * 下载文本文件
     * @param {string} content - 文件内容
     * @param {string} filename - 文件名
     * @param {string} mimeType - MIME类型
     */
    downloadFile(content, filename, mimeType = 'application/json') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    /**
     * 复制文本到剪贴板
     * @param {string} text - 要复制的文本
     * @returns {Promise<boolean>} 是否复制成功
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
            // 降级方案
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            return success;
        } catch (e) {
            console.error('复制失败:', e);
            return false;
        }
    },

    /**
     * 切换元素显示/隐藏
     * @param {HTMLElement} element - 目标元素
     * @param {boolean} show - 是否显示
     */
    toggleVisibility(element, show = true) {
        if (!element) return;
        element.style.display = show ? '' : 'none';
    },

    /**
     * 添加类名（带动画）
     * @param {HTMLElement} element - 目标元素
     * @param {string} className - 类名
     */
    addClassWithAnimation(element, className) {
        if (!element) return;
        element.classList.add(className);
        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        });
    }
};

/**
 * 主题管理器
 */
const ThemeManager = {
    /**
     * 初始化主题
     */
    init() {
        const savedTheme = Utils.getStorage(Utils.STORAGE_KEYS.THEME) || 'light';
        this.setTheme(savedTheme);
        this.bindEvents();
    },

    /**
     * 设置主题
     * @param {string} theme - 'light' 或 'dark'
     */
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        Utils.setStorage(Utils.STORAGE_KEYS.THEME, theme);
        this.updateIcon(theme);
    },

    /**
     * 切换主题
     */
    toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
        Utils.showToast(`已切换到${next === 'dark' ? '深色' : '浅色'}模式`, 'success');
    },

    /**
     * 更新主题图标
     * @param {string} theme - 当前主题
     */
    updateIcon(theme) {
        const icon = document.getElementById('theme-icon');
        if (icon) {
            icon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }
    }
};

/**
 * 快捷入口管理器
 */
const QuickAccess = {
    /**
     * 初始化
     */
    init() {
        this.bindEvents();
        this.render();
    },

    /**
     * 获取最近使用记录
     * @returns {Array} 最近记录列表
     */
    getRecentList() {
        return Utils.getStorage(Utils.STORAGE_KEYS.RECENT) || [];
    },

    /**
     * 添加最近记录
     * @param {string} tool - 工具名称
     * @param {string} action - 操作描述
     */
    addRecent(tool, action = '') {
        const list = this.getRecentList();
        const item = {
            id: Utils.generateId(),
            tool,
            action,
            time: Date.now()
        };

        // 去重：新记录排在前面
        const filtered = list.filter(i => !(i.tool === tool && i.action === action));
        filtered.unshift(item);

        // 只保留最近10条
        const trimmed = filtered.slice(0, 10);
        Utils.setStorage(Utils.STORAGE_KEYS.RECENT, trimmed);
        this.render();
    },

    /**
     * 渲染最近记录
     */
    render() {
        const list = document.getElementById('recent-list');
        if (!list) return;

        const items = this.getRecentList().slice(0, 3);

        if (items.length === 0) {
            list.innerHTML = '<span class="empty-tip">暂无记录</span>';
            return;
        }

        const toolEmojis = {
            todo: '📝',
            password: '🔐',
            account: '💰'
        };

        list.innerHTML = items.map(item => `
            <div class="recent-item" data-tool="${item.tool}">
                <span>${toolEmojis[item.tool] || '📌'}</span>
                <span>${item.action || item.tool}</span>
            </div>
        `).join('');

        // 绑定点击事件
        list.querySelectorAll('.recent-item').forEach(el => {
            el.addEventListener('click', () => {
                const tool = el.dataset.tool;
                const tab = document.querySelector(`[data-tab="${tool}"]`);
                if (tab) {
                    tab.click();
                }
            });
        });
    },

    /**
     * 绑定下拉菜单事件
     */
    bindEvents() {
        const dropdown = document.getElementById('quick-access');
        if (!dropdown) return;

        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });

        // 点击外部关闭
        document.addEventListener('click', () => {
            dropdown.classList.remove('open');
        });
    }
};

/**
 * 数据导入导出管理器
 */
const DataManager = {
    /**
     * 获取全部应用数据
     * @returns {Object} 完整数据对象
     */
    getAllData() {
        return {
            todos: Utils.getStorage(Utils.STORAGE_KEYS.TODO) || [],
            passwordHistory: Utils.getStorage(Utils.STORAGE_KEYS.PASSWORD_HISTORY) || [],
            accounts: Utils.getStorage(Utils.STORAGE_KEYS.ACCOUNTS) || [],
            stats: Utils.getStorage(Utils.STORAGE_KEYS.STATS) || {},
            recent: Utils.getStorage(Utils.STORAGE_KEYS.RECENT) || [],
            exportTime: new Date().toISOString()
        };
    },

    /**
     * 导出数据为JSON文件
     */
    exportData() {
        const data = this.getAllData();
        const filename = `life_toolbox_backup_${Utils.formatDate(new Date(), 'YYYYMMDD_HHmm')}.json`;
        Utils.downloadFile(JSON.stringify(data, null, 2), filename);
        Utils.showToast('数据导出成功', 'success');
    },

    /**
     * 导入数据
     * @param {File} file - JSON文件
     */
    async importData(file) {
        try {
            const text = await file.text();

            if (!Utils.isValidJSON(text)) {
                Utils.showToast('文件格式无效', 'error');
                return;
            }

            const data = JSON.parse(text);

            // 验证数据结构
            if (!this.validateImportData(data)) {
                Utils.showToast('数据结构不完整，导入失败', 'error');
                return;
            }

            // 恢复数据
            if (data.todos) Utils.setStorage(Utils.STORAGE_KEYS.TODO, data.todos);
            if (data.passwordHistory) Utils.setStorage(Utils.STORAGE_KEYS.PASSWORD_HISTORY, data.passwordHistory);
            if (data.accounts) Utils.setStorage(Utils.STORAGE_KEYS.ACCOUNTS, data.accounts);
            if (data.stats) Utils.setStorage(Utils.STORAGE_KEYS.STATS, data.stats);
            if (data.recent) Utils.setStorage(Utils.STORAGE_KEYS.RECENT, data.recent);

            Utils.showToast('数据导入成功，正在刷新...', 'success');

            // 刷新页面以应用数据
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (e) {
            console.error('导入失败:', e);
            Utils.showToast('导入失败：' + e.message, 'error');
        }
    },

    /**
     * 验证导入数据的有效性
     * @param {Object} data - 要验证的数据
     * @returns {boolean} 是否有效
     */
    validateImportData(data) {
        const validKeys = ['todos', 'passwordHistory', 'accounts', 'stats', 'recent'];
        return validKeys.some(key => Array.isArray(data[key]) || typeof data[key] === 'object');
    },

    /**
     * 绑定导入导出事件
     */
    bindEvents() {
        // 导出按钮
        const exportBtn = document.getElementById('export-data');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        // 导入按钮和文件输入
        const importBtn = document.getElementById('import-data');
        const importFile = document.getElementById('import-file');
        const dataDropdown = document.getElementById('data-management');

        if (importBtn && importFile) {
            importBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                importFile.click();
            });

            importFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.importData(file);
                    e.target.value = ''; // 清空以便重复选择同一文件
                }
            });
        }

        // 下拉菜单点击外部关闭
        if (dataDropdown) {
            dataDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
                dataDropdown.classList.toggle('open');
            });

            document.addEventListener('click', () => {
                dataDropdown.classList.remove('open');
            });
        }
    }
};

// 导出模块
window.Utils = Utils;
window.ThemeManager = ThemeManager;
window.QuickAccess = QuickAccess;
window.DataManager = DataManager;
