# 《无尽冬日》模拟器自动化脚本

> **声明**: 本项目仅用于编程技术学习与交流，严格遵循图像模板匹配 + ADB模拟键鼠的底层操作方式，禁止内存读写、进程注入、修改游戏数据等破坏游戏公平性的行为。使用本脚本产生的任何后果由使用者自行承担。

---

## 一、依赖安装命令

**环境要求**: Python 3.11+，Windows 10/11

**安装步骤**:

```powershell
# Step1: 克隆或下载本项目到本地
# Step2: 进入项目目录
cd d:\无尽冬日脚本

# Step3: 安装Python依赖
pip install -r requirements.txt

# Step4: 确认ADB已添加到系统环境变量（见下方教程）
```

**核心依赖说明**:

| 包名 | 版本 | 用途 |
|------|------|------|
| opencv-python | >=4.8.0 | 图像模板匹配核心 |
| numpy | >=1.24.0 | 数值计算与数组操作 |
| PyYAML | >=6.0.1 | YAML配置文件解析 |
| Pillow | >=10.0.0 | 图像格式转换辅助 |
| psutil | >=5.9.0 | 进程检测与系统监控 |

---

## 二、项目目录结构

```
无尽冬日脚本/
├── config.yaml                 # 全局配置文件（循环间隔、ADB端口、识别阈值等）
├── requirements.txt            # Python依赖清单
├── main.py                     # 主调度程序入口（运行: python main.py）
├── gui.py                      # tkinter可视化任务选择面板
├── logger.py                   # 全局日志系统（分级日志+失败截图）
├── state_machine.py            # 状态机调度器（空闲/采集/战斗/领奖/休眠）
├── adb_utils.py                # ADB工具封装类（截图/点击/滑动/按键）
├── image_utils.py              # OpenCV图像识别封装（模板匹配/多目标检测）
├── gui_config.json             # GUI勾选状态自动保存文件（自动创建）
├── README.md                   # 本文件
│
├── tasks/                      # 8个独立任务模块（全部解耦）
│   ├── __init__.py
│   ├── city_resources.py       # 1.主城资源收取（木材/食物/铁矿/燃油）
│   ├── mail_reward.py          # 2.邮件奖励领取（钻石/加速/道具）
│   ├── daily_activity.py       # 3.每日活跃度任务（完成日常领宝箱）
│   ├── expedition.py           # 4.探险自动战斗（推图+拾取宝箱）
│   ├── wild_elite.py           # 5.野外精英巡逻（找怪+开战+拾掉落）
│   ├── alliance_welfare.py     # 6.联盟福利领取（礼包/情报/贡献）
│   ├── popup_cleaner.py        # 7.弹窗自动清理（广告/升级/提示）
│   └── error_handler.py        # 8.异常容错处理（黑屏/掉线/重启）
│
├── templates/                  # 图像模板存放目录（用户自行放置截图）
└── logs/                       # 日志与失败截图自动保存目录
    ├── bot_YYYYMMDD.log        # 按日期命名的运行日志
    ├── fails/                  # 识别失败自动截图
    └── debug/                  # 调试截图
```

---

## 三、模拟器ADB开启教程

### 3.1 雷电模拟器（推荐）

1. **开启ADB调试**: 打开雷电模拟器 -> 设置 -> 关于手机 -> 连续点击"版本号"7次开启开发者模式 -> 返回设置 -> 系统 -> 开发者选项 -> 开启"USB调试"
2. **确认分辨率**: 设置为 `1280x720`（脚本适配此分辨率）
3. **ADB端口**: 雷电默认 `5555`，若多开则依次为 `5555, 5557, 5559...`
4. **ADB连接测试**: 打开CMD/PowerShell执行:
   ```powershell
   adb connect 127.0.0.1:5555
   adb devices
   ```
   若显示 `emulator-5554 device` 或 `127.0.0.1:5555 device`，表示连接成功。

### 3.2 木木模拟器（MuMu）

