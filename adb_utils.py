# ============================================
# 模块名称: adb_utils.py
# 模块用途: ADB工具封装类，负责设备连接、截图、点击、滑动、按键等底层操作
# 核心约束: 所有坐标操作必须加入随机偏移以模拟真人；禁止直接暴露裸坐标
# ============================================

import subprocess      # 调用系统adb命令
import random          # 随机偏移生成
import time            # 操作间隔休眠
import os              # 路径处理
import tempfile        # 临时文件用于截图传输
from typing import Tuple, Optional
from logger import get_logger


class ADBDevice:
    """
    ADB设备操作封装类
    职责: 管理单台模拟器设备的连接生命周期，提供截图/点击/滑动/按键等原子操作
    """

    def __init__(self, host: str = "127.0.0.1", port: int = 5555,
                 device_name: str = "", click_offset: int = 8,
                 swipe_offset: int = 12, min_delay: int = 300,
                 max_delay: int = 1500, swipe_dur: int = 400):
        """
        初始化ADB设备连接
        :param host: ADB服务器地址
        :param port: 模拟器调试端口
        :param device_name: 指定设备序列号，为空则自动连接
        :param click_offset: 点击随机偏移范围(±像素)
        :param swipe_offset: 滑动随机偏移范围(±像素)
        :param min_delay: 操作后最小延迟(ms)
        :param max_delay: 操作后最大延迟(ms)
        :param swipe_dur: 滑动基础持续时间(ms)
        """
        self.host = host
        self.port = port
        self.device_name = device_name
        self.click_offset = click_offset
        self.swipe_offset = swipe_offset
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.swipe_duration = swipe_dur
        self._connected = False          # 连接状态标记
        self._device_serial: str = ""    # 实际连接的设备序列号

        self._connect()                  # 初始化时自动尝试连接

    def _connect(self):
        """
        内部方法：连接ADB服务器并锁定目标设备
        步骤: 启动adb服务 -> 连接指定端口 -> 获取设备列表 -> 确认连接
        """
        logger = get_logger()
        try:
            # Step1: 启动ADB服务器（若未启动）
            subprocess.run(["adb", "start-server"], capture_output=True, text=True, check=False)

            # Step2: 连接模拟器指定端口
            connect_cmd = ["adb", "connect", f"{self.host}:{self.port}"]
            result = subprocess.run(connect_cmd, capture_output=True, text=True, check=False, timeout=10)
            logger.info("[ADB] 连接结果: %s", result.stdout.strip())

            # Step3: 获取已连接设备列表
            devices_result = subprocess.run(["adb", "devices"], capture_output=True, text=True, check=False)
            devices_lines = devices_result.stdout.strip().splitlines()

            available_devices = []
            for line in devices_lines[1:]:  # 跳过第一行表头
                parts = line.strip().split()
                if len(parts) == 2 and parts[1] == "device":
                    available_devices.append(parts[0])

            if not available_devices:
                logger.error("[ADB] 未检测到任何已连接设备，请检查模拟器是否开启ADB调试")
                return

            # Step4: 确定目标设备序列号
            if self.device_name and self.device_name in available_devices:
                self._device_serial = self.device_name
            else:
                self._device_serial = available_devices[0]
                if self.device_name:
                    logger.warning("[ADB] 指定设备 %s 未找到，自动回退到 %s",
                                   self.device_name, self._device_serial)

            self._connected = True
            logger.info("[ADB] 设备连接成功: %s", self._device_serial)

        except Exception as e:
            logger.error("[ADB] 连接设备异常: %s", str(e))
            self._connected = False

    def _adb_cmd(self, cmd_args: list, timeout: int = 10) -> subprocess.CompletedProcess:
        """
        内部方法：执行adb命令，自动附加-s设备参数
        :param cmd_args: adb子命令参数列表
        :param timeout: 命令超时时间(秒)
        :return: subprocess.CompletedProcess结果对象
        """
        if not self._connected:
            raise RuntimeError("ADB设备未连接，无法执行命令")
        full_cmd = ["adb", "-s", self._device_serial] + cmd_args
        return subprocess.run(full_cmd, capture_output=True, timeout=timeout)

    def is_connected(self) -> bool:
        """
        查询设备连接状态
        :return: 已连接返回True
        """
        return self._connected

    def reconnect(self):
        """
        重新连接设备，用于断线恢复场景
        """
        self._connected = False
        self._connect()

    def screenshot(self) -> Optional[bytes]:
        """
        截取设备当前屏幕画面
        :return: PNG图像二进制数据，失败返回None
        """
        logger = get_logger()
        try:
            # ADB截图输出到stdout再读取，避免临时文件权限问题
            result = self._adb_cmd(["shell", "screencap", "-p"], timeout=5)
            if result.returncode != 0:
                logger.error("[ADB] 截图命令失败: %s", result.stderr.decode("utf-8", errors="ignore")[:100])
                return None
            # 修复ADB screencap在Windows下的换行符问题（\r\n -> \n）
            raw = result.stdout.replace(b"\r\n", b"\n")
            logger.debug("[ADB] 截图成功，数据大小: %d bytes", len(raw))
            return raw
        except Exception as e:
            logger.error("[ADB] 截图异常: %s", str(e))
            return None

    def click(self, x: int, y: int, need_offset: bool = True):
        """
        模拟屏幕点击，自动加入随机偏移
        :param x: 目标X坐标
        :param y: 目标Y坐标
        :param need_offset: 是否启用随机偏移（默认True）
        """
        logger = get_logger()
        if need_offset:
            # 在±click_offset范围内生成随机偏移
            ox = random.randint(-self.click_offset, self.click_offset)
            oy = random.randint(-self.click_offset, self.click_offset)
        else:
            ox, oy = 0, 0
        final_x = max(0, x + ox)
        final_y = max(0, y + oy)

        try:
            self._adb_cmd(["shell", "input", "tap", str(final_x), str(final_y)], timeout=3)
            logger.debug("[ADB] 点击 (%d, %d) [原始: %d, %d, 偏移: %d, %d]",
                         final_x, final_y, x, y, ox, oy)
        except Exception as e:
            logger.error("[ADB] 点击异常: %s", str(e))

        # 操作后随机停顿，模拟人手反应时间
        self._random_sleep()

    def swipe(self, x1: int, y1: int, x2: int, y2: int, duration: int = 0):
        """
        模拟屏幕滑动，支持缓动曲线时长
        :param x1: 起点X
        :param y1: 起点Y
        :param x2: 终点X
        :param y2: 终点Y
        :param duration: 滑动时长(ms)，0则使用配置默认值
        """
        logger = get_logger()
        dur = duration if duration > 0 else self.swipe_duration
        # 滑动加入随机偏移，模拟人手不精确性
        ox = random.randint(-self.swipe_offset, self.swipe_offset)
        oy = random.randint(-self.swipe_offset, self.swipe_offset)
        fx1, fy1 = max(0, x1 + ox), max(0, y1 + oy)
        fx2, fy2 = max(0, x2 + ox), max(0, y2 + oy)

        try:
            self._adb_cmd([
                "shell", "input", "swipe",
                str(fx1), str(fy1), str(fx2), str(fy2), str(dur)
            ], timeout=5)
            logger.debug("[ADB] 滑动 (%d,%d)->(%d,%d) 时长:%dms",
                         fx1, fy1, fx2, fy2, dur)
        except Exception as e:
            logger.error("[ADB] 滑动异常: %s", str(e))

        self._random_sleep()

    def long_press(self, x: int, y: int, duration: int = 1000):
        """
        模拟长按操作（通过swipe同起点终点实现）
        :param x: 目标X
        :param y: 目标Y
        :param duration: 按住时长(ms)
        """
        logger = get_logger()
        ox = random.randint(-self.click_offset, self.click_offset)
        oy = random.randint(-self.click_offset, self.click_offset)
        fx, fy = max(0, x + ox), max(0, y + oy)
        try:
            self._adb_cmd([
                "shell", "input", "swipe",
                str(fx), str(fy), str(fx), str(fy), str(duration)
            ], timeout=5)
            logger.debug("[ADB] 长按 (%d, %d) 时长:%dms", fx, fy, duration)
        except Exception as e:
            logger.error("[ADB] 长按异常: %s", str(e))
        self._random_sleep()

    def press_key(self, keycode: int):
        """
        模拟Android按键
        :param keycode: Android按键码，如4=返回，3=Home，26=电源
        """
        logger = get_logger()
        try:
            self._adb_cmd(["shell", "input", "keyevent", str(keycode)], timeout=3)
            logger.debug("[ADB] 按键 keyevent=%d", keycode)
        except Exception as e:
            logger.error("[ADB] 按键异常: %s", str(e))
        self._random_sleep()

    def back(self):
        """快捷方法：模拟返回键(Android KEYCODE_BACK=4)"""
        self.press_key(4)

    def home(self):
        """快捷方法：模拟Home键(Android KEYCODE_HOME=3)"""
        self.press_key(3)

    def start_app(self, package: str):
        """
        启动指定包名的APP
        :param package: 应用包名，如 com.game.endlesswinter
        """
        logger = get_logger()
        try:
            self._adb_cmd(["shell", "am", "start", "-n", f"{package}/.MainActivity"], timeout=10)
            logger.info("[ADB] 启动应用: %s", package)
        except Exception as e:
            logger.error("[ADB] 启动应用异常: %s", str(e))

    def stop_app(self, package: str):
        """
        强制停止指定包名的APP
        :param package: 应用包名
        """
        logger = get_logger()
        try:
            self._adb_cmd(["shell", "am", "force-stop", package], timeout=5)
            logger.info("[ADB] 停止应用: %s", package)
        except Exception as e:
            logger.error("[ADB] 停止应用异常: %s", str(e))

    def get_screen_size(self) -> Tuple[int, int]:
        """
        获取设备屏幕分辨率
        :return: (宽, 高) 元组
        """
        try:
            result = self._adb_cmd(["shell", "wm", "size"], timeout=3)
            output = result.stdout.decode("utf-8", errors="ignore")
            # 输出格式: Physical size: 1280x720
            for line in output.splitlines():
                if "size" in line.lower():
                    parts = line.split()[-1].split("x")
                    return int(parts[0]), int(parts[1])
        except Exception as e:
            get_logger().error("[ADB] 获取分辨率异常: %s", str(e))
        return 1280, 720  # 默认回退值

    def _random_sleep(self):
        """
        内部方法：操作后随机停顿，模拟真人反应时间
        停顿范围: min_delay ~ max_delay (毫秒)
        """
        delay_ms = random.randint(self.min_delay, self.max_delay)
        time.sleep(delay_ms / 1000.0)


# 全局ADB设备单例
_global_device: ADBDevice | None = None


def init_device(config: dict) -> ADBDevice:
    """
    初始化全局ADB设备单例
    :param config: 配置字典，需包含adb和anti_detect节点
    :return: ADBDevice实例
    """
    global _global_device
    adb_cfg = config.get("adb", {})
    anti_cfg = config.get("anti_detect", {})
    _global_device = ADBDevice(
        host=adb_cfg.get("host", "127.0.0.1"),
        port=adb_cfg.get("port", 5555),
        device_name=adb_cfg.get("device_name", ""),
        click_offset=anti_cfg.get("click_offset", 8),
        swipe_offset=anti_cfg.get("swipe_offset", 12),
        min_delay=anti_cfg.get("min_action_delay", 300),
        max_delay=anti_cfg.get("max_action_delay", 1500),
        swipe_dur=anti_cfg.get("swipe_duration", 400)
    )
    return _global_device


def get_device() -> ADBDevice:
    """
    获取全局ADB设备实例
    :return: ADBDevice实例
    """
    if _global_device is None:
        raise RuntimeError("ADB设备尚未初始化，请先调用init_device()")
    return _global_device
