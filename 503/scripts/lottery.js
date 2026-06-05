/**
 * ===================================
 * 随机抽签/抽奖器模块 - lottery.js
 * ===================================
 * 功能：单个抽取、批量分组抽奖
 * 数据持久化：LocalStorage
 */

const LotteryApp = {
    // 历史记录
    history: [],

    // 当前模式：single / group
    currentMode: 'single',

    // 抽奖动画定时器
    animationTimer: null,

    /**
     * 初始化抽奖应用
     */
    init() {
        this.loadData();
        this.bindEvents();
        this.render();
    },

    /**
     * 从 LocalStorage 加载历史记录
     */
    loadData() {
        const saved = Utils.getStorage(Utils.STORAGE_KEYS.LOTTERY);
        this.history = Array.isArray(saved) ? saved : [];
    },

    /**
     * 保存历史记录到 LocalStorage
     */
    saveData() {
        Utils.setStorage(Utils.STORAGE_KEYS.LOTTERY, this.history);
    },

    /**
     * 记录使用统计
     */
    recordUsage() {
        const stats = StatsApp.getStats();
        stats.lotteryUsage = (stats.lotteryUsage || 0) + 1;
        StatsApp.saveStats(stats);
    },

    /**
     * 绑定事件监听
     */
    bindEvents() {
        // 模式切换
        document.querySelectorAll('[data-lottery-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.lotteryMode;
                this.setMode(mode);
            });
        });

        // 候选名单输入
        const candidatesInput = document.getElementById('lottery-candidates');
        if (candidatesInput) {
            candidatesInput.addEventListener('input', () => this.updateCount());
        }

        // 开始抽奖按钮
        const startBtn = document.getElementById('lottery-start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startLottery());
        }
    },

    /**
     * 设置抽奖模式
     * @param {string} mode - 模式：single / group
     */
    setMode(mode) {
        this.currentMode = mode;

        // 更新按钮状态
        document.querySelectorAll('[data-lottery-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lotteryMode === mode);
        });

        // 显示/隐藏分组选项
        const groupSection = document.getElementById('lottery-group-section');
        if (groupSection) {
            groupSection.style.display = mode === 'group' ? 'block' : 'none';
        }
    },

    /**
     * 获取候选列表
     * @returns {Array} 候选选项数组
     */
    getCandidates() {
        const input = document.getElementById('lottery-candidates');
        if (!input) return [];

        const text = input.value.trim();
        if (!text) return [];

        return text.split('\n').filter(item => item.trim() !== '');
    },

    /**
     * 更新候选数量显示
     */
    updateCount() {
        const countEl = document.getElementById('lottery-count');
        if (countEl) {
            const count = this.getCandidates().length;
            countEl.textContent = count;
        }
    },

    /**
     * 开始抽奖
     */
    startLottery() {
        const candidates = this.getCandidates();

        if (candidates.length === 0) {
            Utils.showToast('请输入候选名单', 'error');
            return;
        }

        if (candidates.length === 1) {
            Utils.showToast('候选名单至少需要2个选项', 'error');
            return;
        }

        this.recordUsage();
        QuickAccess.addRecent('lottery', '随机抽奖');

        if (this.currentMode === 'single') {
            this.lotterySingle(candidates);
        } else {
            this.lotteryGroup(candidates);
        }
    },

    /**
     * 单个抽取
     * @param {Array} candidates - 候选列表
     */
    lotterySingle(candidates) {
        const resultContainer = document.getElementById('lottery-result');
        if (!resultContainer) return;

        let count = 0;
        const maxCount = 30;
        const speed = 50;

        // 停止之前的动画
        if (this.animationTimer) {
            clearInterval(this.animationTimer);
        }

        // 开始滚动动画
        this.animationTimer = setInterval(() => {
            count++;
            const randomIndex = Math.floor(Math.random() * candidates.length);
            resultContainer.innerHTML = `
                <div class="lottery-animation">
                    <div class="lottery-rolling">${candidates[randomIndex]}</div>
                </div>
            `;

            if (count >= maxCount) {
                clearInterval(this.animationTimer);
                const winner = candidates[Math.floor(Math.random() * candidates.length)];
                this.showWinner([winner]);
                this.addToHistory('single', [winner]);
            }
        }, speed);
    },

    /**
     * 批量分组
     * @param {Array} candidates - 候选列表
     */
    lotteryGroup(candidates) {
        const groupNumInput = document.getElementById('lottery-group-num');
        const groupNum = parseInt(groupNumInput?.value || '2', 10);

        if (groupNum < 2 || groupNum > candidates.length) {
            Utils.showToast(`分组数量需在 2 到 ${candidates.length} 之间`, 'error');
            return;
        }

        // 打乱顺序
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);

        // 平均分组
        const groups = [];
        const baseSize = Math.floor(shuffled.length / groupNum);
        let remainder = shuffled.length % groupNum;
        let index = 0;

        for (let i = 0; i < groupNum; i++) {
            const size = baseSize + (i < remainder ? 1 : 0);
            groups.push(shuffled.slice(index, index + size));
            index += size;
        }

        this.showGroupResults(groups);
        this.addToHistory('group', groups);
    },

    /**
     * 显示中奖者
     * @param {Array} winners - 中奖者列表
     */
    showWinner(winners) {
        const resultContainer = document.getElementById('lottery-result');
        if (!resultContainer) return;

        resultContainer.innerHTML = `
            <div class="lottery-winner">
                <div class="lottery-confetti">🎉</div>
                <h3>恭喜以下成员！</h3>
                <div class="lottery-winner-list">
                    ${winners.map(w => `<div class="lottery-winner-item">${w}</div>`).join('')}
                </div>
            </div>
        `;
    },

    /**
     * 显示分组结果
     * @param {Array} groups - 分组结果
     */
    showGroupResults(groups) {
        const resultContainer = document.getElementById('lottery-result');
        if (!resultContainer) return;

        resultContainer.innerHTML = `
            <div class="lottery-groups">
                <h3>分组结果</h3>
                <div class="lottery-groups-grid">
                    ${groups.map((group, i) => `
                        <div class="lottery-group-card">
                            <div class="lottery-group-title">第 ${i + 1} 组</div>
                            <div class="lottery-group-members">
                                ${group.map(m => `<span class="lottery-member">${m}</span>`).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * 添加到历史记录
     * @param {string} type - 类型
     * @param {Array} results - 结果
     */
    addToHistory(type, results) {
        const record = {
            id: Utils.generateId(),
            type: type,
            results: results,
            candidatesCount: this.getCandidates().length,
            time: Date.now()
        };

        this.history.unshift(record);
        this.history = this.history.slice(0, 30);

        this.saveData();
        this.renderHistory();
    },

    /**
     * 渲染历史记录
     */
    renderHistory() {
        const list = document.getElementById('lottery-history');
        if (!list) return;

        if (this.history.length === 0) {
            list.innerHTML = '<li style="color: var(--text-muted); text-align: center; padding: 16px;">暂无抽奖记录</li>';
            return;
        }

        list.innerHTML = this.history.map(record => {
            const date = Utils.formatDate(record.time, 'MM-DD HH:mm');
            const resultsPreview = record.type === 'single'
                ? record.results[0]
                : `${record.results.length}组`;

            return `
                <li class="history-item">
                    <div>
                        <div>${resultsPreview}</div>
                        <small style="color: var(--text-muted)">${date}</small>
                    </div>
                    <button class="btn-icon" onclick="LotteryApp.deleteHistory('${record.id}')" title="删除">🗑️</button>
                </li>
            `;
        }).join('');
    },

    /**
     * 删除历史记录
     * @param {string} id - 记录ID
     */
    deleteHistory(id) {
        this.history = this.history.filter(r => r.id !== id);
        this.saveData();
        this.renderHistory();
        Utils.showToast('已删除', 'success');
    },

    /**
     * 渲染
     */
    render() {
        this.updateCount();
        this.renderHistory();
    }
};

// 暴露到全局
window.LotteryApp = LotteryApp;
