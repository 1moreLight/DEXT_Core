# V3-CORE-002 Core 会话协议设计

## 目标与边界

V3-CORE-001 已让 Core 拥有 Room/Desk 权威状态，但 `RoomSessionKernel.Start` 仍接受调用方传来的 Room/Desk 字符串。本包在它前面建立 Core 内部的受控入口，供未来的可信传输适配器调用。当前 v2 Player 不接入此入口；P2 宿主实验和 P3 作品安装契约尚未完成，生产准入默认关闭。

用户要求持续推进并按大步提交。本包的独立结果是模拟客户端能证明协议版本、来源、已安装 Room 身份和角色权限均由 Core 检查，断线重连得到完整快照。

## 模型

- `RoomSessionHello` 是客户端声明：协议版本、期望角色、已安装 Room 副本的稳定 `RoomId`。声明自身不构成授权。
- `RoomSessionPeer` 是未来传输适配器提供的可信连接身份，不能从作者网页的消息体直接构造。适配器必须把每次命令绑定到同一 peer。
- `IRoomSessionAdmissionAuthority` 根据 peer 和 hello 返回 `RoomSessionAdmission`。其中 `VerifiedRoomInstallation` 来自已校验安装目录，包含稳定 RoomId、安装快照标识、Desk ID 集合和起始 Desk。Core 不采信 hello 自带的 Desk 数据。
- Core 当前注册 `ClosedRoomSessionAdmissionAuthority`：没有 P3 安装权威和真实传输时所有 v3 连接均被拒绝，避免模拟凭据成为生产后门。测试使用显式假权威。
- 安装快照标识只表示本机已校验内容发生变化，不是分享作品的作者版本链；具体格式由 P3 定义。

## 状态与权限

协议版本必须与 `RoomSessionKernel.ProtocolVersion` 完全一致，错误版本在调用准入权威之前拒绝。成功打开后，Core 发随机连接 ID，并将它绑定到可信 peer、角色、RoomId、安装快照标识及当前 SessionId。每个命令重新核对准入权威，避免安装或来源被撤销后旧连接继续写入。

`Coordinator` 是 Core 的受信任协调者，可启动、恢复、设置可操作状态和停止 Room。`DesktopPlayer` 与 `Dock` 可请求切页，只有 `DesktopPlayer` 可报告动画完成。视图只允许连接同一已运行 Room；重连取得当前完整快照，而不是重放可能丢失的事件。旧 SessionId、错误 peer、已关闭连接和已变化的安装快照均不得写入。

`Start` 和 `Restore` 只能使用准入权威返回的 Desk 列表，沿用 V3-CORE-001 的 checkpoint 和状态机。切换 Room 后旧连接自然失效；停止会清除 checkpoint。协议返回结构化状态，但不向拒绝的来源泄露 Room 快照或安装细节。

## 验证与后续接线

独立 .NET 模拟客户端覆盖错误版本、角色伪装、未知/撤销安装、跨 peer 令牌、角色权限、切页、断线重连、旧会话和恢复。生产 Core 注册关闭的准入实现，并在真实构建/启动中验证；它不会改变 v2 壁纸。

后续工作包将依据 P2/P3 结果实现真实传输 peer 绑定、已校验安装权威和 Player/配置器协议映射。此设计不把模拟身份或直接文件路径当作上线授权。
