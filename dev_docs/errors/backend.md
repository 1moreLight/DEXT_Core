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
# #126 原生v3双语言边界必须校验原始JSON并采用同一排序（2026-10-02）

- 现象：Rust能安装Core拒绝的作品；U+E000/U+1F600资源顺序相反，重复JSON键被Value抹掉，config:null被Option当缺省。
- 修复：原始字节通过递归唯一键解析器再转Value；显式null结构拒绝；Core按UTF8字节排序。公共config内部nullable值仍保留。
- 检查：共享Unicode安装样包，重复原始键/空config的先红后绿回归，不能只检查解析后的对象。

# #127 私人file URI检查须忽略scheme大小写（2026-10-02）

- 现象：file:被拒但FILE:/FiLe:进入公开config。
- 修复：Rust前缀eq_ignore_ascii_case、CoreOrdinalIgnoreCase；合法HTML入口配匹配资源摘要后回归，避免另一个入口错误掩盖漏洞。

## #129 安装时先查路径再写入/改名，暂存链接与发布替换可越过校验（2026-10-02）

- 现象：真实Windows回归中，暂存assets被换成junction后旧写法先覆盖外部文件再拒绝；发布前目标和暂存目录可被另一个操作改名。
- 原因：目录/文件属性检查与后续路径操作之间存在竞态；Drop中对失去所有权的路径递归删除同样不安全。
- 修复：保留已检验根/祖先/资源句柄，checked create_new写入；目录发布用SetFileInformationByHandle改名并拒绝删除共享。失败不覆盖新出现的非本包目标，旧安装及失败暂存留给有界核验清理。
- 检查：独立Rust28/28，包括两项真实RED→GREEN；Core46/46。掉电恢复/清理仍是最终发布门槛。

## #130 FILE_RENAME_INFO长度不含NUL，但FileName需提供终止符（2026-10-02）

- 现象：个人快照SetFileInformationByHandle间歇ERROR_INVALID_NAME；锁定旧文件测试偶尔未拒绝，实际目标名被读到缓冲区末尾之外。
- 原因：按FileNameLength仅分配UTF16内容，遗漏FileName要求的NUL终止符；原生调用读取了非本次数据。
- 修复：缓冲区多分配并清零2字节，长度仍写入内容字节数。现有真实保存/重开/旧文件锁定回归6/9→9/9。
- 检查：不能只检查Win32返回成功，必须重读固定目标名并验证旧文件被锁时发布失败且原字节不变。

## #131 Explorer代启成功分支丢失应用参数（2026-10-03）

现象：受控WinExe捕获参数回归失败，Explorer path=True，未生成捕获文件。原因：AppCatalogService.Launch把arguments留给fallback，ExplorerShellLaunchService.ShellExecute固定空参数。修复：TryOpen显式接收arguments并传ShellExecute；已有调用保留可选参数。真实受控目标验证带空格参数和工作目录均正确，测试先RED后GREEN。以后须验证实际Explorer路径，不能以替代delegate断言代表原生启动。

## #132 桌面暂停错误拒绝可见Dock绑定（2026-10-03）

现象：Dock launch keeps equal permission while desktop is paused回归23/24，返回NotOperable。原因：动作权威对所有视图应用桌面IsOperable。修复：只有Desktop签发/激活受该状态限制；Dock仍查安装、消费者、授权、绑定与一次性输入，导航继续由会话内核仲裁。24/24 GREEN。真实宿主仍须核验当前可见Dock及物理输入，票据单元测试不能代填该门槛。

## #133 缓存上下文跨过撤销的动作派发（2026-10-03）

现象：35项最终回归前，关闭/停止/暂停/安装解绑替换及个人grant/target/revision修改8项实际失败（25/33）。原因：Context和个人Read分别释放锁后，旧上下文仍用于后续启动。修复：在短同步准备边界保护私有快照、gateway、安装权威和kernel当前状态，消耗票据返回不可变计划；原生launch/gateway.Request在所有锁外执行。gateway竞争时不持私有锁阻塞，释放后重试，防观察者反向读个人数据死锁。单调过期在等待后再次核验。35/35、协议46/46、内核10/10及Explorer实际启动通过。规则：撤销在准备提交前生效则拒绝；已提交动作可能完成，后续撤销影响未来动作。以后不能只补一次快照重读，必须保留线性准备边界及共享锁外副作用。

## #136 输入探针显式源码依赖未同步（2026-10-03）