1. **开启ADB调试**: 设置 -> 关于手机 -> 连续点击版本号 -> 开发者选项 -> USB调试
2. **分辨率**: 设置为 `1280x720`
3. **ADB端口**: 木木默认 `7555`
4. **连接测试**:
   ```powershell
   adb connect 127.0.0.1:7555
   adb devices
   ```

### 3.3 常见问题

| 问题 | 解决方案 |
|------|----------|
| `adb不是内部或外部命令` | 将Android SDK的 `platform-tools` 目录添加到系统环境变量Path |
| `connection refused` | 确认模拟器已开启USB调试，或尝试更换ADB端口 |
| `offline` | 执行 `adb kill-server` 后重新 `adb start-server` |
| `unauthorized` | 在模拟器上确认允许USB调试授权弹窗 |

---

## 四、图像模板制作指南

脚本通过 **图像模板匹配** 识别游戏UI元素，你需要在 `templates/` 目录下放置对应的截图模板。

### 4.1 截图方法

```powershell
# 方法1: 使用ADB截图
adb -s 127.0.0.1:5555 shell screencap -p > screen.png

# 方法2: 点击GUI面板的"调试截图"按钮，自动保存到 logs/debug/
```

### 4.2 模板裁剪建议

1. 使用截图工具（如Windows自带截图、QQ截图、ShareX）截取目标UI元素
2. 模板尺寸建议 `40x40 ~ 120x120` 像素，不要过大
3. 模板背景尽量干净，避免包含动态文字/数字
4. 命名必须与代码中的常量一致（见下方模板清单）

### 4.3 模板文件清单

| 模板文件名 | 对应功能 | 建议截取位置 |
|-----------|---------|-------------|
| `resource_wood.png` | 木材资源红点 | 主城木材建筑上的红点 |
| `resource_food.png` | 食物资源红点 | 主城食物建筑上的红点 |
| `resource_iron.png` | 铁矿资源红点 | 主城铁矿建筑上的红点 |
| `resource_oil.png` | 燃油资源红点 | 主城燃油建筑上的红点 |
| `warehouse_full_close.png` | 仓库满仓弹窗关闭 | 弹窗右上角或底部关闭按钮 |
| `mail_icon.png` | 邮件图标 | 主界面顶部或侧边邮件图标 |
| `mail_all_reward.png` | 一键领取全部邮件 | 邮件面板内的一键领取按钮 |
| `mail_confirm.png` | 邮件领取确认 | 确认弹窗的确定按钮 |
| `mail_empty.png` | 邮箱为空提示 | 空邮箱时的提示文字或图标 |
| `mail_close.png` | 关闭邮件面板 | 邮件面板关闭按钮 |
| `daily_activity_icon.png` | 日常图标 | 主界面日常任务入口 |
| `daily_goto.png` | 前往完成按钮 | 日常列表中的"前往"按钮 |
| `daily_reward_box.png` | 活跃度宝箱 | 活跃度进度条上的宝箱图标 |
| `daily_claim.png` | 领取奖励按钮 | 宝箱弹窗中的领取按钮 |
| `daily_close.png` | 关闭日常面板 | 日常面板关闭按钮 |
| `expedition_icon.png` | 探险入口 | 主界面探险功能图标 |
| `expedition_challenge.png` | 挑战按钮 | 探险界面的挑战按钮 |
| `expedition_auto.png` | 自动战斗按钮 | 战斗界面的自动战斗开关 |
| `expedition_victory.png` | 胜利结算 | 战斗胜利后的结算画面标志 |
| `expedition_chest.png` | 通关宝箱 | 胜利后出现的宝箱图标 |
| `expedition_open.png` | 打开宝箱 | 宝箱弹窗的打开按钮 |
| `expedition_no_stamina.png` | 体力不足提示 | 体力不足时的提示弹窗 |
| `expedition_next.png` | 下一关按钮 | 结算界面的下一关按钮 |
| `expedition_close.png` | 关闭探险界面 | 探险界面关闭按钮 |
| `wild_map_icon.png` | 野外地图入口 | 主界面进入野外的按钮 |
| `wild_search.png` | 搜索野怪按钮 | 野外界面的搜索按钮 |
| `wild_elite_mark.png` | 精英怪标记 | 地图上精英怪的头像/标记 |
| `wild_attack.png` | 攻击按钮 | 选中野怪后的攻击按钮 |
| `wild_march.png` | 行军按钮 | 确认出兵的行军按钮 |
| `wild_battle_end.png` | 战斗结束 | 野外战斗结束的标志 |
| `wild_loot.png` | 掉落宝箱 | 战斗胜利后的掉落物 |
| `wild_back_city.png` | 返回主城 | 野外界面的返回按钮 |
| `alliance_icon.png` | 联盟入口 | 主界面联盟图标 |
| `alliance_gift_tab.png` | 联盟礼包标签 | 联盟界面的礼包标签页 |
| `alliance_gift_claim.png` | 领取礼包按钮 | 礼包列表的领取按钮 |
| `alliance_intel_tab.png` | 情报标签页 | 联盟情报标签 |
| `alliance_intel_claim.png` | 领取情报按钮 | 情报领取按钮 |
| `alliance_contrib_tab.png` | 贡献标签页 | 联盟贡献标签 |
| `alliance_contrib_claim.png` | 领取贡献奖励 | 贡献奖励领取按钮 |
| `alliance_close.png` | 关闭联盟面板 | 联盟界面关闭按钮 |
| `popup_activity_ad.png` | 活动广告弹窗 | 活动广告弹窗的关闭按钮 |
| `popup_hero_levelup.png` | 英雄升级弹窗 | 英雄升级提示的关闭按钮 |
| `popup_building_upgrade.png` | 建筑升级弹窗 | 建筑升级提示的关闭按钮 |
| `popup_battle_result.png` | 对战结果弹窗 | 对战结果的关闭按钮 |
| `popup_generic_close.png` | 通用关闭按钮 | 各类弹窗的X/关闭按钮 |
| `popup_confirm_ok.png` | 确认按钮 | 弹窗中的确定/OK按钮 |
| `error_disconnect.png` | 网络断开提示 | 网络异常提示画面 |
| `error_relogin.png` | 重新登录按钮 | 断线后的重新登录按钮 |
| `error_loading.png` | 游戏加载中 | 游戏加载界面的标志元素 |
| `error_maintenance.png` | 服务器维护 | 维护公告画面 |
| `normal_main_city.png` | 主城标志物 | 主城界面的标志性建筑/元素 |

