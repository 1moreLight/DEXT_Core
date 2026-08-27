# Dext 开发文档总纲（接口与文档索引）

> 更新：2026-08-25。本文件是全部文档与接口的唯一索引；细节看各分册。
> 新会话入口：先读 `../AGENTS.md` → 按「文档体系」顺序读分册 → 从 TODO 最后未完成项继续。

## 一、项目全景

**Dext**：把 Windows 桌面变成手机式主屏。多个 Desk 放真图标应用、长按编辑、切桌动画；整套主题打包成 Room 分享。终局对标 Wallpaper Engine（创作者上架创意工坊，普通用户下载即用）。

```
① 运行时渲染器  wallpapers/dext-room/{index.html,style.css,main.js}
   纯静态三件套，读 room.json 画桌面；跑在 Lively WebView2 Player 里
② 编辑器(配置器) tauri-ui/   Tauri2+React+TS+Tailwind4+shadcn
   使用/编辑双模式；房间库；背景/转场素材；保存并应用
③ 底座(Lively fork)  lively-core-separation/src/Lively/  C# .NET9 WPF
   WorkerW 桌面层托管；应用枚举/启动；RPC 服务端；IPC 处理
④ 数据契约  room.json   ①只认它 ②只产它 AI 只写它
```

进程链：`配置器 ──自定义gRPC(named pipe)──▶ Lively Core ──spawn──▶ WebView2 Player ──虚拟主机──▶ ①渲染器`

## 二、dev_docs 文档体系

| 文件 | 内容 | 何时读/写 |
|---|---|---|
| `../AGENTS.md` | 会话纪律与环境速查（必读协议） | 每次会话开始 |
| `README.md`（本文件） | 全景 + 接口总表 | 查接口时 |
| `PROJECT.md` | 产品定义、决策记录（带日期）、仓库地图、schema 详解、工作流 | 了解"为什么这么设计" |
| `TODO.md` | 总任务台账·当前（**只加不删**，完成打 `[x] 日期`，受阻 `[!]`，废弃标"已取消"） | 每轮动代码前追加计划，做完立即打标 |
| `TODO-archive.md` | 总任务台账·历史归档（已完成阶段全量记录） | 回溯历史阶段时 |
| `ERRORS.md` | 踩坑总索引（编号→五本分册速查表） | 排障时先查索引 |
| `errors/git.md` | 踩坑·Git 协作篇（仓库/分支/worktree/并行会话） | git 相关坑 |
| `errors/backend.md` | 踩坑·后端篇（C# / Rust / RPC / 运行时） | 后端相关坑 |
| `errors/frontend.md` | 踩坑·前端篇（配置器 Tauri/React） | 前端相关坑 |
| `errors/renderer.md` | 踩坑·渲染器篇（wallpapers/dext-room） | 渲染器相关坑 |
| `errors/toolchain.md` | 踩坑·工具链篇（PowerShell / 编码 / 环境） | 工具链相关坑 |
| `LIVELY_API.md` | Lively API 全景调研（壁纸侧 JS 注入函数 / IPC 三通道 / 命令行控制 / fork 对照与待验证项） | 想用 Lively 原生能力（音频频谱/歌曲信息/硬件监控等）或外部脚本控制时 |
| `ACCEPTANCE.md` | 人工验收清单（每轮追加，用户亲自打勾） | 每轮代码完成后追加 |
| `FRONTEND.md` | 渲染器外观迭代手册（实时预览、函数表、任务池、纪律） | 前端外观工作 |
| `FRONTEND_WORK.md` | 配置器 UI 协作手册（小步迭代工作流、主页改版进度、结构快照） | 配置器 UI 工作 |
| `DOCK.md` | **Dock 模块契约**（room.json dock 节点 schema、合并规则、渲染器行为、配置器对接点） | 任何 dock 相关改动/UI 接线 |

**铁律**：动代码前先写 TODO 计划 → 每完成一步打标 → 踩坑记 ERRORS → 决策记 PROJECT → 每轮出验收清单 → 自测通过即 commit。断线/换会话靠台账无损续接。

