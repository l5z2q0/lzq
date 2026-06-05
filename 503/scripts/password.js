/**
 * ===================================
 * 密码生成器模块 - password.js
 * ===================================
 * 功能：自定义长度、字符类型生成密码，密码强度检测，历史记录
 * 数据持久化：LocalStorage
 */

const PasswordApp = {
    // 历史记录
    history: [],

    // 字符集配置
    charSets: {
        uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        lowercase: 'abcdefghijklmnopqrstuvwxyz',
        numbers: '0123456789',
        symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    },

    // 当前生成的密码
    currentPassword: '',

    /**
     * 初始化密码生成器
     */
    init() {
        this.loadData();
        this.bindEvents();
        this.render();
        this.updateStrength(); // 初始状态
    },

    /**
     * 从 LocalStorage 加载历史记录
     */
    loadData() {
        const saved = Utils.getStorage(Utils.STORAGE_KEYS.PASSWORD_HISTORY);
        this.history = Array.isArray(saved) ? saved : [];
    },

    /**
     * 保存历史记录到 LocalStorage
     */
    saveData() {
        Utils.setStorage(Utils.STORAGE_KEYS.PASSWORD_HISTORY, this.history);
    },

    /**
     * 记录使用统计
     */
    recordUsage() {
        const stats = StatsApp.getStats();
        stats.passwordUsage = (stats.passwordUsage || 0) + 1;
        StatsApp.saveStats(stats);
    },

    /**
     * 绑定事件监听
     */
    bindEvents() {
        // 长度滑块
        const lengthSlider = document.getElementById('password-length');
        const lengthValue = document.getElementById('length-value');

        if (lengthSlider && lengthValue) {
            lengthSlider.addEventListener('input', (e) => {
                lengthValue.textContent = e.target.value;
                this.updateStrength();
            });
        }

        // 字符选项变化时更新强度
        ['use-uppercase', 'use-lowercase', 'use-numbers', 'use-symbols'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => this.updateStrength());
            }
        });

        // 生成按钮
        const generateBtn = document.getElementById('generate-password');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generate());
        }

        // 复制按钮
        const copyBtn = document.getElementById('copy-password');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copy());
        }

        // 刷新按钮
        const refreshBtn = document.getElementById('refresh-password');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.generate());
        }
    },

    /**
     * 获取当前设置的字符池
     * @returns {string} 可用字符集合
     */
    getCharPool() {
        let pool = '';

        if (document.getElementById('use-uppercase')?.checked) {
            pool += this.charSets.uppercase;
        }
        if (document.getElementById('use-lowercase')?.checked) {
            pool += this.charSets.lowercase;
        }
        if (document.getElementById('use-numbers')?.checked) {
            pool += this.charSets.numbers;
        }
        if (document.getElementById('use-symbols')?.checked) {
            pool += this.charSets.symbols;
        }

        return pool;
    },

    /**
     * 生成密码
     */
    generate() {
        const pool = this.getCharPool();

        if (!pool) {
            Utils.showToast('请至少选择一种字符类型', 'error');
            return;
        }

        const length = parseInt(document.getElementById('password-length')?.value || '16', 10);

        // 生成密码
        let password = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * pool.length);
            password += pool[randomIndex];
        }

        this.currentPassword = password;

        // 更新显示
        const output = document.getElementById('password-output');
        if (output) {
            output.value = password;
        }

        // 添加到历史记录
        this.addToHistory(password);

        // 更新强度指示
        this.updateStrength();

        // 记录统计
        this.recordUsage();
        QuickAccess.addRecent('password', '生成密码');

        Utils.showToast('密码已生成', 'success');
    },

    /**
     * 添加到历史记录
     * @param {string} password - 密码
     */
    addToHistory(password) {
        // 避免重复
        this.history = this.history.filter(p => p !== password);

        // 添加到开头
        this.history.unshift(password);

        // 只保留10条
        this.history = this.history.slice(0, 10);

        this.saveData();
        this.renderHistory();
    },

    /**
     * 复制当前密码
     */
    async copy() {
        if (!this.currentPassword) {
            Utils.showToast('请先生成密码', 'error');
            return;
        }

        const success = await Utils.copyToClipboard(this.currentPassword);

        if (success) {
            Utils.showToast('已复制到剪贴板', 'success');
        } else {
            Utils.showToast('复制失败，请手动复制', 'error');
        }
    },

    /**
     * 从历史记录复制
     * @param {string} password - 密码
     */
    async copyFromHistory(password) {
        const success = await Utils.copyToClipboard(password);

        if (success) {
            Utils.showToast('已复制到剪贴板', 'success');
        } else {
            Utils.showToast('复制失败', 'error');
        }
    },

    /**
     * 删除历史记录项
     * @param {string} password - 密码
     */
    deleteFromHistory(password) {
        this.history = this.history.filter(p => p !== password);
        this.saveData();
        this.renderHistory();
    },

    /**
     * 计算密码强度
     * @returns {Object} 强度信息 { score: 0-100, level: 'weak'|'medium'|'strong', text: string }
     */
    calculateStrength() {
        const password = this.currentPassword || document.getElementById('password-output')?.value || '';

        if (!password) {
            return { score: 0, level: 'weak', text: '未知' };
        }

        let score = 0;

        // 长度评分
        if (password.length >= 8) score += 20;
        if (password.length >= 12) score += 10;
        if (password.length >= 16) score += 10;
        if (password.length >= 24) score += 10;

        // 字符种类评分
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSymbol = /[^A-Za-z0-9]/.test(password);

        const typeCount = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
        score += typeCount * 10;

        // 重复字符惩罚
        const uniqueRatio = new Set(password).size / password.length;
        score *= uniqueRatio;

        // 标准化到 0-100
        score = Math.min(100, Math.round(score));

        let level, text;
        if (score < 40) {
            level = 'weak';
            text = '弱';
        } else if (score < 70) {
            level = 'medium';
            text = '中等';
        } else {
            level = 'strong';
            text = '强';
        }

        return { score, level, text };
    },

    /**
     * 更新密码强度显示
     */
    updateStrength() {
        // 先生成密码获取真实强度，或者只用长度估算
        const length = parseInt(document.getElementById('password-length')?.value || '16', 10);
        const pool = this.getCharPool();
        const typesEnabled = [
            document.getElementById('use-uppercase')?.checked,
            document.getElementById('use-lowercase')?.checked,
            document.getElementById('use-numbers')?.checked,
            document.getElementById('use-symbols')?.checked
        ].filter(Boolean).length;

        // 简单估算（不实际生成）
        let estimatedScore = 0;
        estimatedScore += Math.min(50, length * 2); // 长度最多50分
        estimatedScore += typesEnabled * 12; // 字符类型每种12分

        let level, text;
        if (estimatedScore < 50) {
            level = 'weak';
            text = '弱';
        } else if (estimatedScore < 80) {
            level = 'medium';
            text = '中等';
        } else {
            level = 'strong';
            text = '强';
        }

        const fill = document.getElementById('strength-fill');
        const textEl = document.getElementById('strength-text');

        if (fill) {
            fill.className = `strength-fill ${level}`;
        }

        if (textEl) {
            textEl.textContent = text;
        }
    },

    /**
     * 渲染历史记录
     */
    renderHistory() {
        const list = document.getElementById('password-history');
        if (!list) return;

        if (this.history.length === 0) {
            list.innerHTML = '<li style="color: var(--text-muted); text-align: center; padding: 16px;">暂无历史记录</li>';
            return;
        }

        list.innerHTML = this.history.map((pwd, index) => `
            <li class="history-item">
                <span>${'*'.repeat(Math.min(20, pwd.length))}</span>
                <div>
                    <button class="btn-icon" onclick="PasswordApp.copyFromHistory('${this.escapeHtml(pwd)}')" title="复制">📋</button>
                    <button class="btn-icon" onclick="PasswordApp.deleteFromHistory('${this.escapeHtml(pwd)}')" title="删除">🗑️</button>
                </div>
            </li>
        `).join('');
    },

    /**
     * 渲染初始状态
     */
    render() {
        this.renderHistory();
    },

    /**
     * HTML转义
     * @param {string} text - 原始文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }
};

// 暴露到全局
window.PasswordApp = PasswordApp;
