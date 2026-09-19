# Dext 项目档案

> 更新于 2026-08-31。结构性决策变更时更新此文件；当前开发顺序只看 ROADMAP.md。

## 一句话

把 Windows 桌面变成手机式主屏：多个 Desk（页面）放真图标应用、双击启动、切页动画；整套主题打包成 Room 分享。终局对标 Wallpaper Engine——创作者做酷房间上架创意工坊，普通用户一键下载使用。

## 产品结构：三件套 + 一个契约

```
┌─────────────────────────────────────────────────┐
│ ① 运行时渲染器                                   │
│   wallpapers/dext-room/{index.html,main.js,style.css}
│   vanilla JS，读 room.json 渲染桌面               │
│   （背景层/图标层/切桌过渡/双击发启动消息）          │
│   跑在 Lively WebView2 Player 里                  │
│   （虚拟主机 https://<hash>.localhost/）           │
├─────────────────────────────────────────────────┤
│ ② 编辑器（配置器）                                │
│   tauri-ui/ （Tauri2 + React + TS + Tailwind4 + shadcn）
│   Rust 端自实现 gRPC 客户端 src-tauri/src/grpc.rs │
├─────────────────────────────────────────────────┤
│ ③ 底座（Dext 自带的 Lively Core fork，C# .NET9 WPF）│
│   lively-core-separation/lively-core-separation/src/Lively
│   AppCatalogService：枚举开始菜单应用+真图标 / Explorer 代启
│   WinDesktopCoreServer：gRPC 服务端               │
│   WebWebView2：msg_launch 处理                     │
├─────────────────────────────────────────────────┤
│ ④ 契约 room.json                                  │
│   唯一交换格式：①只认它，②只产它，AI 只写它         │
└─────────────────────────────────────────────────┘
```

### 进程链

```
[Dext 配置器 Tauri] ──自定义gRPC(named pipe)──▶ [Dext Core / Lively fork]
                                            │ spawn
                                [WebView2 Player 进程]
                                            │ 虚拟主机加载
                                ①渲染器 全屏躺在 WorkerW 桌面层
```

当前 Dext 管道名：`\\.\pipe\Grpc_DEXT:DESKTOPSHELL<用户名>`，由仓库根 `dext-runtime-identity.json` 同时提供给 C#、Rust 和 PowerShell。配置器在每个业务 RPC 前验证产品名、运行身份、PID、Core 路径、数据目录和 pipe；Debug 构建拒绝当前 worktree 之外的 Core。
协议：GrpcDotNetNamedPipes 自定义线协议（非标准 HTTP/2，tonic 不可用），帧结构
RequestInit → Headers → Payload → StreamEnd → Trailers，一次调用一条连接。

### 三条关键流

- **编辑流**：配置器枚举应用 → 勾选进 desk → 写 room.json → set_wallpaper 重载 → 桌面变样
- **启动流**：双击图标 → postMessage → Player(WebMessageReceived) → stdout IPC(msg_launch)
  → Core → Explorer 代启（启动的应用与 Lively 无父子关系）
- **切桌流**：Dock ‹ › / 方向键 → 过渡遮罩淡入 → renderDesk(next) → 揭开

## 决策记录

