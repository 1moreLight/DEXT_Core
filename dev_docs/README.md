# Dext 开发入口

> 更新：2026-08-30。本文件只负责快速进入项目和索引接口；不再承载任务状态。

## 零、先看这里

- 全局计划和**唯一下一项**：`ROADMAP.md`
- 当前分支做到哪：`TODO.md` 最后一节
- 一轮任务怎么开分支、提交、验收、合并：`WORKFLOW.md`
- 本轮怎么验收：`acceptance/<工作包ID>-<名称>.md`
- 产品和设计决策：`PROJECT.md`；具体契约看 `MODEL.md` / `DOCK.md`

以后不再从旧 Phase、旧 TODO 或历史 UI 文档猜“现在该做什么”。当前状态只认 ROADMAP；已经开工后，执行进度只认当前分支 TODO。

## 一、项目全景

**Dext**：把 Windows 桌面变成手机式主屏。多个 Desk 放真图标应用、长按编辑、切桌动画；整套主题打包成 Room 分享。终局对标 Wallpaper Engine（创作者上架创意工坊，普通用户下载即用）。

目标创作模型是“官方宿主 + 用户内容”：Dext 官方 HTML 骨架负责 Desk、Dock、图标、导航、IPC 和保存；用户只定制 background/start/switch/end。四类内容统一使用 `name/type/src`，类型为 image/video/html。

DXT-001 已在独立开发分支中同时定稿全新的 v1，并原地适配现有宿主、配置器预览和持久化链；原 SCENE-001 已并入本包，不再另写一套播放器。v1 不兼容旧 Room。

```
① 运行时渲染器  wallpapers/dext-room/{index.html,style.css,main.js}
   纯静态三件套，读 room.json 画桌面；跑在 Lively WebView2 Player 里
② 编辑器(配置器) tauri-ui/   Tauri2+React+TS+Tailwind4+shadcn
   使用/编辑双模式；房间库；背景/转场素材；保存并应用
③ 底座(Dext 自带的 Lively Core fork)  lively-core-separation/src/Lively/  C# .NET9 WPF
   WorkerW 桌面层托管；应用枚举/启动；RPC 服务端；IPC 处理
④ 数据契约  room.json   ①只认它 ②只产它 AI 只写它
```

进程链：`Dext 配置器 ──自定义gRPC(named pipe)──▶ Dext Core(Lively fork) ──spawn──▶ WebView2 Player ──虚拟主机──▶ ①渲染器`

Dext 随仓库/产品携带自己的 Core fork，不读取用户另装原版 Lively 的实例或数据，也不要求用户先安装 Lively。CORE-002 后运行身份为 mutex `DEXT:DESKTOPSHELL`、pipe `Grpc_DEXT:DESKTOPSHELL<用户名>`、数据 `%LOCALAPPDATA%\Dext`、日志 `%LOCALAPPDATA%\Dext\logs`。旧 `%LOCALAPPDATA%\Lively Wallpaper` 不自动迁移。Dext 与原版 Lively 可以同时保持各自身份和进程，但不承诺两者同时控制同一个 Windows WorkerW 桌面。

## 二、dev_docs 文档体系

