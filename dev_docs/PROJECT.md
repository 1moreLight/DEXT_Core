# Dext 项目档案

> 更新于 2026-08-28。结构性决策变更时更新此文件；当前开发顺序只看 ROADMAP.md。

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
│ ③ 底座（Lively core fork，C# .NET9 WPF）          │
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
[配置器 Tauri] ──自定义gRPC(named pipe)──▶ [Lively Core]
                                            │ spawn
                                [WebView2 Player 进程]
                                            │ 虚拟主机加载
                                ①渲染器 全屏躺在 WorkerW 桌面层
```

管道名：`\\.\pipe\Grpc_LIVELY:DESKTOPWALLPAPERSYSTEM<用户名>`（Constants.cs:75）
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

## 工作流

- `scripts/build.ps1`：全量构建+部署插件（改 C#/.proto 必跑）
- `scripts/start.ps1`：部署检查+起 Core+起配置器 dev（纯前端改动只跑这个）
- `cargo test --lib applies_room_wallpaper`（在 tauri-ui/src-tauri）：强制重新铺壁纸
- Player 必须 Release（Debug 分支不发 hwnd → ShowAsync 永久挂起）
- 日志：`%LOCALAPPDATA%\Lively Wallpaper\logs\<最新>.txt`

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
