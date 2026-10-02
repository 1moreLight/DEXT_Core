# 踩坑记录 · 后端篇（C# / Rust / RPC / 运行时，追加式勿删）

> 格式：症状 / 根因 / 解决 / 防再犯
> 全量索引见 `../ERRORS.md`；其他分册：git / frontend / renderer / toolchain

## 1. RPC 永远超时 + 桌面弹出独立浏览器窗口

- 症状：set_wallpaper 调用挂起超时，屏幕上出现普通浏览器窗口而非壁纸
- 根因：Player 以 Debug 构建时走 `IsDebugBuild()` 分支——显示窗口而不是把 hwnd 发给 Core，Core 的 ShowAsync 无限等待
- 解决：Player 一律 Release 构建（scripts/build.ps1 已保证）
- 防再犯：任何手动 dotnet build 后必须确认是 Release 配置

## 2. tonic 连不上 Lively Core

- 根因：GrpcDotNetNamedPipes 使用自定义线协议，不是标准 HTTP/2 over pipe
- 解决：tauri-ui/src-tauri/src/grpc.rs 手写协议帧
  （RequestInit→Headers→Payload→StreamEnd→Trailers），一次调用一条管道连接
- 防再犯：别试图换回 tonic/http2；改协议先对照 transport.proto

## 3. protox 编译失败

- 根因：C# 侧 .proto 文件带 UTF-8 BOM，protox 不接受
- 解决：拷贝到 tauri-ui/src-tauri/proto/ 时去 BOM；C# Grpc.Tools 不受影响
- 防再犯：改 wallpaper.proto 后同步副本必须重新去 BOM

## 7. WebView2 虚拟主机限制

- 规律：页面只能加载壁纸包目录内的文件（https://<hash>.localhost/ 映射包根目录）
- 影响：视频等大素材必须落盘到包内/房间文件夹内才能播放；绝对路径引用无效
- 关联决策：Room=文件夹方案

## 11. WebWebView2 构造参数 path 是入口文件不是文件夹

- 症状：SaveRoom 报 Could not find a part of the path ...\\index.html\\room.json，桌面编辑无法持久化
- 根因：想当然把构造参数 path 当壁纸文件夹，实际是入口 html 文件路径
- 解决：File.Exists(path) 时取 Path.GetDirectoryName 再拼 room.json
- 防再犯：拼壁纸内文件路径前先确认 path 语义（日志里看实际值）

## 12. 双写用 File.Exists 判断文件夹路径永远 false

- 症状：SaveRoom 写包内成功但源房间从不同步，无任何报错日志
- 根因：__source 戳存的是房间文件夹，代码却用 File.Exists（对目录恒 false）静默跳过
- 解决：File.Exists || Directory.Exists
- 防再犯：存在性判断前先想清楚路径是文件还是目录

## 13. 双写往目录路径 WriteAllText 必抛异常被裸 catch 吞掉

- 症状：修完 #12 后源库仍不同步，且零日志
- 根因：__source 是文件夹，WriteAllText(文件夹) 抛 IOException；内层 catch{} 静默吞掉，两轮排查全被它蒙蔽
- 解决：Directory.Exists(src) 时拼 src+room.json 再写；内层 catch 一律记日志
- 防再犯：**禁止裸 catch**——吞掉的异常就是排障时的黑洞

## 27. apply_room 只覆盖不删除导致跨 Room 运行包污染

- 症状：先应用带 `room.js` / `room.css` / start / end 的 cockpit Room，再应用不带这些成员的普通 Room，cockpit HUD、全屏 Canvas、底部淡字或样式仍留在桌面；重新应用和重启也无法消失。
- 根因：旧 `apply_room` 只在源成员存在时覆盖目标，素材目录也只追加复制；源 Room 缺失可选成员时，壁纸运行包中的上一 Room 文件不会被删除，而渲染器每次仍会加载包内残留的 `room.js` / `room.css`。
- 解决：先完整读取并解析源 `room.json`；校验成功后，对 `background/transition/switch/start/end` 做递归镜像替换，对 `room.js/room.css` 做存在即替换、缺失即删除，最后替换带 `__source` 的运行时 `room.json`。
- 防再犯：Room 应用是“切换自包含包”，不是增量复制。新增任何 Room-owned 顶层成员时，必须加入同一镜像清单，并用“复杂 Room → 缺少该成员的最小 Room”回归测试验证旧文件消失；源 JSON 无效时不得先清理当前运行包。

