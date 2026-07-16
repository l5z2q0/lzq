# ============================================
# 模块名称: daily_activity.py
# 模块用途: 每日活跃度任务 - 完成日常任务并领取活跃度阶梯奖励
#           遍历日常列表，识别可完成项并点击，最后领取活跃度宝箱
# 状态映射: REWARD -> IDLE
# ============================================

import random
import time
from logger import get_logger
from adb_utils import get_device
from image_utils import get_recognizer
from state_machine import get_state_machine, BotState

# 活跃度相关模板
DAILY_ICON_TEMPLATE = "daily_activity_icon.png"     # 主界面日常图标
DAILY_GOTO_BTN = "daily_goto.png"                   # 前往完成按钮
DAILY_COMPLETE_BTN = "daily_complete.png"           # 已完成/可领取标记
DAILY_REWARD_BOX = "daily_reward_box.png"           # 活跃度宝箱图标
DAILY_REWARD_CLAIM = "daily_claim.png"              # 领取奖励按钮
DAILY_CLOSE = "daily_close.png"                     # 关闭日常面板


def run(task_config: dict, checked: bool) -> bool:
    """
    执行每日活跃度任务
    :param task_config: 任务配置
    :param checked: 是否勾选
    :return: 完成True，跳过False
    """
    logger = get_logger()
    sm = get_state_machine()
    device = get_device()
    recognizer = get_recognizer()

    if not checked:
        logger.debug("[每日活跃] 任务未勾选，跳过执行")
        return False

    logger.info("=" * 40)
    logger.info("[任务开始] 每日活跃度任务")
    logger.info("=" * 40)

    if not sm.transition(BotState.REWARD, reason="开始每日活跃度任务"):
        logger.warning("[每日活跃] 状态切换失败，放弃执行")
        return False

    try:
        # Step1: 打开日常面板
        logger.info("[每日活跃] 打开日常面板...")
        icon_pos = recognizer.find(DAILY_ICON_TEMPLATE)
        if not icon_pos:
            logger.warning("[每日活跃] 未找到日常图标")
            return False
        device.click(icon_pos[0], icon_pos[1])
        time.sleep(random.uniform(1.5, 2.5))

        # Step2: 尝试完成带有"前往"按钮的日常任务
        logger.info("[每日活跃] 处理可完成的日常任务...")
        completed = _process_daily_tasks(device, recognizer, logger)
        logger.info("[每日活跃] 处理了 %d 项日常任务", completed)

        # Step3: 领取活跃度宝箱奖励
        logger.info("[每日活跃] 尝试领取活跃度宝箱...")
        _claim_reward_boxes(device, recognizer, logger)

        logger.info("[任务结束] 每日活跃度任务完成")
        return True

    except Exception as e:
        logger.error("[每日活跃] 任务执行异常: %s", str(e))
        return False

    finally:
        _close_daily_panel(device, recognizer, logger)
        sm.transition(BotState.IDLE, reason="每日活跃度任务结束")


def _process_daily_tasks(device, recognizer, logger) -> int:
    """
    遍历并处理日常列表中的"前往"任务
    :return: 处理的任务数量
    """
    count = 0
    max_scroll = 5  # 最大滚动次数，防止无限翻页
    for _ in range(max_scroll):
        # 查找当前页所有"前往"按钮
        goto_positions = recognizer.find_all(DAILY_GOTO_BTN)
        if not goto_positions:
            logger.info("[每日活跃] 当前页无更多可完成任务")
            break
        for pos in goto_positions:
            device.click(pos[0], pos[1])
            logger.info("[每日活跃] 点击前往 | 坐标: %s", pos)
            count += 1
            time.sleep(random.uniform(2.0, 3.5))  # 等待任务完成跳转
            # 完成后尝试返回日常面板
            device.back()
            time.sleep(random.uniform(1.0, 1.5))
        # 向下滑动翻页查看更多任务
        device.swipe(640, 500, 640, 250, duration=400)
        time.sleep(random.uniform(1.0, 1.5))
    return count


def _claim_reward_boxes(device, recognizer, logger):
    """
    领取活跃度达到对应的宝箱奖励
    """
    # 查找所有可领取的宝箱
    boxes = recognizer.find_all(DAILY_REWARD_BOX)
    if not boxes:
        logger.info("[每日活跃] 没有可领取的活跃度宝箱")
        return
    for box_pos in boxes:
        device.click(box_pos[0], box_pos[1])
        logger.info("[每日活跃] 点击活跃度宝箱 | 坐标: %s", box_pos)
        time.sleep(random.uniform(1.0, 1.5))
        # 检测领取按钮
        claim_pos = recognizer.find(DAILY_REWARD_CLAIM)
        if claim_pos:
            device.click(claim_pos[0], claim_pos[1])
            logger.info("[每日活跃] 领取宝箱奖励")
            time.sleep(random.uniform(0.8, 1.2))


def _close_daily_panel(device, recognizer, logger):
    """
    关闭日常面板返回主界面
    """
    for _ in range(2):
        close_pos = recognizer.find(DAILY_CLOSE)
        if close_pos:
            device.click(close_pos[0], close_pos[1])
            time.sleep(random.uniform(0.5, 1.0))
            return
        device.back()
        time.sleep(random.uniform(0.5, 1.0))
