# Dext 项目档案

> 更新于 2026-08-25。结构性决策变更时更新此文件。

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
| 2026-08-25 | **Room = 文件夹** { room.json + background/ 素材 }，导出分享 = zip。指令与素材分离；素材跨房间重复占用问题先不解决(YAGNI)，痛了再做哈希去重库。图标例外：仍内嵌 base64（程序生成的小图，不算素材） |
| 2026-08-25 | schema 固版 v1 后做 AI skill（提示词模板生成合法房间） |
| 2026-08-25 | 终局方向：Steam 创意工坊模式（创作者上传/用户下载） |
| 2026-08-25 | 房间库默认在仓库 `rooms/` 目录，库路径可指定（前端 localStorage 记住）；**路径一律用英文/ASCII**（中文目录名在 PS 控制台/工具链易乱码） |
| 2026-08-25 | 无背景 desk = 纯黑兜底：body 已 #000 + 渲染器空值守卫，不造黑色图片文件 |
| 2026-08-25 | 应用机制：apply_room 把房间数据（room.json + background/）拷进壁纸包目录再 SetWallpaper——因 WebView2 虚拟主机只能读包内文件 |

## 当前 room.json 隐式 schema (v0)

```jsonc
{
  "desks": [
    {
      "name": "Desk 1",
      "background": "assets/desk1-bg.png",     // 文件路径（v0 仅此形态）
      "icons": [
        {
          "label": "Edge",
          "icon_png": "<base64 png 可选>",      // 有则显示真图标
          "glyph": "🌐", "color": "#3b82f6",    // 无 icon_png 时的兜底
          "action": "启动 浏览器",                // 无 launch 时的 toast 文案
          "launch": { "target": "...exe", "args": "", "workdir": "" }
        }
      ]
    }
  ],
  "transitionText": "可选，缺省用默认文案"
}
```

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