| 文件 | 内容 | 何时读/写 |
|---|---|---|
| `../AGENTS.md` | 会话入口、不可违反的协作纪律、环境速查 | 每次会话开始 |
| `README.md`（本文件） | 快速入口、架构和接口索引 | 每次会话开始；查接口时 |
| `WORKFLOW.md` | **单任务开发流程唯一说明**：建分支→开发→待验收→合并→清理 | 开工、交付、合并时 |
| `ROADMAP.md` | **唯一全景计划**：工作包、依赖、当前项、唯一下一项 | 选择下一轮时；状态变化时 |
| `TODO.md` | **当前分支执行台账**；旧内容只保留追溯，不再充当 backlog | 开工前追加；每步完成即打标 |
| `acceptance/*.md` | 每个工作包一份独立验收卡 | 开工前创建；待验收和通过时更新 |
| `PROJECT.md` | 产品定义、架构、结构性决策记录 | 涉及方向或结构决策时 |
| `TODO-archive.md` | 总任务台账·历史归档（已完成阶段全量记录） | 回溯历史阶段时 |
| `ERRORS.md` | 踩坑总索引（编号→五本分册速查表） | 排障时先查索引 |
| `errors/git.md` | 踩坑·Git 协作篇（仓库/分支/worktree/并行会话） | git 相关坑 |
| `errors/backend.md` | 踩坑·后端篇（C# / Rust / RPC / 运行时） | 后端相关坑 |
| `errors/frontend.md` | 踩坑·前端篇（配置器 Tauri/React） | 前端相关坑 |
| `errors/renderer.md` | 踩坑·渲染器篇（wallpapers/dext-room） | 渲染器相关坑 |
| `errors/toolchain.md` | 踩坑·工具链篇（PowerShell / 编码 / 环境） | 工具链相关坑 |
| `LIVELY_API.md` | Lively API 全景调研（壁纸侧 JS 注入函数 / IPC 三通道 / 命令行控制 / fork 对照与待验证项） | 想用 Lively 原生能力（音频频谱/歌曲信息/硬件监控等）或外部脚本控制时 |
| `ACCEPTANCE.md` | 2026-08-28 以前的**历史总验收清单** | 仅回溯；新工作不再追加 |
| `FRONTEND.md` | 渲染器外观迭代手册（实时预览、函数表、任务池、纪律） | 前端外观工作 |
| `FRONTEND_WORK.md` | 旧配置器 UI 迭代记录 | 仅历史参考；状态不作数 |
| `DOCK.md` | **Dock 模块契约**（room.json dock 节点 schema、合并规则、渲染器行为、配置器对接点） | 任何 dock 相关改动/UI 接线 |
| `ROOM_AUTHORING.md` | **Room v1 创作者定制协议**：目录、字段、HTML 场景接口、配置器操作和发布检查 | 使用配置器、手工制作或 vibe coding 定制 Room 时 |
| `DOCK_STYLE.md` | Dock v0.x 外观定制历史；包含已经不进入 v1 的 room.js/room.css 接口 | 仅回溯旧实现时 |

**铁律**：一个工作包一个分支和验收文件 → 动代码前写 TODO 和验收 → 自测通过后 commit → 停在分支等待用户验收 → 用户明确通过后才合并并删除分支/worktree。

### 状态冲突时听谁的

1. 当前代码和 Git 状态
2. 已确认的 PROJECT / MODEL / DOCK 决策
3. ROADMAP 全局状态
4. 当前分支 TODO
5. TODO-archive、ACCEPTANCE、FRONTEND_WORK 等历史记录

## 三、以后怎样用 dev_docs 记录开发

你不需要把所有事情都写进一个文件。先判断现在处于哪一步，再写到对应位置：

| 现在发生的事情 | 写到哪里 | 怎么写 |
|---|---|---|
| 刚想到一个功能，还没决定做 | `ROADMAP.md` | 新增一个可独立验收的工作包，先标“排队” |
| 决定接下来就做它 | `ROADMAP.md` | 全项目只把这一项标成“下一项” |
| 产品方向或架构规则确认了 | `PROJECT.md` | 在“决策记录”追加日期、决定和原因，不删除旧决定；被取代时明确写“由哪条取代” |
| room.json / Dock / Room 创作规则变化 | `MODEL.md` / `DOCK.md` / `ROOM_AUTHORING.md` | 更新唯一正式口径；ROADMAP 只写任务，不重复完整契约 |
| 正式开工 | `TODO.md` + `acceptance/<ID>-<slug>.md` | 先写一句目标、范围外、步骤和人工验收，再动代码 |
| 开发完成了一步 | 当前分支的 `TODO.md` 最后一节 | 立刻把这一项打勾；受阻则写原因和恢复条件 |
| 遇到并解决一个坑 | `ERRORS.md` → `errors/` 对应分册 | 追加现象、原因、修复和下次检查方法，不删除历史坑 |
| 自测完成，等你试用 | `ROADMAP.md` + 独立验收卡 | 状态改“待验收”，记录分支、提交、检查结果和你要操作的步骤 |
| 你明确回复“通过” | 验收卡、ROADMAP、TODO-archive | 才能合并 master；随后标“已完成”、归档 TODO，并清理分支/worktree |

