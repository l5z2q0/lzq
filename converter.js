/**
 * ===================================
 * 单位换算器模块 - converter.js
 * ===================================
 * 功能：长度/重量/面积/体积/温度单位换算
 * 数据持久化：LocalStorage
 */

const ConverterApp = {
    // 历史记录
    history: [],

    // 当前分类
    currentCategory: 'length',

    // 单位配置
    units: {
        length: [
            { id: 'm', name: '米 (m)', ratio: 1 },
            { id: 'km', name: '千米 (km)', ratio: 1000 },
            { id: 'cm', name: '厘米 (cm)', ratio: 0.01 },
            { id: 'mm', name: '毫米 (mm)', ratio: 0.001 },
            { id: 'mi', name: '英里 (mi)', ratio: 1609.344 },
            { id: 'yd', name: '码 (yd)', ratio: 0.9144 },
            { id: 'ft', name: '英尺 (ft)', ratio: 0.3048 },
            { id: 'in', name: '英寸 (in)', ratio: 0.0254 }
        ],
        weight: [
            { id: 'kg', name: '千克 (kg)', ratio: 1 },
            { id: 'g', name: '克 (g)', ratio: 0.001 },
            { id: 'mg', name: '毫克 (mg)', ratio: 0.000001 },
            { id: 'lb', name: '磅 (lb)', ratio: 0.453592 },
            { id: 'oz', name: '盎司 (oz)', ratio: 0.0283495 },
            { id: 't', name: '吨 (t)', ratio: 1000 }
        ],
        area: [
            { id: 'm2', name: '平方米 (m²)', ratio: 1 },
            { id: 'km2', name: '平方千米 (km²)', ratio: 1000000 },
            { id: 'cm2', name: '平方厘米 (cm²)', ratio: 0.0001 },
            { id: 'ha', name: '公顷 (ha)', ratio: 10000 },
            { id: 'acre', name: '英亩 (acre)', ratio: 4046.856 },
            { id: 'ft2', name: '平方英尺 (ft²)', ratio: 0.092903 },
            { id: 'yd2', name: '平方码 (yd²)', ratio: 0.836127 }
        ],
        volume: [
            { id: 'L', name: '升 (L)', ratio: 1 },
            { id: 'mL', name: '毫升 (mL)', ratio: 0.001 },
            { id: 'm3', name: '立方米 (m³)', ratio: 1000 },
            { id: 'cm3', name: '立方厘米 (cm³)', ratio: 0.001 },
            { id: 'gal', name: '加仑 (gal)', ratio: 3.78541 },
            { id: 'qt', name: '夸脱 (qt)', ratio: 0.946353 },
            { id: 'pt', name: '品脱 (pt)', ratio: 0.473176 },
            { id: 'cup', name: '杯 (cup)', ratio: 0.236588 }
        ],
        temperature: [
            { id: 'C', name: '摄氏度 (°C)', ratio: 1, offset: 0 },
            { id: 'F', name: '华氏度 (°F)', ratio: 5/9, offset: -32 },
            { id: 'K', name: '开尔文 (K)', ratio: 1, offset: -273.15 }
        ]
    },

    /**
     * 初始化单位换算器
     */
    init() {
        this.loadData();
        this.bindEvents();
        this.renderUnits();
        this.render();
    },

    /**
     * 从 LocalStorage 加载历史记录
     */
    loadData() {
        const saved = Utils.getStorage(Utils.STORAGE_KEYS.CONVERTER);
        this.history = Array.isArray(saved) ? saved : [];
    },

    /**
     * 保存历史记录到 LocalStorage
     */
    saveData() {
        Utils.setStorage(Utils.STORAGE_KEYS.CONVERTER, this.history);
    },

    /**
     * 记录使用统计
     */
    recordUsage() {
        const stats = StatsApp.getStats();
        stats.converterUsage = (stats.converterUsage || 0) + 1;
        StatsApp.saveStats(stats);
    },

    /**
     * 绑定事件监听
     */
    bindEvents() {
        // 分类切换
        const categorySelect = document.getElementById('converter-category');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                this.currentCategory = e.target.value;
                this.renderUnits();
                this.clearInput();
            });
        }

        // 换算按钮
        const convertBtn = document.getElementById('convert-btn');
        if (convertBtn) {
            convertBtn.addEventListener('click', () => this.convert());
        }

        // 输入框回车换算
        const valueInput = document.getElementById('converter-value');
        if (valueInput) {
            valueInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.convert();
                }
            });
        }

        // 复制结果
        const copyBtn = document.getElementById('copy-converter-result');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyResult());
        }

        // 清空按钮
        const clearBtn = document.getElementById('clear-converter');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearInput());
        }
    },

    /**
     * 渲染单位选择下拉框
     */
    renderUnits() {
        const fromSelect = document.getElementById('converter-from-unit');
        const toSelect = document.getElementById('converter-to-unit');

        if (!fromSelect || !toSelect) return;

        const units = this.units[this.currentCategory] || [];

        const optionsHtml = units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');

        fromSelect.innerHTML = optionsHtml;
        toSelect.innerHTML = optionsHtml;

        // 默认选择不同的单位
        if (units.length > 1) {
            toSelect.selectedIndex = 1;
        }
    },

    /**
     * 执行换算
     */
    convert() {
        const valueInput = document.getElementById('converter-value');
        const fromSelect = document.getElementById('converter-from-unit');
        const toSelect = document.getElementById('converter-to-unit');
        const resultInput = document.getElementById('converter-result');

        if (!valueInput || !fromSelect || !toSelect || !resultInput) return;

        const inputValue = parseFloat(valueInput.value);

        if (isNaN(inputValue)) {
            Utils.showToast('请输入有效数值', 'error');
            return;
        }

        const fromUnit = fromSelect.value;
        const toUnit = toSelect.value;
        const result = this.calculate(inputValue, fromUnit, toUnit);

        // 显示结果
        resultInput.value = this.formatResult(result, toUnit);

        // 添加到历史记录
        this.addToHistory({
            input: inputValue,
            from: fromUnit,
            to: toUnit,
            result: result,
            time: Date.now()
        });

        // 记录统计
        this.recordUsage();
        QuickAccess.addRecent('converter', '单位换算');
    },

    /**
     * 计算换算值
     * @param {number} value - 输入值
     * @param {string} from - 源单位ID
     * @param {string} to - 目标单位ID
     * @returns {number} 换算结果
     */
    calculate(value, from, to) {
        // 温度换算需要特殊处理
        if (this.currentCategory === 'temperature') {
            return this.convertTemperature(value, from, to);
        }

        const units = this.units[this.currentCategory] || [];
        const fromUnit = units.find(u => u.id === from);
        const toUnit = units.find(u => u.id === to);

        if (!fromUnit || !toUnit) return 0;

        // 转换为基准单位，再转换为目标单位
        const baseValue = value * fromUnit.ratio;
        return baseValue / toUnit.ratio;
    },

    /**
     * 温度换算
     * @param {number} value - 输入值
     * @param {string} from - 源单位
     * @param {string} to - 目标单位
     * @returns {number} 换算结果
     */
    convertTemperature(value, from, to) {
        // 先转换为摄氏度
        let celsius;
        switch (from) {
            case 'C':
                celsius = value;
                break;
            case 'F':
                celsius = (value - 32) * 5 / 9;
                break;
            case 'K':
                celsius = value - 273.15;
                break;
            default:
                celsius = value;
        }

        // 再转换为目标单位
        switch (to) {
            case 'C':
                return celsius;
            case 'F':
                return celsius * 9 / 5 + 32;
            case 'K':
                return celsius + 273.15;
            default:
                return celsius;
        }
    },

    /**
     * 格式化结果
     * @param {number} result - 结果值
     * @param {string} unitId - 单位ID
     * @returns {string} 格式化后的字符串
     */
    formatResult(result, unitId) {
        // 根据单位类型格式化
        if (Math.abs(result) < 0.0001 || Math.abs(result) > 1000000) {
            return result.toExponential(4);
        }
        return parseFloat(result.toPrecision(10)).toString();
    },

    /**
     * 添加到历史记录
     * @param {Object} record - 记录对象
     */
    addToHistory(record) {
        const display = `${record.input} ${this.getUnitName(record.from)} = ${this.formatResult(record.result, record.to)} ${this.getUnitName(record.to)}`;

        this.history.unshift({
            ...record,
            display: display,
            id: Utils.generateId()
        });

        // 只保留最近20条
        this.history = this.history.slice(0, 20);

        this.saveData();
        this.renderHistory();
    },

    /**
     * 获取单位名称
     * @param {string} unitId - 单位ID
     * @returns {string} 单位名称
     */
    getUnitName(unitId) {
        const units = this.units[this.currentCategory] || [];
        const unit = units.find(u => u.id === unitId);
        return unit ? unit.name.split(' ')[0] : unitId;
    },

    /**
     * 复制结果到剪贴板
     */
    async copyResult() {
        const resultInput = document.getElementById('converter-result');
        if (!resultInput || !resultInput.value) {
            Utils.showToast('没有可复制的结果', 'error');
            return;
        }

        const success = await Utils.copyToClipboard(resultInput.value);
        if (success) {
            Utils.showToast('已复制到剪贴板', 'success');
        } else {
            Utils.showToast('复制失败', 'error');
        }
    },

    /**
     * 清空输入
     */
    clearInput() {
        const valueInput = document.getElementById('converter-value');
        const resultInput = document.getElementById('converter-result');

        if (valueInput) valueInput.value = '';
        if (resultInput) resultInput.value = '';
    },

    /**
     * 渲染历史记录
     */
    renderHistory() {
        const list = document.getElementById('converter-history');
        if (!list) return;

        if (this.history.length === 0) {
            list.innerHTML = '<li style="color: var(--text-muted); text-align: center; padding: 16px;">暂无历史记录</li>';
            return;
        }

        list.innerHTML = this.history.map(record => `
            <li class="history-item">
                <span title="${record.display}">${record.display.substring(0, 30)}${record.display.length > 30 ? '...' : ''}</span>
                <button class="btn-icon" onclick="ConverterApp.copyHistory('${record.id}')" title="复制">📋</button>
            </li>
        `).join('');
    },

    /**
     * 从历史记录复制
     * @param {string} id - 记录ID
     */
    async copyHistory(id) {
        const record = this.history.find(r => r.id === id);
        if (record) {
            const success = await Utils.copyToClipboard(record.display);
            if (success) {
                Utils.showToast('已复制', 'success');
            }
        }
    },

    /**
     * 渲染
     */
    render() {
        this.renderHistory();
    }
};

// 暴露到全局
window.ConverterApp = ConverterApp;
