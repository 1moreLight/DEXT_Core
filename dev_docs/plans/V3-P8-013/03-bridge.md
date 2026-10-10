状态：开做。正式index/main、Core展示/图标与Player私有通道已接；原生任务动作、真实Player输入和演示仍必做。以下按时间保留接线历史，最新状态见文末。

## 03 接线继续入口（已核对，尚未实现）
- 官方DOM加载入口：wallpapers/dext-room-v3/index.html/main.js；目前新model/host/css尚未加载，只有后台测试加载。接线时先Core允许，再挂官方区并await setTaskAreaOcclusion的几何确认，最后允许动作；停用顺序相反。不能把onOccupied通知发送当作Core已确认。
- 展示来源：ApplicationDockService的Refresh/GroupForCurrentDesk + P8-012 DockTaskProjection；不能转发Status的私人字段。增添有界官方图标数据；placeholder首字不算最终图标。
- 私有类型：Lively.Models/Message/LivelyMessageRoomDock.cs 与 MessageType/转换器；Form1.cs当前只识别Dock ready/keyboard，需新增明确任务展示/请求消息，不复用作者SDK。
- Core接入位置：RoomSessionRuntimeCoordinator.Dock.cs持有实际DockPlayer；WebWebView2.cs分派IPC；WebWebView2.DockInput.cs已读取RawInput边沿并用NativeDockAt/Available检查实际窗口，勿新增全局hook。
- 重要边界：现有RoomNativeInputAuthority按作品按钮授权；新应用itemId不是作者buttonId，不能伪造manifest按钮或绕成任意launch路径。需专用官方任务完成关联，沿真实Core原生边沿/当前宿主，防与旧作者RouteMouse同时处理；DOM isTrusted不单独授权。
- ApplicationDockService依赖Coordinator，避免构造器循环：可用注册/撤销官方任务提供者的接口，由服务启动后注册，关闭先撤销。具体接口及测试在本步骤动C#前落档。
- 本步骤仍包括独立融合演示和真实Player验证。014负责用户呈现选择/overlay/失败回退与原生预览；当前应用优先所有权保持，不能为了展示本包强开两个主栏。
- 布局配置接线须使用当前有效componentOverrides合并结果，与runtime-model同语义；官方固定项仍按已提交Desk（非transition target）生成上下文。几何变更取消按下，纯标题/前台轮询不重发几何屏障。

### 2026-10-10 本轮接线拆解（开做）
1. Core 在现有应用枚举后，为当前已附着主题 Player 构建纯展示快照；上下文包含 Player 世代、已提交 Desk/固定范围、固定设置修订。原生动作仍需后续专用完成关联。
2. 私有 stdin 新增任务快照消息，仅发送不透明 ID/名称/状态/有界 PNG；不透传 Status、路径或 HWND。Player 核对当前 Dock 身份后只调用官方顶层私有函数。无 provider 构造器互相依赖。
3. 图标从现有 AppCatalog 读取，缓存随当前任务集合收敛；单图标 64 KiB，总图标 base64 512 KiB，缺失保持首字后备。DOM 更新保留按钮和图标节点。
4. 本轮先打通展示生产端与 Player 消费入口；正式 main 控制器、原生动作、演示及完整接线验收仍在本步骤，不以展示消息算完成。

本轮增量：Core DockTaskDisplay + 已附着 Player 的私有快照发送、Player 身份核对后的顶层调用入口已写；PNG 缓存/缺图后备与 DOM 图标已写。完整 Release 构建通过。main 尚未定义 dextNativeTaskSnapshot，因而不会激活未接完动作的区域；完整输入/页面控制器仍开做，不宣称任务区已能实际操作应用。
验证：应用原46项+展示适配检查通过；Node72项、headless Edge六组（含真实PNG渲染、节点保留和点击）通过。运行候选未替换。
用户补充占位要求与 BewlyCat 调查见 ../../research/DOCK_WORKAREA_2026-10-10.md；P8-014继续复用原生工作区占位，普通拖动越界与最大化分开验收。

### 正式页面控制器（开做）
- 使用 dom-host.readDiagnostics 中已经合并 Desk 覆盖的实际 dock 实例，不再另写一套合并算法。
- 壁纸只读数据刷新不反复发布几何。布局/可见性改变时立即取消按下，串行等待旧区域清理和新 occlusion 确认，再显示区域；过期异步结果不能重新显示已隐藏区。
- 新 Core 私有快照携带 ActionsEnabled；原生动作链尚未完成时始终 false，页面只显示图标且按钮禁用。主控制器不能把数据到达当作获得操作权限。
- 官方脚本/CSS加入固定资源白名单并由正式index加载。desktop视图完全不创建任务区，旧主题没有声明不显示。

正式控制器增量：index/main已加载task-area模块，Player私有快照现在到达dextNativeTaskSnapshot；controller从实际实例读取有效config，串行确认occlusion后显示，隐藏/撤销立即取消。数据更新不重发几何；Core ActionsEnabled默认false，原生动作尚未实现，显示区按钮保持禁用。86项Node、七组headless DOM、完整Release构建通过；未部署。

