# V3-P8-003 系统应用 Dock 验收
状态：待用户验收；步骤 3/4=75%；基线 halfV3；分支 feat/V3-P8-003-app-taskbar。
规划索引：../plans/V3-P8-003-app-taskbar.md（每步独立文件，待做/开做/做完）。
候选版：D:\use\Orca\DEXT\DEXT_Core\.build\v3-app-taskbar-ready-20261009\start-dext.cmd

## 人工步骤
1. 配置器“设置 → 系统应用 Dock”固定一个应用；关闭配置器后 Dock 仍显示，未打开的固定应用可单击启动。
2. 打开应用窗口后出现运行标记；单击切到该窗口，再点前台单窗口应用最小化。多个窗口能选择具体窗口，关闭后列表更新。
3. 取消固定后未运行应用消失，正在运行应用保留；正常退出并重启 Core 后固定项/顺序/启用偏好恢复。
4. 最大化/全屏后退出，Dock 恢复且不抢焦点；关闭系统应用 Dock 后原任务栏和桌面可用。

## 自动与实际证据（2026-10-09）
- Dext.ApplicationDock.Tests：10项模型/保存检查 + 4项真实受控窗口检查通过。
- scripts/build.ps1：Core/Player/Watchdog Release 通过；完整 build-v3-release.ps1 含 Tauri Release 通过。
- 最终鼠标按下/抬起保护调整后 Core Release 重建并经 start.ps1 重启。
- RuntimeProbe 对实际候选 Core 的 pin/enable/unpin 通过；enabled=True 经正常退出/重启恢复；Core PID35264，身份/绝对路径正确，7个真实应用组，无Dock状态错误。
- 自动点击工具不可用：Orca runtime_unavailable；bundled node_repl apply deny-read ACLs 初始化失败。因此上述4步尚需用户真实操作。
- 当前已启用应用Dock、固定项为空，未更改用户Room清单。

## 范围与已知限制
首版主屏工作区底部独立应用Dock，窗口清单500ms更新；固定项按程序路径归组，同一程序不同启动参数不拆成独立图标。
缩略图、Jump List、系统托盘协议、鱼眼动画及系统应用Dock自身AppBar占位待后续。既有Room导航Dock仍独立。
提交仅表示阶段实现完成；用户验收前不合并。

### 补充运行证据（2026-10-09）
RuntimeProbe restart-probe：实际Core正常退出/重启后，完整固定列表及顺序、启用状态一致；测试项清理后pins=0、enabled=True。新Core PID37308。
此证据补齐第3步的运行时保存部分，不替代取消固定后的视觉表现及其他鼠标验收。

### 用户截图：实际呈现
2026-10-09 用户截图显示深色应用Dock、图标和运行标记，与Windows任务栏同时存在。确认原生Dock已实际显示；用户本轮询问来源，未表示交互验收通过。交互缺项仍保留。
