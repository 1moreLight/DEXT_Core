# Lively API 全景调研

> 更新于 2026-08-25。研究对象：上游 Lively 生态全部对外接口形态 + 本 fork 现状对照。
> 结论先行：官方对外只有两套正式 API——**壁纸侧 JS 注入函数**与**命令行控制**；
> 没有 HTTP/REST API（维护者在 discussion 中明确拒绝）。fork 两套都完整保留。

## 零、全景分层图

```
┌─ 外部程序/脚本 ──── 命令行参数 ──────────────▶ Lively Core（单实例经 gRPC AutomationCommand 转发）
│                                                    │ spawn + 命令行启动参数(--wallpaper-*)
│                                                    ▼
│                                              WebView2 Player 进程
│   ┌── A. JS 注入函数 ◀──────── ExecuteScriptFunctionAsync ────────┤
│   │   （livelyAudioListener 等，页面定义全局函数即可收数）              │
│   └── B. postMessage ──────▶ WebMessageReceived ──▶ stdout IPC ───▶ Core
│                                                    │
│   C. 下行 IPC（stdin）：cmd_* / lsp_* / lp_* ◀──────┘
└─ D. LivelyProperties.json：声明式属性面板（配置持久化 + setprop 命令行可改）
```

## 一、A：壁纸侧 JS API（Lively → 页面）

Player 用 `ExecuteScriptFunctionAsync` 调页面的**全局函数**（WebView2 Player `Form1.cs`）。
这些函数会注入官方顶层页面。room.json v1 不再执行顶层 `room.js`；sandbox 用户 HTML 也不直接获得这些宿主能力。若未来开放给内容作者，必须先设计受控转发协议。

| 全局函数 | 载荷 | 启用开关（LivelyInfo.json `"Arguments"`） | fork 状态 |
|---|---|---|---|
| `livelyAudioListener(arr)` | 128 长度小数数组，值典型 0~1（不保证封顶，需自行钳制），系统音频频谱 | `--audio` | ✓ Form1.cs:416 |
| `livelyCurrentTrack(json)` | JSON 字符串：Title/Artist/AlbumTitle/Thumbnail(base64)/Genres…，无媒体播放时 `null` | `--system-nowplaying` | ✓ Form1.cs:370 |
| `livelySystemInformation(json)` | JSON 字符串：NameCpu/CurrentCpu/NameGpu/CurrentGpu3D/CurrentNetDown/CurrentNetUp/TotalRam/CurrentRamAvail | `--system-information` | ✓ Form1.cs:396 |
| `livelyWallpaperPlaybackChanged(obj)` | `{IsPaused: true\|false}`（暂停时 JS 仍执行，只是渲染停了） | `--pause-event true` | ✓ Form1.cs:660 |
| `livelyPropertyListener(name, val)` | 属性名 + 新值；页面加载时会先调一次初始化 | 由 LivelyProperties.json 存在即启用 | ✓ Form1.cs:607+ |
| `livelyCurrentWeather(obj)` | 天气（上游标注 NOT READY） | `--area-weather` | ✗ 未实现 |

### 1.1 开关透传机制（关键实现细节）

- Core 组装 Player 命令行时，把 `LivelyInfo.json` 的 `Arguments` 里每个 `--xxx`
  改写为 **`--wallpaper-xxx`** 追加进去（`WebWebView2.cs:482 TryParseUserCommandArgs`）。
  所以 wiki 写的 `--audio` 实际到达 Player 是 `StartArgs.AudioVisualizer`。
- Player 侧开关全集见 `Lively.Player.WebView2/StartArgs.cs`：
  `--wallpaper-url/-type/-display/-geometry/-scale/-volume/-user-data/-debug/-color-scheme/-property`
  + 功能开关 `-audio`(频谱)/`-audio-id`(输出设备)/`-system-information`/`-system-nowplaying`/`-pause-event`/`-pause-media`/`-verbose-log`。
- 注意：`--wallpaper-audio` 是 bool，解析器不接受显式 `false`（上游注释引 commandline#702）；
  另 Core 仅当 `LivelyInfo.Type == "webaudio"` 时才自动加 audio 开关，
  `Type: "web"` 的房间想开频谱**必须自己写 `"Arguments": "--audio"`**（待真机验证）。