## 30. 页面提交的 `__source` 造成任意路径回写

- 症状：旧 `saveRoom` 直接从页面提交的 JSON 读取 `__source`，然后把整份 JSON 写到该路径；能向官方页面发消息的内容可伪造任意已存在路径。
- 根因：把运行包内部路由戳误当成 Room 内容，也没有区分“页面数据”和“应用链生成的可信元数据”。
- 解决：Rust 只在验证后的运行包注入规范化源目录；Player 只转发顶层官方页面；Core 从写入前的现有运行包读取可信戳，忽略 incoming `__source`，包内重盖该戳，源副本剥离后原子写。
- 防再犯：安全元数据不能经用户内容往返。凡是决定文件路径、权限或 IPC 目标的值，都必须由可信宿主保存并在使用前重新取回，不能接受页面回传。

## 34. Core 同进程并发保存复用临时文件名

- 症状：桌面编辑保存与 Dock 消息同时到达时，两个任务可能操作同一个 `<room.json>.<进程号>.tmp`，导致替换失败或丢失其中一次修改。
- 根因：异步消息都在同一 Core 进程内，进程号不是一次写入的唯一标识，读改写链也没有实例锁。
- 解决：每次原子写使用新的 GUID 临时名，并以每个壁纸实例的锁串行化“读取可信戳 → 修改 → 包内/源目录双写”。
- 防再犯：原子写临时名必须按写入唯一；只保护最终 rename 不够，基于旧 JSON 的整段读改写也必须在同一锁内。

## 39. 独立 worktree 共享用户 Room 时，未合并字段会被旧分支严格校验阻断

- 现象：CORE-002 从 master 建分支后，用户库里由 DXT-002 写入 `idle` 的 v1 Room 在 `apply_room` 阶段报 `room contains unknown field "idle"`，普通桌面内容也无法应用。
- 根因：工作包代码彼此隔离，但配置器默认读取同一个用户 Room 库；v1 根字段采用严格白名单，较老分支不了解尚未合并的新字段。
- 解决：CORE-002 只把已知的 `idle` 扩展作为向前兼容字段进行结构校验、透传和编辑写回保留，不提供 idle 编辑或运行能力；其他未知字段仍拒绝。复验用源文件 SHA-256 证明应用过程未改用户 Room。
- 防再犯：新增持久化字段时必须同时考虑尚在验收的并行分支；共享用户数据需要明确“忽略并保留”的兼容窗口，不能通过删除字段或回退用户文件解决。

## 44. Windows `canonicalize` 的 `\\?\` 前缀破坏 Room 活动态匹配