Dext.Input.Tests显式链接RoomSessionProtocol.cs；CORE-006增加RoomActionCatalog/RoomActionContext后，探针未同步Compile Include，还原依赖后真实编译出现4项CS0246。本轮补RoomActionCatalog与RuntimeContext源文件引用。新增协议依赖时检查所有链接该源文件的csproj，不能只验证主Core和协议测试项目。

## #138 快照跨进程投影漏字段（2026-10-03）

内核快照新增信息不会自动穿过WebWebView2的DTO映射与Player Form1匿名JS投影。隔离ReleasePlayer实际只收到旧字段，测试失败。新增唯一RoomSessionPlayerMessage投影并由生产与探针共用；消息DTO和Form1显式传递queue/deadline/active/installationStamp/lifecycle，实际页面正反两组状态通过。gRPC/Rust/TS也同步字段，后续变化须验证实际接收端，不能以内核测试代替IPC。

## #140 媒体槽权限必须独立检查阶段和前台修订（2026-10-03）

新增回归实际36/44失败：slot消费者未建立，个人130项上限不足196项，统一IsOperable又使starting/idle全部拒绝。若只放开IsOperable，还会使暂停/锁屏或后台消费；原先非桌面阶段的前台变化也不递增revision，旧票据可能恢复可用。

从已验证清单建立独立媒体消费者；结构活动检查stage/Desk/role，实际消费再检查暂停/锁屏/前台，Dock仅保留桌面暂停例外。Core前台事实进入同一内部快照，每次变化推进全局revision；个人最大196、background稳定ID后缀80字符。新阶段/锁屏/前台/等待竞态与最大数量回归44/44通过。原生Windows事实和物理输入仍必须后续实接，单元票据不代替实机验收。

## #141 Windows事实必须进入首个快照并原子更新（2026-10-03）

旧协调者Start/Restore未传Windows状态，内核默认未锁屏/桌面前台；即使随后补发SetLifecycle再SetOperable，解锁与前台变化也可能分成两帧。播放策略又不等于实际每显示器暂停结果。

独立RoomRuntimeFactsSource记录实际Pause/Play、锁屏和独立前台，未知状态限制操作。Start/Restore直接构造完整初始状态；SetRuntimeFacts一次提交三事实，存储失败保留原快照并允许相同采样重试。协议72/72包含首次订阅无宽松中间态、后台解锁从不出现可操作修订、权限边界及显示器范围。完整构建/真实v2恢复启动通过；真实原生v3锁屏与唤醒验收仍须后续执行。

## #142 Framework Player标准输出编码破坏Unicode（2026-10-03）

真实IPC探针发送中文清单并回读，名字变成替换字符；纯Json.NET内存测试未发现。Player使用Framework控制台默认编码，Core/.NET9按UTF-8读管道。统一SendToParent使用StringEscapeHandling.EscapeNonAscii输出ASCII JSON，实际中文精确匹配通过；探针stdin明确UTF-8，与Core一致。不能仅用同进程序列化测试宣称跨进程Unicode正确。

## #143 重复异步Resume取消首次重放（2026-10-03）

真实WebView测试将media JS延迟120ms，暂停后连续发送两次Resume，第一组快照成功但恢复重放超时。重复Resume递增修订后直接返回，首次await完成已不匹配，最后缓存状态从未发布。现在仅实际暂停→恢复增加playbackRevision，重复Resume不改它；runtimeDeliverySuspended独立跨异步恢复保持，完成后依次重放context/最后快照或revoke。实际五组探针通过，不以同步模型代替UI异步时序。

## #144 非对象Desk导致上下文接收抛异常（2026-10-03）

接收器直接读取declaredDesks中的id，标量/null消息触发Cannot access child value on JValue，回归17/19。先核验每项JObject和id字符串、资源字符串数组，再投影；19/19通过，非法新上下文不破坏上一份有效状态。

## #146 WorkerW层级日志与物理验收的区别（2026-10-03，待Task4复核）

真实启动日志20261003_032422出现一次Unexpected WorkerW Z-order。现有EnsureWorkerWZOrder检测最后子窗不符后调用SetWindowPos到HWND_BOTTOM，随后Player loaded/ready成功；代码没有检查该原生调用返回值。本轮仅证明进程/管道身份、恢复和正常退出，未量测纠正后的物理层级。不把身份成功写成层级测试通过；最终WorkerW/DPI门槛须验证实际呈现。

## #147 合法资源路径超过完整Windows MAX_PATH（2026-10-03）

