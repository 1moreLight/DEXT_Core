# V3-P8-014 宿主偏好与状态策略

状态：开做

实现：扩展Services/ApplicationDock/DockModel.cs的本机偏好，默认native；新建DockPresentationPolicy.cs纯策略，区分期望/实际宿主、就绪、失败原因、停止。模式由AutoHide/ReserveSpace映射autohide/reserve/overlay。

- [ ] 写清并核对涉及入口和调用者。
- [ ] 为具体行为增加必要失败检查，然后实现。
- [ ] 执行相关检查并记录命令/结果；不外推范围。
- [ ] 更新本步骤状态、TODO并提交。

完成证据：旧偏好保持native；三模式映射；失败保留theme意图且仅在重试/新Room恢复尝试；停止不得启动回退。
