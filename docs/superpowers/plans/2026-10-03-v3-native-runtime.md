# V3-P5-001 原生持续桌面宿主实施计划

> 执行方式：superpowers:executing-plans，逐任务测试、实现、具名提交；包末一次全分支独立审查。用户已授权连续推进与最终集中验收，无中途审批。

**目标：**真实 Core/Release Player直接运行原生v3作品；共享场景/组件持续存在，图标与Widget按同一几何过渡；启动、暂停、闲置、锁屏与恢复保持Core已提交Desk。

**依据：**V3_PLAN D04/D06/D07/D08/D11/D16、§6.2/§7；ROOM_V3。整个基础版16项仍保留，包末只按实际完整证据更新台账。

**范围外：**顶层Dock/AppBar、节点编辑器、分享界面、游戏宿主、发布清理；其后续要求不取消。当前原生绑定权威作为依赖，不接受作者自报输入/权限/目标路径。

## 冻结的技术裁定

- 新应用Room使用startDesk；同一安装副本重启恢复已提交Desk。start只在新主Player文档建立时播放；切页、暂停/idle/锁屏恢复不重播。
- image/GIF start采用500ms宿主缺省，延续熟悉的现有静态启动体验；需更长时序可用本地HTML。video播放到ended，不以60s总时长截断；30s未加载或停滞且无进展时降级。HTML done或60s超时后进入已确定Desk。
- background image/GIF持续、video静音循环、HTML沙箱；idle持续至宿主唤醒，作者done不能退出idle。没有idle时保留已提交桌面画面。
- lifecycle使用stage(starting/desktop/idle)与playbackPaused/locked/operable正交状态，保留idle时暂停、暂停时锁屏的组合；暂停原因和前台可操作状态分开。进入非可操作状态先由Core提交目标，保留共享实例；恢复发完整状态并恢复订阅。
- transition watchdog至少合法动画duration+2000ms，最小3000ms；不把声明10000ms动画在10000ms处直接截断。具体超时只由Core可信安装数据设置。
- 作者只能通过公开有限几何接口变换source/target/shared三组，提交当前session/transition/geometryVersion；不接受CSS选择器、DOM引用或任意属性。暂定设计画布1920×1080，响应式视口独立，后续实际DPI验证调整。
- 共享config递归逐字段合并，未改嵌套字段继续继承；null为显式值，删除覆盖才恢复继承。
- global组变换/占用仅roomScene可报；活动组件和媒体槽可报自己的已声明按钮矩形。Widget不依赖roomScene才能画可操作按钮。数据失败只隐藏读数，SDK提供显式readout状态绑定与诊断，保留静态外框。
- Content原生契约补capabilities/buttonIds（缺省空），消费者为slot.start、slot.idle、slot.background.<DeskID>；不继承scene授权。D08要求背景、Dock与Widget相同动作同样校验，不能把HTML素材永久收窄为装饰。Rust/Core/Schema同时修改，phase/Desk限制由Core查，个人消费者配额覆盖最大196实例。
- 每项裁定写ledger/ROOM_V3，结构决策写PROJECT，最终集中验收可审阅。裁定不替代真实物理输入、DPI或安全门槛。

## Review Focus

旧会话/迟到完成/陈旧几何不能提交当前Desk或激活入口；共享实例不会因切Desk、resize、idle或暂停重建；缩屏不得覆写保存布局；作者只能读取声明、已授权能力；直接原生消息、外部资源/导航与未声明资源必须被实际Player拒绝；原生输入证明必须绑定当前可见按钮及几何；原用户Room与布局不能变成测试夹具。

### Task 1：共享纯运行模型与作者SDK

**文件：**wallpapers/dext-room-v3/runtime-model.js及.test.js；creator-kit/v3/sdk/dext-sdk.v1.js及.d.ts、sdk.test.js；ROOM_V3_RUNTIME_API.md；原生continuous样包资源列表/SDK引用。

**接口：**createRuntime(verifiedManifest).acceptSnapshot(snapshot)->Result<Effect[]>，acceptGeometry(consumer,report)，animationFinished(session,transition)，setViewport(viewport)，dispose(reason)，readDiagnostics。Core快照含protocol/session/room/install/revision/current/target/queued/transition/deadline/active/operable/lifecycle及其revision；模型不调用网络、WebView或直接提交Desk。实例按session+稳定componentID创建一次，以mount/update/suspend/resume/dispose effects表达；每Desk公开覆盖逐字段合并共享config。

**SDK：**固定parent事件源，经v1握手给每实例token；ready、desk.get/subscribe/navigate、lifecycle.subscribe、capabilities.get、data.subscribe/bindReadout、actions.list/activate、scene.publishGeometry/completeTransition/done。消息包含apiVersion/instanceId/token/requestId/sessionId，大小/字段有界，pending请求有超时，dispose失效并释放订阅。token不代表特权输入。