## 三、数据契约 room.json（v0.x，宽容读取：缺字段必须给默认值）

```jsonc
{
  "desks": [
    {
      "name": "Desk 1",
      "background": "background/x.png",        // 字符串=图片路径(相对房间根)；"" =黑底
                                                // 或 {"type":"video","src":"background/x.mp4"}
      "iconSize": "medium",                     // large|medium|small
      "icons": [
        {
          "label": "Edge",
          "x": 0, "y": 0,                       // 稀疏格子坐标；列数随 iconSize/屏宽动态
          "icon_png": "<base64>",               // 可选；否则 glyph+color 兜底
          "glyph": "🌐", "color": "#3b82f6",
          "action": "启动 浏览器",               // 无 launch 时的 toast 文案
          "launch": { "target": "", "args": "", "workdir": "" }
        }
      ]
    }
  ],
  "transition": "slide",                        // 或 {"type":"video","src":"transition/x.mp4"}
  "dock": { ... },                              // Dock 自定义（可选）：位置/样式/常驻图标，见 DOCK.md
  "__source": "D:\\...\\rooms\\my-room"         // 配置器 apply 时盖的戳；桌面编辑据此双写回源库
}
```

房间形态：`rooms/<房名>/` = `room.json + background/(图/视频素材) + transition/(转场视频)`。
应用 = 配置器把这三样拷进壁纸包 `wallpapers/dext-room/`（WebView2 虚拟主机只能读包内文件）。

## 四、接口总表

### L1 渲染器扩展接口（main.js，纯静态无框架——保持这样）

| 接口 | 形态 | 说明 |
|---|---|---|
| `TRANSITIONS` | 注册表 `{名字: {dur, run(stage,dir,done), cleanup()}}` | 切桌动画扩展点；现有 slide/fade/zoom/none；`dir` +1 下一桌 / -1 上一桌 |
| 视频转场 | 特例 `playVideoTransition(next, src)` | stinger：全屏视频，播到 50% 换桌，ended 揭晓；失败回退 slide |
| `ICON_SIZES` / `sizeOf` | 常量表 | 大/中/小三档（图标/格子/字号联动），desk.iconSize 选用 |
| `transitionSpec()` | 读取器 | room.transition 字符串/对象 → {name, src}，宽容缺省 slide |
| `mountBackground(bg, video, desk)` | 函数 | 背景多态渲染（图片/视频/黑底），主层与 staging 共用 |
| `renderIcons(layer, desk, s)` | 函数 | 图标渲染（坐标钳制/真图标/长按/删除），主层与 staging 共用 |
| 主题令牌 | style.css `:root` `--dext-*` | 外观迭代第一入口（accent/success/danger/dock 等 8 个） |
| `dext:room` 消息 | window message | 配置器预览注入 `{type:"dext:room", room, deskIndex}` → 整房重渲 |
| `window.dext` | 房间脚本 API | onReady / onDeskChange / onEditChange / getRoom / getCurrentDesk（MODEL.md §6） |
| `room.js` / `room.css` | 房间自带 | 渲染器加载（错误隔离）；apply_room 随包拷贝 |
| `dockCfg()` / `renderDock()` | 函数 | Dock 自定义：合并全局+桌级配置、位置/样式/autoHide/dots、常驻图标（DOCK.md） |
| 演出槽 playSlot | 统一播放器 | `{video|html|action}` 三态；start 覆盖层 / end / switch 共用（MODEL.md §6.5） |
| `dext:end` | Player→页面 | cmd_close 转发；页面播 end 槽后 ack `dext:endDone`（5s 上限） |

### L2 渲染器 → Player → Core（上行 IPC，stdout 管道）

| 消息 | postMessage 载荷 | MessageType | Core 处理 |
|---|---|---|---|
| 启动应用 | `{target, args, workdir}` | `msg_launch` | Explorer 代启（应用不归属 Lively） |
| 保存房间 | `{type:"saveRoom", room}` | `msg_save_room` | 写包内 room.json；有 `__source` 再写源库（双写） |

