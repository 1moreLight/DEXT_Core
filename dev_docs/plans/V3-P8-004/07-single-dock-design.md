# 07 同屏单Dock与任务栏协调设计
状态：做完
类型：设计建议；不改变当前运行偏好，不属于本包已实现能力。
目标：把P8-003应用任务能力与原P8主题Dock的显示/占位策略连接起来，回到V3_PLAN第35行的同屏单一独立Dock要求。

## 代码事实
| 能力 | 当前实现 | 当前边界 |
|---|---|---|
| 主题Dock生命周期 | Core/Dext/RoomSessionRuntimeCoordinator.Dock.cs | 从当前Room的dockComponentId和Desk引用决定是否创建WebView2 Dock Player |
| 主题Dock偏好 | Core/Dext/RoomDockPreferences.cs | enabled、mode、heightDip；独立保存dock-preferences.json |
| 自动隐藏/占位 | Player.WebView2/DextDockWindowHost.cs | 管理原生窗口、DPI、AppBar注册和真实工作区确认 |
| Windows任务栏还原 | Core/Dext/RoomDockTaskbarGuard.cs | 基于Core/Dock进程身份、租约和Watchdog持久记录恢复 |
| 应用任务列表/点击 | Services/ApplicationDock/ApplicationDockService.cs | Core WPF窗口；独立application-dock.json，只含enabled/pins |
| 应用Dock位置 | Services/ApplicationDock/ApplicationDockWindow.cs | 直接读取SystemParameters.WorkArea；不注册AppBar |
| 设置界面 | tauri-ui/src/components/V3DockSettings.tsx | 系统应用Dock面板和“原生Dock”面板并列，各有独立开关 |

以上路径的C#部分均相对lively-core-separation/src/Lively/；Core文件位于Lively目录。

## 已识别的整合缺口
两个开关都开时，代码允许存在两条顶层Dock。应用Dock按已经扣过主题AppBar的工作区定位，可能再叠一层；这与最终同屏单Dock要求不同。当前分包验证可保留独立原型，不能据此宣称“真正任务栏整合完成”。
仅把应用Dock的Top设为屏幕底部，会绕过主题占位并覆盖任务栏；仅复用旧偏好文件，又不能让WPF窗口自动获得Player的AppBar生命周期。两者都不是完整接入。

## 建议实现顺序
### A 先建立唯一窗口所有者
Core协调器维护一个已确认的活动Dock宿主。宿主状态至少区分停止、启动中、可交互、全屏隐藏、故障；偏好保存成功不代表窗口可交互。
切换时先关闭旧宿主与预览、释放其占位/恢复任务栏，再启动新宿主；新宿主可交互并通过工作区检查后才能接管系统任务栏。失败时保持Windows任务栏可用，旧恢复记录不能提前丢弃。
此步允许先在两种呈现间切换，作为过渡。它不等于主题与应用任务已经合为一条。

### B 让应用任务成为同一条Dock的官方内容
保留现有Core应用枚举/身份核验/本机固定项；将运行任务模型与窗口呈现分开。主题定义可以指定官方应用区域的外观/位置，窗口列表与点击动作仍由官方宿主完成。
优先验证现有HTML Dock中官方应用区的输入手感，达到当前WPF已确认点击基线后再替换默认呈现。现有WPF版保留为回退，不能一次性删除已验证路径。
真正完成标准：一个主Dock HWND/占位所有者，同时能显示Room导航、固定应用和运行窗口，预览只作为该宿主的附属临时窗口。

### C 接回统一显示与恢复
自动隐藏、常驻占位、全屏、DPI/任务栏变化只由同一协调器/宿主管理。复用现有Watchdog恢复事实，明确应用宿主的退出也触发释放，不能只监听旧Player PID。
设置页显示“希望的模式”和“实际运行模式/失败原因”；Room导出只带主题区域和外观，不带私人固定列表或路径。

## 必要验收（后续独立包）
1. 分别从主题Dock和应用Dock入口切换，确认同屏只有一个主Dock；桌面内的作者按钮可以继续存在。
2. 单击启动、切前台、再次最小化，多窗口预览选择，与当前已验证版比较；增加/关闭窗口时按下不被刷新取消。
3. 普通最大化下两种模式符合设置；一个工作区占位；退出后恢复原工作区。
4. 进入/退出全屏，预览和菜单一起消失并可恢复，桌面和游戏输入没有残留遮挡。
5. 源宿主正常退出、崩溃、Explorer重启，任务栏/占位恢复可见；不得用RPC成功替代实际状态。
6. 分享Room后没有本机固定应用路径；无主题Room仍有系统应用Dock可选。

## 决策边界
本文件只提出实现路径，不修改PROJECT正式决策、不创建第二个“下一项”。当前P8-004仍先完成实机验收；ROADMAP唯一下一项保持集中验收续项。