现象：资源31项阶段新增最大240字节相对路径后原生服务返回403，实际Framework Player也读取失败。原因：安装目录前缀使完整路径超过传统Win32限制。修复：CreateFileW使用已规范化、已验证根下的扩展绝对路径（本地与UNC分别处理）；句柄最终路径仍做真实根边界检查。最长资源与Unicode路径在纯测试和ReleasePlayer实测通过，未放宽240字节清单上限。

## #149 RTC构造异常不是Connection-Allowlist生效判据（2026-10-03）

现象：响应有webrtc=block，new RTCPeerConnection仍成功，旧自检错误退出。原因：策略拒绝ICE候选/连接，不要求构造抛SecurityError。修复：带report-to token但不配置外部报告端点；新ReportingObserver监听connection-allowlist，构造无ICE server的peer后takeRecords，核对当前URL、单一响应origin、connection=webrtc及disposition=enforce。close/disconnect清理；无有效强制报告则诊断退出。官方/沙箱页真实报告和缺API反例通过。

## #150 Runtime禁RTC与mDNS接口初始化冲突（2026-10-03，仍有最终恢复门槛）

实测WebView2 153.0.4234.32：inherited about:blank中RTC构造，以及同一官方页reload后再次构造，可使renderer退出，kind=RenderProcessExited/reason=Crashed/exit3。Chromium日志明确No binder found for interface network.mojom.MdnsResponder及bad IPC123。当前Chromium源码在强制webrtc=block时不注册该binder，但RTC工厂仍可创建MdnsResponderAdapter并请求它；与现场吻合，不能归咎于opaque origin或资源摘要。

官方能力自检改为每个WebView实例一次，每次文档仍有相同强制响应策略，实际资源/撤销/reload回归通过。ProcessFailed撤销资源、清就绪状态，并报告类型/原因/退出码。该规避不保证恶意作者反复构造RTC时的稳定性；P5 Task4保留真实故障恢复门槛。被移除的about:blank诊断用例不计通过；不靠放开RTC、关闭策略、JS覆盖API或不受支持的flag伪造边界。详见resource-research的官方源码链接。

## #152 原生JSON字段须先验类型和形状（2026-10-03）

输入协议初版用JToken强制转换/ToObject，测试14/25：1.2可转整数，数字字符串可转double，缺x/tabIndex取0，未知几何字段被忽略。改为严格Integer/Float/String token、必需且唯一的字段形状、有界安全整数、重复consumer/button拒绝；25/25通过。入口大小/深度/重复JSON键/尾部JSON和当前代次身份共同校验，不以DTO反序列化成功代替边界。

## #153 原始键盘BREAK/E0是独立位（2026-10-03）

RawInputMsgWindow旧Flags!=Up会把E0|Up误当Down，InputUtil又把所有按键设置extended位。改为BREAK位1判断松开、E0位2判断扩展；向Core事件保留扩展事实，普通Enter不加bit24，真正扩展键才加；keyUp的previous/transition位为1。隐藏原生接收窗口验证实收lParam和Raw flags，不能只用JS键盘测试代填。

## #158 SetParent后再次恢复原始样式（2026-10-03）

原生闲置还原的父窗和矩形正确，但STYLE多出WS_CLIPSIBLINGS，严格测试失败。SetParent会改变相关窗口状态；先规范为child、重挂后再写回完整原始style/exstyle并刷新frame，随后核验实际状态，负坐标夹具精确还原通过。不要只以SetParent返回值代替还原成功。

## #159 原生popup祖先与实际置顶（2026-10-03）

实际WinForms Player脱离后带隐藏owner，GetParent非零并不代表仍在WorkerW。以GA_ROOT确认独立根窗口、GA_PARENT保存/恢复真实父窗；参见[GetParent](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getparent)、[GetAncestor](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getancestor)。传统WorkerW保留popup样式，不能只接受WS_CHILD。

传统parented-popup重挂后SetWindowPos(TOPMOST)返回true，但实际WS_EX_TOPMOST未设置；重复样式/布局刷新均未解决。显式NOTOPMOST→TOPMOST后真实根窗口、可见性、矩形和TOPMOST位全部符合。普通child与实际ReleasePlayer两种样式往返及DPI120还原通过；多系统DPI/实际WorkerW和故障重建仍未代填。

## #164 原生暂停必须先停止官方宿主的活动期限（2026-10-03）