- [ ] 先写模型/SDK行为测试并运行RED：current与target分离、排队修订不重播动画、完成不自行提交、迟到完成拒绝、换session释放旧实例、共享ID不重建、覆盖继承、生命周期和几何版本；父源/token/版本/会话验证、请求超时和销毁。
- [ ] 实现生产共享模型/SDK，运行`node --test wallpapers/dext-room-v3/runtime-model.test.js creator-kit/v3/sdk/sdk.test.js`与JS语法、原生Schema验证；Expected GREEN，具名提交。

### Task 2：Core/Player原生上下文、生命周期、资源和可信输入

**文件：**RoomSessionRuntimeCoordinator/PlayerBridge/Kernel/Protocol/ActionCatalog/PersonalStore；新增RoomRuntimeContext和RoomNativeInputAuthority；Rust room_v3/room-v3.schema.json与Core安装复核补媒体消费者声明；WebWebView2、WinDesktopCore/RawInput、Playback/ScreenSaver/SessionSwitch接线；新增LivelyMessageRoomRuntime，修改MessageType/IpcMessageConverter及Form1；DextRuntimeBoundary；相关行为测试。

**接口：**同一Core已复核清单生成裁剪RuntimeContext，实际PlayerPID+私有连接获取；传输补queued/deadline/active/lifecycle。可信Windows事实更新协调者，不接受作者改变暂停/锁屏状态。实际RawInput激活配对绑定Player/session/geometry/button，Core内部IssueHostInput后InvokeButton，作者不能出票。资源读取区分官方文件与verified content inventory，撤销/导航清空输入和会话。

- [ ] 先写实际production-source协议/输入/边界失败测试；实现后运行Kernel/Protocol/Actions suites，Expected GREEN。
- [ ] 脚本伪请求/合成点击/重放/导航/陈旧几何拒绝；物理鼠标与Enter/Space单次生效。PostMessage测试只称原生消息回归，物理RawInput另验。
- [ ] 改C#后完整`build.ps1`→`start.ps1`及identity；Expected同分支Core/ReleasePlayer/配置器全OK，具名提交。

### Task 3：生产DOM宿主、持续实例、同步过渡与四类媒体

**文件：**dext-room-v3/index.html/main.js/style.css/LivelyInfo.json；dom-host/frame-host/media-host；所需官方模块同目录内部依赖；renderer/v3-runtime.e2e.ts；ReleasePlayer V3RuntimeProbe。

**接口：**DOM适配纯模型effects；manifest只从Core RuntimeContext取得，内容URL只映射当前已声明inventory。roomScene单实例；共享Widget不建staging副本；inactive保留iframe、暂停媒体/订阅。官方组默认slide/fade/none、作者有界几何驱动同一组。animationFinished只回告Core，current以提交快照为准。四类媒体按D11裁定。

- [ ] 浏览器定向失败测试先行；共享实例计数、当前提交点、默认/作者动画、queue/超时/失焦、四媒体和start/idle/锁屏恢复，Expected GREEN。
- [ ] 相同生产脚本在隔离ReleasePlayer验证资源、安全和IPC；外部网站/脚本、导航、直接IPC、未授权数据/动作拒绝。未实现能力诚实返回unsupported；失败仅隐藏受影响读数，静态外框保留。
- [ ] 前端build/JS语法/e2e通过，具名提交。

### Task 4：个人布局、版本化命中与真实桌面闭环

**文件：**geometry.js及.test.js/input-host.js；RoomPersonalStore新增布局与RoomLayoutAuthority；明确布局消息分支；rooms/v3-runtime-basic、v3-runtime-continuous及negatives；WorkerW验证入口；TODO/acceptance/ROADMAP/V3_DELIVERY。

**接口：**resolveLayout(saved,geometry)->临时变化/未解决诊断；clientToCanvas/hitTest要求当前geometryVersion。个人布局按Room/Desk/icon/component稳定ID，只有用户成功提交保存；失败回原位。viewport临时移位/缩小不写盘，恢复还原；Widget落占用回原位，无空间明确诊断；几何变化取消旧手势/输入证明。

- [ ] production布局/存储失败测试先RED后GREEN，动画与DPI命中不沿用旧坐标；完整自动套件定向通过。
- [ ] 新WorkerW probe核验当前Core，保存/临时安装/finally恢复原桌面。真实切页、物理输入、DPI/缩屏、Alt-Tab、idle/锁屏、Player/Core重启与换Room；按独立验收卡留证据，不能用Chromium代填。
- [ ] 一个fresh-context全分支审查，Critical/Important一次RED→GREEN修正，记录全部rulings/declined/minors；具名提交后保持未合并并继续后续包。

## Ledger

dev_docs/implementation/V3-P5-001-ledger.md；记录每步BASE、证据、失败修复与裁定。最终集中验收前不合入master。