---

## 五、调试排错指南

### 5.1 脚本无法启动

| 现象 | 排查步骤 |
|------|----------|
| `ModuleNotFoundError` | 执行 `pip install -r requirements.txt` 安装缺失依赖 |
| `配置文件不存在` | 确认 `config.yaml` 与 `main.py` 在同一目录 |
| GUI窗口闪退 | 检查Python版本是否为3.11+，tkinter是否正常 |

### 5.2 ADB连接问题

| 现象 | 排查步骤 |
|------|----------|
| `未检测到任何已连接设备` | 1. 确认模拟器已开启USB调试<br>2. 执行 `adb connect 127.0.0.1:5555`<br>3. 检查防火墙是否拦截ADB端口 |
| `截图命令失败` | 1. 执行 `adb devices` 确认设备在线<br>2. 尝试重启模拟器ADB服务 |
| `设备offline` | 执行 `adb kill-server && adb start-server` |

### 5.3 图像识别问题

| 现象 | 排查步骤 |
|------|----------|
| 模板匹配始终失败 | 1. 检查 `templates/` 目录下是否有对应图片<br>2. 确认模板分辨率与游戏截图一致<br>3. 降低 `config.yaml` 中的 `confidence_threshold`（如从0.75降到0.65） |
| 误识别/多识别 | 1. 提高 `confidence_threshold`（如从0.75升到0.85）<br>2. 裁剪更精确的模板，减少背景干扰 |
| 识别不稳定 | 1. 开启/关闭 `grayscale` 和 `gaussian_blur` 测试效果<br>2. 使用 `find_with_mask` 忽略动态区域 |

### 5.4 任务执行异常

