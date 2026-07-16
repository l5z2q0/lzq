# ============================================
# 模块名称: popup_cleaner.py
# 模块用途: 弹窗自动清理任务 - 关闭活动广告、英雄升级、建筑升级、对战提示等弹窗
#           高频检测，保持界面清洁，避免弹窗阻塞其他任务
# 状态映射: CLEANING -> IDLE
# ============================================

import random
import time
from typing import List, Tuple
from logger import get_logger
from adb_utils import get_device
from image_utils import get_recognizer
from state_machine import get_state_machine, BotState

# 弹窗模板列表：按优先级排序，先检测常见弹窗
POPUP_TEMPLATES: List[Tuple[str, str]] = [
    # (模板文件名, 弹窗名称说明)
    ("popup_activity_ad.png", "活动广告"),
    ("popup_hero_levelup.png", "英雄升级"),
    ("popup_building_upgrade.png", "建筑升级"),
    ("popup_battle_result.png", "对战结果"),
    ("popup_new_unlock.png", "新功能解锁"),
    ("popup_vip_bonus.png", "VIP奖励"),
    ("popup_daily_sign.png", "每日签到"),
    ("popup_system_notice.png", "系统公告"),
    ("popup_event_banner.png", "活动横幅"),
    ("popup_generic_close.png", "通用关闭按钮"),
]

# 特殊处理：某些弹窗有专门的确认/取消按钮
CONFIRM_TEMPLATES = [
    ("popup_confirm_ok.png", "确认按钮"),
    ("popup_confirm_yes.png", "是按钮"),
]


def run(task_config: dict, checked: bool) -> bool:
    """
    执行弹窗清理任务
    :param task_config: 任务配置
    :param checked: 是否勾选
    :return: 清理了弹窗返回True，无弹窗或跳过返回False
    """
    logger = get_logger()
    sm = get_state_machine()
    device = get_device()
    recognizer = get_recognizer()

    if not checked:
        logger.debug("[弹窗清理] 任务未勾选，跳过执行")
        return False

    # 弹窗清理属于轻量任务，不打印大横幅以减少日志噪音
    logger.info("[弹窗清理] 开始检测界面弹窗...")

    if not sm.transition(BotState.CLEANING, reason="开始弹窗清理"):
        # 弹窗清理优先级高，即使状态切换失败也尝试执行
        logger.warning("[弹窗清理] 状态切换失败，仍尝试执行")

    cleaned_any = False  # 标记本次是否清理了任何弹窗

    try:
        # 对每种弹窗模板进行检测
        for template, popup_name in POPUP_TEMPLATES:
            pos = recognizer.find(template)
            if pos:
                device.click(pos[0], pos[1])
                logger.info("[弹窗清理] 关闭【%s】弹窗 | 坐标: %s", popup_name, pos)
                cleaned_any = True
                time.sleep(random.uniform(0.4, 0.8))

        # 处理带确认按钮的弹窗
        for template, btn_name in CONFIRM_TEMPLATES:
            pos = recognizer.find(template)
            if pos:
                device.click(pos[0], pos[1])
                logger.info("[弹窗清理] 点击【%s】| 坐标: %s", btn_name, pos)
                cleaned_any = True
                time.sleep(random.uniform(0.4, 0.8))

        if cleaned_any:
            logger.info("[弹窗清理] 本次共清理 %d 处弹窗", sum(1 for t, n in POPUP_TEMPLATES if recognizer.check_exist(t)))
        else:
            logger.debug("[弹窗清理] 界面清洁，无弹窗需要处理")

        return cleaned_any

    except Exception as e:
        logger.error("[弹窗清理] 任务执行异常: %s", str(e))
        return False

    finally:
        # 清理完毕后务必切回空闲，释放状态占用
        sm.transition(BotState.IDLE, reason="弹窗清理结束")