### 一次开发最简单的记录流程

```text
想法出现
  → ROADMAP 登记“排队”
决定开工
  → ROADMAP 唯一“下一项”
  → 建独立 worktree/分支
  → TODO 写计划 + acceptance 写验收
开发过程中
  → TODO 逐项打勾
  → 决策写 PROJECT/MODEL，踩坑写 ERRORS
代码完成
  → 自测、commit、标“待验收”
你回复“通过”
  → 合并 master、标“已完成”、归档和清理
```

最重要的三个区别：

- `ROADMAP` 是全项目待办和唯一顺序；`TODO` 只记录当前分支怎么执行，不能再堆未来愿望。
- `PROJECT/MODEL/DOCK` 记录已经确认的长期规则；讨论中的猜测不要先写成正式契约。
- `commit` 只表示代码已保存；只有你人工验收通过并合并 master，工作包才算完成。

### 以后开新一轮可以直接使用的提示词

```text
请严格按照 AGENTS.md 和 dev_docs/WORKFLOW.md 开始工作包 <ID> <名称>。
先读 dev_docs/README.md、ROADMAP.md、TODO.md、ERRORS.md 和本轮相关专题文档；
确认 ROADMAP 状态和现有待验收分支，从最新 master 建独立 worktree/分支。
动代码前先在 TODO 追加目标、范围外和步骤，并建立独立 acceptance 文件。
开发中逐项更新 TODO，结构决策写 PROJECT/MODEL，解决的新坑追加 ERRORS。
自测通过后只提交本工作包文件，停在待验收并给出与验收卡一致的人工步骤。
在我明确回复“通过”前，不得合并 master。
```

如果只是讨论需求，可以在最后加一句：“本轮只讨论和登记 ROADMAP，不开分支、不改代码。”

## 四、room.json v1 正式口径

- `version: 1`；Desk 顺序来自 `desks`，默认 Desk 复用 UI 已有的 `startDesk`。
- background/start/switch/end 的用户内容统一为 `{name,type,src}`，`type` 是 image/video/html。
- background 图片纯静态；start/switch/end 图片纯静态显示 0.5 秒。
- switch 视频完整播放后才换 Desk；复杂时序使用 HTML。
- switch 只存在于相邻 Desk 与三页以上的首尾之间，两个方向分别保存在 `switches`。
- Desk 排序时 switch 跟随 Desk 和方向重新映射；新相邻组合缺少内容时由 UI 提示，不自动生成。
- v1 不兼容旧 Room、旧 `transition` 或顶层 room.js/room.css，也不提供迁移工具。
- `__source` 只允许出现在运行包；预览、源 Room 和未来 zip 禁止携带。
- 内容目录固定为 `background/`、`start/`、`switch/`、`end/`，所有 `src` 必须留在 Room 内。

完整字段与宽容策略见 `MODEL.md`，机器校验见仓库根目录 `room.schema.json`。

## 五、接口总表

### L1 room.json v1 官方宿主接口