### 1.2 数据样例（来自上游 wiki）

```js
// 音频频谱
function livelyAudioListener(audioArray) { /* 128 个 0~1 小数 */ }

// 正在播放（JSON 字符串，需 parse）
function livelyCurrentTrack(data) {
  const o = JSON.parse(data);
  if (o) console.log(o.Title, o.Artist, o.Thumbnail /*base64*/); // null = 没在放
}

// 硬件监控（JSON 字符串）
function livelySystemInformation(data) {
  const o = JSON.parse(data);
  // o.NameCpu/o.CurrentCpu(%) o.NameGpu/o.CurrentGpu3D(%)
  // o.CurrentNetDown/o.CurrentNetUp(Bytes/s) o.TotalRam/o.CurrentRamAvail(MB)
}

// 暂停状态
function livelyWallpaperPlaybackChanged(data) {
  console.log(JSON.parse(data).IsPaused);
}
```

## 二、B：页面回传通道（页面 → Player → Core）

页面 `window.chrome.webview.postMessage(obj)` → Player `WebMessageReceived`（Form1.cs:203）
→ stdout 行 JSON → Core `WebWebView2` switch 处理。

fork 的上行 IPC 消息全集（`MessageType` 枚举上行半区）：

| postMessage 载荷 | MessageType | Core 行为 |
|---|---|---|
| `{target, args, workdir}` | `msg_launch` | Explorer 代启应用 |
| `{type:"saveRoom", room}` | `msg_save_room` | 写包内 room.json + 按 `__source` 双写源库（Dext 自增） |
| （内部握手）hwnd | `msg_hwnd` | Player 把窗口句柄交给 Core 托管 WorkerW |
| （内部）日志 | `msg_console` | 写日志 |
| （内部）加载完成 | `msg_wploaded` | Core 收尾 |
| （内部）截图完成 | `msg_screenshot` | 截图流程 |

> fork 的 WebMessageReceived 逻辑：`dext:shutdownDone` 自吞（Phase 9 shutdown 流程）、
> `saveRoom` 转 msg_save_room、**其余一律按 launch 载荷转发**。

## 三、C：下行 IPC（Core → Player stdin）

`MessageType` 下行半区，Player 收到后翻译成页面动作：

| 消息 | 页面效果 |
|---|---|
| `cmd_reload` / `cmd_close` / `cmd_screenshot` | 重载页 / 关闭 / 截图请求 |
| `cmd_suspend` / `cmd_resume` | 暂停页内所有 video/audio / 恢复播放 |
| `cmd_volume` | 音量（Player 内部处理） |
| `lp_slider/textbox/dropdown/fdropdown/button/cpicker/chekbox/dropdown_scaler` | → `livelyPropertyListener(name,val)` 注入页面 |
| `lsp_perfcntr` / `lsp_nowplaying` | → `livelySystemInformation` / `livelyCurrentTrack` 注入 |

## 四、D：外部控制面（第三方程序 → Lively）

### 4.1 没有 HTTP API

上游 maintainer 在 discussion #2386 明确答复：不支持自建/内置 HTTP server 对外暴露控制。
网上所谓"Lively API"均指第一节壁纸侧 JS。**别找 REST，不存在。**

### 4.2 命令行控制（官方唯一外部控制方式）

`lively.exe <args>`；已有实例运行时经单实例 mutex → gRPC `AutomationCommand` 转发（App.xaml.cs:72）。
fork **完整保留**：`Lively/Commandline/CommandHandler.cs`（658 行全套）+
`RPC/CommandsServer.cs:102` + 独立工具工程 `Lively.Utility.Commandline`（等价上游 livelycu.exe）。

