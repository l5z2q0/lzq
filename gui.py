# ============================================
# 模块名称: gui.py
# 模块用途: tkinter可视化任务选择面板与控制界面
# 功能说明:
#   1. 复选框自由勾选要运行的任务，未勾选直接跳过
#   2. 自动保存/加载上一次勾选配置
#   3. 附带启动挂机、停止挂机、读取配置、调试截图按钮
#   4. 运行时控制台实时打印当前任务执行日志
#   5. 关闭窗口或点击停止立刻中断所有ADB操作
# ============================================

import tkinter as tk              # Python标准GUI库
from tkinter import ttk, messagebox, scrolledtext  # 高级组件与消息弹窗
import threading                  # 后台线程运行挂机逻辑
import json                       # 勾选配置JSON序列化
import os                         # 文件路径操作
import time                       # 时间格式化
from typing import Dict, Callable, Optional

# 配置文件路径：与脚本同级目录下的gui_config.json
GUI_CONFIG_FILE = "gui_config.json"

# 任务列表定义：key为模块标识，value为显示名称
TASK_DEFINITIONS = [
    ("city_resources", "主城资源收取（木材/食物/铁矿/燃油）"),
    ("mail_reward", "邮件奖励领取（钻石/加速/道具）"),
    ("daily_activity", "每日活跃度任务（完成日常领宝箱）"),
    ("expedition", "探险自动战斗（推图+拾取宝箱）"),
    ("wild_elite", "野外精英巡逻（找怪+开战+拾掉落）"),
    ("alliance_welfare", "联盟福利领取（礼包/情报/贡献）"),
    ("popup_cleaner", "弹窗自动清理（广告/升级/提示）"),
    ("error_handler", "异常容错处理（黑屏/掉线/重启）"),
]