Player暂停期间缓存Core快照，媒体宿主仍读旧playbackPaused=false；直接挂起/恢复渲染不能保证JS活动期限停止。实际ReleasePlayer回归在收到暂停后产生revision1的500ms启动完成，没有暂停回执。新增私有ExecuteScript同步通知，await完成后才原生挂起；media/frame停止计时、媒体意图和来源。恢复同步处理最后缓存Core状态再释放，跳过旧TryPlayMedia的无差别全节点播放。当前revision3、剩余活动计时及新来源修订实测通过；Core生命周期事实不被此本地暂停门修改。原生逐iframe媒体与完整页面仍待接线。

## #165 新官方模块仍须显式加入原生资源白名单（2026-10-03）

新增playback-host.js并在隔离官方页引用，但DextNativeResourceServer有限白名单没有它。后续clockStart无法访问模块并超时；这一失败不计暂停逻辑RED。加入单个具名官方文件并重新部署ReleasePlayer后，实际暂停回归才测到#164。内容清单与官方模块白名单是两个范围，不能用放开目录映射修复。

## #167 硬件来源健康状态与最低采样间隔（2026-10-03）

源检查发现CPU/性能计数器失败后仍发布默认零读数，且跳过后续GPU等待可能使while循环忙跑。增加IsAvailable健康标记；失败missing，非有限数error；每轮按Stopwatch补足至少1秒周期。假来源验证失败不会伪造available，实际机器健康采集通过；没有把健康采集称为强制真实计数器失败验证。

## #169 媒体来源标识可能含Windows路径（2026-10-03）

实际Windows生产投影的回归以SourceAppId=C:\private\player.exe构造来源，97/98失败：GetMediaAsync返回的source ID并非总是公开AUMID。投影清空含冒号、斜线、反斜线、控制字符或超过160字符的ID，保留媒体元数据；audio只level/muted。修复后98/98，来源测试同时断言所有系统控制写入为0。

## #170 原生WebView传输必须与Player读取类型一致（2026-10-03）

native-host最初postMessage已检查的JS对象，单位假传输收对象因此通过；真实Player的TryGetWebMessageAsString抛ArgumentException，SDK权限超时全部denied。保持Player既有字符串入口，生产模块JSON.stringify已检查的信封；单位传输增加typeof string断言再解析。实际ReleasePlayer持续读数、同修订撤权/恢复及暂停全部通过。格式问题不能改为把授予失败视为期望通过。


## #176 Frame.Destroyed回调中注销原生事件可使WebView宿主崩溃（2026-10-03）

真实ReleasePlayer播放根音频、closed Shadow视频及嵌套音频后撤销，连续三次在EmbeddedBrowserWebView.dll 154.0.4258.48 x86以0x4000001f退出。Windows Application 1000/1001确认原生模块，非普通媒体策略异常。在Destroyed内再次对正在销毁的Frame注销COM事件产生重入；改为只移除缓存FrameId、父链/作用域和期望状态，由原生销毁清掉事件；正常活体Dispose才注销。相同整页撤销随后通过，最终媒体/原官方整页再次通过。销毁回调闭包绑定自己的Frame，不依赖事件sender重新认领身份。

## #183 JSON字节上限不等于容器项数上限（2026-10-03）

新消费者存储初版限定32KiB/深度24，却允许含4097个0的小数组，违反作者API每容器最多4096项。真实生产检查返回Accepted而非Denied，109/110。规范化值后递归核对每个object/array项数，落盘验证同样调用，修复后110/110。拒绝超限写入前不修改候选个人快照，原字节保持；SDK校验不能替代Core边界。

## #184 私有KV不能复用通用IPC原文日志（2026-10-03）

真实Core已授权SDK存储成功后，唯一私有marker在Core日志出现，实际检查失败。新增ValueJson通过现有通用Logger.Info(e.Data)被完整复制到诊断文件。原生请求独立日志分支只记录method/generation/revision，省略consumer/key/value/raw payload；实际Core同一夹具再次通过marker不出现、撤权与重启持久读取。传输JSON必须有界和当前授权，但这不会自动保护通用日志；新增含个人值的IPC须检查真实生产日志。

## #187 TargetId-only个人绑定不能在空默认入口中丢失（2026-10-03）

导航生产者回归125/128中，合法无作者默认动作的按钮配了个人TargetId，公开Action仍null/IsBound=false，正常激活也会MissingBinding。Resolve只在已有binding.launch动作时读取TargetId；空默认入口缺少动作推断。保留显式个人Action→作者默认Action原优先级，两者均不存在时才以TargetId推断binding.launch。实际源码128/128通过，公开元数据正确、作者动态导航不能绕过该个人绑定，普通activate仅启动一次。另补无任何配置入口的已授权真实输入动态导航与未知Desk提前拒绝；GUI/SDK原生接线与物理输入仍后续验证。