| 现象 | 排查步骤 |
|------|----------|
| 任务执行一半卡住 | 1. 查看 `logs/bot_YYYYMMDD.log` 错误日志<br>2. 检查是否有未处理的弹窗阻塞<br>3. 启用 `popup_cleaner` 任务自动清理弹窗 |
| 任务间隔不生效 | 确认 `config.yaml` 中对应任务的 `interval` 配置正确（单位：秒） |
| 连续任务失败 | 查看 `logs/fails/` 目录下的失败截图，分析原因 |

---

## 六、识别精度调优方案

### 6.1 置信度阈值调优

`config.yaml` 中的 `confidence_threshold` 控制匹配严格程度：

- **0.60 ~ 0.70**: 宽松匹配，适合背景复杂但模板特征明显的场景
- **0.75 ~ 0.80**: 均衡设置，大多数情况推荐使用（默认0.75）
- **0.85 ~ 0.95**: 严格匹配，适合模板清晰、误识别代价高的场景

### 6.2 预处理开关调优

```yaml
image:
  grayscale: true      # 开启可降低颜色干扰，若模板依赖颜色则关闭
  gaussian_blur: true  # 开启可降噪，若模板本身模糊则关闭
```

### 6.3 重试机制调优

```yaml
image:
  max_retry: 3         # 识别失败重试次数，网络不稳定可增大到5
  retry_interval: 1.0  # 重试间隔(秒)，模拟器卡顿时可增大到2.0
```

### 6.4 坐标偏移调优

```yaml
anti_detect:
  click_offset: 8      # 点击偏移像素，过小易被检测，过大可能点错按钮
  swipe_offset: 12     # 滑动偏移像素
```

### 6.5 高级技巧：使用掩码匹配

对于包含动态数字/动画的UI元素，可制作掩码图片（与模板同尺寸的灰度图，黑色区域表示忽略）：

```python
# image_utils.py 已内置掩码匹配功能
recognizer.find_with_mask("template.png", "mask.png")
```

---

## 七、运行方式

```powershell
# 方式1: 直接运行（推荐）
python main.py

# 方式2: 后台运行（Windows）
pythonw main.py
```

启动后：
1. 在GUI面板中勾选要执行的任务
2. 点击 **"启动挂机"** 按钮
3. 观察右侧控制台实时日志输出
4. 需要停止时点击 **"停止挂机"** 或关闭窗口

---

## 八、更新日志

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-07-16 | 初始版本，完成8大任务模块+GUI面板+状态机调度 |

---

## 九、技术架构图

```
┌─────────────────────────────────────────────┐
│                tkinter GUI 面板               │
│   (任务勾选 / 启动停止 / 控制台 / 配置保存)     │
└──────────────────┬──────────────────────────┘
                   │ 勾选状态 + 控制信号
┌──────────────────▼──────────────────────────┐
│              main.py 主调度程序                │
│   (任务注册表 / 时间间隔调度 / 防检测休眠)       │
└──────────────────┬──────────────────────────┘
                   │ 任务分发
┌──────────────────▼──────────────────────────┐
│           tasks/ 8个独立任务模块               │
│  资源收取 / 邮件 / 活跃 / 探险 / 野外 / 联盟    │
│  弹窗清理 / 异常处理                           │
└──────────────────┬──────────────────────────┘
                   │ 状态切换请求
┌──────────────────▼──────────────────────────┐
│          state_machine.py 状态机              │
│   IDLE / COLLECT / BATTLE / REWARD / RECOVER  │
└──────────────────┬──────────────────────────┘
                   │ 调用
┌──────────────────▼──────────────────────────┐
│  image_utils.py  ←  OpenCV模板匹配 / 多目标检测 │
│       ↑                                      │
│  adb_utils.py    ←  ADB截图 / 点击 / 滑动 / 按键│
│       ↑                                      │
│  logger.py       ←  分级日志 / 失败截图        │
└─────────────────────────────────────────────┘
```

---

**再次声明**: 本脚本仅供编程学习与技术研究，请遵守游戏用户协议，合理控制挂机时长，避免对游戏服务器造成负担。