- 现象：`apply_room` 成功、桌面已切换，但配置器两秒轮询后又把“使用中”清空，详情主按钮从“停止壁纸”退回“应用此 Room”。
- 根因：Rust 在 Windows 上对源 Room 执行 `canonicalize` 后把 `\\?\D:\...` 写入运行包 `__source`；`list_rooms` 返回普通 `D:\...`，React 用字符串相等判断时永远不匹配。
- 解决：可信戳写入和 `active_room` 返回统一经过 `display_path`，把 extended drive path 还原为普通绝对路径、把 `\\?\UNC\` 还原为 UNC；添加两种前缀的回归测试，并用真 Tauri 应用/停止验证状态。
- 防再犯：canonical path 适合做文件系统安全判断，不等于适合做 UI 身份键。跨 Rust/JS 传递 Windows 路径时必须明确比较格式，并覆盖 drive、UNC、大小写和分隔符差异。

## 46. 删除 Room 复用 v1 内容校验导致旧/损坏 Room 无法清理

- 现象：旧 `black-room` 在列表中可见，但点击删除报 `room.version must be 1`；格式越旧或 JSON 越损坏，越无法从库里清理。
- 根因：`delete_room` 与导出共用 `direct_room_in_library`；该函数把“目标是否是库直属安全目录”和“内容是否为可应用/导出的合法 v1 Room”绑在一起，删除前也执行了严格 Schema 与素材引用校验。
- 解决：提取 `direct_room_entry_in_library`，只验证规范路径、直属关系、重解析点和真实 `room.json` 文件；删除使用这层安全边界，导出继续在其上执行 v1 与素材校验。旧版或损坏 Room 能进入 Windows 回收站，但仍不能应用或导出。
- 防再犯：删除前必须验证操作对象和目录边界，但不应要求待清理对象业务内容健康；业务 Schema 校验只用于读取、编辑、应用、导入和导出等依赖内容正确性的流程。

## 47. 普通窗口预览标记误当屏保标记会错误进入 idle

- 现象：如果把 `WallpaperPreview` 的 `isWindowed: true` 当成屏保标记，库预览、RPC 预览等普通窗口也会误加载 Room 的 idle，无法显示正常 Desk。
- 根因：`isWindowed` 只描述窗口托管方式，不代表实例由 `ScreensaverService` 创建；预览和屏保都会使用窗口化 Player。
- 解决：从 `ScreensaverService` 到工厂、Player 参数和页面查询参数显式传递独立的 `isScreensaver` 标记；只有该标记为真时才进入 `?screensaver=1`。
- 防再犯：生命周期模式必须使用语义明确的独立字段端到端传递，不能从窗口样式、命令来源或路径旁推。

## 48. v2 降级保护误把源占位目录升级为新的 v1 校验前置条件

- 现象：为 `save_room_as` 增加 v2 降级保护后，原本允许从缺少版本的占位源目录写出一份严格合法 v1 的既有流程被提前拒绝，旧 v1 测试回归。
- 根因：把“识别并阻止显式 v2/未来版本源”写成了“源 Room 必须先通过完整 v1 校验”，无意中扩大了操作的历史前置条件；真正需要严格校验的是即将写出的 v1 payload 和明确的新版本边界。
- 解决：源 `room.json` 仅在能识别到显式 `version >= 2` 时阻止降级；缺失版本继续保持既有素材复制行为，目标 payload 仍走完整 v1 校验和原子写入。
- 防再犯：加入新版本写保护时先列出原操作既有输入域；只在最终写入/应用边界加强必要校验，不能顺手把来源元数据或占位目录变成新的业务前置条件。

## 49. Windows 系统媒体 API 与封面流可能永久阻塞

- 现象：Core 直接调用 `GlobalSystemMediaTransportControlsSessionManager.RequestAsync()` 时真实环境超过 60 秒不返回；改用 NPSMLib 后，标题、作者、状态和控制均能快速工作，但 Apple Music 的 `GetThumbnailStream()` 读取会永久阻塞，并使后续媒体查询也超时。
- 根因：GSMTC 会受 Windows 媒体会话服务不稳定影响；部分提供者暴露的 NPSMLib 封面 COM stream 不会完成读取，取消 token 和移到后台线程都不能可靠中断底层同步读取。
- 解决：Core 复用 Lively 已依赖的 NPSMLib 读取媒体元数据和执行封闭动作，但不在 RPC 轮询路径主动读取封面流；Rust `verified_call` 增加 10 秒总超时。封面在未来 Widget Bridge 中复用 Lively Player 已有 `livelyCurrentTrack` 缓存并作为 P2 可选数据转发。
- 防再犯：任何 Windows/COM 媒体调用都必须有进程边界或最终超时，不能在锁内读取未知 stream；“放到后台线程”不等于可取消，若阻塞会污染共享媒体会话。活体测试至少连续读取两次，并在动作/音量探测后恢复原状态。
# #54 v2 LivelyInfo 参数被重复加前缀

现象：真实铺设时 `Lively.Player.WebView2` 以 `CommandLine.UnknownOptionError` 退出，Core 日志显示启动参数无法解析。

原因：`WebWebView2.TryParseUserCommandArgs` 为兼容旧 Lively 参数无条件给所有 `--...` 加 `--wallpaper-`；v2 的 `LivelyInfo.json` 已使用完整的 `--wallpaper-*` 与 `--dext-*` 参数，导致重复命名空间。

修复：仅对未带 `wallpaper-` 或 `dext-` 命名空间的参数补前缀；完整 v2 参数原样传给 Player。重建 Release Player 后重新铺设，Player 正常存活。

下次检查：修改 Player 启动参数或 `LivelyInfo.json` 后，必须运行 `cargo test --lib applies_room_wallpaper -- --ignored` 并检查 `Lively.Player.WebView2.exe` 进程及 Core 最新日志。
# #58 Creator 预览 token 长期有效

现象：配置器打开期间，已检查但未确认的 Creator Pack staging 目录和 token 会一直保留。

原因：`CreatorImports` 只按 token 保存临时包，没有时间边界。

修复：为 staging 记录 `Instant`，设置 10 分钟 TTL；新 inspect 时清理过期条目，confirm/discard 对过期 token 明确拒绝并释放临时目录。

防再犯：任何隔离导入状态都必须有有限生命周期，并覆盖过期状态测试。
# #62 过期 Creator 预览 URL 仍可读取

现象：token 过期后 confirm/discard 会失败，但已打开的预览 URL 仍可能从资源协议读取 staging 文件。

原因：`serve_creator_file` 只查 token 是否存在，没有复用预览 TTL。

修复：资源服务检查 `created_at`，过期时删除 staging 并返回 HTTP 410；有效 token 仍使用 no-store 和离线 CSP。

防再犯：隔离 token 的 TTL 必须覆盖 inspect、资源服务、confirm 和 discard 四个入口。
# #63 Creator 预览 URL 路径校验不完整

现象：资源协议只拒绝 `..` 和反斜杠，手工构造 URL 时仍可携带冒号、控制字符或尾随点/空格。

原因：预览服务没有复用 Creator manifest 使用的 `safe_resource_path` 规则。

修复：中间目录段拒绝 Windows 特殊字符，最终文件段必须通过安全资源路径和扩展名校验。

防再犯：所有从 token/URL 解析出的资源路径都必须经过与 manifest 相同的逐段校验。
# #64 Offline Boundary 把首屏导航当外域取消，Player 每次铺壁纸都黑屏

现象：2026-09-03 09:49 起每次 Player 启动日志必现
`WebView navigation failed: OperationCanceled`，之后永远等不到 `{"Type":2,"Success":true}`，
桌面全黑无 dock（用户 09-05 报「应用壁纸读不到」即此坑，与启动方式无关）。

原因：`IsAllowedDextResource` 的首航兜底写成 `Source 为空串时放行 *.localhost`，
但 WebView2 首次导航前 `CoreWebView2.Source` 返回的是初始文档 `about:blank` 而非空串 →
首个 `https://<hash>.localhost/` 导航被 `NavigationStarting` Cancel → WebErrorStatus.OperationCanceled。

