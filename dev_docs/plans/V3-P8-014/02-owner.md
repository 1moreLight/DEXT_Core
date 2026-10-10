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

2026-10-11官方任务区回执增量：正式顶层新增私有dextNativeTaskReadiness，只返回pending/ready/hidden/unavailable，不返回应用数据。Player在窗口同步及单飞心跳中读取，绑定generation/session/revision与5秒时效；Core候选描述增加TaskAreaStatus。隐藏保留已配置区域的hidden状态，几何不可用/缺区域返回unavailable，待布局不误报失败。该信号尚未驱动服务切换/任务栏租约，不声称回退已通。
19项main/controller检查通过（新hook先失败再实现），完整Release通过，CoreOnly复核旧Core48280，无新配置器。日志task-readiness-red/tests/build。下一步消费候选状态、配置有效融合模式与attempt故障关联，再开放呈现RPC；第02仍开做，1/6≈17%。

2026-10-11服务接线代码完成一段：ApplicationDockService.Presentation消费候选/策略，Edit支持presentation(native/theme)/retryPresentation，Status区分requested/target/actual/phase/reason。配置先持久化再驱动；重试不写偏好。Coordinator有效融合设置覆盖Enabled/Mode但保留磁盘主题偏好；DockDemand绑定attempt，先旧owner释放再新宿主启动。任务栏融合接管等待首次官方区ready，hidden/短暂pending不撤销已确认区域，unavailable撤销。

失败按单调attempt记录，旧Player退出不会覆盖较新失败。失败锁存保留theme意图，新的会话/安装或手动重试再尝试；静态无Dock/无区域回退。35秒连续未就绪超时，已就绪/锁屏/全屏重置等待，普通切页不因旧启动时间立刻超时。旧宿主attempt不得冒充新尝试已就绪。

限制：overlay尚未实现，当前选择融合常显会以overlayNotAvailable回退原生；第03必须完成后去掉临时保护。实际Core往返/故障恢复尚未执行，第02仍开做。生产策略/资格及10项所有权检查通过；最终完整Release通过，日志fusion-service-policy-tests、fusion-service-owner-tests、fusion-service-build。CoreOnly复核旧Core48280，无新配置器/未部署新包。下一步限定实际Core验证autohide/reserve切换与回退，再接overlay。
