# ============================================
# 模块名称: expedition.py
# 模块用途: 探险自动战斗任务 - 循环推图、拾取通关宝箱
#           体力不足时自动暂停等待恢复，避免浪费挑战次数
# 状态映射: BATTLE -> IDLE
# ============================================

import random
import time
from logger import get_logger
from adb_utils import get_device
from image_utils import get_recognizer
from state_machine import get_state_machine, BotState

# 探险模块模板常量
EXPEDITION_ICON = "expedition_icon.png"        # 主界面探险入口
EXPEDITION_CHALLENGE = "expedition_challenge.png"  # 挑战按钮
EXPEDITION_AUTO_BATTLE = "expedition_auto.png"     # 自动战斗按钮
EXPEDITION_VICTORY = "expedition_victory.png"      # 胜利结算画面
EXPEDITION_CHEST = "expedition_chest.png"          # 通关宝箱
EXPEDITION_CHEST_OPEN = "expedition_open.png"      # 打开宝箱按钮
EXPEDITION_NO_STAMINA = "expedition_no_stamina.png" # 体力不足提示
EXPEDITION_NEXT_LEVEL = "expedition_next.png"      # 下一关按钮
EXPEDITION_CLOSE = "expedition_close.png"          # 关闭探险界面


def run(task_config: dict, checked: bool) -> bool:
    """
    执行探险自动战斗任务
    :param task_config: 任务配置
    :param checked: 是否勾选
    :return: 完成True，跳过False
    """
    logger = get_logger()
    sm = get_state_machine()
    device = get_device()
    recognizer = get_recognizer()

    if not checked:
        logger.debug("[探险战斗] 任务未勾选，跳过执行")
        return False

    logger.info("=" * 40)
    logger.info("[任务开始] 探险自动战斗")
    logger.info("=" * 40)

    if not sm.transition(BotState.BATTLE, reason="开始探险自动战斗"):
        logger.warning("[探险战斗] 状态切换失败，放弃执行")
        return False

    try:
        # Step1: 进入探险界面
        logger.info("[探险战斗] 进入探险界面...")
        icon_pos = recognizer.find(EXPEDITION_ICON)
        if not icon_pos:
            logger.warning("[探险战斗] 未找到探险入口")
            return False
        device.click(icon_pos[0], icon_pos[1])
        time.sleep(random.uniform(2.0, 3.0))

        # Step2: 循环推图，最多连续挑战10次防止无限循环
        max_battles = 10
        for battle_idx in range(max_battles):
            logger.info("[探险战斗] ===== 第 %d/%d 场战斗 =====", battle_idx + 1, max_battles)

            # 2.1 检测体力是否不足
            if recognizer.check_exist(EXPEDITION_NO_STAMINA):
                logger.warning("[探险战斗] 体力不足，暂停等待恢复")
                sm.transition(BotState.SLEEPING, reason="探险体力不足进入休眠")
                # 体力不足时休眠10分钟后返回
                time.sleep(600)
                sm.transition(BotState.BATTLE, reason="体力恢复后继续探险")
                continue

            # 2.2 点击挑战
            challenge_pos = recognizer.find(EXPEDITION_CHALLENGE)
            if not challenge_pos:
                logger.info("[探险战斗] 无可用挑战关卡，结束推图")
                break
            device.click(challenge_pos[0], challenge_pos[1])
            logger.info("[探险战斗] 点击挑战")
            time.sleep(random.uniform(3.0, 5.0))  # 等待战斗加载

            # 2.3 开启自动战斗（若未自动开启）
            auto_pos = recognizer.find(EXPEDITION_AUTO_BATTLE)
            if auto_pos:
                device.click(auto_pos[0], auto_pos[1])
                logger.info("[探险战斗] 开启自动战斗")

            # 2.4 等待战斗结束（胜利画面出现）
            logger.info("[探险战斗] 等待战斗结束...")
            victory_pos = recognizer.wait_for(EXPEDITION_VICTORY, timeout=60, interval=2)
            if victory_pos:
                logger.info("[探险战斗] 战斗胜利")
                time.sleep(random.uniform(1.0, 2.0))
            else:
                logger.warning("[探险战斗] 等待胜利超时，可能战斗异常")

            # 2.5 拾取通关宝箱
            _collect_chest(device, recognizer, logger)

            # 2.6 尝试进入下一关
            next_pos = recognizer.find(EXPEDITION_NEXT_LEVEL)
            if next_pos:
                device.click(next_pos[0], next_pos[1])
                logger.info("[探险战斗] 进入下一关")
                time.sleep(random.uniform(2.0, 3.0))
            else:
                logger.info("[探险战斗] 无下一关按钮，本轮回合结束")
                break

        logger.info("[任务结束] 探险自动战斗完成")
        return True

    except Exception as e:
        logger.error("[探险战斗] 任务执行异常: %s", str(e))
        return False

    finally:
        _close_expedition(device, recognizer, logger)
        sm.transition(BotState.IDLE, reason="探险自动战斗结束")


def _collect_chest(device, recognizer, logger):
    """
    内部函数：拾取通关宝箱
    """
    chest_pos = recognizer.find(EXPEDITION_CHEST)
    if chest_pos:
        device.click(chest_pos[0], chest_pos[1])
        logger.info("[探险战斗] 点击通关宝箱")
        time.sleep(random.uniform(1.0, 1.5))
        # 点击打开
        open_pos = recognizer.find(EXPEDITION_CHEST_OPEN)
        if open_pos:
            device.click(open_pos[0], open_pos[1])
            logger.info("[探险战斗] 打开宝箱")
            time.sleep(random.uniform(0.8, 1.2))
    else:
        logger.info("[探险战斗] 未检测到通关宝箱")


def _close_expedition(device, recognizer, logger):
    """
    关闭探险界面返回主城
    """
    for _ in range(3):
        close_pos = recognizer.find(EXPEDITION_CLOSE)
        if close_pos:
            device.click(close_pos[0], close_pos[1])
            time.sleep(random.uniform(0.5, 1.0))
            return
        device.back()
        time.sleep(random.uniform(0.5, 1.0))