修复：兜底条件改为「Source 为空串或等于 about:blank 均视为尚无文档」，再要求 host 以
`.localhost` 结尾（同域判断不变，外域仍然拦截）。

防再犯：WebView2 生命周期断言（Source/初始文档/事件顺序）要用日志实证再写进拦截器；
导航被主动 Cancel 的统一表现就是 OperationCanceled，见到它先查自家 NavigationStarting。

# #66 与 LivelyInfo.json 重复追加 Player 开关，壁纸应用失败退出码 87

现象：给 `WebWebView2` 恒加 `--wallpaper-system-information true` 后，每次应用壁纸 Player 都
以退出码 87 退出，Core 报 `Error initializing. Unknown options are passed.`（日志实为
`CommandLine.RepeatedOptionError`）。

原因：`wallpapers/dext-room/LivelyInfo.json` 的 `Arguments` 早已携带
`--wallpaper-system-information / --wallpaper-system-nowplaying / --wallpaper-pause-event /
--dext-trusted-host`（21a1bff 能力桥提交），Core 再恒加一次即重复参数；Player 解析失败
按约定 `Environment.Exit(87)`，Core 把 87 归纳为「Unknown options」。此前"Widget 硬件无数据"
的原因另查（元数据开关其实一直在传）。

修复：撤回 Core 恒加开关的改动，参数唯一来源保持 `LivelyInfo.json`。

防再犯：给 Player 增删启动参数前先看 `wallpapers/dext-room/LivelyInfo.json` 的 `Arguments`
与 `TryParseUserCommandArgs` 的命名空间归一化，同一开关只允许一个来源；遇到退出码 87 直接查
Core 日志里的 CommandLine 错误类型（Repeated/Unknown）。

# #103 WM_MOUSEMOVE 没有 MK_MOVE：0x20 是侧键状态

现象：真实图标按下获得 capture，随后 lostpointercapture 的 buttons=8，图标恢复原位；浏览器测试正常。