原生输入接续调查：WebWebView2.Input.cs 的 NativeMouseDown/Up 已为当前 RawInput 边沿生成 RoomNativeInputGesture，再由 Form1.NativeInput.cs 的 PrepareNativeSampleAsync/CompleteNativeSampleAsync 在真实投递前后采样。作者几何经 RoomSessionPlayerBridge.Input.cs 的manifest catalog验证，新任务ID不能放进作者buttons。下一次可给专用任务采样增加独立字段和对应完成关联，复用同一次物理边沿与实际窗口，不新增hook；同时处理键盘官方任务焦点与触摸，不能只实现鼠标就把03做完。main当前dext:v3-task-action尚无Core接收器，ActionsEnabled不得先置true。
启动复核：task-controller-runtime-preserved.log确认旧候选Core39560复用，-CoreOnly未启动配置器；该复核不代表新展示区部署。
生命周期补证：新控制器误用desktop operable已通过定向RED→GREEN修正，普通应用取得前台/桌面播放暂停不隐藏仍可见的Dock。最终Node87项通过；见ERRORS #289。
最终本轮状态：正式展示通道与页面控制器已接；原生动作仍待做，Core ActionsEnabled=false。独立review发现的浮点边界/几何回退问题已两项RED→GREEN修复，最终89项Node、七组DOM通过。旧阶段“main未接”等语句仅为增量历史，不是当前状态。四步进度仍2/4=50%。

### 原生任务取样与完成关联（开做）
- 在同一次官方顶层 beginNativeInputSample 中读取任务按钮的当前可见矩形、上下文与不透明 ID；独立 taskHit 字段，不加入作者 buttons/catalog。
- Player 只从固定主文档取得该字段，随原生投递回执返回 Core。沿原有 DOWN/UP 顺序；实际被遮挡、滚动裁切、隐藏或未启用的按钮不能取样为目标。
- Core 用现有 RawInput 生成的 gesture、实际 HWND/视口及同一次序号关联两个取样；上下文或目标变化取消，完成至多一次。快照轮询序号增加不使同一目标点击失效。
- 本增量先完成鼠标取样/完成关联及专用检查；键盘焦点/触摸、操作派发与真实 Player 演示继续在03，不提前开启 ActionsEnabled。

本增量已实现：samplePointer读取顶层可见且裁切后的实际目标，Player将taskHit随同一次原生投递回执回送；Core DockTaskInput使用原RawInput序号/起始时间/HWND/视口关联同一对边沿。作者几何在该点有命中时不生成任务动作，旧作者点击没有额外任务几何开销。
ApplicationDockService已订阅实际主题宿主完成事件，在Dispatcher复核当前宿主、已提交Desk、固定修订及不透明ID后走原Click/TogglePin；移除未实现的网页dext:v3-task-action消息。新通道仍ActionsEnabled=false，尚未实际派发OS操作。
自动证据：16项任务完成关联检查、17项原输入投递回归、90项Node、原七组DOM与新增四组真实DOM取样检查通过；完整Release构建通过。CoreOnly保留旧候选39560，没有启动配置器。这些不算真实Player/触控/应用启动验收。
接续：键盘不能直接沿DOM keydown，因为既有官方Dock guardian有意拦截这些键；应由原生RawInput和专用官方任务焦点完成关联接线，避免双重执行。触摸须核对实际Windows输入路径；不能把后台浏览器click通过当触控通过。随后制作独立融合样包并在实际Player验证，完成后才开启动作并进入04。
复核收敛：独立review唯一P2为排队完成跨几何撤销；已用生产RoomNativeInputAuthority复现RED并加入CancellationVersion，正常完成、撤销、重新发布、隐藏再恢复四项GREEN。最终任务20项，原输入17项，Node90项，DOM11组；最终Release通过。新操作仍未启用，键盘/触摸/实际Player演示继续。

### 键盘接线（开做）
- 官方任务区通过独立taskTargets提供可见目标顺序与实际裁切矩形；Core按自己的任务投影核验context/item/window/action，再映射到输入叶层的official-task焦点。作者buttons仍单独通过原catalog校验，不向作者协议添加任务目标。
- 先完成正式DOM的原生焦点/菜单操作、Player私有取样回传和Core目标映射。Tab/Enter/Space将继续由已有RawInput与RoomNativeKeyDelivery生成，不能把DOM键盘事件当成动作证据。
- 后续把经核验的任务焦点与作者Tab顺序组合，官方任务键盘不向作者frame或DOM转发合成键；两个事件时刻取样后才完成动作。原生菜单返回由官方私有事件处理。
- 窄区键盘滚动、触摸及实际Player仍是03完整验收条件；本阶段不启用ActionsEnabled。
键盘接线增量：正式DOM的独立taskTargets、Player私有回传、Core投影校验和现有RawInput/KeyDelivery已贯通；Tab/Shift+Tab、Enter/Space与本地菜单返回/Esc已接线。原生任务键不合成转发给作者frame。窄栏焦点滚出后回跳作者、作者重新进入跳过应用两处问题均RED→GREEN修复（ERRORS #293）。
证据：16项Core键盘、20项鼠标任务、17项原输入、90项Node、七组原DOM和八组取样/键盘DOM通过；完整Release构建通过。独立复核只有上述边界进入问题，已修复。CoreOnly确认旧Core39560继续运行，没有启动配置器；不是新代码实机验收。
当前03仍开做，2/4=50%。ActionsEnabled=false，真实Player/触控、独立融合样包仍待做；上述旧阶段缺少键盘接线的说明仅为历史。统一人工四步未执行，继续后续工作，不合并master。
