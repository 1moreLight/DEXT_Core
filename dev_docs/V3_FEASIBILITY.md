# v3 可行性复核、构建难度与预计问题

> 2026-09-25，研究阶段。代码基线：`cca4391`，结合当前工作区只读核查。本文补充 [V3_IDEAS.md](V3_IDEAS.md) 与 [V2_TO_V3_TODO.md](V2_TO_V3_TODO.md)，不表示实施开工。证据来自仓库代码、微软官方接口/示例、Web 平台文档；未运行原生 Dock 原型。难度与工时均为工程判断，不是性能实测或交付承诺。

## 1. 总体判断

核心方向可行：作者以 HTML 创作，Dext 管理作品、用户绑定、权限和 Windows 窗口。现有运行时、能力桥和离线加载可以复用。主要工作集中在多实例状态、输入边界、Windows 窗口行为和创作工具的一致性；删除重建旧 Room 只省去数据迁移，不能省去这些工作。

汽车仪表盘在两个 Desk 间保持形状、切换数据，技术风险相对低。原生 Dock 的焦点、全屏抑制、多屏/DPI 组合风险较高。用户进一步澄清：透明区域能点到下方软件并非必须体验；此前把“点击穿透”列为首轮门槛，是从仪表盘的不规则外形作出的过度推断。首轮可用包住 Dock 的矩形窗口；若矩形遮挡实际操作，再缩小或拆成几块窗口。点击穿透只作为可选增强评估。

## 2. 对上一轮方案的复核与修正

### 2.1 覆盖检测已有基础，但不能直接当游戏检测

[WindowUtil.IsDisplayCoveredByWindow](../lively-core-separation/src/Lively/Lively.Common/Helpers/WindowUtil.cs)第 71 行直接返回 `IsZoomed(hwnd) || IsWindowCoveringTarget(...)`。[Playback.EvaluatePlaybackByForegroundWindow](../lively-core-separation/src/Lively/Lively/Core/Suspend/Playback.cs)第 155 行使用显示器 `WorkingArea` 检测覆盖。因此普通最大化窗口也会触发壁纸暂停；这个布尔值不能直接变成 Dock 隐藏开关。

同文件 `EvaluatePlaybackByGameMode()` 已调用 `SHQueryUserNotificationState`，只在 `QUNS_RUNNING_D3D_FULL_SCREEN` 时暂停。官方定义把该状态限定为独占 Direct3D 全屏；`QUNS_BUSY` 还包含全屏应用和演示设置。这不能证明应用是游戏，也不覆盖所有无边框、Vulkan/OpenGL 情形。[枚举定义](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/ne-shellapi-query_user_notification_state)

拟改方式：提取只读窗口事实快照，包含前台 HWND、显示器、标准最大化标记、边界、Shell 通知与用户规则；分别由壁纸播放策略、Dock 可见性策略消费。现有 Playback 注释明确说明因位置事件噪声/可靠性采用定时检测，上一轮“用 WinEventHook”应降为候选：前台事件加速响应，低频复核补漏，避免直接替换现有暂停逻辑。Dock 抑制时取消正在等待的展开计时器，恢复时重新取状态，防止旧悬停回调在游戏中展开。

### 2.2 全屏时隐藏，不等于必须撤销 AppBar 占位