原因：master 继承的 InputUtil 用自定义 MK_MOVE=0x20 转发每次 WM_MOUSEMOVE。该位实际是 MK_XBUTTON1，
在 WebView2 中变成 buttons=8，同时丢掉左键位。UP 又错误地保留按住位。新图标代码在捕获丢失时立即
回滚和移除事件监听，Widget/早期图标没有该处理，所以表现不同；“移动日志缺失”也可能是监听已清理，
不能据此断言宿主未发送消息。

修复：MouseForwardingSession 统一持有 DOWN 接收 HWND 和坐标原点；MOVE 保留左键，UP 清除左键并只发一次。
已开始的手势不再按当前前台/显示器重新选择释放目标；未属于转发会话的物理按住不注入 hover=0。
RawInput 按位拆解组合按键标志，负 client 坐标按 signed 16-bit 打包。移除临时 Renderer 日志，保留取消回滚。

验证：原生隐藏窗口测试先得到 expected 0 / actual 0x20；修复后通过。隔离 Release Player 实验准确复现
旧 buttons=8，再验证十轮原生转发得到 capture、MOVE buttons=1、UP buttons=0 且无提前取消。
这个自动检查不替代真实 WorkerW/物理鼠标验收。命令见 tests/Dext.Input.Tests/README.md。

# #110 缺失 Core 文件不能先于运行身份探测而隐藏重试入口

现象：配置器仍在、Core 已退出时，临时移走当前 worktree 的 `Lively.exe` 后，顶栏变成“连接异常”且没有“启动 Core”按钮；用户无法点击以获得明确错误，也无法重试。

原因：轮询身份的包装函数先解析并要求 Core 文件存在，才去查询 Pipe。文件缺失错误因此覆盖了“Core 未运行”状态。

修复：轮询先查询 Core；仅在有响应时检查其是否为配置器所属的可执行文件。启动动作自身继续检查文件存在及 Dext 产品元数据，并给出“缺少启动文件，请重新构建或修复安装”的可见错误。文件恢复后同一按钮可重试。测试时已将临时移走的二进制原样恢复。

# #111 Core shutdown 辅助进程遇到单实例退出竞态

现象：V3-CORE-001 重建前用同一 `Lively.exe app --shutdown` 请求现有 Core 退出，原 PID 退出后仍出现一个来自本 worktree、命令行带 `app --shutdown` 的新 `Lively.exe`。它锁住 `Lively.exe` 输出，`scripts/build.ps1` 的 Core 步骤报 MSB3027/MSB3021。

原因：本次观察到 shutdown 辅助进程与原单实例退出交错；辅助进程在原 Core 消失后取得单实例身份并走了正常 Core 启动路径。仅等待原 PID 结束不足以证明输出文件已解锁。

修复：枚举并核对新 PID 的可执行绝对路径和 `app --shutdown` 命令行，确认是本轮辅助进程后停止它，再重跑构建。后续优先用配置器受控 `exit_core`/RPC 正常退出；重建前核对所有同路径 Core 进程已退出，不仅核对原 PID。不得按进程名盲停其他 worktree 或用户安装的实例。

# #112 一次性过渡计时器遇系统时钟回拨后未重排

现象：Room 切页开始后系统时间回拨，一次性定时器按原等待时间触发，但当前时间仍早于截止时间；回调直接返回，目标 Desk 一直停在过渡态。

原因：`ExpireTransition` 拒绝提前到达的超时，却没有重新设置已经消耗的一次性定时器。

修复：保持截止时间检查，提前到达时按剩余时间重新排程；新增可控时钟回归，先复现失败再验证自动提交。内核 8/8、完整构建、运行身份与启动日志通过。

# #113 会话入口未绑定已校验安装快照

现象：入口只核对当前内核快照的 RoomId；安装快照标识更新后，新客户端仍能看到旧会话。直接调用内核启动的同 Room 会话也能被入口当成协议会话读取。

原因：连接准入校验了安装身份，但活跃会话没有记录由哪个已校验安装快照经受控入口创建。新连接只用 RoomId 匹配内核状态。

修复：入口在 Start/Restore 成功时绑定 SessionId、RoomId 和安装快照标识；Open 和所有后续命令均要求该绑定与当前准入、内核快照一致，Stop 清除绑定。两个回归先失败（12/14），修复后协议 14/14、内核 8/8。

# #114 协调者连接能绕过视图切页权限

