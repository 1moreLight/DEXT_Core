# Dext 开发入口

> 更新：2026-08-31。本文件只负责快速进入项目和索引接口；不再承载任务状态。

## 零、先看这里

- 全局计划和**唯一下一项**：`ROADMAP.md`
- 当前分支做到哪：`TODO.md` 最后一节
- 一轮任务怎么开分支、提交、验收、合并：`WORKFLOW.md`
- 本轮怎么验收：`acceptance/<工作包ID>-<名称>.md`
- 产品和设计决策：`PROJECT.md`；具体契约看 `MODEL.md` / `DOCK.md`

以后不再从旧 Phase、旧 TODO 或历史 UI 文档猜“现在该做什么”。当前状态只认 ROADMAP；已经开工后，执行进度只认当前分支 TODO。

## 一、项目全景

**Dext**：把 Windows 桌面变成手机式主屏。多个 Desk 放真图标应用、长按编辑、切桌动画；整套主题打包成 Room 分享。终局对标 Wallpaper Engine（创作者上架创意工坊，普通用户下载即用）。

目标创作模型是“官方宿主 + 用户内容”：Dext 官方 HTML 骨架负责 Desk、Dock、图标、导航、IPC、保存与 WidgetHost；用户可定制 background/start/switch/idle Scene 和每 Desk 多个 Widget。

DXT-003 将项目收口为唯一原生 Room v2；v1 与更旧 demo 不兼容、不迁移、不重建。新建、编辑、保存、另存、预览、应用和 zip 全链只接受/产生 v2。

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
| `ROOM_AUTHORING.md` | **Room v2 创作者协议**：Scene/Widget 选择、目录、字段、安全和发布检查 | 使用配置器、手工制作或 vibe coding 定制 Room 时 |
| `WIDGETS_V2.md` | **Room v2 Widget 正式契约与路线**：多 Widget、Scene 分工、权限、联网、分享与 AI 边界 | 阅读或实现小组件、AI 创作与可分享扩展时 |
| `ROOM_V2_FRONTEND_CHECKLIST.md` | WidgetHost、Scene 数据绑定、可信热点、拖拽/层叠与图标避让实施清单 | 开发 v2 前端宿主时 |
| `ROOM_V2_SYSTEM_API.md` | 系统媒体与 Windows 主音量的受控 RPC、权限和手势边界 | 接入系统展示或动作时 |
| `ROOM_V2_AI_PROMPT.md` | 可直接交给 AI 的 Room v2/Scene/Widget 创作提示词 | AI 生成前端内容时 |
| `../creator-kit/` | Creator Pack v1 Schema、版本化 SDK、Scene/Widget 模板与安全正反 fixtures | 导出 AI 上下文、制作或审查 `.dext-content.zip` 时 |
| `CONFIGURATOR_V2_PLAN.md` | **UI-V2-001 单工作包总计划**：配置器、Scene、WidgetHost、系统能力、安全分享与 AI 创作端到端范围 | 开发或验收配置器 v2 时 |
| `CONFIGURATOR_V2_LUNA_PROMPT.md` | 可直接交给 `gpt-5.6-luna` 的 UI-V2-001 执行指令 | 将整个 v2 工作包交接给执行模型时 |
| `DOCK_STYLE.md` | Dock v0.x 外观定制历史；包含已废弃的 room.js/room.css 接口 | 仅回溯旧实现时 |

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

## 四、room.json v2 正式口径

- `version: 2`；Desk 顺序来自 `desks`，默认 Desk 使用 `startDesk`；每个 Desk 必须写 `widgets`。
- background/start/switch/idle 的用户内容统一为 `{name,type,src}`，`type` 是 image/video/html。
- background 图片纯静态；start/switch 图片纯静态显示 0.5 秒；idle 图片持续显示到 Lively 唤醒。
- switch 视频完整播放后才换 Desk；复杂时序使用 HTML。
- switch 只存在于相邻 Desk 与三页以上的首尾之间，两个方向分别保存在 `switches`。
- Desk 排序时 switch 跟随 Desk 和方向重新映射；新相邻组合缺少内容时由 UI 提示，不自动生成。
- v1 与更旧 Room 均不受支持，不读取为草稿、不迁移、不降级；顶层 room.js/room.css 不执行。
- `__source` 只允许出现在运行包；预览、源 Room 和未来 zip 禁止携带。
- 内容目录固定为 `background/`、`start/`、`switch/`、`idle/`、`widgets/`，所有资源必须留在 Room 内。

