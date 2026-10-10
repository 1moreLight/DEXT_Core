# V3-P8-014 唯一宿主接线与失败回退

状态：开做

实现：连接DockHostOwnership、RoomSessionRuntimeCoordinator.Dock/ApplicationDock和ApplicationDockService。先释放旧主窗/AppBar/租约再接入新owner；启用应用枚举不强制WPF展示。缺Room/区域/失败返回WPF，避免反复抢占。

- [ ] 写清并核对涉及入口和调用者。
- [ ] 为具体行为增加必要失败检查，然后实现。
- [ ] 执行相关检查并记录命令/结果；不外推范围。
- [ ] 更新本步骤状态、TODO并提交。

完成证据：切换只存在一个主栏；旧宿主退出确认前不授予新owner；关闭Core不会新建回退；任务栏手动恢复优先。

2026-10-11交接原语增量：DockHostOwnership增加Request(Theme/Application/None)及IsRequested，默认Theme兼容旧行为；选择仅改变请求，旧owner显式释放前新宿主不可取得。None可暂缓接管，Shutdown后请求失效且不可复活。ApplicationDockService.ReleaseOwnerAsync以当前宿主请求而非应用Enabled判断是否保留原生owner，支持后续应用仍启用但改用融合。

新增4项检查先因缺API失败，补实现后10/10所有权检查通过；完整Release通过、CoreOnly保留旧Core48280，无新配置器。日志.build/fusion-owner-red.log、fusion-owner-tests.log、fusion-owner-build.log。本步骤仍开做：策略还没有接到Render/Coordinator demand，不能称融合切换已经可用。下一步读取主题可用性/实际状态并连接DockPresentationPolicy，再加入失败锁存及RPC呈现操作。

2026-10-11主题候选读取增量：新增DockThemeEligibility，按正式宿主同样的深合并语义读取当前Desk组件覆盖；拒绝缺Dock/缺官方区、越界逻辑矩形和无效样式。它只判断manifest声明，实际viewport最小尺寸、遮挡及任务输入就绪仍须Player确认。Coordinator.ReadThemeTaskCandidate提供上下文、不可用原因、生命周期阶段与附着/原生窗口就绪；读取session后释放锁再读dockGate，并防旧Room窗口冒充新Room已就绪。该读取尚未接Render，不改变当前宿主。

7项声明/深合并检查及原应用测试通过，完整Release通过；CoreOnly保持旧Core48280，无新配置器。日志theme-eligibility-red/tests/build。第02仍开做，整包17%；下一步服务消费此描述并驱动ownership及有效主题设置，故障原因必须绑定尝试/上下文而非直接把旧dockPhase当本次失败。