新增上行消息的模式：MessageType 枚举加值 → Lively.Models.Message 建消息类 → IpcMessageConverter 加映射 → Player Form1.WebMessageReceived 分支 → Core WebWebView2 switch 落地。

### L3 Tauri commands（配置器前端 ↔ Rust，`invoke`）

| 命令 | 签名 | 说明 |
|---|---|---|
| `get_installed_apps` | `→ AppInfo[]`（含 48px 图标 base64） | 开始菜单枚举 |
| `launch_app` | `(target, arguments, working_dir)` | 走 RPC 启动 |
| `get_wallpapers` / `set_wallpaper` / `core_stats` | 见 grpc.rs | RPC 封装 |
| `list_rooms` | `(dir) → {name,path,desks,icons}[]` | 扫房间库（含 room.json 的子文件夹） |
| `read_room` / `write_room` | `(path[, room_json])` | 参数化读写房间文件 |
| `create_room` | `(dir, name) → path` | 骨架房（校验非法字符） |
| `apply_room` | `(room_dir)` | 盖 `__source` 戳 → 拷 room.json+background/+transition/ 进包 → SetWallpaper 重载 |
| `import_background` | `(room_dir, src_path, kind) → background值` | kind=image/video/transition；拷进对应子目录，时间戳命名 |

### L4 gRPC（Rust ↔ Core，GrpcDotNetNamedPipes 自定义线协议）

- 管道：`\\.\pipe\Grpc_LIVELY:DESKTOPWALLPAPERSYSTEM<用户名>`；**不是标准 HTTP/2，tonic 不可用**，客户端在 `tauri-ui/src-tauri/src/grpc.rs` 手写帧（RequestInit→Headers→Payload→StreamEnd→Trailers），一次调用一条连接
- 用到的 RPC（wallpaper.proto DesktopService）：`GetInstalledApps`(stream) / `LaunchApp` / `SetWallpaper` / `GetWallpapers`
- proto 副本在 `src-tauri/proto/`，**必须去 BOM**（protox 限制）

### L5 `dext://` 自定义协议（配置器内嵌渲染器 = 实时预览通道）

- Rust 注册，把壁纸包目录映射给配置器 webview（Windows 下 `http://dext.localhost/`）
- iframe 加载 `index.html` + postMessage 注入编辑态房间 = 所见即所得预览
- 带路径穿越防护；mime 表覆盖 html/css/js/json/png/jpg/svg/mp4/webm

## 五、工作流命令

| 场景 | 命令 |
|---|---|
| 全量构建（改 C#/.proto 后必跑） | `scripts\build.ps1`（Player 必须 Release） |
| 日常启动（核心+配置器） | `scripts\start.ps1` |
| 渲染器外观迭代（无需 Lively） | `scripts\room-preview.ps1`（端口 5174 热刷新） |
| 强制重铺壁纸 | `cargo test --lib applies_room_wallpaper`（tauri-ui/src-tauri 下） |
| 配置器自测 | `npm run build`（tauri-ui）；Rust 侧 `cargo check` |
| 渲染器语法自检 | `node --check wallpapers/dext-room/main.js` |
| 日志 | `%LOCALAPPDATA%\Lively Wallpaper\logs\<最新>.txt` |
| 查代码 | `codegraph explore/node` 优先（索引已建） |

## 六、当前能力清单（2026-08-25）

- 桌面：图标网格（稀疏坐标+三档尺寸）、长按编辑（拖拽/占用交换/删除/抖动）、双击启动、‹ › 切桌、方向感知过渡（slide/fade/zoom/none/text/视频stinger）、图片/视频/黑底背景（视频循环懒挂载）
- 持久化：桌面编辑双写（包内+源库）、重启/重应用/切房全一致
- 配置器：使用/编辑双模式、房间库（新建/另存/切换/库路径可指定）、应用库搜索勾选、背景与转场素材选择、实时预览（dext:// + 注入）、保存/应用分离
- 未做（排队）：Schema v1 定稿+校验文件、导入 json 校验入口、失效快捷方式过滤、图标归一化、右键菜单、房间导出 zip、AI skill、多屏、创意工坊
