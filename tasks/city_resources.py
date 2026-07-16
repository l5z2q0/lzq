# ============================================
# 模块名称: city_resources.py
# 模块用途: 主城资源收取任务 - 自动识别木材、食物、铁矿、燃油红点并点击收取
#           检测仓库满仓弹窗并自动处理关闭
# 状态映射: COLLECT -> IDLE
# ============================================

import random
import time
from typing import Dict, List
from logger import get_logger
from adb_utils import get_device
from image_utils import get_recognizer
from state_machine import get_state_machine, BotState

# 资源类型与对应模板文件名映射
RESOURCE_TEMPLATES: Dict[str, str] = {
    "木材": "resource_wood.png",
    "食物": "resource_food.png",
    "铁矿": "resource_iron.png",
    "燃油": "resource_oil.png",
}

# 仓库满仓弹窗关闭按钮模板
WAREHOUSE_FULL_TEMPLATE = "warehouse_full_close.png"


def run(task_config: dict, checked: bool) -> bool:
    """
    执行主城资源收取任务
    :param task_config: 该任务的配置字典（含enabled、interval等）
    :param checked: GUI中该任务是否被勾选
    :return: 任务执行完成返回True，被跳过返回False
    """
    logger = get_logger()
    sm = get_state_machine()
    device = get_device()
    recognizer = get_recognizer()

    # Step0: 优先判断勾选状态，未勾选直接跳过，符合解耦原则
    if not checked:
        logger.debug("[主城资源] 任务未勾选，跳过执行")
        return False

    logger.info("=" * 40)
    logger.info("[任务开始] 主城资源收取")
    logger.info("=" * 40)

    # Step1: 状态机切换到采集状态
    if not sm.transition(BotState.COLLECT, reason="开始主城资源收取"):
        logger.warning("[主城资源] 状态切换失败，放弃执行")
        return False

    try:
        collected_count = 0  # 统计本次收取的资源数量

        # Step2: 遍历所有资源类型，查找并点击红点
        for res_name, template in RESOURCE_TEMPLATES.items():
            logger.info("[主城资源] 查找 %s 收取按钮...", res_name)
            pos = recognizer.find(template)
            if pos:
                x, y = pos
                device.click(x, y)
                collected_count += 1
                logger.info("[主城资源] %s 收取完成 | 坐标: (%d, %d)", res_name, x, y)
                # 每次收取后额外停顿，避免操作过快
                time.sleep(random.uniform(0.8, 1.5))
            else:
                logger.info("[主城资源] %s 无可收取资源", res_name)

        # Step3: 检测并关闭仓库满仓弹窗
        _handle_warehouse_full(device, recognizer, logger)

        logger.info("[任务结束] 主城资源收取完成，共收取 %d 处资源", collected_count)
        return True

    except Exception as e:
        logger.error("[主城资源] 任务执行异常: %s", str(e))
        return False

    finally:
        # 无论成功失败，最终切回空闲状态
        sm.transition(BotState.IDLE, reason="主城资源收取结束")


def _handle_warehouse_full(device, recognizer, logger):
    """
    内部函数：检测并关闭仓库满仓提示弹窗
    :param device: ADB设备实例
    :param recognizer: 图像识别器实例
    :param logger: 日志实例
    """
    logger.info("[主城资源] 检测仓库满仓弹窗...")
    # 连续检测2次，确保弹窗真实存在
    for attempt in range(2):
        pos = recognizer.find(WAREHOUSE_FULL_TEMPLATE)
        if pos:
            device.click(pos[0], pos[1])
            logger.info("[主城资源] 仓库满仓弹窗关闭 | 坐标: %s", pos)
            time.sleep(random.uniform(0.5, 1.0))
        else:
            break