class BotGUI:
    """
    挂机脚本可视化控制面板类
    职责: 构建界面、管理勾选状态、控制主循环启停、实时显示日志
    """

    def __init__(self, start_callback: Callable, stop_callback: Callable,
                 screenshot_callback: Callable, config_reload_callback: Callable):
        """
        构造函数：初始化GUI并绑定控制回调函数
        :param start_callback: 点击"启动挂机"时的回调，接收勾选状态字典
        :param stop_callback: 点击"停止挂机"时的回调
        :param screenshot_callback: 点击"调试截图"时的回调
        :param config_reload_callback: 点击"读取配置"时的回调
        """
        self.start_callback = start_callback
        self.stop_callback = stop_callback
        self.screenshot_callback = screenshot_callback
        self.config_reload_callback = config_reload_callback

        self.root = tk.Tk()
        self.root.title("《无尽冬日》自动化挂机控制台 v1.0")
        self.root.geometry("720x600")
        self.root.resizable(False, False)
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)  # 关闭窗口事件绑定

        # 运行状态标记
        self.is_running = False          # 是否正在挂机
        self.check_vars: Dict[str, tk.BooleanVar] = {}  # 各任务的勾选变量
        self._log_queue: list[str] = []  # 日志缓存队列，线程安全由GIL保证

        self._build_ui()                 # 构建界面元素
        self._load_config()              # 加载上次保存的勾选状态

    def _build_ui(self):
        """
        内部方法：构建所有界面组件
        布局: 顶部标题 -> 左侧任务勾选区 -> 右侧控制台 -> 底部按钮栏
        """
        # ---------- 顶部标题栏 ----------
        header = tk.Frame(self.root, bg="#2c3e50", height=50)
        header.pack(fill=tk.X)
        tk.Label(header, text="《无尽冬日》自动化挂机控制台",
                 font=("Microsoft YaHei", 16, "bold"),
                 fg="white", bg="#2c3e50").pack(pady=8)

        # ---------- 主内容区（左右分栏） ----------
        main_frame = tk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # 左侧：任务勾选面板
        left_frame = tk.LabelFrame(main_frame, text="任务选择（勾选后挂机时执行）",
                                   font=("Microsoft YaHei", 11, "bold"),
                                   padx=10, pady=10)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # 为每个任务创建复选框
        for task_id, task_name in TASK_DEFINITIONS:
            var = tk.BooleanVar(value=False)
            self.check_vars[task_id] = var
            cb = tk.Checkbutton(left_frame, text=task_name, variable=var,
                                font=("Microsoft YaHei", 10),
                                anchor="w", wraplength=280)
            cb.pack(fill=tk.X, pady=3)

        # 右侧：实时控制台输出
        right_frame = tk.LabelFrame(main_frame, text="运行控制台",
                                    font=("Microsoft YaHei", 11, "bold"),
                                    padx=5, pady=5)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        self.console = scrolledtext.ScrolledText(
            right_frame, wrap=tk.WORD, state=tk.DISABLED,
            font=("Consolas", 9), bg="#1e1e1e", fg="#d4d4d4",
            insertbackground="white", height=20
        )
        self.console.pack(fill=tk.BOTH, expand=True)

        # 状态栏标签
        self.status_label = tk.Label(right_frame, text="状态: 待机",
                                     font=("Microsoft YaHei", 10, "bold"),
                                     fg="#e74c3c", anchor="w")
        self.status_label.pack(fill=tk.X, pady=(5, 0))

        # ---------- 底部控制按钮栏 ----------
        btn_frame = tk.Frame(self.root, padx=10, pady=10)
        btn_frame.pack(fill=tk.X)

        # 启动按钮（绿色主题）
        self.btn_start = tk.Button(btn_frame, text="▶ 启动挂机", width=14,
                                   font=("Microsoft YaHei", 11, "bold"),
                                   bg="#27ae60", fg="white", activebackground="#2ecc71",
                                   command=self._on_start)
        self.btn_start.pack(side=tk.LEFT, padx=5)

        # 停止按钮（红色主题，初始禁用）
        self.btn_stop = tk.Button(btn_frame, text="■ 停止挂机", width=14,
                                  font=("Microsoft YaHei", 11, "bold"),
                                  bg="#c0392b", fg="white", activebackground="#e74c3c",
                                  state=tk.DISABLED, command=self._on_stop)
        self.btn_stop.pack(side=tk.LEFT, padx=5)

        # 读取配置按钮
        self.btn_reload = tk.Button(btn_frame, text="🔄 读取配置", width=12,
                                    font=("Microsoft YaHei", 10),
                                    bg="#3498db", fg="white",
                                    command=self._on_reload)
        self.btn_reload.pack(side=tk.LEFT, padx=5)

        # 调试截图按钮
        self.btn_screenshot = tk.Button(btn_frame, text="📷 调试截图", width=12,
                                        font=("Microsoft YaHei", 10),
                                        bg="#9b59b6", fg="white",
                                        command=self._on_screenshot)
        self.btn_screenshot.pack(side=tk.LEFT, padx=5)

        # 全选/取消全选按钮
        self.btn_toggle_all = tk.Button(btn_frame, text="☑ 全选/取消", width=10,
                                        font=("Microsoft YaHei", 10),
                                        command=self._toggle_all)
        self.btn_toggle_all.pack(side=tk.RIGHT, padx=5)

    # ---------- 按钮事件处理 ----------

    def _on_start(self):
        """
        点击"启动挂机"按钮：收集勾选状态，调用启动回调
        """
        if self.is_running:
            return
        # 收集勾选状态字典
        checked_state = {tid: var.get() for tid, var in self.check_vars.items()}
        active_tasks = [name for tid, name in TASK_DEFINITIONS if checked_state.get(tid)]
        if not active_tasks:
            messagebox.showwarning("提示", "请至少勾选一项任务后再启动挂机！")
            return

        self._save_config()  # 启动前保存当前勾选
        self.is_running = True
        self._update_ui_state()
        self.log("【系统】挂机已启动，选中任务: " + "、".join(active_tasks))

        # 在后台线程中启动主循环，避免阻塞GUI
        threading.Thread(target=self._run_start_callback,
                         args=(checked_state,), daemon=True).start()

    def _run_start_callback(self, checked_state: dict):
        """
        内部线程方法：调用外部启动回调
        """
        try:
            self.start_callback(checked_state)
        except Exception as e:
            self.log(f"【系统】启动过程发生异常: {e}")
        finally:
            # 若回调返回（非停止情况下不应发生），自动重置UI
            if self.is_running:
                self.is_running = False
                self.root.after(0, self._update_ui_state)

    def _on_stop(self):
        """
        点击"停止挂机"按钮：调用停止回调，重置状态
        """
        if not self.is_running:
            return
        self.is_running = False
        self._update_ui_state()
        self.log("【系统】停止信号已发送，正在中断所有操作...")
        try:
            self.stop_callback()
        except Exception as e:
            self.log(f"【系统】停止过程异常: {e}")

    def _on_reload(self):
        """
        点击"读取配置"按钮：重新加载config.yaml和勾选配置
        """
        self.log("【系统】重新读取配置文件...")
        try:
            self.config_reload_callback()
            self._load_config()
            self.log("【系统】配置读取完成")
        except Exception as e:
            self.log(f"【系统】配置读取失败: {e}")

    def _on_screenshot(self):
        """
        点击"调试截图"按钮：立即截取当前屏幕并保存
        """
        self.log("【系统】正在执行调试截图...")
        try:
            path = self.screenshot_callback()
            if path:
                self.log(f"【系统】调试截图已保存: {path}")
            else:
                self.log("【系统】截图失败，请检查ADB连接")
        except Exception as e:
            self.log(f"【系统】截图异常: {e}")

    def _toggle_all(self):
        """
        全选/取消全选切换
        """
        all_selected = all(var.get() for var in self.check_vars.values())
        new_state = not all_selected
        for var in self.check_vars.values():
            var.set(new_state)
        self.log(f"【系统】已{'取消全选' if all_selected else '全选'}所有任务")

    def _on_close(self):
        """
        关闭窗口事件：先停止挂机，保存配置，再退出
        """
        if self.is_running:
            if messagebox.askyesno("确认", "挂机正在运行，确定要退出吗？"):
                self._on_stop()
            else:
                return
        self._save_config()
        self.root.destroy()

    # ---------- 配置持久化 ----------

    def _save_config(self):
        """
        将当前勾选状态保存到JSON文件
        """
        try:
            data = {tid: var.get() for tid, var in self.check_vars.items()}
            with open(GUI_CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            self.log(f"【系统】保存配置失败: {e}")

    def _load_config(self):
        """
        从JSON文件加载上次的勾选状态
        """
        if not os.path.exists(GUI_CONFIG_FILE):
            return
        try:
            with open(GUI_CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            for tid, var in self.check_vars.items():
                var.set(data.get(tid, False))
            self.log("【系统】已加载上次保存的任务勾选配置")
        except Exception as e:
            self.log(f"【系统】加载配置失败: {e}")

    # ---------- UI状态更新 ----------

    def _update_ui_state(self):
        """
        根据is_running状态更新按钮可用性
        """
        if self.is_running:
            self.btn_start.config(state=tk.DISABLED)
            self.btn_stop.config(state=tk.NORMAL)
            self.status_label.config(text="状态: 运行中", fg="#27ae60")
        else:
            self.btn_start.config(state=tk.NORMAL)
            self.btn_stop.config(state=tk.DISABLED)
            self.status_label.config(text="状态: 已停止", fg="#e74c3c")

    # ---------- 日志输出 ----------

    def log(self, message: str):
        """
        向控制台输出一行日志（线程安全，支持从非GUI线程调用）
        :param message: 日志内容
        """
        timestamp = time.strftime("%H:%M:%S")
        line = f"[{timestamp}] {message}\n"
        # 使用after方法确保在主线程中更新UI
        self.root.after(0, lambda: self._insert_log(line))

    def _insert_log(self, line: str):
        """
        内部方法：实际向Text控件插入文本
        """
        self.console.config(state=tk.NORMAL)
        self.console.insert(tk.END, line)
        self.console.see(tk.END)  # 自动滚动到最新行
        # 限制最大行数500行，防止内存无限增长
        total_lines = int(self.console.index(tk.END).split(".")[0])
        if total_lines > 500:
            self.console.delete("1.0", "50.0")
        self.console.config(state=tk.DISABLED)

    # ---------- 公共接口 ----------

    def run(self):
        """
        启动GUI主循环（阻塞方法）
        """
        self.log("【系统】控制台已就绪，请勾选任务后点击启动")
        self.root.mainloop()

    def notify_stopped(self):
        """
        外部调用：通知GUI挂机已停止（用于主循环自然结束时同步UI）
        """
        self.is_running = False
        self.root.after(0, self._update_ui_state)
        self.log("【系统】挂机主循环已结束")


# 全局GUI单例
_global_gui: Optional[BotGUI] = None


def create_gui(start_cb: Callable, stop_cb: Callable,
               screenshot_cb: Callable, reload_cb: Callable) -> BotGUI:
    """
    创建全局GUI实例
    :param start_cb: 启动回调
    :param stop_cb: 停止回调
    :param screenshot_cb: 截图回调
    :param reload_cb: 重载配置回调
    :return: BotGUI实例
    """
    global _global_gui
    _global_gui = BotGUI(start_cb, stop_cb, screenshot_cb, reload_cb)
    return _global_gui


def get_gui() -> BotGUI:
    """
    获取全局GUI实例
    """
    if _global_gui is None:
        raise RuntimeError("GUI尚未创建")
    return _global_gui