| 接口 | 形态 | 说明 |
|---|---|---|
| `TRANSITIONS` | 注册表 `{名字: {dur, run(stage,dir,done), cleanup()}}` | 切桌动画扩展点；现有 slide/fade/zoom/none；`dir` +1 下一桌 / -1 上一桌 |
| `playSlot(slot, opts)` | 统一内容播放器 | start/switch/end 的 image=0.5 秒、video=完整播放、html=sandbox+实例消息；完成后彻底清理 |
| `playVideoTransition(next, slot, ...)` | 现有入口的薄适配 | 复用 `playSlot`；内容完成后才换 Desk，不再中点换页 |
| `ICON_SIZES` / `sizeOf` | 常量表 | 大/中/小三档（图标/格子/字号联动），desk.iconSize 选用 |
| `resolveTransition(from,to)` | 读取器 | `switches["from>to"] → switch → slide`；只认 v1 预设或 Content |
| `mountBackground(bg, video, desk)` | 函数 | v1 image/video/html/null；HTML sandbox 长驻在官方图标层下方 |
| `renderIcons(layer, desk, s)` | 函数 | 图标渲染（坐标钳制/真图标/长按/删除），主层与 staging 共用 |
| 主题令牌 | style.css `:root` `--dext-*` | 外观迭代第一入口（accent/success/danger/dock 等 8 个） |
| `dext:room` 消息 | window message | 仅 preview 模式接受固定配置器父窗口；载荷为完整 v1、deskIndex、临时 assetBase |
| `room.js` / `room.css` | 旧 Room 扩展 | v1 宿主不加载；用户代码只能放入四类 HTML Content |
| `dockCfg()` / `renderDock()` | 函数 | Dock 自定义：合并全局+桌级配置、位置/样式/autoHide/dots、常驻图标（DOCK.md） |
| `dext:end` | Player→页面 | cmd_close 转发；页面播 end 后 ack `dext:endDone`，Player 有 65 秒安全上限 |

### L2 渲染器 → Player → Core（上行 IPC，stdout 管道）

| 消息 | postMessage 载荷 | MessageType | Core 处理 |
|---|---|---|---|
| 启动应用 | `{target, args, workdir}` | `msg_launch` | Explorer 代启（应用不归属 Lively） |
| 保存房间 | `{type:"saveRoom", room}` | `msg_save_room` | Player 只收顶层官方页；Core 从现有包读可信戳，包内保留、源文件剥离后双写 |

新增上行消息的模式：MessageType 枚举加值 → Lively.Models.Message 建消息类 → IpcMessageConverter 加映射 → Player Form1.WebMessageReceived 分支 → Core WebWebView2 switch 落地。

### L3 Tauri commands（配置器前端 ↔ Rust，`invoke`）

| 命令 | 签名 | 说明 |
|---|---|---|
| `get_installed_apps` | `→ AppInfo[]`（含 48px 图标 base64） | 开始菜单枚举 |
| `launch_app` | `(target, arguments, working_dir)` | 走 RPC 启动 |
| `get_wallpapers` / `set_wallpaper` / `core_stats` | 见 grpc.rs | RPC 封装 |
| `list_rooms` | `(dir) → {name,path,desks,icons}[]` | 扫房间库（含 room.json 的子文件夹） |
| `read_room` / `write_room` | `(path[, room_json])` | 写入剥离 `__source`、验证 v1 并原子替换 |
| `save_room_css` | `(room_dir, css)` | 保留给旧 Dock 模板编辑数据；v1 运行宿主不执行该 CSS |
| `create_room` | `(dir, name) → path` | 建最小合法 v1 和四个素材目录 |
| `save_room_as` | `(room_dir, dir, name, room_json) → path` | 另存干净 v1，并复制原 Room 的四类素材目录；失败不留下半成品 |
| `apply_room` | `(room_dir)` | 严格验证 v1，只镜像四个素材目录，清理旧扩展，并仅在运行包注入规范化 `__source` |
| `import_background` | `(room_dir, src_path, slot, content_type) → Content` | 复用既有命令导入 `background/start/switch/end` 的 image/video/HTML，并返回 `{name,type,src}` |
| `delete_room` | `(library_dir, room_dir)` | 只接受库内直接子 Room，经完整校验后移入 Windows 回收站 |
| `export_room_zip` / `import_room_zip` | 见 `lib.rs` | 事务式导出/导入自包含 v1 zip；防路径穿越、链接、重复项、解压炸弹、重名和残留 |
| `active_room` / `stop_wallpapers` | `→ ActiveRoom?` / `→ ()` | 以 Core `GetWallpapers` 和运行包可信 `__source` 为真相；停止 Player 但保留 Core |
| `get_dext_settings` / `patch_dext_settings` | 白名单设置视图/patch | 经 Settings RPC 执行 Get 全量 → patch → Set，保留未编辑字段 |
| `validate_room_library` | `(path) → canonical_path` | 创建并实际读写探测 Room 库，成功后前端才持久化路径 |
| `diagnostics_json` / `export_diagnostics` | `→ JSON` / `(path)` | 汇总配置器/Core 版本、身份、进程、pipe、目录、运行包与源 Room |
| `about_info` / `open_about_document` / `open_dext_directory` | 固定枚举 | 只打开仓库内许可/来源文档或已验证的 Dext data/log 目录，不向 WebView 开放任意路径 |

