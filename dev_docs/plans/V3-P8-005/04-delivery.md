# 04 交付与统一验收
状态：开做
实现、自测和候选已交付，用户统一验收前不合并。包进度3/4=75%。
分支：feat/V3-P8-005-taskbar-controls；工作区C:\Users\JAN\.codex\worktrees\v3-taskbar-controls\DEXT_Core。
当前候选：D:\use\Orca\DEXT\DEXT_Core\.build\v3-taskbar-controls-ready-20261010。
回退候选：D:\use\Orca\DEXT\DEXT_Core\.build\v3-dock-preview-reviewed-20261010；更早点击基线v3-app-taskbar-ready-20261009均保留。
入口：配置器 → 设置 → 系统应用Dock；隐藏Windows任务栏 / 恢复Windows任务栏 / 跟随Dock。
缺项：acceptance/V3-P8-005-taskbar-controls.md五项人工操作，尤其原触控/切页与全屏；正常退出恢复已实机程序验证，不重复冒称手动通过。
后续遵循用户持续开发授权，集中验收不阻塞后续编码。唯一下一项见ROADMAP，禁止混入master或删除依赖工作区。