/**
 * ===================================
 * 密码生成器模块 - password.js
 * ===================================
 * 功能：自定义长度、字符类型生成密码，密码强度检测，历史记录
 * 数据持久化：LocalStorage
 */

const PasswordApp = {
    history: [],
    charSets: {
        uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        lowercase: 'abcdefghijklmnopqrstuvwxyz',
        numbers: '0123456789',
        symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    },
    currentPassword: '',

    init() {
        this.loadData();
        this.bindEvents();
        this.render();
        this.updateStrength();
    },

    loadData() {
        const saved = Utils.getStorage(Utils.STORAGE_KEYS.PASSWORD_HISTORY);
        this.history = Array.isArray(saved) ? saved : [];
    },

    saveData() {
        Utils.setStorage(Utils.STORAGE_KEYS.PASSWORD_HISTORY, this.history);
    },

    recordUsage() {
        const stats = StatsApp.getStats();
        stats.passwordUsage = (stats.passwordUsage || 0) + 1;
        StatsApp.saveStats(stats);
    },

    bindEvents() {
        const lengthSlider = document.getElementById('password-length');
        const lengthValue = document.getElementById('length-value');

        if (lengthSlider && lengthValue) {
            lengthSlider.addEventListener('input', (e) => {
                lengthValue.textContent = e.target.value;
                this.updateStrength();
            });
        }

        ['use-uppercase', 'use-lowercase', 'use-numbers', 'use-symbols'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => this.updateStrength());
            }
        });

        const generateBtn = document.getElementById('generate-password');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generate());
        }

        const copyBtn = document.getElementById('copy-password');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copy());
        }

        const refreshBtn = document.getElementById('refresh-password');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.generate());
        }
    },

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

    generate() {
        const pool = this.getCharPool();

        if (!pool) {
            Utils.showToast('请至少选择一种字符类型', 'error');
            return;
        }

        const length = parseInt(document.getElementById('password-length')?.value || '16', 10);

        let password = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * pool.length);
            password += pool[randomIndex];
        }

        this.currentPassword = password;

        const output = document.getElementById('password-output');
        if (output) {
            output.value = password;
        }

        this.addToHistory(password);
        this.updateStrength();
        this.recordUsage();
        QuickAccess.addRecent('password', '生成密码');

        Utils.showToast('密码已生成', 'success');
    },

    addToHistory(password) {
        this.history = this.history.filter(p => p !== password);
        this.history.unshift(password);
        this.history = this.history.slice(0, 10);
        this.saveData();
        this.renderHistory();
    },

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

    async copyFromHistory(password) {
        const success = await Utils.copyToClipboard(password);

        if (success) {
            Utils.showToast('已复制到剪贴板', 'success');
        } else {
            Utils.showToast('复制失败', 'error');
        }
    },

    deleteFromHistory(password) {
        this.history = this.history.filter(p => p !== password);
        this.saveData();
        this.renderHistory();
    },

    calculateStrength() {
        const password = this.currentPassword || document.getElementById('password-output')?.value || '';

        if (!password) {
            return { score: 0, level: 'weak', text: '未知' };
        }

        let score = 0;

        if (password.length >= 8) score += 20;
        if (password.length >= 12) score += 10;
        if (password.length >= 16) score += 10;
        if (password.length >= 24) score += 10;

        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSymbol = /[^A-Za-z0-9]/.test(password);

        const typeCount = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
        score += typeCount * 10;

        const uniqueRatio = new Set(password).size / password.length;
        score *= uniqueRatio;

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

    updateStrength() {
        const length = parseInt(document.getElementById('password-length')?.value || '16', 10);
        const pool = this.getCharPool();
        const typesEnabled = [
            document.getElementById('use-uppercase')?.checked,
            document.getElementById('use-lowercase')?.checked,
            document.getElementById('use-numbers')?.checked,
            document.getElementById('use-symbols')?.checked
        ].filter(Boolean).length;

        let estimatedScore = 0;
        estimatedScore += Math.min(50, length * 2);
        estimatedScore += typesEnabled * 12;

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

    render() {
        this.renderHistory();
    },

    escapeHtml(text) {
        return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }
};

window.PasswordApp = PasswordApp;