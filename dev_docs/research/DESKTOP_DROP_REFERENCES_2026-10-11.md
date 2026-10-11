# 桌面拖入参考（进度优先）
状态：做完；仅源码核对，不运行参考项目、不复制第三方实现。

| 项目 | 固定源码 | 可借鉴 | 对Dext的结论 |
| --- | --- | --- | --- |
| DeskBox | 988bc01f5a85e29c2a7c1d3fdb9009a78127ef33 | ContentWidgetWindow.NativeDragDrop.cs枚举自身及ContentBridge子HWND注册NativeDropTarget，统一DragEnter/Over/Drop；效果和实际处理分离 | 最直接参考。子窗口接收归属值得借鉴，但不能对Chromium窗口照搬Revoke/Register |
| BentoDesk | 76d74a4d138b5ddc041f8402b5295a3e5d882696 | drop_target.rs：UI线程OLE初始化，RegisterDragDrop/RevokeDragDrop，CF_HDROP，Shell回调负责真实Zone命中 | 原生实现对照。AGPL-3.0，只看设计，未移植代码 |
| Racks | 6f1a9e55f63b5011958d65f9e507d168b3d685db | RackWindow.DragDrop.cs区分内部重排与外部FileDrop | 默认MOVE、Ctrl临时LINK属于其产品规则，Dext不能照搬为Windows Ctrl复制 |

源码链接：
- https://github.com/Tianyu199509/DeskBox/blob/988bc01f5a85e29c2a7c1d3fdb9009a78127ef33/src/DeskBox/Views/ContentWidgetWindow.NativeDragDrop.cs
- https://github.com/ZRainbow1275/bentodesk/blob/76d74a4d138b5ddc041f8402b5295a3e5d882696/crates/bentodesk-backend/src/drag_drop/drop_target.rs
- https://github.com/duartelcunha/Racks/blob/6f1a9e55f63b5011958d65f9e507d168b3d685db/Racks/RackWindow.DragDrop.cs

## 当前判断
Dext已有WorkerW接收层、WebView原生文件对象、Core Shell操作及监听刷新。用户2026-10-11 22:35确认Ctrl拖一个文件到Home成功显示；同时间日志有dragover→drop→desktopDrop received→transfer completed/hresult0/placement accepted→result accepted，同request n1371。因此不再为此前禁止符号盲目重写接收层。
原生OLE桥作为后续真实失败的备用方向，不新增不必要接管，不扩网络安全测试。多文件/同名/移动/取消等剩余场景集中验收。
