# 03 完整构建和桌面验证
状态：开做
要做：游戏结束后先build.ps1再start.ps1；实际悬停预览、跨窗点击、多窗口分页、关闭源窗口及全屏恢复。
完成条件：完整Release成功、桌面证据记录、提交供交付；不把源码检查写成运行通过。
接手：分支feat/V3-P8-004-window-preview；当前运行候选仍是P8-003，不能声称当前桌面已含预览。

2026-10-09：只读进程检查确认ZenlessZoneZero.exe已退出；开始独立候选Release构建。配置器未改，复用P8-003已验证二进制；Core/Player/Watchdog从本分支重新构建。
### 输入回归优先（用户睡前要求）
先用受控窗口验证原有点击，区分全屏隐藏与真实输入故障；不因工具枚举失败修改已验证点击路径。
受控UI测试需要足够观察时间，将原fixture自动退出时间作为显式可选参数提供，默认30秒保持。

### 2026-10-09 23:55 运行证据与交接
- 完整Core/Player/Watchdog Release成功，日志：D:\use\Orca\DEXT\DEXT_Core\.build\dock-preview-build.log。
- scripts/start.ps1已启动独立候选 D:\use\Orca\DEXT\DEXT_Core\.build\v3-dock-preview-20261009；Core PID42292、配置器PID3804（PID只作当时证据，接手需重新核对路径）。配置器无代码修改，复用P8-003验证产物。
- 原P8-003候选 v3-app-taskbar-ready-20261009 完整保留作为回退基线。
- 实际Core状态 enabled=True、pins=0、groups=12、error为空；原生只读枚举确认“Dext 系统应用 Dock”可见。不是工具枚举缺项就等于Dock消失。
- Orca运行已恢复，但其应用列表不收录仅有工具窗口的Core；不能完成真实悬停/预览点击。未为自动化更改产品窗口样式或桌面输入路径。
- 源码编译与8项几何检查不能替代DWM合成、悬停保持、点击切换的实机证据，仍保持开做/67%。
- 用户要求无需提问，遇验收边界先做diff验收/设计建议；已转代码审查。
- 用户指定2026-10-10 00:59北京时间停止工作。到时保存当前状态并暂停目标；不擅自合并master。

23:57定向检查：DockPreview 8/8、ApplicationDock 10项模型/持久化和4项受控原生窗口检查通过。包含真实枚举、归组、最小化、关闭后拒绝旧窗口；不包含真实Dock按钮输入及DWM绘制。

候选包清单：release-inventory.json已生成，650项文件摘要；本分支声明的hostAssets与候选逐项摘要一致。Core源码4999890，配置器复用已验证P8-003产物，清单明确记录来源。
补充设计建议05已做完；diff审查04开做。工作包仍67%，未合并。

### 受控预览交互补证计划
状态：开做。通过测试项目链接同一生产Dock/预览源码，添加普通观察窗口供自动化发现。仅枚举受控fixture进程，点击仍调用真实DockWindows.Perform；不更改产品窗口样式、不调整旧桌面输入。该证据只覆盖受控独立宿主，不能替代用户正式桌面验收。

受控宿主结果：普通观察窗口成功出现在Orca列表，生产同款Dock工具窗口仍被过滤，指定真实HWND也返回windowNotFound。未改产品样式绕过工具限制。测试进程已结束，实际Core Dock已恢复enabled=True，pins=0，error为空。
测试入口：Dext.DockPreview.Tests.exe --interactive-preview <fixture PID>；仅对给定测试PID展示生产Dock/预览，五分钟自动结束，无固定/启动功能，不能作为完整Core集成证明。正式鼠标/触屏及预览仍待验收。

修复版运行目录：D:\use\Orca\DEXT\DEXT_Core\.build\v3-dock-preview-reviewed-20261010；Core PID43892（只代表此次启动），源码1137ec5；start.ps1身份核对成功。上方4999890候选运行信息为历史。
