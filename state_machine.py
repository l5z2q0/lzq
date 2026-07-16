# ============================================
# 模块名称: state_machine.py
# 模块用途: 全局状态机调度器，管理脚本运行状态，防止逻辑冲突
# 设计原则: 状态切换必须经过合法校验，禁止直接从任意状态跳转到任意状态
# ============================================

import threading       # 线程锁，保证状态切换线程安全
import time            # 时间戳记录
from enum import Enum, auto  # 枚举类型定义状态常量
from logger import get_logger  # 引入全局日志


class BotState(Enum):
    """
    机器人运行状态枚举
    各状态含义:
        IDLE      - 空闲待机，等待执行信号
        COLLECT   - 正在执行资源采集类任务
        BATTLE    - 正在执行战斗类任务（探险/野外）
        REWARD    - 正在执行领奖类任务（邮件/活跃度/联盟）
        CLEANING  - 正在执行弹窗清理
        RECOVER   - 异常恢复中（重启游戏/重登账号）
        SLEEPING  - 休眠状态，模拟真人离线
        STOPPED   - 已停止，所有任务中断
    """
    IDLE = auto()
    COLLECT = auto()
    BATTLE = auto()
    REWARD = auto()
    CLEANING = auto()
    RECOVER = auto()
    SLEEPING = auto()
    STOPPED = auto()


# 合法状态转移矩阵：key为当前状态，value为允许转移到的目标状态集合
VALID_TRANSITIONS = {
    BotState.IDLE:      {BotState.COLLECT, BotState.BATTLE, BotState.REWARD,
                         BotState.CLEANING, BotState.RECOVER, BotState.SLEEPING, BotState.STOPPED},
    BotState.COLLECT:   {BotState.IDLE, BotState.CLEANING, BotState.RECOVER, BotState.STOPPED},
    BotState.BATTLE:    {BotState.IDLE, BotState.CLEANING, BotState.RECOVER, BotState.STOPPED},
    BotState.REWARD:    {BotState.IDLE, BotState.CLEANING, BotState.RECOVER, BotState.STOPPED},
    BotState.CLEANING:  {BotState.IDLE, BotState.RECOVER, BotState.STOPPED},
    BotState.RECOVER:   {BotState.IDLE, BotState.STOPPED},
    BotState.SLEEPING:  {BotState.IDLE, BotState.STOPPED},
    BotState.STOPPED:   {BotState.IDLE},  # 停止后只能回到空闲准备重启
}


class StateMachine:
    """
    状态机核心类
    职责: 维护当前状态、执行状态切换、记录状态历史、提供状态查询接口
    """

    def __init__(self, idle_timeout: int = 300):
        """
        初始化状态机
        :param idle_timeout: 空闲超时时间(秒)，超过则自动建议进入休眠
        """
        self._state = BotState.STOPPED       # 初始状态为停止
        self._lock = threading.RLock()       # 可重入锁，支持同线程多次acquire
        self._idle_timeout = idle_timeout    # 空闲超时阈值
        self._state_history = []             # 状态变更历史记录，用于调试回溯
        self._last_active_time = time.time() # 最后活跃时间戳
        self._state_entry_time = time.time() # 进入当前状态的时间

    @property
    def current(self) -> BotState:
        """
        获取当前状态（线程安全读）
        :return: 当前BotState枚举值
        """
        with self._lock:
            return self._state

    def transition(self, target: BotState, reason: str = "") -> bool:
        """
        执行状态转移，必须经过合法性校验
        :param target: 目标状态
        :param reason: 转移原因，用于日志记录
        :return: 转移成功返回True，非法转移返回False
        """
        with self._lock:
            current = self._state
            # 校验转移是否合法
            if target not in VALID_TRANSITIONS.get(current, set()):
                get_logger().warning(
                    "[状态机] 非法状态转移: %s -> %s | 原因: %s",
                    current.name, target.name, reason
                )
                return False

            # 执行转移
            old_state = current
            self._state = target
            now = time.time()
            self._state_entry_time = now
            if target != BotState.IDLE:
                self._last_active_time = now

            # 记录历史
            self._state_history.append({
                "time": time.strftime("%H:%M:%S"),
                "from": old_state.name,
                "to": target.name,
                "reason": reason
            })
            # 历史记录最多保留50条，防止内存无限增长
            if len(self._state_history) > 50:
                self._state_history.pop(0)

            get_logger().info(
                "[状态机] %s -> %s | 原因: %s",
                old_state.name, target.name, reason if reason else "未说明"
            )
            return True

    def is_running(self) -> bool:
        """
        判断状态机是否处于可运行状态（非STOPPED）
        :return: 未停止返回True
        """
        with self._lock:
            return self._state != BotState.STOPPED

    def is_idle_timeout(self) -> bool:
        """
        判断空闲状态是否已超时，建议进入休眠
        :return: 超时返回True
        """
        with self._lock:
            if self._state != BotState.IDLE:
                return False
            idle_duration = time.time() - self._last_active_time
            return idle_duration > self._idle_timeout

    def get_state_duration(self) -> float:
        """
        获取当前状态已持续的秒数
        :return: 持续时间(秒)
        """
        with self._lock:
            return time.time() - self._state_entry_time

    def get_history(self) -> list:
        """
        获取状态变更历史
        :return: 状态历史字典列表
        """
        with self._lock:
            return list(self._state_history)

    def reset_to_idle(self):
        """
        强制重置到空闲状态（用于初始化或恢复后）
        注意: 此操作绕过合法性校验，仅应在受控场景调用
        """
        with self._lock:
            self._state = BotState.IDLE
            self._last_active_time = time.time()
            self._state_entry_time = time.time()
            get_logger().info("[状态机] 强制重置到 IDLE 状态")


# 全局状态机单例
_global_state_machine: StateMachine | None = None


def init_state_machine(idle_timeout: int = 300) -> StateMachine:
    """
    初始化全局状态机单例
    :param idle_timeout: 空闲超时时间(秒)
    :return: StateMachine实例
    """
    global _global_state_machine
    _global_state_machine = StateMachine(idle_timeout)
    return _global_state_machine


def get_state_machine() -> StateMachine:
    """
    获取全局状态机实例
    :return: StateMachine实例
    """
    if _global_state_machine is None:
        raise RuntimeError("状态机尚未初始化，请先调用init_state_machine()")
    return _global_state_machine