| 日期 | 决策 |
|---|---|
| 2026-08-25 | 不用 Lively 自带 UI，配置器是唯一入口 |
| 2026-08-25 | 只做主显示器（多屏后议） |
| 2026-08-25 | 图标双击启动（防误触）；后期加右键菜单 |
| 2026-08-25 | 每 Desk 独立背景 |
| 2026-08-25 | 图标手动格子定位 x,y（网格默认尺寸待定） |
| 2026-08-25 | 抽共享渲染器：配置器内嵌实时预览，与桌面同一份代码 |
| 2026-08-25 | **Room = 文件夹**，导出分享 = zip。v1 固定为 room.json + `background/` / `start/` / `switch/` / `end/` 自包含内容；素材跨房间重复占用先不解决。图标例外：仍内嵌 base64。 |
| 2026-08-25 | schema 固版 v1 后做 AI skill（提示词模板生成合法房间） |
| 2026-08-25 | 终局方向：Steam 创意工坊模式（创作者上传/用户下载） |
| 2026-08-25 | 房间库默认在仓库 `rooms/` 目录，库路径可指定（前端 localStorage 记住）；**路径一律用英文/ASCII**（中文目录名在 PS 控制台/工具链易乱码） |
| 2026-08-25 | 无背景 desk = 纯黑兜底：body 已 #000 + 渲染器空值守卫，不造黑色图片文件 |
| 2026-08-25 | 应用机制：apply_room 把房间数据拷进壁纸包目录再 SetWallpaper——因 WebView2 虚拟主机只能读包内文件；Room-owned 路径必须按源 Room 镜像替换，不能保留上一 Room 缺失的可选脚本、样式或素材目录（2026-08-29 ROOM-FIX-001 补充） |
| 2026-08-25 | **切换按有向边建模**：`switches["from>to"]` 逐方向保存，来回可不同；房间级 `switch` 是安全默认（详见 MODEL.md）。 |
| 2026-08-25 | transitionText 字段废弃（text 转场类型保留，文案改固定模板）；外观主题(theme)暂不做，痛了再加 |
| 2026-08-25 | **顶层房间脚本路线已废止**：v1 不兼容顶层 room.js/room.css 或 action 扩展；用户代码只进入 background/start/switch/end 的受控 HTML 内容，官方宿主不可替换。 |
| 2026-08-25 | **统一内容方向**：background/start/switch/end 均使用带 `name/type/src` 的 image/video/html 内容；`name` 仅供 UI 展示。 |
| 2026-08-25 | **三幕命名定稿**：start（启动）/ switch（切换）/ end（结束）；v1 不读取 boot/transition/shutdown 旧字段和旧 `transition/` 目录。 |
| 2026-08-27 | **开发仓库唯一化**：所有开发只在本仓库（Orca/DEXT_Core，多 worktree 共享）进行；`D:\midDOW\` 彻底废弃、仅作历史参考。**任何进程/服务都不得再从 midDOW 启动**（曾发生老 vite 残留占端口 1421 导致本项目起不来）。配置器设计模式默认端口如被占用则顺延+1（1422…） |
| 2026-08-26 | **Room 拓扑**：启动画面只直连 `startDesk`（无 switch）；Desk 顺序来自 `desks` 数组，switch 只存在于相邻 Desk 及三页以上的首尾之间。配置器 Room 编辑 = 思维导图，Desk 增删和排序自动同步。 |
| 2026-08-28 | **开发方式收敛**：一个工作包只交付一个可独立验收的结果；每包独立 worktree、分支和验收文件。自测提交后停在待验收，用户明确通过才合并 master；合并后删除工作分支/worktree。ROADMAP 管全局顺序，TODO 只管当前分支。 |
| 2026-08-28 | **Dock 是独立可复用资产**：编辑侧栏的 Dock 页是模板库，只负责浏览、选择和以后承接创意工坊下载项，不直接修改当前 Room；进入 Room 编辑器后才选择该 Room 使用哪个 Dock。当前选择以配置/CSS 快照写入 Room，保证 Room 可独立运行。 |
| 2026-08-29 | **默认 Desk**：复用 UI-003 的 `startDesk`；启动时始终进入该 Desk，不恢复上次停留页。字段缺失或非法时才回退 `desks[0]`。 |
| 2026-08-29 | **Desk 导航拓扑修订为环**：每个 Desk 都应有上一页和下一页。相邻 Desk 建双向边；Desk 数量 ≥3 时再增加首尾双向边，2 个 Desk 不重复造边，1 个 Desk 无 switch。配置器中相邻边走节点上下，只有首尾环线走侧边。 |
| 2026-08-29 | **官方宿主与用户内容分层**：Dext 官方 HTML 宿主持有 Desk、Dock、图标、IPC、保存、导航与生命周期；用户只提供 background/start/switch/end 内容，不能替换或直接控制官方宿主。会写前端的作者可制作受控 HTML，不会写的用户由配置器按钮或官方骨架/vibe coding 生成。 |
| 2026-08-29 | **图片和视频时序**：background 图片纯静态；start/switch/end 图片纯静态显示 0.5 秒。switch 视频完整播放后才换 Desk，不使用中点换页；复杂节奏交给 HTML。 |
| 2026-08-29 | **Desk 排序保持语义**：调整 `desks` 顺序时，配置器按 Desk 和方向重映射 `startDesk` 与 `switches`；新形成的相邻组合缺少内容时提示补充，绝不自动复制或生成。 |
| 2026-08-29 | **契约与重构原计划分包（历史）**：最初计划 DXT-001 只定 Room v1，SCENE-001 再实现 SceneHost；已被下一条 2026-08-30 决策取代。 |
| 2026-08-30 | **DXT-001 契约与现有宿主一起改**：用户明确要求不再把渲染器留到下一包。DXT-001 在同一 worktree/分支/验收内定稿 v1，并原地扩展现有 `playSlot`、`mountBackground`、`resolveTransition`、`switchDesk`、`playVideoTransition`、预览和持久化链；除非现有结构无法满足安全隔离，否则禁止另写重复播放器。SCENE-001 不再单独开发。 |
| 2026-08-30 | **Dext 使用自己的 Lively Core fork，而不是依赖用户另装的原版 Lively**：Dext 配置器、Core、Player 和脚本必须作为同一产品闭环运行。开包时代码仍沿用 Lively 的应用名、单实例名、named pipe、`%LOCALAPPDATA%\Lively Wallpaper` 数据/日志目录和按进程名判断启动的逻辑，存在连错 Core、共享状态和误判已启动的风险；CORE-002 已在独立分支完成隔离实现，待用户验收后再合并。 |
| 2026-08-30 | **开发顺序调整**：DXT-002 的 idle 实现保留在独立待验收分支，但暂不继续扩展或合并；先完成 CORE-002 运行身份隔离，再解决 DXT-002 契约去留，然后补 UI-001、UI-002 与 ROOM-001/002/003 的 Room 制作、导出、导入和校验闭环。 |
| 2026-08-30 | **Dext 运行身份实现边界**：产品名 `Dext`、mutex `DEXT:DESKTOPSHELL`、pipe `Grpc_DEXT:DESKTOPSHELL<用户名>`、数据 `%LOCALAPPDATA%\Dext`、临时缓存 `%TEMP%\Dext`。不读取或静默迁移旧 Lively 数据；保留 Lively namespace、程序集、proto 包、源码目录及 Core/Player 文件名，避免无用户收益的高风险重构。身份可与原版同时存在，但不承诺同时控制 WorkerW。安装器/MSIX/AppUserModelId/屏保注册另由 PACKAGING-001 处理。 |
| 2026-08-31 | **UI-V1 配置器运行真相与安全边界**：Room“使用中”只认 Core `GetWallpapers` 与运行包可信 `__source`，停止只关闭壁纸；Room zip、删除、库读写探测、诊断和文档打开都落在 Rust 白名单边界。设置写入固定为 Get 全量 → patch 允许字段 → Set 全量；配置器主题继续只存在前端。 |
| 2026-08-31 | **Room 生命周期采用 idle、废弃 end**：用户在 Room v2 开工前明确确认采用 `idle` 并废弃 `end`，取代 2026-08-25 的“三幕/end”决定。Room v1/v2 的正式可选待机内容均使用 `idle`/`idle/`；图片常驻、视频静音循环、HTML 持续运行，缺失时黑屏。普通关闭立即结束，旧 `end` 不迁移也不兼容。 |
| 2026-08-31 | **待机生命周期复用 Lively Core**：只认 `ScreensaverService` 明确传入的 screensaver 启动标记，复用其空闲检测、全屏窗口、多屏、媒体保护、输入唤醒与锁屏设置；Dext 不新增待机计时器或设备偏好字段。 |
| 2026-08-31 | **Room v2 Widget 契约冻结**：Widget placement 保存为 1920×1080 逻辑画布整数矩形与 z，未来宿主按居中等比 contain 缩放；P1 自动允许时间、语言、视口、当前 Desk、暂停态、音频频谱及 CPU/GPU/RAM 摘要，歌曲/封面、网络摘要和 Dext 代理联网为 P2，P3/P4 只保留配额 KV、Dext 内导航/通知和用户映射 action 的未来声明。网络默认离线且禁止直连，manifest 不接受域名白名单或可执行路径；每个 Desk 的 Widget 是独立实例但 id 在 Room 内全局唯一；config 随 Room，宿主管理的可变数据与授权只留本机。v1→v2 只能显式复制并保留源 v1；WidgetHost 前 v2 仅可列出、只读打开和校验，禁止编辑、保存、另存降级、应用、v1 预览和当前 zip 操作。 |
| 2026-08-31 | **Room 契约收口为原生 v2-only**：用户确认当前 Room 均为 demo，无需保留 v1 兼容、迁移或降级路径。新建、读取、编辑、保存、另存、预览、应用与 zip 只接受/产生 `version: 2`；每个 Desk 始终带 `widgets`。删除 v1 Schema、fixtures、版本分派、`buildRoomV1()` 及只为兼容旧 Room 存在的代码和提示；历史 v1 文档只作历史记录，不再是运行契约。该决定取代上一条中的 v1 保留、显式复制升级和 WidgetHost 前 v2 只读限制。 |
| 2026-09-02 | **配置器 v2 采用单工作包端到端交付**：用户明确要求不再把配置器 UI、WidgetHost、Scene 数据展示、图标避让、可信系统热点和安全分享拆成多个中途验收步骤。UI-V2-001 在一个 worktree/分支中保留现有设计语言并重构代码职责，同时完成真实运行链；内部允许按风险顺序提交，但只在全部范围完成后做一次人工验收。创意工坊云服务、内置外部 AI、代理联网、安装器和多显示器仍不在本包。 |
| 2026-09-02 | **v2 能力授权绑定源 Room 内容哈希**：Scene/Widget 的声明不等于批准；本机授权存放在 `%LOCALAPPDATA%\\Dext\\permissions-v1.json`，按规范化源 Room 路径、整份 `room.json` SHA-256 和内容 subject 绑定。保存修改、另存或重新导入后授权自动失效。v2 当前完全离线，未实现的代理联网、导航、通用存储和通知能力从允许枚举删除，而不是保留不可兑现入口。 |
| 2026-09-11 | **当前 Room 的 Desk 布局采用受控热同步**：配置器放入/移除应用只提交目标 Desk 图标布局，Rust 从可信源 Room 读改写并同步匹配的运行包，再通过 Core 向官方顶层宿主发送完整运行快照；不以自动 `apply_room` 重启壁纸，也不让客户端提供 `__source` 或写入路径。新增后默认最小化配置器、切目标 Desk 并进入编辑，可在设置中关闭跳转但不关闭热同步。Widget placement 优先于图标，真桌面松手时只移动冲突图标；无完整合法布局则整体回退。 |
| 2026-09-19 | **Desk 自动重排采用浏览器先行的自研轻量动画层**：`DextLayout` 只负责最终坐标，新增 `DextLayoutMotion` 以稳定身份和 FLIP/WAAPI 统一执行 move/enter/exit、revision 中断与 reduced-motion；不引入通用拖拽/网格运行时。先用直接调用同一引擎的浏览器实验台和 Playwright 固化行为，用户确认运动质感前禁止接入真实桌面 `main.js`。动画不改变 room.json 或 Widget 优先、Dock 禁区、无解整体回退规则。 |
| 2026-09-19 | **自动重排不得替换苹果式长按编辑模式**：用户验收反馈要求保留 500ms 长按、图标与 Widget 抖动和完成退出。图标由内层 face 执行 ±1.35°/350ms jiggle；Widget 必须是边框、背景、阴影与文字整卡执行更克制的 ±0.38°/420ms jiggle，拖动当前对象时暂停，reduced-motion 关闭。点击 Done 或双击桌面真正空白处退出编辑，交互对象上的双击不退出。默认 move 为 280ms、rollback 为 300ms；极限连续 revision 只作为压力场景。 |
| 2026-09-19 | **图标拖动采用 Sortable 路径重排，不做两两交换**：拖起图标轻微抬高并跟随指针，目标格保留 placeholder，源格到目标格之间的图标依次 FLIP 让位，松手保存新坐标顺序。图标重排不移动 Widget；Widget 自身仍可拖并优先占位。Dock 是图标与 Widget 的禁放区。 |
| 2026-09-19 | **拖动取消与 Reset 以单次输入事务为边界**：每次真实图标/Widget 拖动开始前，以当前已发布布局建立独立恢复基线，不继承旧场景的 preview；Reset/场景切换必须终止 drag/press、500ms 长按 timer 和 pointer capture，旧 pointer 序列不得跨重置继续提交。 |

## 工作流

- `scripts/build.ps1`：全量构建+部署插件（改 C#/.proto 必跑）
- `scripts/start.ps1`：部署检查+起 Core+起配置器 dev（纯前端改动只跑这个）
- `cargo test --lib applies_room_wallpaper -- --ignored`（在 tauri-ui/src-tauri）：显式运行会改变桌面和 Core 恢复布局的活体测试；普通 `cargo test --lib` 不运行
- Player 必须 Release（Debug 分支不发 hwnd → ShowAsync 永久挂起）
- 日志：`%LOCALAPPDATA%\Dext\logs\<最新>.txt`；用首行 PID/BaseDirectory/identity 判断是否为 Dext Core

## 仓库地图

- `lively-core-separation/lively-core-separation/`：C# 源码（内层目录同名嵌套）
  - `src/Lively/Lively/Services/AppCatalogService.cs` 枚举/启动
  - `src/Lively/Lively/RPC/WinDesktopCoreServer.cs` RPC 处理
  - `src/Lively/Lively/Core/Wallpapers/WebWebView2.cs` msg_launch/hwnd 流程
  - `src/Lively/Lively.Player.WebView2/Form1.cs` webview→core 转发
  - `src/Lively/Lively.Grpc.Common/Proto/wallpaper.proto` RPC 定义
- `tauri-ui/`：配置器
  - `src/App.tsx` 编辑器 UI；`src-tauri/src/grpc.rs` 协议客户端；`src-tauri/proto/` 去 BOM 的 proto 副本
- `wallpapers/dext-room/`：运行时渲染器 + 当前激活的 room.json + assets/
- `dext-room-demo/`：最早的独立 demo（gitignore，仅存档）
- `D:\midDOW\DeskBox\`：外部参考仓库（快捷方式/图标/Explorer 启动的移植来源，GPL-3）
