# 03 构建验证
状态：做完
- 占位控制12/12、应用策略/偏好33/33、原WPF交互18/18。
- 完整Core/Player/Watchdog/配置器Release通过；审查后最终Core重建通过。
- 独立diff发现原生屏幕查询失败留下Ready=true；先复现缺失失效入口，再添加MarkUnavailable与外层错误门槛，恢复后重新确认。
- scripts/start.ps1精确路径启动通过：v3-app-reserve-20261010，Core PID42912，配置器30336。
- 证据：主工作区.build/app-reserve-release.log、app-reserve-final-core.log、app-reserve-readiness-green.log、app-reserve-start.log、app-reserve-status.log。
- 未切换用户占位设置，实际工作区/Explorer/DPI留统一人工验收；API返回与纯模型不替代此项。
