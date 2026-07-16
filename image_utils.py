# ============================================
# 模块名称: image_utils.py
# 模块用途: OpenCV图像识别封装，提供模板匹配、多目标检测、文字区域定位等功能
# 核心约束: 所有匹配必须经过灰度降噪预处理；失败自动重试并截图留存
# ============================================

import cv2                 # OpenCV图像处理核心库
import numpy as np         # 数值计算与数组操作
import time                # 重试间隔计时
import os                  # 文件路径检查
from typing import Tuple, Optional, List
from logger import get_logger
from adb_utils import get_device


class ImageRecognizer:
    """
    图像识别器类
    职责: 加载模板、预处理屏幕截图、执行模板匹配、返回匹配结果坐标
    """

    def __init__(self, template_dir: str = "templates", confidence: float = 0.75,
                 grayscale: bool = True, gaussian_blur: bool = True,
                 max_retry: int = 3, retry_interval: float = 1.0):
        """
        初始化图像识别器
        :param template_dir: 模板图片存放目录
        :param confidence: 匹配置信度阈值(0~1)
        :param grayscale: 是否启用灰度处理
        :param gaussian_blur: 是否启用高斯降噪
        :param max_retry: 匹配失败最大重试次数
        :param retry_interval: 每次重试间隔(秒)
        """
        self.template_dir = template_dir
        self.confidence = confidence
        self.grayscale = grayscale
        self.gaussian_blur = gaussian_blur
        self.max_retry = max_retry
        self.retry_interval = retry_interval
        self._template_cache: dict[str, np.ndarray] = {}  # 模板缓存，避免重复读取磁盘

        # 确保模板目录存在
        os.makedirs(self.template_dir, exist_ok=True)
        get_logger().info("[图像识别] 初始化完成 | 模板目录: %s | 置信度: %.2f",
                          self.template_dir, self.confidence)

    def _load_template(self, template_name: str) -> Optional[np.ndarray]:
        """
        内部方法：加载模板图片，支持缓存
        :param template_name: 模板文件名，如 "wood_icon.png"
        :return: OpenCV图像矩阵(BGR格式)，失败返回None
        """
        # 若已在缓存中，直接返回
        if template_name in self._template_cache:
            return self._template_cache[template_name]

        # 自动补全路径
        path = os.path.join(self.template_dir, template_name)
        if not os.path.exists(path):
            get_logger().error("[图像识别] 模板文件不存在: %s", path)
            return None

        # OpenCV读取图片，默认BGR格式
        img = cv2.imread(path, cv2.IMREAD_COLOR)
        if img is None:
            get_logger().error("[图像识别] 模板读取失败: %s", path)
            return None

        # 预处理：灰度 + 高斯降噪
        processed = self._preprocess(img)
        self._template_cache[template_name] = processed
        get_logger().debug("[图像识别] 模板加载成功: %s [尺寸:%s]", template_name, processed.shape)
        return processed

    def _preprocess(self, img: np.ndarray) -> np.ndarray:
        """
        内部方法：图像预处理流程
        步骤: 灰度转换(可选) -> 高斯模糊降噪(可选)
        :param img: 输入图像(BGR或灰度)
        :return: 处理后的图像
        """
        result = img.copy()
        # Step1: 灰度转换
        if self.grayscale and len(result.shape) == 3:
            result = cv2.cvtColor(result, cv2.COLOR_BGR2GRAY)
        # Step2: 高斯模糊降噪，核大小5x5，标准差自动计算
        if self.gaussian_blur:
            result = cv2.GaussianBlur(result, (5, 5), 0)
        return result

    def capture_screen(self) -> Optional[np.ndarray]:
        """
        截取当前屏幕并进行预处理
        :return: 预处理后的OpenCV图像矩阵，失败返回None
        """
        logger = get_logger()
        device = get_device()
        raw_bytes = device.screenshot()
        if raw_bytes is None:
            return None
        # 将PNG二进制转为numpy数组
        np_arr = np.frombuffer(raw_bytes, dtype=np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            logger.error("[图像识别] 截图解码失败")
            return None
        return self._preprocess(img)

    def find(self, template_name: str, screenshot: Optional[np.ndarray] = None) -> Optional[Tuple[int, int]]:
        """
        单目标模板匹配：在屏幕中查找指定模板，返回中心点坐标
        :param template_name: 模板文件名
        :param screenshot: 预处理的屏幕截图，为None则自动截取
        :return: 匹配成功返回(x, y)中心坐标，失败返回None
        """
        logger = get_logger()
        template = self._load_template(template_name)
        if template is None:
            return None

        for attempt in range(1, self.max_retry + 1):
            screen = screenshot if screenshot is not None else self.capture_screen()
            if screen is None:
                logger.warning("[图像识别] 截图获取失败，重试 %d/%d", attempt, self.max_retry)
                time.sleep(self.retry_interval)
                continue

            # 若模板是灰度图但截图是彩色，统一转换为灰度
            if len(template.shape) == 2 and len(screen.shape) == 3:
                screen_gray = cv2.cvtColor(screen, cv2.COLOR_BGR2GRAY)
            else:
                screen_gray = screen

            # 模板匹配核心：归一化相关系数匹配法(NORMED)
            result = cv2.matchTemplate(screen_gray, template, cv2.TM_CCOEFF_NORMED)
            min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

            logger.debug("[图像识别] 匹配 %s | 置信度: %.3f | 尝试: %d/%d",
                         template_name, max_val, attempt, self.max_retry)

            if max_val >= self.confidence:
                # 计算模板中心点坐标
                h, w = template.shape[:2]
                center_x = max_loc[0] + w // 2
                center_y = max_loc[1] + h // 2
                logger.info("[图像识别] 匹配成功 %s | 坐标: (%d, %d) | 置信度: %.3f",
                            template_name, center_x, center_y, max_val)
                return (center_x, center_y)

            # 匹配失败，记录截图并等待重试
            if attempt < self.max_retry:
                logger.warning("[图像识别] 匹配 %s 置信度 %.3f 低于阈值 %.2f，等待重试...",
                               template_name, max_val, self.confidence)
                time.sleep(self.retry_interval)

        # 全部重试失败
        logger.error("[图像识别] 匹配 %s 最终失败，已达最大重试次数 %d", template_name, self.max_retry)
        # 自动保存失败截图
        raw_screenshot = get_device().screenshot()
        if raw_screenshot:
            from logger import get_logger as gl
            gl().save_fail_screenshot(raw_screenshot, reason=f"匹配失败_{template_name}")
        return None

    def find_all(self, template_name: str, screenshot: Optional[np.ndarray] = None) -> List[Tuple[int, int]]:
        """
        多目标模板匹配：查找屏幕上所有匹配区域，返回中心点坐标列表
        用途: 同时识别多个相同图标（如多个资源红点）
        :param template_name: 模板文件名
        :param screenshot: 预处理的屏幕截图，为None则自动截取
        :return: 匹配到的中心坐标列表（按x坐标排序）
        """
        logger = get_logger()
        template = self._load_template(template_name)
        if template is None:
            return []

        screen = screenshot if screenshot is not None else self.capture_screen()
        if screen is None:
            return []

        # 统一灰度
        if len(template.shape) == 2 and len(screen.shape) == 3:
            screen_gray = cv2.cvtColor(screen, cv2.COLOR_BGR2GRAY)
        else:
            screen_gray = screen

        result = cv2.matchTemplate(screen_gray, template, cv2.TM_CCOEFF_NORMED)
        h, w = template.shape[:2]

        # 使用阈值获取所有可能匹配点
        loc = np.where(result >= self.confidence)
        points = list(zip(*loc[::-1]))  # (x, y)列表

        # 非极大值抑制：合并距离相近的匹配点，避免重叠检测
        merged: List[Tuple[int, int]] = []
        for pt in points:
            cx, cy = pt[0] + w // 2, pt[1] + h // 2
            too_close = False
            for existing in merged:
                if abs(existing[0] - cx) < w and abs(existing[1] - cy) < h:
                    too_close = True
                    break
            if not too_close:
                merged.append((cx, cy))

        merged.sort(key=lambda p: p[0])  # 按x坐标排序，便于从左到右处理
        logger.info("[图像识别] 多目标匹配 %s | 找到 %d 个目标", template_name, len(merged))
        return merged

    def find_with_mask(self, template_name: str, mask_name: str,
                       screenshot: Optional[np.ndarray] = None) -> Optional[Tuple[int, int]]:
        """
        带掩码的模板匹配：忽略模板中掩码指定区域（黑色为忽略，白色为关注）
        用途: 屏蔽动态变化区域（如数字、动画）以提高匹配稳定性
        :param template_name: 模板文件名
        :param mask_name: 掩码图片文件名（同尺寸灰度图）
        :param screenshot: 预处理的屏幕截图
        :return: 匹配成功返回中心坐标，失败返回None
        """
        logger = get_logger()
        template = self._load_template(template_name)
        mask = self._load_template(mask_name)
        if template is None or mask is None:
            return None

        screen = screenshot if screenshot is not None else self.capture_screen()
        if screen is None:
            return None

        if len(template.shape) == 2 and len(screen.shape) == 3:
            screen_gray = cv2.cvtColor(screen, cv2.COLOR_BGR2GRAY)
        else:
            screen_gray = screen

        # OpenCV掩码匹配：mask参数必须是单通道
        if len(mask.shape) == 3:
            mask = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)

        result = cv2.matchTemplate(screen_gray, template, cv2.TM_CCOEFF_NORMED, mask=mask)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

        if max_val >= self.confidence:
            h, w = template.shape[:2]
            center = (max_loc[0] + w // 2, max_loc[1] + h // 2)
            logger.info("[图像识别] 掩码匹配成功 %s | 坐标: %s | 置信度: %.3f",
                        template_name, center, max_val)
            return center
        else:
            logger.warning("[图像识别] 掩码匹配 %s 失败，置信度: %.3f", template_name, max_val)
            return None

    def check_exist(self, template_name: str, screenshot: Optional[np.ndarray] = None) -> bool:
        """
        快速检测模板是否存在（不关心坐标，只返回布尔值）
        用途: 判断某个UI元素/弹窗是否出现
        :param template_name: 模板文件名
        :param screenshot: 预处理的屏幕截图
        :return: 存在返回True
        """
        return self.find(template_name, screenshot) is not None

    def wait_for(self, template_name: str, timeout: int = 10, interval: float = 0.5) -> Optional[Tuple[int, int]]:
        """
        阻塞等待模板出现，直到超时
        用途: 等待页面加载完成、等待弹窗弹出
        :param template_name: 模板文件名
        :param timeout: 最大等待时间(秒)
        :param interval: 轮询间隔(秒)
        :return: 出现则返回坐标，超时返回None
        """
        logger = get_logger()
        start = time.time()
        while time.time() - start < timeout:
            pos = self.find(template_name)
            if pos is not None:
                return pos
            time.sleep(interval)
        logger.warning("[图像识别] 等待 %s 超时 (%d秒)", template_name, timeout)
        return None


# 全局图像识别器单例
_global_recognizer: ImageRecognizer | None = None


def init_recognizer(config: dict) -> ImageRecognizer:
    """
    初始化全局图像识别器单例
    :param config: 配置字典，需包含image节点
    :return: ImageRecognizer实例
    """
    global _global_recognizer
    img_cfg = config.get("image", {})
    _global_recognizer = ImageRecognizer(
        template_dir=img_cfg.get("template_dir", "templates"),
        confidence=img_cfg.get("confidence_threshold", 0.75),
        grayscale=img_cfg.get("grayscale", True),
        gaussian_blur=img_cfg.get("gaussian_blur", True),
        max_retry=img_cfg.get("max_retry", 3),
        retry_interval=img_cfg.get("retry_interval", 1.0)
    )
    return _global_recognizer


def get_recognizer() -> ImageRecognizer:
    """
    获取全局图像识别器实例
    :return: ImageRecognizer实例
    """
    if _global_recognizer is None:
        raise RuntimeError("图像识别器尚未初始化，请先调用init_recognizer()")
    return _global_recognizer