## #188 原生鼠标UP生成证明但没有投递激活
- 2026-10-03，P5作者导航接线发现：NativeMouseUp正确生成Completed，但NotifyNative最后参数为false；只有DOM click作者处理器可以主动消费，纯画布默认按钮缺少原生激活事件。
- 改为true，并为真实完成附加私有单调序号。官方图标只走原生事件，去掉与Core事件竞争的DOM click派发。代码路径发现不冒充旧物理失败；最终实际Core Windows注入产生activate/sequence1和一份inputConsumed回执。
- 回归核对鼠标/Enter/Space所有完成路径、Core原生事件、作者/默认共同消费与旧序号拒绝；最终人工输入仍独立验收。

## #189 导航成功被修订更新误报旧输入
- 2026-10-03，真实生产JS行为RED15/16：保留当前文档的Core导航请求，Core先发布新修订，再到达真实accepted回执，native-host.acceptIdentity取消在途请求并向SDK返回staleInput。
- 只在同一generation/session的修订推进时保留已发出的activate/navigate请求及其有界计时；回执必须精确匹配原请求身份和私有消费字段。新代次/会话、暂停、销毁仍取消所有请求，数据/权限/存储旧修订规则不放宽。
- 不是重派旧请求或给重放成功。原始请求仍由Core按实际证明/个人授权消费；DOM仅公开status。实际Core作者SDK得到accepted，原生完成仅一份消费回执。queued与expiredInput加入原生安全状态集合，Frame错误保留expiredInput。

## #193 Windows控制等待后仍须核对取消
- 2026-10-03，接线前复核发现既有ControlMediaAsync只在mediaLock前检查token；等锁/读取来源期间请求可已超过Core4s期限。锁内取得后、发送命令前再次检查。
- 原SetVolume新增带token重载；保留既有签名，通过无取消token转调。解析默认endpoint后每次写level/muted前重新检查，Core只调用带token版本。真实已取消请求拒绝且设备ID/level/mute未改变。
- 这是源码发现的迟到执行风险与新取消API的RED/GREEN验证，不宣称已复现Windows挂死；已发出的单个COM调用不可被此检查撤回，挂起并发槽位仍需持有至实际终止。

## #196 Player故障必须退役易失会话再恢复已提交checkpoint
- 2026-10-03，原Proc_Exited解绑但Kernel仍有snapshot；同Core新Player的TryRestore要求snapshot==null，随后Start覆盖为startDesk。新增Core内部Retire：核对session、停timeout、清易失状态，完全不读写checkpoint；gateway清旧连接/订阅，迟到旧PID/session不得退役新会话。协议和同Kernel回归23/87项通过，实际同Core独立Player故障恢复focus/KV/新身份。
- Close/Terminate在发送关闭或Kill之前原子记录主动关闭；真实unexpected Exited才排Dispatcher恢复。取得wallpaper loading lock之后再核对旧实例仍当前，Core Dispose先设停机guard，产品退出期间不重生。每Core30秒最多3次自动恢复，初始Show失败不无限重建；失败自动构建不得保存空布局覆盖现有恢复布局。
- 已核验的native idle父窗恢复失败关闭是故障，使用独立内部TerminateAfterNativeFailure保留故障识别；它不会清除先前主动关闭标志。该Win32失败组合仍在最终人工门槛内，不冒充本轮实际父窗破坏测试。

## #201 多边形不能由包围框签输入证明（2026-10-03）
P5生产authority新增行为测试实际RED：归一化三角形包围框内、三角形外的OS点仍得到完成证明；旧几何只有矩形。同动作多图标也被视为重复入口或DOM吞掉第二个。新增私有呈现entry与凸多片区域，包围框只快速排除，Core测严格内部；DOWN/UP同呈现entry，Tab可区分同动作不同图标，动作仍按consumer/button和一次native完成消费。不能用新entryId/视觉焦点作为证明，输入数组必须脱离且公共Focus/Proof不能泄漏可变几何。具体最终验证见当前验收卡。

## #206 已撤销文档nonce不能通过较新修订复活（2026-10-03）
bounded native request join更新当前snapshot时需保留同文档rN水位，初版RegisterFrame却在RevokeDocument后允许相同epoch/nonce以更大revision恢复Active。正式行为RED83/84后增加DocumentRevoked，只有实际新的native文档epoch+nonce能重新注册；同文档修订只允许正常revision撤销后的恢复，不能抹去真正文档退休。RevokeAll终结整个join实例，旧callback不能复活；最终84/84。该helper仅关联请求，Core物理证明及授权仍须另行复核。

