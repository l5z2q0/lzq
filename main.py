# ============================================
# 模块名称: main.py
# 模块用途: 主调度程序入口，负责初始化全局组件、注册任务、运行主循环
# 运行方式: python main.py
# 终止方式: GUI点击停止 或 关闭窗口 或 Ctrl+C
# ============================================

import yaml                  # YAML配置文件解析
import os                    # 路径与环境变量
import time                  # 时间操作与休眠
import random                # 随机数生成（防检测）
import signal                # 信号处理（Ctrl+C优雅退出）
import sys                   # 系统退出
import threading             # 线程事件用于停止信号
from datetime import datetime
from typing import Dict

# 导入自定义模块
from logger import init_logger, get_logger
from state_machine import init_state_machine, get_state_machine, BotState
from adb_utils import init_device, get_device
from image_utils import init_recognizer, get_recognizer
from gui import create_gui, get_gui, GUI_CONFIG_FILE

# 导入8个独立任务模块
from tasks import city_resources, mail_reward, daily_activity, expedition
from tasks import wild_elite, alliance_welfare, popup_cleaner, error_handler

# 配置文件路径
CONFIG_FILE = "config.yaml"

# 全局停止事件：用于线程间通信，通知主循环终止
_stop_event = threading.Event()

# 任务模块注册表：key与GUI任务ID对应，value为模块引用与配置key
TASK_REGISTRY = {
    "city_resources":   (city_resources,   "city_resources"),
    "mail_reward":      (mail_reward,      "mail_reward"),
    "daily_activity":   (daily_activity,   "daily_activity"),
    "expedition":       (expedition,       "expedition"),
    "wild_elite":       (wild_elite,       "wild_elite"),
    "alliance_welfare": (alliance_welfare, "alliance_welfare"),
    "popup_cleaner":    (popup_cleaner,    "popup_cleaner"),
    "error_handler":    (error_handler,    "error_handler"),
}


def load_config() -> dict:
    """
    加载YAML配置文件
    :return: 配置字典，失败则返回空字典
    """
    if not os.path.exists(CONFIG_FILE):
        print(f"[致命错误] 配置文件不存在: {CONFIG_FILE}")
        sys.exit(1)
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        print(f"[配置] 成功加载: {CONFIG_FILE}")
        return config
    except Exception as e:
        print(f"[致命错误] 加载配置异常: {e}")
        sys.exit(1)


def init_all(config: dict):
    """
    初始化所有全局单例组件
    顺序: 日志 -> 状态机 -> ADB设备 -> 图像识别器
    :param config: 配置字典
    """
    print("[初始化] 正在启动各组件...")
    init_logger(config.get("log", {}))
    init_state_machine(config.get("state", {}).get("idle_timeout", 300))
    init_device(config)
    init_recognizer(config)
    get_logger().info("[初始化] 所有组件启动完成")


def reload_config() -> dict:
    """
    重新加载配置文件并重新初始化相关组件
    :return: 新的配置字典
    """
    logger = get_logger()
    logger.info("[配置] 重新加载 %s", CONFIG_FILE)
    config = load_config()
    # 注: 日志和状态机不重新初始化，ADB和识别器参数通过配置动态生效
    return config