完整字段与运行语义见 `MODEL.md`。仓库唯一 Room Schema 是 `room-v2.schema.json`；`scripts/validate-room-schema.py` 只校验 v2 fixtures、样包和资源。

### Room v2 Widget 边界

- 固定 `version: 2`，唯一待机字段为 `idle`，每个 Desk 写出 `widgets` 数组；`end` 非法。
- Widget manifest、路径/资源、1920×1080 placement、权限枚举、config 限制和数量限制以 `room-v2.schema.json` 与 `WIDGETS_V2.md` 为准。
- WidgetHost 已实现首版离线视觉执行：v2 可编辑、覆盖保存、另存、预览、应用和 zip；现有 Widget 数据与资源必须无损保留。
- v1 与未知版本只显示不支持；除安全删除外不得进入保存、预览、应用或 zip 链。
- 自包含离线样包位于 `dev_docs/fixtures/room-v2/sample-library/widget-contract-sample/`。

## 五、接口总表

### L1 room.json v2 官方宿主接口

| 接口 | 形态 | 说明 |
|---|---|---|
| `TRANSITIONS` | 注册表 `{名字: {dur, run(stage,dir,done), cleanup()}}` | 切桌动画扩展点；现有 slide/fade/zoom/none；`dir` +1 下一桌 / -1 上一桌 |
| `playSlot(slot, opts)` | 统一内容播放器 | start/switch 按完成语义播放；idle 以 persistent 模式持续到 Lively 关闭屏保实例 |
| `playVideoTransition(next, slot, ...)` | 现有入口的薄适配 | 复用 `playSlot`；内容完成后才换 Desk，不再中点换页 |
| `ICON_SIZES` / `sizeOf` | 常量表 | 大/中/小三档（图标/格子/字号联动），desk.iconSize 选用 |
| `resolveTransition(from,to)` | 读取器 | `switches["from>to"] → switch → slide`；只认官方预设或 Content |
| `mountBackground(bg, video, desk)` | 函数 | v2 image/video/html/null；HTML sandbox 长驻在官方图标层下方 |
| `renderIcons(layer, desk, s)` | 函数 | 图标渲染（坐标钳制/真图标/长按/删除），主层与 staging 共用 |
| 主题令牌 | style.css `:root` `--dext-*` | 外观迭代第一入口（accent/success/danger/dock 等 8 个） |
| `dext:room` 消息 | window message | 仅 preview 模式接受固定配置器父窗口；载荷为完整 v2、deskIndex、临时 assetBase |
| `room.js` / `room.css` | 旧 Room 扩展 | 宿主不加载；用户代码只能放入 Scene/Widget 受控目录 |
| `dockCfg()` / `renderDock()` | 函数 | Dock 自定义：合并全局+桌级配置、位置/样式/autoHide/dots、常驻图标（DOCK.md） |
| `--wallpaper-screensaver` / `?screensaver=1` | Core→Player→页面 | Lively 屏保实例标记；Dext 只渲染 `room.idle`，普通关闭立即完成 |

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
| `list_rooms` | `(dir) → {name,path,desks,icons,version,widgets}[]` | 扫房间库；识别版本并统计 Widget，不执行 Widget |
| `read_room` / `write_room` | `(path[, room_json])` | 写入剥离 `__source`、验证 v2 并原子替换 |
| `create_room` | `(dir, name) → path` | 建最小合法 v2 和五个内容目录 |
| `save_room_as` | `(room_dir, dir, name, room_json) → path` | 另存干净 v2，并镜像五类资源；失败不留下半成品 |
| `duplicate_room` | `(library_dir, room_dir, name) → path` | 仅复制库内直接子 Room，完整镜像 v2 JSON 与五类资源，失败清理目标 |
| `rename_room` | `(library_dir, room_dir, name) → path` | 仅重命名库内直接子 Room，拒绝非法名称、重名、链接和库外路径；运行中 Room 随后重新应用刷新来源戳 |
| `apply_room` | `(room_dir)` | 严格验证 v2，镜像五类资源，并仅在运行包注入规范化 `__source` |
| `import_background` | `(room_dir, src_path, slot, content_type) → Content` | 复用既有命令导入 `background/start/switch/idle` 的 image/video/HTML，并返回 `{name,type,src}` |
| `delete_room` | `(library_dir, room_dir)` | 只接受库内直接子 Room，经完整校验后移入 Windows 回收站 |
| `export_room_zip` / `import_room_zip` | 见 `lib.rs` | 事务式导出/导入自包含 v2 zip；校验 Widget 声明并防路径穿越、链接、重复项、解压炸弹、重名和残留 |
| `export_ai_context` | `(destination, room_json) → path` | 导出脱敏 Room 结构、提示词、Schema、SDK、模板与 fixtures；不调用外部 AI |
| `inspect_creator_pack` / `discard_creator_import` | `(archive_path) → report` / `(token)` | 只在临时区检查 Creator Pack，返回隔离预览 token；不修改 Room |
| `confirm_creator_import` | `(token, room_dir, room_json, desk_index, scene_target?) → Content/Widget` | 用户确认后事务式写入 Scene/Widget；重新执行完整 Room/资源校验 |
| `get_system_media` / `control_system_media` | 见 `grpc.rs` | 当前系统媒体快照与 play/pause/toggle/next/previous 封闭动作 |
| `get_system_volume` / `set_system_volume` | 见 `grpc.rs` | Windows 默认输出主音量与 mute，0..1 双边校验 |
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
- iframe 加载 `index.html?preview=1`；固定 origin postMessage 注入完整 v2 与 `lib://` 临时素材根目录
- 预览只改内存，不加载真实包的 room.json/room.js/room.css，也不会触发 `persistRoom`
- 带路径穿越防护；mime 表覆盖 html/css/js/json/png/jpg/svg/mp4/webm

