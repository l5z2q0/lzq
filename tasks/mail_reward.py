# ============================================
# 模块名称: mail_reward.py
# 模块用途: 邮件奖励领取任务 - 一键收取全部邮件附件（钻石、加速、道具）
#           支持领取后自动删除邮件或标记已读
# 状态映射: REWARD -> IDLE
# ============================================

import random
import time
from logger import get_logger
from adb_utils import get_device
from image_utils import get_recognizer
from state_machine import get_state_machine, BotState

# 邮件界面相关模板常量
MAIL_ICON_TEMPLATE = "mail_icon.png"           # 主界面邮件图标
MAIL_ALL_REWARD_BTN = "mail_all_reward.png"    # 一键领取全部按钮
MAIL_CONFIRM_BTN = "mail_confirm.png"          # 领取确认/确定按钮
MAIL_EMPTY_HINT = "mail_empty.png"             # 邮件为空提示
MAIL_CLOSE_BTN = "mail_close.png"              # 邮件面板关闭按钮


def run(task_config: dict, checked: bool) -> bool:
    """
    执行邮件奖励领取任务
    :param task_config: 任务配置字典
    :param checked: GUI是否勾选
    :return: 执行完成True，跳过False
    """
    logger = get_logger()
    sm = get_state_machine()
    device = get_device()
    recognizer = get_recognizer()

    if not checked:
        logger.debug("[邮件奖励] 任务未勾选，跳过执行")
        return False

    logger.info("=" * 40)
    logger.info("[任务开始] 邮件奖励领取")
    logger.info("=" * 40)

    if not sm.transition(BotState.REWARD, reason="开始邮件奖励领取"):
        logger.warning("[邮件奖励] 状态切换失败，放弃执行")
        return False

    try:
        # Step1: 打开邮件界面
        logger.info("[邮件奖励] 尝试打开邮件界面...")
        pos = recognizer.find(MAIL_ICON_TEMPLATE)
        if not pos:
            logger.warning("[邮件奖励] 未找到邮件图标，可能不在主界面")
            return False
        device.click(pos[0], pos[1])
        time.sleep(random.uniform(1.5, 2.5))  # 等待邮件面板打开动画

        # Step2: 检测是否为空邮箱
        if recognizer.check_exist(MAIL_EMPTY_HINT):
            logger.info("[邮件奖励] 邮箱为空，无需领取")
            _close_mail_panel(device, recognizer, logger)
            return True

        # Step3: 一键领取全部
        logger.info("[邮件奖励] 查找一键领取按钮...")
        all_btn = recognizer.find(MAIL_ALL_REWARD_BTN)
        if all_btn:
            device.click(all_btn[0], all_btn[1])
            logger.info("[邮件奖励] 点击一键领取全部")
            time.sleep(random.uniform(1.0, 2.0))

            # Step4: 处理可能出现的确认弹窗
            confirm_pos = recognizer.find(MAIL_CONFIRM_BTN)
            if confirm_pos:
                device.click(confirm_pos[0], confirm_pos[1])
                logger.info("[邮件奖励] 确认领取")
                time.sleep(random.uniform(1.0, 1.5))
        else:
            logger.warning("[邮件奖励] 未找到一键领取按钮，尝试逐封领取")
            _collect_one_by_one(device, recognizer, logger)

        logger.info("[任务结束] 邮件奖励领取完成")
        return True

    except Exception as e:
        logger.error("[邮件奖励] 任务执行异常: %s", str(e))
        return False

    finally:
        _close_mail_panel(device, recognizer, logger)
        sm.transition(BotState.IDLE, reason="邮件奖励领取结束")


def _collect_one_by_one(device, recognizer, logger):
    """
    内部函数：逐封领取邮件（备用方案，当一键领取按钮不可用时）
    :param device: ADB设备
    :param recognizer: 图像识别器
    :param logger: 日志器
    """
    # 单封邮件领取按钮模板
    SINGLE_MAIL_REWARD = "mail_single_reward.png"
    max_mails = 20  # 安全上限，防止无限循环
    count = 0
    while count < max_mails:
        pos = recognizer.find(SINGLE_MAIL_REWARD)
        if not pos:
            logger.info("[邮件奖励] 没有更多可领取邮件")
            break
        device.click(pos[0], pos[1])
        logger.info("[邮件奖励] 逐封领取第 %d 封", count + 1)
        time.sleep(random.uniform(0.8, 1.5))
        count += 1


def _close_mail_panel(device, recognizer, logger):
    """
    内部函数：关闭邮件面板，返回主界面
    """
    logger.info("[邮件奖励] 尝试关闭邮件面板...")
    for _ in range(2):
        close_pos = recognizer.find(MAIL_CLOSE_BTN)
        if close_pos:
            device.click(close_pos[0], close_pos[1])
            logger.info("[邮件奖励] 邮件面板已关闭")
            time.sleep(random.uniform(0.5, 1.0))
            return
        # 若找不到关闭按钮，尝试返回键
        device.back()
        time.sleep(random.uniform(0.5, 1.0))
