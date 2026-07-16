# ============================================
# 模块名称: error_handler.py
# 模块用途: 异常容错处理任务 - 检测黑屏、掉线、网络中断等异常
#           自动重启游戏并重登账号，保障长时间挂机稳定性
# 状态映射: RECOVER -> IDLE
# ============================================

import random
import time
import os
from logger import get_logger
from adb_utils import get_device
from image_utils import get_recognizer
from state_machine import get_state_machine, BotState

# 异常检测模板
ERROR_BLACK_SCREEN = "error_black.png"         # 黑屏画面（几乎全黑）
ERROR_DISCONNECT = "error_disconnect.png"      # 网络断开/连接失败提示
ERROR_RELOGIN_BTN = "error_relogin.png"        # 重新登录按钮
ERROR_LOADING = "error_loading.png"            # 游戏加载中界面
ERROR_MAINTENANCE = "error_maintenance.png"    # 服务器维护提示

# 正常游戏界面元素（用于对比判断是否卡死）
NORMAL_MAIN_CITY = "normal_main_city.png"      # 主城标志性建筑

# 游戏包名（根据实际包名修改）
GAME_PACKAGE = "com.game.endlesswinter"


def run(task_config: dict, checked: bool) -> bool:
    """
    执行异常检测与恢复任务
    :param task_config: 任务配置
    :param checked: 是否勾选
    :return: 发生异常并恢复返回True，正常状态返回False
    """
    logger = get_logger()
    sm = get_state_machine()
    device = get_device()
    recognizer = get_recognizer()

    if not checked:
        logger.debug("[异常处理] 任务未勾选，跳过执行")
        return False

    logger.debug("[异常处理] 开始检测异常状态...")

    # 异常处理优先级最高，直接进入恢复状态
    if not sm.transition(BotState.RECOVER, reason="开始异常检测"):
        logger.warning("[异常处理] 状态切换失败，跳过本次检测")
        return False

    try:
        # Step1: 截图并分析是否为黑屏
        if _is_black_screen(device, recognizer, logger):
            logger.error("[异常处理] 检测到黑屏，执行恢复流程...")
            _recover_game(device, recognizer, logger)
            return True

        # Step2: 检测网络断开提示
        if recognizer.check_exist(ERROR_DISCONNECT):
            logger.error("[异常处理] 检测到网络断开提示")
            _recover_game(device, recognizer, logger)
            return True

        # Step3: 检测服务器维护
        if recognizer.check_exist(ERROR_MAINTENANCE):
            logger.warning("[异常处理] 检测到服务器维护，进入长休眠...")
            sm.transition(BotState.SLEEPING, reason="服务器维护")
            time.sleep(1800)  # 休眠30分钟后再次检测
            return True

        # Step4: 检测是否卡在加载界面过久
        if recognizer.check_exist(ERROR_LOADING):
            logger.warning("[异常处理] 检测到加载界面，等待5秒后复测...")
            time.sleep(5)
            if recognizer.check_exist(ERROR_LOADING):
                logger.error("[异常处理] 加载界面卡死，执行恢复")
                _recover_game(device, recognizer, logger)
                return True

        # Step5: 检测主城标志物判断是否卡死（可选高级检测）
        if not recognizer.check_exist(NORMAL_MAIN_CITY):
            logger.debug("[异常处理] 未检测到主城标志，可能不在主界面")
            # 此处不立即恢复，仅记录日志，避免误报

        logger.debug("[异常处理] 状态正常，无异常")
        return False

    except Exception as e:
        logger.error("[异常处理] 检测过程异常: %s", str(e))
        return False

    finally:
        sm.transition(BotState.IDLE, reason="异常检测结束")


def _is_black_screen(device, recognizer, logger) -> bool:
    """
    内部函数：判断当前屏幕是否为黑屏（全黑或接近全黑）
    方法: 截图后计算平均亮度，低于阈值则认为黑屏
    :return: 黑屏返回True
    """
    try:
        raw = device.screenshot()
        if raw is None:
            logger.warning("[异常处理] 截图失败，可能ADB已断开")
            return True  # 截图失败视为异常

        import cv2
        import numpy as np
        np_arr = np.frombuffer(raw, dtype=np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return True

        avg_brightness = np.mean(img)
        logger.debug("[异常处理] 屏幕平均亮度: %.1f", avg_brightness)
        # 亮度低于15视为黑屏（0-255范围）
        return avg_brightness < 15.0
    except Exception as e:
        logger.error("[异常处理] 黑屏检测异常: %s", str(e))
        return False


def _recover_game(device, recognizer, logger):
    """
    内部函数：执行游戏恢复流程
    步骤: 强制停止游戏 -> 等待 -> 重新启动 -> 等待加载 -> 尝试登录
    """
    logger.info("[异常处理] ===== 开始游戏恢复流程 =====")

    # Step1: 强制停止游戏
    logger.info("[异常处理] 强制停止游戏...")
    device.stop_app(GAME_PACKAGE)
    time.sleep(random.uniform(3.0, 5.0))

    # Step2: 重新启动游戏
    logger.info("[异常处理] 重新启动游戏...")
    device.start_app(GAME_PACKAGE)
    time.sleep(random.uniform(8.0, 12.0))  # 等待启动动画

    # Step3: 等待加载完成
    logger.info("[异常处理] 等待游戏加载...")
    # 最多等待60秒加载
    for wait_sec in range(0, 60, 5):
        if not recognizer.check_exist(ERROR_LOADING):
            logger.info("[异常处理] 加载完成，耗时约 %d 秒", wait_sec)
            break
        time.sleep(5)
    else:
        logger.warning("[异常处理] 加载超时，可能网络问题")

    # Step4: 检测重新登录按钮并点击
    relogin_pos = recognizer.find(ERROR_RELOGIN_BTN)
    if relogin_pos:
        device.click(relogin_pos[0], relogin_pos[1])
        logger.info("[异常处理] 点击重新登录")
        time.sleep(random.uniform(5.0, 8.0))

    logger.info("[异常处理] ===== 游戏恢复流程结束 =====")