## #208 私有手势关联需要在DOWN冻结，截止UP不能重新开始（2026-10-04）
旧Core只在UP分配完成序号，Player无法在实际DOWN之前用同一正数关联arm作者文档，UP也可能在物理1500ms截止后新建已过期proof。新增生产RED238/254后，序号改为DOWN分配、UP原序号完成；视口/DPI/OS点/scope/时间不可变，未完成长按按elapsed>=1500ms撤销，动作权威统一半开期限。完成后才过期仍返回expiredInput，不放宽默认动作或作者权限。
相邻输入设备的新DOWN替换旧pending，晚到另一设备UP不能取消或消费新对；空区域DOWN只记录事实，后续移动视觉样本才能产生按钮完成。修复后254/254、完整build/start/正常退出通过，原四文件保持。本段尚未向Player/SDK发送正数关联，不声称解决整条作者timer入口。

## #209 输入接线只注册直接作者root，保留嵌套媒体播放（2026-10-04）
Player新增native input describe后，实际媒体wire在嵌套/blank媒体子文档拿到null，JObject.Parse抛错并按策略正常关闭。输入根资格本来只允许Parent==null，故LoadAsync只对直接作者root读取/验证guardian nonce；嵌套媒体继续既有media policy，不注册输入。增加真实异常原因诊断，实际ReleasePlayer相同媒体wire通过，不放宽直接root的guardian验证。
旧Player为.NET Framework4.7.2且csproj显式Compile：新partial文件须具名加入Compile，PID使用using Process.GetCurrentProcess().Id缓存；首次遗漏Compile与Environment.ProcessId编译错误不计行为RED。
指针取消曾沿最初DOWN坐标，MOVE后Invalidate导致释放回跳；新增实际生产队列行为RED9/10，保存最新转发的MOVE后10/10。取消仍先撤销再UP，不调用动作完成回调。

### #170 补充：顶层原生派发receipt也必须匹配字符串接收（2026-10-04）
Player的直接frame媒体/输入receiver可读WebMessageAsJson；固定官方顶层现有Form1仍用TryGetWebMessageAsString。新增官方trusted DOWN/UP dispatch回执错误地照搬frame对象postMessage，实际完整官方宿主DOWN等待回执超时并关闭自己的Player。作者root的隔离wire通过不能替代顶层链验证。
增加真实格式行为断言，RED26/27（object不是string）；官方bootstrap先捕获JSON.stringify，将私有receipt序列化为字符串，GREEN27/27。完整build后正式index/main/dom/native/frame/media/SDK实际ReleasePlayer两边采样与一次图标默认动作通过；原前台保持、暂停/切页/撤销回归通过。未改变既有顶层来源或Core物理/权限规则。

## #216 单个焦点gesture丢连续Tab，早到键用错焦点（2026-10-04）
生产功能实质RED291/295：第二次raw Tab替换第一请求，第一样本被拒；取样待回时Enter/Space没有记录DOWN，早到UP丢失。新增编译RED不能代替这四项行为失败。
未回焦点请求改有界FIFO，每份当前可见样本按首项推进；激活冻结原始键/scan/QPC/序号和此前末项屏障，UP提前到只标释放，最终焦点后发送原一对。过期前置Tab取消待键，禁止旧焦点或续签时间；新鼠标/几何/会话仍撤销，动作不是多项队列。GREEN295/295及生产Core authority/key delivery+实际ReleasePlayer连续ShiftTab/Enter样本整轮通过，raw OS/完整Core窗口和回复fixture单列。
夹具编译曾将Guid SessionId调用ToString写入私有pointer，CS0029后按真实DTO类型改回Guid；不放宽消息类型，不计该编译错误为生产功能RED。

## #221 零序号不能表示最近完成（2026-10-04）
正式Core/Player链已使用DOWN正数关联，Core GetProof仍有sequence=0与零值匹配任意当前proof的旧兼容，消费bridge亦默认0。必要实质RED295/299确认零lookup/启动/导航/系统控制可取得后来完成。移除默认参数与零回退，Player四种消费parser要求正数，Core299/299与消息72/72、最新部署实际正式Player组合通过。
旧fixture显式传其实际构造完成序号；正数但错消费者/几何应StaleInput，零内部调用InputRequired，均不消费。失败reply0与尚未经过native request join的作者原始authorInput不代表动作准入，不能混同为零值消费。实际Core OS/物理DPI最终门槛仍待补。

