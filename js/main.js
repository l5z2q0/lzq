const STORAGE_KEYS = {
    TODOS: 'toolbox_todos',
    ACCOUNTS: 'toolbox_accounts',
    CALC_COUNT: 'toolbox_calc_count',
    THEME: 'toolbox_theme'
};

function getFromStorage(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch {
        return defaultValue;
    }
}

function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('保存数据失败:', e);
    }
}

function switchPage(pageId) {
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.add('hidden');
    });
    document.getElementById(pageId).classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active', 'text-blue-600', 'dark:text-blue-400', 'bg-blue-50', 'dark:bg-blue-900/30');
        btn.classList.add('text-gray-600', 'dark:text-gray-300', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
    });

    const activeBtn = document.getElementById(`nav-${pageId.replace('page-', '')}`);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-600', 'dark:text-gray-300', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
        activeBtn.classList.add('active', 'text-blue-600', 'dark:text-blue-400', 'bg-blue-50', 'dark:bg-blue-900/30');
    }

    document.getElementById('mobile-menu').classList.add('hidden');

    if (pageId === 'page-stats') {
        updateStats();
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark');
    saveToStorage(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
}

function loadTheme() {
    const theme = getFromStorage(STORAGE_KEYS.THEME, 'light');
    if (theme === 'dark') {
        document.body.classList.add('dark');
    }
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function exportData(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            callback(null, data);
        } catch (err) {
            callback(err, null);
        }
    };
    reader.readAsText(file);
}

function exportAllData() {
    const todos = getFromStorage(STORAGE_KEYS.TODOS, []);
    const accounts = getFromStorage(STORAGE_KEYS.ACCOUNTS, []);
    const calcCount = getFromStorage(STORAGE_KEYS.CALC_COUNT, 0);
    
    const allData = {
        todos,
        accounts,
        calcCount,
        exportTime: new Date().toISOString()
    };
    
    exportData('toolbox_backup.json', allData);
}

function importAllData(file) {
    importData(file, (err, data) => {
        if (err) {
            alert('导入失败：无效的JSON文件');
            return;
        }
        
        if (data.todos) {
            saveToStorage(STORAGE_KEYS.TODOS, data.todos);
        }
        if (data.accounts) {
            saveToStorage(STORAGE_KEYS.ACCOUNTS, data.accounts);
        }
        if (data.calcCount) {
            saveToStorage(STORAGE_KEYS.CALC_COUNT, data.calcCount);
        }
        
        alert('导入成功！页面将刷新');
        location.reload();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadTheme();

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
        document.getElementById('mobile-menu').classList.toggle('hidden');
    });

    document.getElementById('nav-todo').addEventListener('click', () => switchPage('page-todo'));
    document.getElementById('nav-calc').addEventListener('click', () => switchPage('page-calc'));
    document.getElementById('nav-account').addEventListener('click', () => switchPage('page-account'));
    document.getElementById('nav-stats').addEventListener('click', () => switchPage('page-stats'));
    document.getElementById('nav-about').addEventListener('click', () => switchPage('page-about'));

    document.getElementById('mobile-todo').addEventListener('click', () => switchPage('page-todo'));
    document.getElementById('mobile-calc').addEventListener('click', () => switchPage('page-calc'));
    document.getElementById('mobile-account').addEventListener('click', () => switchPage('page-account'));
    document.getElementById('mobile-stats').addEventListener('click', () => switchPage('page-stats'));
    document.getElementById('mobile-about').addEventListener('click', () => switchPage('page-about'));

    document.getElementById('export-all').addEventListener('click', exportAllData);
    document.getElementById('import-file').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importAllData(e.target.files[0]);
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#mobile-menu') && !e.target.closest('#mobile-menu-btn')) {
            document.getElementById('mobile-menu').classList.add('hidden');
        }
    });
});

window.Toolbox = {
    STORAGE_KEYS,
    getFromStorage,
    saveToStorage,
    exportData,
    importData,
    showLoading,
    hideLoading
};