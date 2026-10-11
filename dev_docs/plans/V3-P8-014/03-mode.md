# V3-P8-014 overlay常显与占位模式

状态：做完（实施；待统一人工验收）

实现：贯通RoomDockPreferences、Player Form1.NativeDock、消息/启动参数验证，增加overlay。不注册AppBar、不因离开自动隐藏，全屏/锁屏仍隐藏。融合使用应用模式及主题高度，禁用融合保留原主题设置。

- [x] 写清并核对涉及入口和调用者。
- [x] 为具体行为增加必要失败检查，然后实现。
- [x] 执行相关检查并记录命令/结果；不外推范围。
- [x] 更新本步骤状态、TODO并提交。

完成证据：三模式分别验证工作区；overlay离开保持可见；reserve最大化避让；全屏退出恢复；不把普通拖动限制等同最大化占位。

2026-10-11 接线增量：正式偏好、融合请求、Core Player 参数和 Player 模式选择贯通 overlay；移除临时 overlayNotAvailable 回退。新增 overlayAvailable 状态，配置器三模式与状态文案同步。三模式偏好往返检查先因 overlay 拒绝失败，修复后及既有应用检查通过；完整 Core Release、前端 npm build 均退出0。start.ps1 -CoreOnly 确认原 Core52004，不启动配置器。日志 .build/overlay-mode-red.log、overlay-mode-green.log、overlay-core-build.log、overlay-ui-build.log。现有宿主 Tick/Visibility 已区分 autohide 与常显；尚未进行本增量三模式实机工作区/全屏验证，状态继续开做。

2026-10-11 实际三模式：Core50820，fusion-modes-live退出0。常显离开保持可见且AppBar未注册；reserve实际工作区Bottom缩小；autohide释放占位恢复Bottom、离开隐藏、触边展开。首轮Core31060因旧租约恢复任务未完成被误报失败，已修复ReleaseAutomaticAsync等待当前恢复（最多5秒），新增检查先红后绿，完整Release通过。原运行版/偏好/fixture/checkpoint已恢复，无新配置器。日志fusion-modes-live.log、mode-handoff-red/green.log、mode-handoff-core-build.log。此次未做物理锁屏、三模式各自全屏和最大化窗口实测；保留统一验收，不把工作区几何检查冒充这些步骤通过。
