# V3-P8-014 配置器设置与实际状态

状态：做完（实施；待统一验收）

实现：ApplicationDockService.Status/Edit及tauri-ui/src/components/ApplicationDockSettings.tsx新增native/theme选择、实际状态及回退原因/重试。沿既有RPC，不把保存偏好当就绪；默认native。

- [x] 写清并核对涉及入口和调用者。
- [x] 为具体行为增加必要失败检查，然后实现。
- [x] 执行相关检查并记录命令/结果；不外推范围。
- [x] 更新本步骤状态、TODO并提交。

完成证据：选择融合/原生可往返；缺区域显示原因与回退；重启保持期望；原固定项和Room私人配置不变。

2026-10-11 实现：配置器新增native/theme选择、实际宿主/phase、原因和显式重试；修正旧文案和只读WPF占位状态，融合读取真实Player状态。保存反馈不宣称就绪。两项状态格式检查先红后绿，npm build与完整Core Release通过；原Core49448保留，无新配置器。日志presentation-ui-red/green.log、presentation-ui-build.log、presentation-settings-core-build.log。此前02实测RPC切换/回退/重试/独立设置保持通过；本次新UI尚未在实际配置器点选，不代填通过。