## #225 原生应用统一启动路径并等待真实新会话（2026-10-04）
真实Tauri导入/保存后apply_room返回Ok，但Core inactive、Player导航OperationCanceled。资源服务器先Path.GetFullPath再计算虚拟域名，官方文档校验却从原始启动URL计算。配置器常量含src-tauri/../../，二者域名不同，此前使用规范路径的探针不能证明配置器入口。
apply_room规范宿主绝对路径并剥扩展前缀。SetWallpaper只报告排队，最多25s等待当前Room新session/有效Player/安装戳与稳定完整安装快照，之后才记私有来源和返回成功；失败明示保存完成、应用未确认。同安装重复应用的新session/Player实机通过。active_room原生分支要求Core会话活跃/有效Player及来源记录匹配完整安装；来源不注入作者清单。

## #239 原生Dock资格与偏好不可冒称宿主运行（2026-10-04）
P8接线源码核对发现：只查当前Desk的任意role=dock组件会把普通桌面Dock误报为原生Dock，与已冻结ROOM_V3的dockComponentId不符。现在从当前已核验安装读取该明确ID并查有效Desk引用；UI用独立Core runtime.phase/PID/available事实，enabled只表示已保存偏好。当前宿主尚未接入明确hostPending/PID0，常驻unsupportedMode；不会用保存accepted制造running。公共IRoomSessionRuntimeCoordinator新增返回类型需public，已一并核对修正；未运行编译器或伪造实际失败/通过证据。

## #240 隐藏 Dock 不能沿用可见窗枚举和 DesktopPlayer 独占上下文（2026-10-04）
源码接线发现：旧GetProcessWindow(nativeSearch:true)只返回IsWindowVisible窗口；正式Dock初始化期间隐藏，继续用它将取不到根HWND。同时协议ReadRuntimeContext/Subscribe初始化/Replay仅准DesktopPlayer，新增Dock PID绑定仍不能取得同一正式上下文。
修正：Dock使用已知WebView HWND的根祖先（现有枚举GetRoot）并核对Core创建进程PID；上下文、订阅和重放按已绑定DesktopPlayer或Dock放行，启动/过渡完成继续只准DesktopPlayer。管理器先确认旧进程退出再创建替代，未确认退出留故障，不并发开第二个。
证据范围：源码与接线核对，游戏期间未编译/运行，实际隐藏窗初始化及共享快照仍待本包游戏后验收。不能把源码修正记为Windows运行通过。

## #243 任务栏恢复不能只靠正常Dispose或API返回TRUE（2026-10-05）
源码接线发现：正常退出恢复不能覆盖Core被结束、Player失去响应及Explorer重建。已采用独立Watchdog模式和精确PID/启动时刻、lease/mutex、持久恢复记录；先保存原基线再隐藏，Core也监督看护，失效后不遗留旧顶层Dock。Player心跳恢复给唤醒留宽限，健康维护不重复读完整安装。
Shell ABM_GETSTATE的0是有效状态，Windows 7起缺少ALWAYSONTOP位也不代表任务栏不置顶；ABM_SETSTATE总返回TRUE，不能把返回值当效果证据。代码读取实际自动隐藏/可见状态再报告，恢复失败保留记录；全屏时仅还原Shell策略，不强行把任务栏显示到游戏上。接口参考：Microsoft ABM_GETSTATE / ABM_SETSTATE（见V3_DELIVERY链接）。以上仅源码和项目XML检查，实际工作区/DPI/游戏/崩溃恢复仍须Windows验收。

