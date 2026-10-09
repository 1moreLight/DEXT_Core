# V3-P8-003 / 02 Core 原生应用 Dock
状态：做完
目标：关闭配置器后，Core 的应用 Dock 仍可使用。
## 计划
- 原生独立窗口，显示图标、运行/前台标记及多窗口选择菜单。
- 单击启动、切换或最小化；右键固定/取消固定。
- 主屏工作区底部显示，全屏隐藏、恢复后显示，不抢焦点。
- Core 启动加载偏好，退出关闭窗口和定时器。
## 修改与验证
ApplicationDockService.cs、ApplicationDockWindow.cs、App.xaml.cs。
Core/Player/Watchdog Release 构建已通过。
剩余：真实 Dock 的鼠标点击、前台切换、关闭配置器存活及退出恢复。
## 人工验收
独立验收卡第 1、2、4 步。

2026-10-09 更新：实现及定向验证完成。最终 Release 构建通过；候选 Core RPC 固定/启用/取消固定通过，正常退出重启后 enabled=True 恢复。上述鼠标/配置器端到端人工项统一由第04步收口，尚未宣称通过。