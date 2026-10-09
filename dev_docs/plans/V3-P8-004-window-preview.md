# V3-P8-004 Dock 窗口预览
目标：悬停运行应用显示实时窗口缩略图，点击预览切换到对应窗口，多窗口可选择。
基线：V3-P8-003分支3a73235；依赖包待补实机证据，按用户“先往下写别的功能”继续，不合并。
工作区：C:\Users\JAN\.codex\worktrees\v3-dock-preview\DEXT_Core
分支：feat/V3-P8-004-window-preview
## 设计
使用Core拥有的非分层顶层WPF预览窗和Windows DWM缩略图；鼠标停留300ms展开、离开Dock与预览250ms收起。
预览不激活窗口；点击复用已有身份核验与窗口激活动作。最小化/拒绝预览显示标题替代。
一个应用窗口过多时分页，全部窗口仍可选。源关闭、Dock隐藏或Core退出时释放缩略图。
本包不包含系统托盘、Jump List或任务栏占位整合。
参考：[DwmRegisterThumbnail](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmregisterthumbnail)、[缩略图属性](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ns-dwmapi-dwm_thumbnail_properties)；实现自行编写。
## 步骤
| 步骤 | 状态 | 记录 |
|---|---|---|
| 01 缩略图布局及资源生命周期 | 做完 | [01-thumbnail.md](V3-P8-004/01-thumbnail.md) |
| 02 悬停与选择接线 | 做完 | [02-interaction.md](V3-P8-004/02-interaction.md) |
| 03 完整构建和桌面验证 | 开做 | [03-runtime.md](V3-P8-004/03-runtime.md) |
进度2/3=67%；完整Release已构建并启动独立候选。实际预览交互待补证，当前转入代码diff审查。

补充工作记录（不增加主步骤分母）：[04 diff审查](V3-P8-004/04-diff-review.md)、[05 后续设计建议](V3-P8-004/05-design-notes.md)。