微软要求 AppBar 在 `ABN_FULLSCREENAPP` 打开时降低 Z 顺序；文档没有要求每次全屏都注销 AppBar。[AppBar 文档](https://learn.microsoft.com/en-us/windows/win32/shell/application-desktop-toolbars)

因此修正为：第一版实验先隐藏 Dock/触发条并保留注册，观察真正全屏是否已覆盖整屏；只有实际游戏受工作区影响时，再比较临时释放占位。频繁 `ABM_REMOVE/NEW` 会引入其他最大化窗口跳动、位置通知循环以及恢复次序问题。普通最大化继续受保留区约束是真正想要的行为；应用自行设置的窗口尺寸、F11 和独占全屏不能一概套用“自动避让”。

自动隐藏模式的“铺满”应解释为 **Dext 不额外占用工作区**；Windows 自己的常驻任务栏和其他 AppBar 仍可能扣除屏幕空间，不能承诺自动隐藏 Dext 就会隐藏系统任务栏。

### 2.3 透明外观、点击穿透、毛玻璃是三项不同能力

目前只需验证符合作品的透明外观与可用的按钮；下表保留点击穿透的技术解释，供将来确实需要时使用。HTML 作品在桌面内部留出的“透明空隙可放图标”与顶层 Dock 把鼠标交给其他软件，是两种不同的输入边界。

| 能力 | 已有证据 | 不能据此承诺的效果 |
|---|---|---|
| HTML 背景透明 | Player 设置 `DefaultBackgroundColor=Transparent` | 原生顶层窗一定透出其他软件、一定允许点击下层 |
| 原生分层窗透明命中 | Windows 支持按窗口透明度/形状命中 | HTML 像素透明度自动等于整个 HWND 的命中形状 |
| `HTTRANSPARENT` | 官方描述继续查询同线程下方窗口 | 不能把它当成向任意其他进程点透的通用保证 |
| `AllowHostInputProcessing` | WebView2 让宿主先处理浏览器输入 | 不是让鼠标穿过整个应用去点下方软件 |
| CSS `backdrop-filter` | 在网页绘制范围内处理背景 | 不能由 CSS 直接模糊其他应用窗口 |

依据：[窗口命中](https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-nchittest)、[WebView2 输入处理](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/winrt/microsoft_web_webview2_core/corewebview2controlleroptions)、[CSS 背景滤镜](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)。原生桌面毛玻璃属于宿主材质能力，可另外研究 Desktop Acrylic；现有 WinForms Player 没有因此自动获得 WinUI 的材料 API。[Windows 材质](https://learn.microsoft.com/en-us/windows/apps/develop/ui/materials)

建议实验顺序：先矩形 HTML 窗与按钮；再做作品需要的透明外观、半透明和阴影。只有矩形窗口挡住用户实际需要操作的下方软件时，再比较缩小/拆分窗口与局部点透。`SetWindowRgn` 是有限形状的可选方案，但它也裁剪绘制，不能把“按钮命中区”直接拿去裁剪整个带光晕的作品。[窗口区域 API](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowrgn)

如果后续确实需要复杂局部点透，CompositionController 是更可控的候选，并非已证明更简单的替换。微软提供组合宿主示例；改用它还要处理鼠标捕获、移出窗口释放、滚轮、光标和焦点。[官方示例](https://github.com/MicrosoftEdge/WebView2Samples)。微软反馈仓库近期有组合模式拖出释放后失去交互的作者复现报告，尚不能据此认定普遍缺陷，但可加入可选试验的压力场景。[报告 #5712](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5712)

### 2.4 不能将普通网页按钮的声明当成可信用户手势

`event.source`、实例 token 与权限检查能识别请求实例，不能证明用户刚才真的点了按钮。作者脚本可以自行发消息，包括伪造 `{isTrusted:true}` 字段。上一轮“校验 iframe 来源即可核验点击”的表述不充分。

现有 [mountTrustedHotspots](../wallpapers/dext-room/main.js)由官方父页创建按钮，并检查父页收到的 DOM `event.isTrusted`，这是可复用的输入边界。v3 启动/切页可继续由作者声明动作、宿主受信任命中层接收真实操作；若需要完全自由的 HTML 交互，须单独设计宿主发放、短期一次性、绑定实例/动作的输入凭据。Core 无法从任意网页 JSON 直接还原可信手势，也不能让特殊 Dock 的能力通过共享 JS 上下文泄漏给普通 Widget。

SDK 应让作者用简单的元素/动作声明获得按钮行为，避免要求 AI 自己处理安全协议。拖拽、滑块、表单与键盘无障碍比单击按钮复杂，应分别验证，不能假定一个透明按钮覆盖层满足所有交互。

### 2.5 v2 授权指纹不是整份作品内容版本

[Core.LoadCurrentPermissionGrants](../lively-core-separation/src/Lively/Lively/Core/Wallpapers/WebWebView2.cs)对源 `room.json` 字节求 SHA-256；[Rust.permission_reviews_for_room](../tauri-ui/src-tauri/src/lib.rs)也使用清单字节指纹。这里没有对 HTML/JS/CSS 资源整体求哈希，因而同路径修改脚本未必改变该指纹；相反，普通布局改写 room.json 就可能使现有授权失效。

v3 需要明确安装内容版本、能力集合与用户授权的关联。建议安装时计算规范化清单和可执行资源的内容摘要，运行加载与摘要对应的稳定快照；本机绑定/待办/图标坐标另存。创作热刷新只提供模拟能力，正式应用修改后的作品时再按变更策略审阅。不能一边按源文件验证，一边执行已经被更改的另一份安装文件。是否所有素材变化都要求重审、CSS 修改是否保留授权，要另行定规则；本轮没有断言已有可利用漏洞。

### 2.6 HTML 层统一后，还要解决输入与数据存储

当前 [style.css](../wallpapers/dext-room/style.css)让背景 iframe `pointer-events:none`，Widget 的矩形容器重新允许输入。新增铺满屏幕的 Room iframe 若整体接收输入，会挡住 Desk/图标；若整体禁止输入，作者的按钮、待办输入框又不能工作。空白像素不会自动变成跨 iframe 的点击洞。

建议把装饰层、需要真实交互的组件和官方图标层分清；稀疏按钮用受控命中层，富交互区域使用有明确边界的组件 iframe。只有验证输入映射可靠后再扩大任意全屏交互能力。占用区、交互区、原生窗绘制区、Windows 工作区是四份不同语义的数据。

**P2a 2026-09-29 原型结果：**`experimentalContinuousScene` 仅作为测试 Room 字段，在现有 Player 页面挂一个有边界的沙箱 iframe；Desk 切换时保持文档和实例身份，官方图标层只让图标自身接收指针。浏览器 2/2 和 Release WebView2 隔离 Player 验证了跨两次切页不重载、官方图标更新、1280×800 且 Player scale 1.25 下按 1920×1080 画布比例映射矩形；原生输入旧 Room 拖动回归 10/10。占用矩形已用于图标偏好重排、图标拖放和 Widget 移动冲突回退。该测试字段不属于 v2 发布 Schema，不能走配置器普通 Room 导入；真实 WorkerW 物理鼠标和不同系统 DPI 仍需验收卡中的临时包测试，不以隔离 Player 结果代替。

`sandbox="allow-scripts"` 不带 `allow-same-origin` 时是特殊 origin，不能依赖普通 localStorage/IndexedDB 作为待办存储；同源父子同时放开 scripts 与 same-origin 又会削弱隔离。[iframe 文档](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)。建议提供按作品/组件命名空间隔离的宿主存储能力，限制键值大小、写入频率并定义备份/卸载语义；包导出不携带用户数据。

### 2.7 “键盘可用”与“系统全局快捷键”不同

[WinDesktopCore.RawInput_KeyboardClickRaw](../lively-core-separation/src/Lively/Lively/Core/WinDesktopCore.cs)第 1195 行只在 `mousekeyboard` 模式且 `IsDesktop()` 时转发；renderer 接到方向键后切 Desk。现有代码不能证明用户在任意软件中按键都可切页。

如果只要求回到桌面后用键盘，延用现有边界即可；如果需要全局组合键，新增 Core `RegisterHotKey/WM_HOTKEY` 到受控切页命令，处理被其他程序占用、按住重复与全屏游戏抑制。具体快捷键和全局范围仍是产品选择。[RegisterHotKey](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey)

## 3. 构建与集成成本

当前 Core 是 `net9.0-windows10.0.18362.0` WPF；[Player 项目](../lively-core-separation/src/Lively/Lively.Player.WebView2/Lively.Player.WebView2.csproj)是 .NET Framework 4.7.2 WinForms，WebView2 SDK `1.0.3595.46`。所以“增加原生窗口”可先保持现有 WinForms/IPC 结构做实验；选择 WPF 组合控件或 C++ DirectComposition 后，项目引用、目标框架、发布目录、运行身份及启动脚本都要对应处理。不能因为 Core 是 .NET 9 就把 Player 当成同一框架。

SDK 版本与本机 WebView2 Runtime 版本也不同；本轮没有检测运行时版本。候选 API 要确认项目 SDK 中存在、目标 Runtime 支持，并记录失败回退。[Runtime 部署模型](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version)

| 子项 | 难度 | 可复用基础 | 主要新增成本 | 粗估有效开发日 |
|---|---|---|---|---|
| 关键原生/HTML 实验 | 中高 | Player、能力桥 | 顶层按钮输入、AppBar、实例生命周期的可重复验证 | 2–4 |
| v3 契约与安装/导入/分享 | 中高 | Rust 校验、Creator Pack | 所有读写链同步升级、稳定安装快照、资源规则 | 4–7 |
| Room/Desk 常驻层与跨窗状态 | 中高 | mount/dispose、Desk 通知 | 单一状态拥有者、revision、恢复、过渡取消 | 4–7 |
| 动态占用区与普通 Widget 避让 | 中高 | 图标几何与拖动事务 | 共用坐标、布局回馈循环、无空位回退 | 4–7 |
| 应用绑定/动作/授权/用户存储 | 高 | 当前授权与 Core 服务 | 绑定 ID、可信输入、内容版本、存储边界 | 5–9 |
| 主屏原生 Dock 两模式 | 高 | Core 子进程/显示器工具 | AppBar、触边、全屏抑制、焦点、清理恢复 | 4–8 |
| AI 创作试验台与诊断 | 中高 | 预览/Creator | 同源协议模拟、错误定位、多尺寸、刷新 | 4–7 |
| 全链集成与真实使用回归 | 高 | 现有测试工具 | 系统事件交错、构建发布、性能/输入回归 | 5–9 |

以上假设单人熟悉仓库、AI 辅助编码、以主屏和两份样板作品为首轮范围，**不要求跨窗口点击穿透**，约 **32–58 个有效开发日**；不含反复设计、等待验收、任意第三方作品兼容、多屏完整支持、游戏 HUD 或云服务。不同项有交叉，区间只用于判断规模；关键实验之后应重新估算。若只做可展示的汽车仪表盘原型，所需明显少于完整 v3，不能用演示原型工时推算可长期使用的产品。

## 4. 最可能遇到的问题与控制办法

| 触发情况 | 预计问题 | 设计/验证办法 |
|---|---|---|
| Desk 切换时壁纸被暂停，Dock 仍显示 | Dock 数据停更或页码不同步 | Core 持有 Room/Desk 版本化状态；数据订阅按可见消费者管理，不把 Dock 绑定到壁纸暂停状态 |
| HTML 改尺寸后上报占用区，宿主避让又改尺寸 | 布局来回抖动、消息洪泛 | 一次布局事务使用同一 viewport revision；去重/限频；装饰动画不每帧改放置障碍 |
| 同一应用在全局/Desk 列表重复 | 图标顺序或启动标记不一致 | 由单一绑定计算函数产生展示列表；规则待决定 |
| Player 升为顶层，仍复用壁纸输入转发 | 双击/拖动重复或抓错窗口 | Dock 用原生窗口正常输入；WorkerW RawInput 转发只作用于壁纸角色 |
| 自动展开或 Dock 获得键盘焦点 | 原软件失焦，TODO 无法输入，IME 异常 | 区分悬停展示不激活与用户主动进入输入；`SWP_NOACTIVATE` 不代表所有后续点击都不激活 |
| AppBar/任务栏位置改变 | 反复协商、占位厚度漂移 | 比较新旧矩形、控制重入；按目标显示器工作区实测；不全局篡改 SPI_SETWORKAREA |
| Explorer 重启、睡眠恢复、拔屏、Core/Player 崩溃 | 旧 HWND/占位/触发条残留或重复实例 | 明确谁拥有 HWND 与 AppBar 注册；恢复时核查旧实例并幂等重建；不要假定正常退出清理覆盖崩溃 |
| AI 生成 CDN、远程字体、fetch、本地存储 | 预览可用但正式离线/沙箱失败 | Creator 模板约束离线资源、明确存储 API、提供缺资源与被拒能力诊断 |
| 跨进程 Dock 与 Room 重载 | 旧请求落到新作品、新 Desk | 请求绑定安装版本、实例与 revision；销毁撤销授权/订阅/区域；命令需结果应答 |
| 多个 WebView/组件常驻 | GPU、内存、动画和采样负担增加 | 记录基线与增量；共享采样并裁剪订阅，隐藏时降频；不要把每个 iframe 等同独立进程或假定零成本 |

WebView2 本身采用多进程模型，实例与浏览器进程的关系受环境/用户数据目录影响；需要在选定宿主后测量，不能预先承诺固定内存或 CPU 数字。[进程模型](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model)

现有 `TrackLaunchedApp/MonitorLaunchedApp` 只跟踪经当前链发起的目标，不能据此声称已具备完整 Windows 任务栏的窗口枚举、分组、激活和缩略图能力。本轮用户明确的“类似任务栏”要求是占位与隐藏；若将来要完整任务管理，另算工作量。

## 5. 收敛顺序与人工判定

1. 用一个主屏、一个 Dock、两页仪表盘验证：普通最大化可触边；常驻模式能避让；全屏游戏不唤出；退出恢复。先不加原生毛玻璃和复杂窗形动画。
2. 验证按钮单次触发、焦点/IME，以及矩形窗口是否遮挡下方的实际操作。优先试现有 WinForms WebView2；遇到实测限制再比较缩小/拆分窗口或其他宿主。透明空隙点到下方软件作为可选实验，不是首轮验收条件。
3. 验证常驻层不重建、Desk 状态同步、占用区对普通 Widget 和图标都生效；在不同 DPI 下对齐显示与命中。
4. 冻结 v3 契约、绑定/授权/用户存储；让同一作品走完导入、试验台、正式应用、重新启动、导出。
5. 核对新增研究未替用户作产品决定：全局快捷键、F11 行为、普通 Widget 编辑位置、原生材质范围、重复应用规则仍保留选择空间。

本轮文档复核可以确认方向、API 限制与代码改造入口；透明交互兼容性、全屏误判率、恢复行为和性能必须依靠后续原生原型与真实使用记录才能判定。