def take_debug_screenshot() -> str:
    """
    执行调试截图并保存到logs/debug目录
    :return: 保存的文件路径，失败返回空字符串
    """
    logger = get_logger()
    device = get_device()
    debug_dir = os.path.join("logs", "debug")
    os.makedirs(debug_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(debug_dir, f"debug_{timestamp}.png")
    try:
        raw = device.screenshot()
        if raw:
            with open(path, "wb") as f:
                f.write(raw)
            logger.info("[调试] 截图已保存: %s", path)
            return path
    except Exception as e:
        logger.error("[调试] 截图异常: %s", str(e))
    return ""


def main_loop(config: dict, checked_state: dict):
    """
    挂机主循环：按时间间隔调度各任务执行
    :param config: 全局配置字典
    :param checked_state: GUI传递的勾选状态字典 {task_id: bool}
    """
    logger = get_logger()
    sm = get_state_machine()
    gui = get_gui()

    # 初始化各任务上次执行时间戳
    task_last_run: Dict[str, float] = {tid: 0.0 for tid in TASK_REGISTRY}

    # 防检测配置
    anti_cfg = config.get("anti_detect", {})
    min_loop_sleep = anti_cfg.get("min_loop_sleep", 60)
    max_loop_sleep = anti_cfg.get("max_loop_sleep", 600)
    long_sleep_on_fail = config.get("state", {}).get("long_sleep_on_fail", 300)

    # 连续识别失败计数器
    consecutive_failures = 0
    max_consecutive_failures = 10  # 连续10次任务失败进入长休眠

    logger.info("[主循环] 挂机主循环已启动")
    gui.log("【系统】主循环已启动，开始按间隔调度任务...")

    # 重置状态机到空闲
    sm.reset_to_idle()

    while not _stop_event.is_set():
        try:
            loop_start = time.time()
            any_task_executed = False

            # 按注册表顺序遍历任务
            for task_id, (module, config_key) in TASK_REGISTRY.items():
                if _stop_event.is_set():
                    break

                # 获取任务配置
                task_cfg = config.get("tasks", {}).get(config_key, {})
                interval = task_cfg.get("interval", 3600)

                # 判断是否需要执行（时间间隔到达 + GUI已勾选）
                now = time.time()
                time_since_last = now - task_last_run.get(task_id, 0)
                is_checked = checked_state.get(task_id, False)

                if is_checked and time_since_last >= interval:
                    logger.info("[主循环] 任务 %s 间隔到达 (已过去 %.0f秒)，准备执行", task_id, time_since_last)
                    gui.log(f"【调度】开始执行: {task_id}")

                    # 调用任务模块的run函数
                    success = module.run(task_cfg, is_checked)
                    task_last_run[task_id] = time.time()
                    any_task_executed = True

                    if success:
                        consecutive_failures = 0  # 成功则重置失败计数
                        gui.log(f"【调度】任务完成: {task_id}")
                    else:
                        consecutive_failures += 1
                        gui.log(f"【调度】任务失败或跳过: {task_id}")

                    # 每个任务执行后短暂停顿，避免CPU占用过高
                    time.sleep(random.uniform(0.5, 1.5))

            # 如果本轮没有任何任务执行，说明都在等待间隔
            if not any_task_executed and not _stop_event.is_set():
                logger.debug("[主循环] 本轮无任务需要执行，进入短暂等待...")
                # 等待5秒后再次轮询
                _stop_event.wait(5)
                continue

            # 防检测：每轮循环结束后随机休眠1~10分钟
            if not _stop_event.is_set():
                sleep_sec = random.randint(min_loop_sleep, max_loop_sleep)
                logger.info("[主循环] 本轮调度结束，进入随机休眠 %d 秒（模拟真人离线）", sleep_sec)
                gui.log(f"【系统】进入随机休眠 {sleep_sec//60}分{sleep_sec%60}秒")
                _stop_event.wait(sleep_sec)

            # 连续失败过多时进入长休眠
            if consecutive_failures >= max_consecutive_failures:
                logger.error("[主循环] 连续失败 %d 次，进入长休眠 %d 秒",
                             consecutive_failures, long_sleep_on_fail)
                gui.log(f"【警告】连续失败{consecutive_failures}次，进入长休眠")
                _stop_event.wait(long_sleep_on_fail)
                consecutive_failures = 0  # 长休眠后重置计数

        except Exception as e:
            logger.error("[主循环] 主循环异常: %s", str(e))
            gui.log(f"【错误】主循环异常: {e}")
            time.sleep(5)

    # 循环结束
    logger.info("[主循环] 收到停止信号，主循环已退出")
    gui.log("【系统】主循环已安全退出")
    gui.notify_stopped()


def start_bot(checked_state: dict):
    """
    GUI回调：启动挂机
    :param checked_state: 勾选状态字典
    """
    global _stop_event
    _stop_event.clear()
    config = load_config()
    init_all(config)
    main_loop(config, checked_state)


def stop_bot():
    """
    GUI回调：停止挂机
    设置停止事件，主循环检测到后优雅退出
    """
    logger = get_logger()
    logger.info("[控制] 收到停止指令")
    get_gui().log("【系统】正在发送停止信号...")
    _stop_event.set()
    # 强制ADB返回键尝试中断当前操作
    try:
        device = get_device()
        device.back()
    except Exception:
        pass


def signal_handler(sig, frame):
    """
    信号处理：捕获Ctrl+C，优雅退出
    """
    print("\n[信号] 捕获到中断信号，正在停止...")
    stop_bot()


# 注册信号处理器
signal.signal(signal.SIGINT, signal_handler)


if __name__ == "__main__":
    """
    程序入口：创建GUI并进入主循环
    """
    print("=" * 50)
    print("《无尽冬日》自动化挂机脚本 v1.0")
    print("分辨率: 1280x720 | 模拟器: 雷电/木木")
    print("=" * 50)

    # 创建GUI，绑定回调函数
    gui = create_gui(
        start_callback=start_bot,
        stop_callback=stop_bot,
        screenshot_callback=take_debug_screenshot,
        config_reload_callback=reload_config
    )

    # 启动GUI主循环（阻塞）
    gui.run()

    print("[系统] 程序已退出")
