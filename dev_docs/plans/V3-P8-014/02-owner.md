# V3-P8-014 唯一宿主接线与失败回退

状态：待做

实现：连接DockHostOwnership、RoomSessionRuntimeCoordinator.Dock/ApplicationDock和ApplicationDockService。先释放旧主窗/AppBar/租约再接入新owner；启用应用枚举不强制WPF展示。缺Room/区域/失败返回WPF，避免反复抢占。

- [ ] 写清并核对涉及入口和调用者。
- [ ] 为具体行为增加必要失败检查，然后实现。
- [ ] 执行相关检查并记录命令/结果；不外推范围。
- [ ] 更新本步骤状态、TODO并提交。

完成证据：切换只存在一个主栏；旧宿主退出确认前不授予新owner；关闭Core不会新建回退；任务栏手动恢复优先。