| 命令 | 说明 |
|---|---|
| `app --showApp true/false` | 显示/最小化主界面（托盘） |
| `app --shutdown true` | 退出全部 |
| `app --play true/false` | 全局播放/暂停壁纸 |
| `app --volume 100 / +10 / -10` | 全局音量（绝对或增量） |
| `app --showIcons true/false` | 桌面图标显隐 |
| `app --layout per/span/duplicate` | 排布方式 |
| `setwp --file <路径/random/reload> [--monitor n]` | 设壁纸（库内文件夹/媒体文件自动导入/随机/重载） |
| `closewp --monitor n(-1=全部)` | 关壁纸 |
| `seekwp --value 10.5 / +10 [--monitor n]` | 播放进度（网页壁纸仅 0=刷新有效） |
| `setprop --monitor n --property "key=value"` | 改运行中壁纸的 LivelyProperty（支持 ++/-- 增量、`lively_default_settings_reload=true` 重置） |
| `screenshot --file x.jpg [--monitor n]` | 壁纸截图 |
| `screensaver --show/fadeIn/showExclusive true/false` | 屏保 |

## 五、E：LivelyProperties.json（声明式属性面板）

- 壁纸根放 `LivelyProperties.json`（slider/textbox/dropdown/folderDropdown/button/color/checkbox/label
  八种控件声明），Lively 自动生成「自定义」UI；用户改动持久化到每显示器副本，
  副本路径经 `--wallpaper-property` 传给 Player，变更以 `lp_*` 消息回流 → `livelyPropertyListener`。
- 可与命令行联动：`setprop` 改的就是这份副本 → 等于给了外部程序一个**持久化的壁纸参数遥控器**。
- 本地化文件 `LivelyProperties.loc.json`（v2.2.0+）；JSON Schema 在上游仓库 `schemas/` 目录。
- 视频类壁纸有内置默认属性（hue/saturation/brightness…），mpv 插件目录可见默认模板。

## 六、对照本仓库：Dext 能直接用什么

| 能力 | 现状 | 对 Dext 的价值 |
|---|---|---|
| JS 注入函数 | fork Player 原样保留，官方顶层页面可用 | v1 用户内容尚未开放；未来需由官方宿主筛选并转发给 sandbox，而不是恢复顶层 room.js |
| postMessage 回传 | fork 已扩 dext 消息（launch/saveRoom/dext:shutdownDone） | 我们自己的通道比上游原生更丰富，继续走这条线 |
| 命令行控制 | fork 全保留 | 自动化测试可用（如 `setwp reload` 替代部分重铺场景）；创意工坊阶段可做 CLI 导入器 |
| LivelyProperties | 机制在，但 Dext 配置器已自建编辑 UI | 暂不用；若将来要"桌面右键自定义壁纸参数"可复用此通道（setprop → livelyPropertyListener） |
| HTTP API | 不存在 | 配置器↔Core 继续走自有 gRPC named-pipe |

### 风险/待验证

1. `"Arguments": "--audio"` 在 `Type:"web"` 房间是否生效未实测（理论可行：Arguments 透传无条件执行）。
2. 音频频谱需要 NAudioLoopback 捕获权限/设备存在；无声卡输出时数组可能恒 0。
3. `livelyAudioListener` 等注入发生在**页面所有帧还是主 frame**未验证；v1 先按只信任官方顶层页面处理，不向 sandbox 内容承诺。
4. 暂停策略：`cmd_suspend` 会暂停页面 media 元素，Dext 的视频背景/演出槽受此影响属预期行为（跟随 Lively 暂停语义）。

## 七、参考

- 上游 wiki：System Data（Web-Guide-V）、Interaction/LivelyProperties（Web-Guide-IV）、Command-Line-Controls、Web-Player
- 维护者关于无 HTTP API 的答复：lively discussion #2386（2024-09）
- fork 代码坐标：
  - `src/Lively/Lively.Player.WebView2/Form1.cs`（JS 注入 + WebMessageReceived）
  - `src/Lively/Lively.Player.WebView2/StartArgs.cs`（Player 命令行全集）
  - `src/Lively/Lively/Core/Wallpapers/WebWebView2.cs`（启动参数组装 + 上行消息落地）
  - `src/Lively/Lively/Commandline/CommandHandler.cs`（命令行全套）
  - `src/Lively/Lively/RPC/CommandsServer.cs`（AutomationCommand gRPC 入口）
  - `src/Lively/Lively.Models/Message/MessageType.cs`（IPC 消息枚举）
