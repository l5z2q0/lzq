# ============================================
# 模块名称: alliance_welfare.py
# 模块用途: 联盟福利领取任务 - 联盟礼包、每日情报、联盟贡献奖励一键领取
#           依次进入联盟界面，检测并领取各类福利
# 状态映射: REWARD -> IDLE
# ============================================

import random
import time
from logger import get_logger
from adb_utils import get_device
from image_utils import get_recognizer
from state_machine import get_state_machine, BotState

# 联盟福利相关模板
ALLIANCE_ICON = "alliance_icon.png"            # 联盟入口图标
ALLIANCE_GIFT_TAB = "alliance_gift_tab.png"    # 联盟礼包标签页
ALLIANCE_GIFT_CLAIM = "alliance_gift_claim.png" # 领取礼包按钮
ALLIANCE_INTEL_TAB = "alliance_intel_tab.png"  # 每日情报标签页
ALLIANCE_INTEL_CLAIM = "alliance_intel_claim.png" # 领取情报按钮
ALLIANCE_CONTRIB_TAB = "alliance_contrib_tab.png" # 联盟贡献标签页
ALLIANCE_CONTRIB_CLAIM = "alliance_contrib_claim.png" # 领取贡献奖励按钮
ALLIANCE_CLOSE = "alliance_close.png"          # 关闭联盟面板


def run(task_config: dict, checked: bool) -> bool:
    """
    执行联盟福利领取任务
    :param task_config: 任务配置
    :param checked: 是否勾选
    :return: 完成True，跳过False
    """
    logger = get_logger()
    sm = get_state_machine()
    device = get_device()
    recognizer = get_recognizer()

    if not checked:
        logger.debug("[联盟福利] 任务未勾选，跳过执行")
        return False

    logger.info("=" * 40)
    logger.info("[任务开始] 联盟福利领取")
    logger.info("=" * 40)

    if not sm.transition(BotState.REWARD, reason="开始联盟福利领取"):
        logger.warning("[联盟福利] 状态切换失败，放弃执行")
        return False

    try:
        # Step1: 打开联盟界面
        logger.info("[联盟福利] 打开联盟界面...")
        icon_pos = recognizer.find(ALLIANCE_ICON)
        if not icon_pos:
            logger.warning("[联盟福利] 未找到联盟入口")
            return False
        device.click(icon_pos[0], icon_pos[1])
        time.sleep(random.uniform(2.0, 3.0))

        # Step2: 领取联盟礼包
        _claim_gift(device, recognizer, logger)

        # Step3: 领取每日情报
        _claim_intelligence(device, recognizer, logger)

        # Step4: 领取联盟贡献奖励
        _claim_contribution(device, recognizer, logger)

        logger.info("[任务结束] 联盟福利领取完成")
        return True

    except Exception as e:
        logger.error("[联盟福利] 任务执行异常: %s", str(e))
        return False

    finally:
        _close_alliance(device, recognizer, logger)
        sm.transition(BotState.IDLE, reason="联盟福利领取结束")


def _claim_gift(device, recognizer, logger):
    """
    切换到联盟礼包页并领取
    """
    logger.info("[联盟福利] 处理联盟礼包...")
    tab_pos = recognizer.find(ALLIANCE_GIFT_TAB)
    if tab_pos:
        device.click(tab_pos[0], tab_pos[1])
        logger.info("[联盟福利] 切换到礼包标签页")
        time.sleep(random.uniform(1.0, 1.5))
        # 查找所有可领取的礼包按钮
        claim_positions = recognizer.find_all(ALLIANCE_GIFT_CLAIM)
        for idx, pos in enumerate(claim_positions):
            device.click(pos[0], pos[1])
            logger.info("[联盟福利] 领取联盟礼包 %d/%d", idx + 1, len(claim_positions))
            time.sleep(random.uniform(0.8, 1.2))
        if not claim_positions:
            logger.info("[联盟福利] 无待领取联盟礼包")
    else:
        logger.warning("[联盟福利] 未找到联盟礼包标签页")


def _claim_intelligence(device, recognizer, logger):
    """
    切换到每日情报页并领取
    """
    logger.info("[联盟福利] 处理每日情报...")
    tab_pos = recognizer.find(ALLIANCE_INTEL_TAB)
    if tab_pos:
        device.click(tab_pos[0], tab_pos[1])
        logger.info("[联盟福利] 切换到情报标签页")
        time.sleep(random.uniform(1.0, 1.5))
        claim_pos = recognizer.find(ALLIANCE_INTEL_CLAIM)
        if claim_pos:
            device.click(claim_pos[0], claim_pos[1])
            logger.info("[联盟福利] 领取每日情报")
            time.sleep(random.uniform(0.8, 1.2))
        else:
            logger.info("[联盟福利] 无待领取每日情报")
    else:
        logger.warning("[联盟福利] 未找到情报标签页")


def _claim_contribution(device, recognizer, logger):
    """
    切换到联盟贡献页并领取
    """
    logger.info("[联盟福利] 处理联盟贡献奖励...")
    tab_pos = recognizer.find(ALLIANCE_CONTRIB_TAB)
    if tab_pos:
        device.click(tab_pos[0], tab_pos[1])
        logger.info("[联盟福利] 切换到贡献标签页")
        time.sleep(random.uniform(1.0, 1.5))
        claim_positions = recognizer.find_all(ALLIANCE_CONTRIB_CLAIM)
        for idx, pos in enumerate(claim_positions):
            device.click(pos[0], pos[1])
            logger.info("[联盟福利] 领取贡献奖励 %d/%d", idx + 1, len(claim_positions))
            time.sleep(random.uniform(0.8, 1.2))
        if not claim_positions:
            logger.info("[联盟福利] 无待领取贡献奖励")
    else:
        logger.warning("[联盟福利] 未找到贡献标签页")


def _close_alliance(device, recognizer, logger):
    """
    关闭联盟面板返回主界面
    """
    for _ in range(2):
        close_pos = recognizer.find(ALLIANCE_CLOSE)
        if close_pos:
            device.click(close_pos[0], close_pos[1])
            time.sleep(random.uniform(0.5, 1.0))
            return
        device.back()
        time.sleep(random.uniform(0.5, 1.0))
