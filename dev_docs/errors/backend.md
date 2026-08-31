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