## 六、工作流命令

| 场景 | 命令 |
|---|---|
| 全量构建（改 C#/.proto 后必跑） | `scripts\build.ps1`（Player 必须 Release） |
| 日常启动（核心+配置器） | 双击 `scripts\start-dext.cmd`，或终端运行 `scripts\start.ps1`；输出缺失或仍是 Lively 产品元数据时自动执行完整构建 |
| 渲染器外观迭代（无需 Lively） | `scripts\room-preview.ps1`（端口 5174 热刷新） |
| 强制重铺壁纸（活体测试，会改变桌面与恢复布局） | `cargo test --lib applies_room_wallpaper -- --ignored`（tauri-ui/src-tauri 下） |
| 配置器自测 | `npm run build`（tauri-ui）；Rust 侧 `cargo check` |
| 渲染器语法自检 | `node --check wallpapers/dext-room/main.js` |
| Room v2 Schema、语义、fixtures 与样包验证 | `python scripts\validate-room-schema.py` |
| 日志 | `%LOCALAPPDATA%\Dext\logs\<最新>.txt`；首行可核对 PID、Core 绝对路径和运行身份 |
| 运行身份核对 | `scripts\verify-runtime-identity.ps1`（只读报告 Core 二进制 ProductName、进程路径、mutex、pipe、data、log） |
| 查代码 | `codegraph explore/node` 优先（索引已建） |

## 七、能力基线（master，2026-08-30）

- 桌面：图标网格与 Dock 保持；方向预设及 image/video/html switch 共用现有切桌入口；HTML background/start/switch/idle 全部受控挂载。
- 持久化：源 Room 严格 v2、运行包唯一可信 `__source`、Widget 资源镜像、顶层 IPC 和双写边界已收紧。
- 配置器：Room 层级树和导图属性栏可为 Desk/start/独立 idle 节点/两个方向的 switch 选择 image/video/自包含单 HTML，复制进固定目录后更新内存预览；Desk 身份级排序、Dock 覆盖和成组 HTML 资产均按 v2 单一写出器保存。
- 待做内容不在这里维护；以 `ROADMAP.md` 为唯一清单。
