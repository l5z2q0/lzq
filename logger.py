# ============================================
# 模块名称: logger.py
# 模块用途: 全局日志系统，支持分级日志、文件轮转、识别失败自动截图
# 作者说明: 所有日志统一由此模块管理，禁止其他模块直接使用print
# ============================================

import logging          # Python标准日志库
import logging.handlers # 日志文件轮转处理器
import os               # 操作系统接口，用于目录创建
import time             # 时间戳生成
from datetime import datetime  # 日期时间格式化
from pathlib import Path       # 跨平台路径处理

# 日志级别映射字典，支持字符串转logging级别对象
LOG_LEVEL_MAP = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
}


class GameLogger:
    """
    游戏自动化脚本专用日志类
    功能: 初始化日志记录器、文件轮转、失败截图、控制台输出
    """

    def __init__(self, config: dict):
        """
        构造函数：根据配置初始化日志系统
        :param config: 从config.yaml读取的log配置字典
        """
        self.log_dir = config.get("log_dir", "logs")          # 日志目录
        self.level_str = config.get("level", "INFO")           # 日志级别字符串
        self.max_size_mb = config.get("max_size_mb", 10)       # 单个文件大小限制(MB)
        self.backup_count = config.get("backup_count", 5)      # 保留备份数
        self.save_screenshot = config.get("save_fail_screenshot", True)  # 失败是否截图

        # 确保日志目录存在
        os.makedirs(self.log_dir, exist_ok=True)

        # 创建logger实例
        self.logger = logging.getLogger("EndlessWinterBot")
        self.logger.setLevel(LOG_LEVEL_MAP.get(self.level_str, logging.INFO))
        self.logger.handlers.clear()  # 清空已有处理器，避免重复添加

        # 日志文件路径：按日期命名，便于归档
        log_file = os.path.join(self.log_dir, f"bot_{datetime.now().strftime('%Y%m%d')}.log")

        # 文件处理器：按大小轮转，避免单个日志文件过大
        file_handler = logging.handlers.RotatingFileHandler(
            filename=log_file,
            maxBytes=self.max_size_mb * 1024 * 1024,  # MB转字节
            backupCount=self.backup_count,
            encoding="utf-8"
        )
        # 文件日志格式：包含时间、级别、模块名、消息
        file_formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        file_handler.setFormatter(file_formatter)
        self.logger.addHandler(file_handler)

        # 控制台处理器：实时输出到终端/GUI控制台
        console_handler = logging.StreamHandler()
        console_formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(message)s",
            datefmt="%H:%M:%S"
        )
        console_handler.setFormatter(console_formatter)
        self.logger.addHandler(console_handler)

        self.info("=" * 50)
        self.info("日志系统初始化完成 | 级别: %s | 目录: %s", self.level_str, self.log_dir)
        self.info("=" * 50)

    def debug(self, msg: str, *args):
        """输出DEBUG级别日志，用于开发调试"""
        self.logger.debug(msg, *args)

    def info(self, msg: str, *args):
        """输出INFO级别日志，用于正常运行信息"""
        self.logger.info(msg, *args)

    def warning(self, msg: str, *args):
        """输出WARNING级别日志，用于非致命异常"""
        self.logger.warning(msg, *args)

    def error(self, msg: str, *args):
        """输出ERROR级别日志，用于严重错误"""
        self.logger.error(msg, *args)

    def save_fail_screenshot(self, screenshot_bytes: bytes, reason: str = "识别失败"):
        """
        识别失败时自动截图保存到logs/fails目录
        :param screenshot_bytes: ADB截图的二进制数据
        :param reason: 失败原因，用于文件名标记
        """
        if not self.save_screenshot or screenshot_bytes is None:
            return
        # 创建失败截图子目录
        fail_dir = os.path.join(self.log_dir, "fails")
        os.makedirs(fail_dir, exist_ok=True)
        # 文件名包含时间戳和原因
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_reason = reason.replace(" ", "_").replace("/", "_")[:20]
        filename = os.path.join(fail_dir, f"fail_{timestamp}_{safe_reason}.png")
        try:
            with open(filename, "wb") as f:
                f.write(screenshot_bytes)
            self.info("[截图保存] 失败截图已保存: %s", filename)
        except Exception as e:
            self.error("[截图保存] 保存失败截图异常: %s", str(e))


# 全局日志单例，由main.py初始化后供全模块使用
_global_logger: GameLogger | None = None


def init_logger(config: dict) -> GameLogger:
    """
    初始化全局日志单例
    :param config: 日志配置字典
    :return: GameLogger实例
    """
    global _global_logger
    _global_logger = GameLogger(config)
    return _global_logger


def get_logger() -> GameLogger:
    """
    获取全局日志实例，未初始化时抛出异常防止静默错误
    :return: GameLogger实例
    """
    if _global_logger is None:
        raise RuntimeError("日志系统尚未初始化，请先调用init_logger()")
    return _global_logger