现象：协议实现已限制启动、恢复、完成和停止的角色，但 `Request` 没有拒绝 `Coordinator`；协调者可直接触发 Desk 切换，与设计中的桌面/Dock 视图权限不符。

原因：`Request` 只检查了连接准入、会话和 Desk 身份，没有检查角色。原测试借用协调者连接触发切页，掩盖了缺口。

修复：改用桌面连接测试未知 Desk 与重连，并补协调者请求返回 `Forbidden` 的失败回归（13/14）；入口增加角色拒绝后协议 14/14、内核 8/8。

# #115 网关关闭订阅时与并发推送形成锁顺序死锁

现象：V3-CORE-003 的并发回归中，一条线程持有网关锁并关闭连接，另一条线程持有内核观察者锁等待进入网关回调；关闭若同步调用内核订阅的 `Dispose`，双方互等。

原因：内核通知先取得观察者锁再进入网关；网关关闭先取得网关锁再等待观察者锁，锁顺序相反。

修复：网关锁内立即标记订阅失效并移出表，内核句柄的实际释放排到线程池执行。即使内核尚未来得及释放，回调也会先检查失效标记，不再向旧连接推送。并发回归先超时（19/20），修复后 20/20。

# #116 初始订阅回调同步改变会话后返回旧修订

现象：订阅建立时内核立即回调完整快照；回调可同步请求切页并收到下一修订，但 `Subscribe` 的返回仍是进入订阅前的旧修订。

原因：返回值捕获了注册前的 `current`，未在初始通知完成后重新核对连接与内核快照。

修复：初始通知返回后再次验证准入和当前会话，并以最新快照作为结果；若回调已关闭连接或更换会话则不发有效句柄。回归先失败（20/21），修复后协议 21/21、内核 8/8。

# #117 checkpoint 不可读被误报为无恢复点

现象：FileRoomSessionCheckpointStore 先用 `File.Exists` 判断，读取的 IO/权限异常也一律吞掉返回 `null`；上层无法区分“从未保存”与“磁盘或权限暂时不可用”，恢复命令只得到笼统拒绝。

原因：`File.Exists` 在部分无法访问的情形返回 `false`，泛化的异常捕获又丢失了存储故障类别。

修复：直接读取 checkpoint；文件/目录确实不存在和 JSON 损坏仍返回无恢复点，其他 `IOException` 或 `UnauthorizedAccessException` 向受控协议传播并映射为 `StorageUnavailable`。文件路径指向目录的实际读取回归通过；协议 27/27、内核 10/10。

# #120 外置 Cargo target 导致同分支 Core 身份误拒

现象：配置器从 D 盘共享构建缓存启动时只出现空小窗口或无法连接；Core 已从本 worktree 启动，配置器仍无法解析其对应的 Core 路径。身份脚本把配置器显示为 OTHER。

原因：`core_path_for_configurator` 和身份脚本仅接受 `tauri-ui/src-tauri/target/debug`，未考虑编译时的 `CARGO_TARGET_DIR`。此前为节省 C 盘空间把 Rust target 重定向到 D 盘。

修复：配置器以编译时 `CARGO_TARGET_DIR` 或标准 target 识别自身，始终从编译时 manifest 所在 worktree 定位 Core；身份脚本支持当前环境的 target 目录。Rust 定向回归和真实三进程路径/pipe 核对通过。

## #123 公开 config 的 Schema 与原生校验必须一致（2026-10-02）

V3-P3-001 的公开配置 Schema 要求对象，初版递归数据检查却允许顶层数组/字符串。新增真实行为回归先失败；递归入口在 depth=0 检查 object 后通过。嵌套 target/secret/绝对路径仍拒绝。以后新增 Value 类型配置时同时验证形状、引用与隐私限制，不把递归遍历通过等同于完整契约通过。
# #124 原生安装拒绝异常必须在准入边界收口（2026-10-02）

- 现象：Core原生样包可以绑定，但摘要/结构反例向调用方抛异常，测试33/42。
- 原因：独立校验器使用InvalidDataException；原准入catch只含IOException等，未覆盖它。
- 修复：准入明确捕获无效数据异常并返回拒绝；保持未知程序错误可见。同一反例回归全部通过。
- 检查：同时跑正例与重新摘要后仍非法的结构反例，避免“所有包都拒绝”造成假绿。
