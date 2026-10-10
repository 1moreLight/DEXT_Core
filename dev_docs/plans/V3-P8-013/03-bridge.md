状态：开做。前两步模块/几何已具备，当前尚未加载到正式index/main，尚无Core数据/图标/动作通道；完整私有接线、真实Player输入和演示仍必做。

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
