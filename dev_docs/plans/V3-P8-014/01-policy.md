# V3-P8-014 宿主偏好与状态策略

状态：做完（策略/偏好实现，尚未接线）

实现：扩展Services/ApplicationDock/DockModel.cs的本机偏好，默认native；新建DockPresentationPolicy.cs纯策略，区分期望/实际宿主、就绪、失败原因、停止。模式由AutoHide/ReserveSpace映射autohide/reserve/overlay。

- [x] 写清并核对涉及入口和调用者。
- [x] 为具体行为增加必要失败检查，然后实现。
- [x] 执行相关检查并记录命令/结果；不外推范围。
- [x] 更新本步骤状态、TODO并提交。

完成证据：旧偏好保持native；三模式映射；失败保留theme意图且仅在重试/新Room恢复尝试；停止不得启动回退。

2026-10-11：DockPreferences新增Presentation默认native，文件加载拒绝未知值；DockPresentationPolicy分离requested/target/actual/phase，三模式映射，失败按当前attempt锁存，新Room或显式retry撤销旧回调，停止不可逆。该类由服务Dispatcher调用，不执行窗口切换。
先编译失败证明缺字段/策略，再实现；18项新策略/持久化检查及既有ApplicationDock检查通过。完整build.ps1 -V3Release通过，start.ps1 -CoreOnly复核旧PID48280并保留，不启动配置器。日志.build/presentation-policy-tests.log、presentation-policy-build.log；产物v3-fusion-policy-20261011仅Core构建目录，不是完整发行候选。下一步02接服务/owner，不能把纯策略称实际回退已完成。
