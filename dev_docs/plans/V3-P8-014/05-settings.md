# V3-P8-014 配置器设置与实际状态

状态：待做

实现：ApplicationDockService.Status/Edit及tauri-ui/src/components/ApplicationDockSettings.tsx新增native/theme选择、实际状态及回退原因/重试。沿既有RPC，不把保存偏好当就绪；默认native。

- [ ] 写清并核对涉及入口和调用者。
- [ ] 为具体行为增加必要失败检查，然后实现。
- [ ] 执行相关检查并记录命令/结果；不外推范围。
- [ ] 更新本步骤状态、TODO并提交。

完成证据：选择融合/原生可往返；缺区域显示原因与回退；重启保持期望；原固定项和Room私人配置不变。