### L4 gRPC（Rust ↔ Core，GrpcDotNetNamedPipes 自定义线协议）

- 管道：`\\.\pipe\Grpc_DEXT:DESKTOPSHELL<用户名>`；**不是标准 HTTP/2，tonic 不可用**，客户端在 `tauri-ui/src-tauri/src/grpc.rs` 手写帧（RequestInit→Headers→Payload→StreamEnd→Trailers），一次调用一条连接；每个业务 RPC 前先读取并验证 Dext Core 产品名、运行身份、PID、路径、数据目录和 pipe
- 用到的 RPC：DesktopService `GetInstalledApps`(stream) / `LaunchApp` / `SetWallpaper` / `GetWallpapers` / `CloseAllWallpapers`；SettingsService `GetSettings` / `SetSettings`
- proto 副本在 `src-tauri/proto/`，**必须去 BOM**（protox 限制）

### L5 `dext://` 自定义协议（配置器内嵌渲染器 = 实时预览通道）

- Rust 注册，把壁纸包目录映射给配置器 webview（Windows 下 `http://dext.localhost/`）
- iframe 加载 `index.html?preview=1`；固定 origin postMessage 注入完整 v1 与 `lib://` 临时素材根目录
- 预览只改内存，不加载真实包的 room.json/room.js/room.css，也不会触发 `persistRoom`
- 带路径穿越防护；mime 表覆盖 html/css/js/json/png/jpg/svg/mp4/webm

## 六、工作流命令

| 场景 | 命令 |
|---|---|
| 全量构建（改 C#/.proto 后必跑） | `scripts\build.ps1`（Player 必须 Release） |
| 日常启动（核心+配置器） | 双击 `scripts\start-dext.cmd`，或终端运行 `scripts\start.ps1`；输出缺失或仍是 Lively 产品元数据时自动执行完整构建 |
| 渲染器外观迭代（无需 Lively） | `scripts\room-preview.ps1`（端口 5174 热刷新） |
| 强制重铺壁纸 | `cargo test --lib applies_room_wallpaper`（tauri-ui/src-tauri 下） |
| 配置器自测 | `npm run build`（tauri-ui）；Rust 侧 `cargo check` |
| 渲染器语法自检 | `node --check wallpapers/dext-room/main.js` |
| Room v1 Schema 夹具验证 | `python scripts\validate-room-schema.py` |
| 日志 | `%LOCALAPPDATA%\Dext\logs\<最新>.txt`；首行可核对 PID、Core 绝对路径和运行身份 |
| 运行身份核对 | `scripts\verify-runtime-identity.ps1`（只读报告 Core 二进制 ProductName、进程路径、mutex、pipe、data、log） |
| 查代码 | `codegraph explore/node` 优先（索引已建） |

## 七、能力基线（master，2026-08-30）

- 桌面：图标网格与 Dock 保持；方向预设及 image/video/html switch 共用现有切桌入口；HTML background/start/switch/end 全部受控挂载。
- 持久化：源 Room 严格 v1、运行包唯一可信 `__source`、顶层 IPC 和双写边界已收紧。
- 配置器：现有导图属性栏可为 Desk/start/两个方向的 switch 选择 image/video/自包含单 HTML，复制进固定目录后更新内存预览，明确保存时才写 `room.json`；end 的可视化入口、Desk 排序和成组 HTML 资产仍属后续工作。
- 待做内容不在这里维护；以 `ROADMAP.md` 为唯一清单。
