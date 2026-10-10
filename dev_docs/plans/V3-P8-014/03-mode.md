# V3-P8-014 overlay常显与占位模式

状态：开做

实现：贯通RoomDockPreferences、Player Form1.NativeDock、消息/启动参数验证，增加overlay。不注册AppBar、不因离开自动隐藏，全屏/锁屏仍隐藏。融合使用应用模式及主题高度，禁用融合保留原主题设置。

- [x] 写清并核对涉及入口和调用者。
- [ ] 为具体行为增加必要失败检查，然后实现。
- [ ] 执行相关检查并记录命令/结果；不外推范围。
- [ ] 更新本步骤状态、TODO并提交。

完成证据：三模式分别验证工作区；overlay离开保持可见；reserve最大化避让；全屏退出恢复；不把普通拖动限制等同最大化占位。

2026-10-11 接线增量：正式偏好、融合请求、Core Player 参数和 Player 模式选择贯通 overlay；移除临时 overlayNotAvailable 回退。新增 overlayAvailable 状态，配置器三模式与状态文案同步。三模式偏好往返检查先因 overlay 拒绝失败，修复后及既有应用检查通过；完整 Core Release、前端 npm build 均退出0。start.ps1 -CoreOnly 确认原 Core52004，不启动配置器。日志 .build/overlay-mode-red.log、overlay-mode-green.log、overlay-core-build.log、overlay-ui-build.log。现有宿主 Tick/Visibility 已区分 autohide 与常显；尚未进行本增量三模式实机工作区/全屏验证，状态继续开做。
