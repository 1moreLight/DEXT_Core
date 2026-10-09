# 06 运行版本与回退交接
状态：做完
日期：2026-10-10
目标：接手者能明确当前运行版本、已知良好基线、剩余工作和停止时点。

## 版本
- 工作分支：feat/V3-P8-004-window-preview。
- 工作区：C:\Users\JAN\.codex\worktrees\v3-dock-preview\DEXT_Core。
- 当前候选：D:\use\Orca\DEXT\DEXT_Core\.build\v3-dock-preview-reviewed-20261010。
- 当前Core代码1137ec5；发布清单release-inventory.json包含650项摘要，配置器复用P8-003未变更的已验证产物。
- 已知良好回退候选：D:\use\Orca\DEXT\DEXT_Core\.build\v3-app-taskbar-ready-20261009；用户已确认此版图标可点击、显示打开状态。
- v3-dock-preview-20261009是审查修复前的中间产物，回退优先选P8-003。

## 回退操作（仅出现回归时执行）
1. 用Get-CimInstance Win32_Process读取Lively.exe的当前绝对路径，确认属于上方当前候选；不要按同名程序一概停止。
2. 使用tests/Dext.ApplicationDock.RuntimeProbe中的shutdown命令，参数传当前候选绝对目录。它核对身份后正常退出Core；再确认原PID已退出。
3. 执行scripts/start.ps1 -ReleaseDirectory 'D:\use\Orca\DEXT\DEXT_Core\.build\v3-app-taskbar-ready-20261009'。
4. 核对新Core路径与Dock启用状态。固定项偏好不迁移、不删除，仍读取原本机数据目录。

## 剩余工作
第03步开做（总体67%）：真实预览悬停、跨窗点击、分页/最小化标题替代、源关闭/全屏恢复、原单窗口点击与焦点。完整步骤见独立验收卡。
第04步diff审查、第05步建议文档均做完。未合并master。

## 本轮停止
用户明确指定2026-10-10 00:59北京时间停止；届时暂停目标并保留当前提交/证据，不把未验收改写成通过。已设置一次线程停止提醒。

## 2026-10-10 00:59 定时停止记录
状态：本轮已停止，目标按用户要求暂停。
当前分支：feat/V3-P8-004-window-preview；停止前HEAD为172d6d0，工作区干净。
已完成：窗口预览实现、完整Release构建/启动、旧窗口快照点击修复与11项定向检查、14项应用Dock检查、独立diff审查、设计建议与回退交接。
未完成：真实预览悬停/跨窗点击、分页与标题替代、全屏恢复及触屏证据；自动化无法定位工具窗口。工作包仍2/3=67%，未合并master。
当前候选：D:\use\Orca\DEXT\DEXT_Core\.build\v3-dock-preview-reviewed-20261010；已知良好回退候选v3-app-taskbar-ready-20261009保留。
下一步：用户恢复推进后，按独立验收卡补实机交互；发现问题仍在本分支修复。此时不启动任何新编码、构建或测试。
