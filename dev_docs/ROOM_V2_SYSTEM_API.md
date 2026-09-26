# Room v2 受控系统 API

> 状态：Core gRPC、Tauri 后端、真实 Player 能力桥、Scene/Widget 实例授权和可信热点已实现；最终活体媒体/音量验收仍随 UI-V2-001 一次执行。
> 本文只描述可分享内容最终允许接触的封闭系统能力，不是通用自动化接口。

## 一、安全原则

- Scene/Widget 永远不能直接调用 Tauri、gRPC、WebView2 IPC、Shell、文件系统或 Windows API。
- 所有本机能力由官方顶层宿主代理，先检查 manifest 请求、用户授权、实例身份、参数 Schema、频率和真实用户手势。
- 分享包只声明标准能力名，不携带本机批准记录、程序路径、命令行、凭据或设备 id。
- 未知能力、未知字段、越界参数和通用命令字符串在 Rust 和 Core 最终边界再次拒绝。
- 系统动作必须是明确枚举，不能提供 `execute(actionString)` 一类开放接口。

## 二、当前已实现的可信后端

### 2.1 当前系统媒体

Tauri commands：

- `get_system_media()`
- `control_system_media(action)`

Core RPC：

- `GetSystemMedia`
- `ControlSystemMedia`

读取结果包括：是否存在会话、来源应用、标题、作者、专辑、播放状态、进度、时长和播放能力。允许的动作只有：

- `play`
- `pause`
- `toggle-play-pause`
- `next`
- `previous`

实现复用 Lively 已依赖的 NPSMLib。Windows `GlobalSystemMediaTransportControlsSessionManager.RequestAsync()` 在真实环境中可能永久挂起，因此不作为 Core 实现。Rust RPC 另有 10 秒总超时，防止任何 Core 调用永久占住配置器。

专辑封面字段是可选的。部分媒体提供者（已验证 Apple Music）在 Core 进程中读取 NPSMLib 封面流会阻塞后续全部媒体访问，因此 Core RPC 当前不主动读封面。真壁纸运行时继续复用 Lively Player 已有的 `livelyCurrentTrack` 数据与封面缓存；后续 `CapabilityBridge` 从 Player 缓存受控转发给获授权 Scene/Widget，而不是在每次点击或轮询时重新读取系统流。

### 2.2 Windows 默认输出主音量

Tauri commands：

- `get_system_volume()`
- `set_system_volume(level?, muted?)`

Core RPC：

- `GetSystemVolume`
- `SetSystemVolume`

读取返回默认多媒体输出设备的 `level`（0..1）、静音状态、设备 id 和名称。写入必须至少提供 `level` 或 `muted`；音量必须是有限数且位于 0..1。Rust 和 Core 都执行同样校验。

这里只操作 **Windows 系统默认输出主音量**，不是壁纸视频、Scene、Widget 或 Dext 自己的音量。

## 三、Capability Bridge

作者侧使用当前 Creator Pack protocol 1 的版本化、结构化 API。例如，SDK 初始化后读取最近一次快照或订阅后续变化：

```js
const media = dext.get("now-playing.read"); // 尚无快照时为 undefined
const volume = dext.get("system.volume.read");

dext.subscribe("now-playing.read", renderMedia);
dext.subscribe("system.volume.read", renderVolume);
```

当前 iframe 通过 `dext:scene:init` / `dext:widget:init` 建立实例，之后只接收 `dext:capability` 结构化消息。桥接层已经：

- 按源 Room 路径、Widget/Scene 身份和源 `room.json` 字节摘要查授权。当前摘要不包含 HTML/JS/CSS 文件；未来作品版本需要另外设计整体内容身份。
- 对数据做裁剪，默认不泄露设备 id、进程路径或其他会话列表。
- 媒体/音量订阅使用宿主缓存和限频，不允许每个 Widget 自己高频轮询 Core。
- 页面销毁或切 Desk 后立即撤销订阅，旧 instanceId 消息无效。
- P2 的歌曲信息和封面需要明确授权；P1 的音频频谱不自动包含歌曲身份。

## 四、可信动作

作者只能声明热点或按钮希望执行的标准 action：

```jsonc
{
  "action": "system.media.toggle-play-pause"
}

{
  "action": "system.volume.set",
  "value": 0.35
}
```

执行前必须同时满足：

1. 当前 Room/实例请求了对应权限；
2. 用户已在本机批准；
3. action 与参数通过封闭 Schema；
4. 事件来自官方可信命中层捕获的真实点击、触摸或键盘激活；
5. 未超过限频；
6. Rust/Core 最终边界仍接受该动作。

定时器、加载事件、合成 click、iframe 内 `postMessage` 自报“用户点击”都不能代替官方手势证明。

## 五、永不开放给分享内容的能力

- Shell、PowerShell、cmd、脚本解释器或任意命令字符串；
- 任意 exe/lnk/URI/URL 启动；
- 任意文件、目录、注册表或环境变量读取；
- 原始 Tauri `invoke`、gRPC 方法名或 WebView2 `chrome.webview`；
- 任意设备控制、系统设置、摄像头、麦克风、剪贴板；
- Widget 直连互联网或自带域名白名单；
- 把系统媒体、硬件数据或用户输入上传到作者服务器。

未来如需启动应用，只能让用户在本机把一个 Dext `actionId` 映射到已安装应用；分享包不能携带实际路径和参数。

## 六、前端接入验收

- 普通 Tauri 配置器能读取媒体和音量；非法动作、空 patch、NaN 和越界音量被拒绝。
- 没有媒体会话时快速返回 `hasSession=false`，不能挂住 Core。
- 播放/暂停探测后恢复原状态；音量探测后恢复原 level/mute。
- Scene/Widget 直接调用 Tauri/gRPC 失败，只有官方桥接层可以访问。
- 非用户手势不能触发系统动作。
- 分享/另存/导出不带授权记录、设备 id、当前歌曲、音量或运行态。
