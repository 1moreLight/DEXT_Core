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
