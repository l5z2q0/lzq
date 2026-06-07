/**
 * ===================================
 * 随机抽签/抽奖器模块 - lottery.js
 * ===================================
 * 功能：单个抽取、批量分组抽奖
 * 数据持久化：LocalStorage
 */

const LotteryApp = {
    history: [],
    currentMode: 'single',
    animationTimer: null,

    init() {
        this.loadData();
        this.bindEvents();
        this.render();
    },

    loadData() {
        const saved = Utils.getStorage(Utils.STORAGE_KEYS.LOTTERY);
        this.history = Array.isArray(saved) ? saved : [];
    },

    saveData() {
        Utils.setStorage(Utils.STORAGE_KEYS.LOTTERY, this.history);
    },

    recordUsage() {
        const stats = StatsApp.getStats();
        stats.lotteryUsage = (stats.lotteryUsage || 0) + 1;
        StatsApp.saveStats(stats);
    },

    bindEvents() {
        document.querySelectorAll('[data-lottery-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.lotteryMode;
                this.setMode(mode);
            });
        });

        const candidatesInput = document.getElementById('lottery-candidates');
        if (candidatesInput) {
            candidatesInput.addEventListener('input', () => this.updateCount());
        }

        const startBtn = document.getElementById('lottery-start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startLottery());
        }
    },

    setMode(mode) {
        this.currentMode = mode;

        document.querySelectorAll('[data-lottery-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lotteryMode === mode);
        });

        const groupSection = document.getElementById('lottery-group-section');
        if (groupSection) {
            groupSection.style.display = mode === 'group' ? 'block' : 'none';
        }
    },

    getCandidates() {
        const input = document.getElementById('lottery-candidates');
        if (!input) return [];

        const text = input.value.trim();
        if (!text) return [];

        return text.split('\n').filter(item => item.trim() !== '');
    },

    updateCount() {
        const countEl = document.getElementById('lottery-count');
        if (countEl) {
            const count = this.getCandidates().length;
            countEl.textContent = count;
        }
    },

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

    lotterySingle(candidates) {
        const resultContainer = document.getElementById('lottery-result');
        if (!resultContainer) return;

        let count = 0;
        const maxCount = 30;
        const speed = 50;

        if (this.animationTimer) {
            clearInterval(this.animationTimer);
        }

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

    lotteryGroup(candidates) {
        const groupNumInput = document.getElementById('lottery-group-num');
        const groupNum = parseInt(groupNumInput?.value || '2', 10);

        if (groupNum < 2 || groupNum > candidates.length) {
            Utils.showToast(`分组数量需在 2 到 ${candidates.length} 之间`, 'error');
            return;
        }

        const shuffled = [...candidates].sort(() => Math.random() - 0.5);

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

    deleteHistory(id) {
        this.history = this.history.filter(r => r.id !== id);
        this.saveData();
        this.renderHistory();
        Utils.showToast('已删除', 'success');
    },

    render() {
        this.updateCount();
        this.renderHistory();
    }
};

window.LotteryApp = LotteryApp;