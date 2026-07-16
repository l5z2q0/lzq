# ============================================
# 模块名称: wild_elite.py
# 模块用途: 野外精英巡逻任务 - 自动寻找野怪、开战、拾取掉落材料
#           在主城与野外地图之间切换，检测并攻击精英怪
# 状态映射: BATTLE -> IDLE
# ============================================

import random
import time
from logger import get_logger
from adb_utils import get_device
from image_utils import get_recognizer
from state_machine import get_state_machine, BotState

# 野外模块模板常量
WILD_MAP_ICON = "wild_map_icon.png"            # 野外地图入口
WILD_SEARCH_BTN = "wild_search.png"            # 搜索野怪按钮
WILD_ELITE_MARK = "wild_elite_mark.png"        # 精英怪标记/头像
WILD_ATTACK_BTN = "wild_attack.png"            # 攻击按钮
WILD_MARCH_BTN = "wild_march.png"              # 出兵/行军按钮
WILD_BATTLE_END = "wild_battle_end.png"        # 战斗结束标记
WILD_LOOT_CHEST = "wild_loot.png"              # 掉落宝箱/材料
WILD_BACK_CITY = "wild_back_city.png"          # 返回主城按钮
WILD_AUTO_JOIN = "wild_auto_join.png"          # 自动加入/集结按钮


def run(task_config: dict, checked: bool) -> bool:
    """
    执行野外精英巡逻任务
    :param task_config: 任务配置
    :param checked: 是否勾选
    :return: 完成True，跳过False
    """
    logger = get_logger()
    sm = get_state_machine()
    device = get_device()
    recognizer = get_recognizer()

    if not checked:
        logger.debug("[野外精英] 任务未勾选，跳过执行")
        return False

    logger.info("=" * 40)
    logger.info("[任务开始] 野外精英巡逻")
    logger.info("=" * 40)

    if not sm.transition(BotState.BATTLE, reason="开始野外精英巡逻"):
        logger.warning("[野外精英] 状态切换失败，放弃执行")
        return False

    try:
        # Step1: 进入野外地图
        logger.info("[野外精英] 进入野外地图...")
        map_pos = recognizer.find(WILD_MAP_ICON)
        if not map_pos:
            logger.warning("[野外精英] 未找到野外地图入口")
            return False
        device.click(map_pos[0], map_pos[1])
        time.sleep(random.uniform(2.0, 3.0))

        # Step2: 搜索精英怪，最多搜索3轮
        max_search = 3
        for search_idx in range(max_search):
            logger.info("[野外精英] ===== 第 %d/%d 轮搜索 =====", search_idx + 1, max_search)

            # 点击搜索按钮
            search_pos = recognizer.find(WILD_SEARCH_BTN)
            if search_pos:
                device.click(search_pos[0], search_pos[1])
                logger.info("[野外精英] 点击搜索")
                time.sleep(random.uniform(1.5, 2.5))
            else:
                logger.warning("[野外精英] 未找到搜索按钮")
                break

            # 查找精英怪标记
            elite_pos = recognizer.find(WILD_ELITE_MARK)
            if not elite_pos:
                logger.info("[野外精英] 未找到精英怪，继续搜索")
                continue

            logger.info("[野外精英] 发现精英怪 | 坐标: %s", elite_pos)
            device.click(elite_pos[0], elite_pos[1])
            time.sleep(random.uniform(1.0, 1.5))

            # Step3: 发起攻击
            attack_pos = recognizer.find(WILD_ATTACK_BTN)
            if attack_pos:
                device.click(attack_pos[0], attack_pos[1])
                logger.info("[野外精英] 点击攻击")
                time.sleep(random.uniform(1.0, 1.5))
            else:
                logger.warning("[野外精英] 未找到攻击按钮，可能已被其他玩家占领")
                continue

            # 确认行军
            march_pos = recognizer.find(WILD_MARCH_BTN)
            if march_pos:
                device.click(march_pos[0], march_pos[1])
                logger.info("[野外精英] 确认行军")
                time.sleep(random.uniform(2.0, 3.0))
            else:
                logger.warning("[野外精英] 未找到行军按钮")
                continue

            # Step4: 等待战斗结束
            logger.info("[野外精英] 等待战斗结束...")
            end_pos = recognizer.wait_for(WILD_BATTLE_END, timeout=90, interval=3)
            if end_pos:
                logger.info("[野外精英] 战斗结束")
                time.sleep(random.uniform(1.0, 2.0))
                # 拾取掉落
                _collect_loot(device, recognizer, logger)
            else:
                logger.warning("[野外精英] 战斗超时")

            # 每次战斗后停顿，模拟真人操作间隔
            time.sleep(random.uniform(3.0, 5.0))

        # Step5: 返回主城
        logger.info("[野外精英] 巡逻结束，返回主城...")
        back_pos = recognizer.find(WILD_BACK_CITY)
        if back_pos:
            device.click(back_pos[0], back_pos[1])
            time.sleep(random.uniform(2.0, 3.0))

        logger.info("[任务结束] 野外精英巡逻完成")
        return True

    except Exception as e:
        logger.error("[野外精英] 任务执行异常: %s", str(e))
        return False

    finally:
        sm.transition(BotState.IDLE, reason="野外精英巡逻结束")


def _collect_loot(device, recognizer, logger):
    """
    拾取野外战斗掉落材料
    """
    loot_pos = recognizer.find(WILD_LOOT_CHEST)
    if loot_pos:
        device.click(loot_pos[0], loot_pos[1])
        logger.info("[野外精英] 拾取掉落材料")
        time.sleep(random.uniform(1.0, 1.5))
    else:
        logger.info("[野外精英] 无掉落材料可拾取")