## #245 Dock实际高度和可用状态不能只用Player回报（2026-10-05）
源码接线发现：WindowReady不证明Core有有效输入窗口，保存高度也不代表实际DPI/宿主限高。Core沿现有ReadNativeViewport测量实际HWND/尺寸/DPI，缺失则保持awaitingInput、不请求替代任务栏。该测量不要求窗口展开，不因自动隐藏产生反复恢复/替代。配置器显示实际DIP/DPI/受限状态，屏幕约束不覆盖保存值。仅源码核对，实际DPI/输入/隐藏行为待游戏后集中验收。
## #247 常驻选择与实际工作区确认须分开（2026-10-05）
源码接线发现：若reserve选项以当前reserveAvailable作为选择前提，自动隐藏用户永远无法第一次切到常驻。设置页允许保存常驻偏好，Core按模式身份先关闭旧宿主后重建，只有实际占位才报告reserveAvailable/AppBarOccupied。AppBar注册成功不代替窗口位置及工作区；Player查询实际矩形/工作区，Core按有效输入窗口和GetMonitorInfo再次确认后才隐藏原任务栏。不可呈现时注销，DPI/Explorer重协商，临时全屏隐藏沿原型保留注册策略；不写SPI_SETWORKAREA。当前仅源码/工程XML核对，Windows运行证据留Task4。
## #248 原生另存资源与私人生命周期必须接真实入口（2026-10-05）
v2固定五类目录镜像不覆盖v3声明资源，另存不能仅换清单版本；Room副本还要新UUID及独立个人绑定/皮肤。按正式声明资源暂存，Core复制确认后发布，不继承授权/KV/个人布局。删除作者目录不等于个人数据清理完成，RPC连接错误也不能证明Core没有执行。
源码实现独立个人复制/删除RPC、结果不明的库根恢复意图、删除租约与恢复原件检测；Core串行复制/删除，删除标记拒绝迟到复制。UI区分已移入回收站与个人清理待重试。仅源代码接线通过差异核对，Windows构建/时序/断电恢复仍在独立验收门槛。
## #249 未来要求须在严格反序列化/旧版分派之前解释（2026-10-05）
只有version3可编辑的政策忽略apiVersion和未知能力，旧zip探测器把未来版本交给v2分派，用户只得到普通字段错误；旧只读入口仍读取成规范化草稿。源码修正：统一固定API1要求检查、未知格式/能力清楚提示、Core独立拒绝；库列表兼容回执禁用受影响入口，清单只读另窗且打开再次核对。未构建/运行，最终完整升级回归仍需实际证据。
## #250 安装清理须保留真实句柄和中断记录（2026-10-05）
.dext-install/.dext-previous前缀不是删除凭据；按可变路径递归删除也不能证明实际对象。源码实现固定宿主、有界枚举、完整摘要或创建阶段目录身份记录；先核验所有剩余文件，持祖先句柄并以DELETE文件/目录句柄删除，部分失败可重试，未知或变动对象保持。原生FILE_DISPOSITION_INFO的DeleteFile为BOOLEAN，按1字节传入；FILE_ID_INFO组合卷与128位ID。公开微软定义见RELEASE_V3.md，Windows实际构建/执行仍待集中门槛。
## #252 另存预写恢复记录与已有Core发布身份（2026-10-05）
现象：Core复制私人覆盖已持久化、配置器尚未发布作者目录时崩溃，原记录生成顺序无法保证恢复；v3配置器只在新启动时校验v3产品描述，复用已有Core路径未执行同一检查。
原因：恢复记录在RPC错误分支才生成，恢复枚举后未重新持有记录租约；产品描述检查没有覆盖既有进程和正式RPC入口。
修复：复制RPC前写入意图并持有独占记录租约直到发布/回滚；恢复重试重新获取并读取记录，忙时跳过。已运行Core的真实进程核对同时检查v3发布元数据，正式RPC身份验证沿用此检查。
证据边界：源码与差异核对，现有产品描述断言修正配置期望；未构建或执行Windows中断/恢复。用户游戏结束后按INTEGRATION验收卡集中验证，不额外扩展网络矩阵。

## #253 恢复清理需按Room身份识别目录改名（2026-10-05）
现象：另存作者目录已经发布但恢复记录未移除，随后目录改名，重连恢复把旧目录缺失误认为作品未发布而删除个人覆盖。
原因：只读取意图里的旧room_name；Room UUID保持不变却没有用于库内作品查找。
修复：先查原目录UUID，再只读扫描库内直接子目录清单，匹配稳定UUID就取消私人清理。暂存内容为嵌套目录，不当作已发布作品；读错误或超过扫描上限保持记录，不冒称作品缺失。
证据边界：源码与具名差异检查，Windows实测归入INTEGRATION人工步骤5；未构建/启动，不新增网络或恢复测试矩阵。

## #255（2026-10-06）焦点丢失清空按钮几何，回到桌面没有重发
症状：Dock悬停短暂有边框，但Desk切换和应用按钮不能点击。RoomNativeInputAuthority.CheckNativeViewport/MouseMove把foreground=false等同几何失效；配置器打开后viewport与buttons被永久清空，而同revision不会自动重新发布。修复：同原生视口仅清输入手势、完成回执、焦点和采样；保留按钮区域，视口/文档/快照改变仍清几何。4项焦点返回回归先失败后通过；桌面人工复验独立记录，单测不等同人工通过。
