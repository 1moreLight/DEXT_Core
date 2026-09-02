# Room v2 Widget 正式契约与路线

> Room v2 是唯一受支持格式。DXT-003 交付 manifest、存储/复制/应用/zip 后端和受控系统接口；WidgetHost、权限 UI、可信热点与联网隔离在后续工作包实现。

## 1. 结论

Dext 可以做成像 Room 一样可分享、可高度自定义，并允许 AI 以写前端的方式自由构造。安全边界不依赖作者或 AI 自觉，而由官方宿主、Schema、sandbox、资源拦截、权限和最终 RPC 校验共同保证。

小组件不是唯一形态：

- Scene 适合把时钟、进度条、性能数据、歌曲与封面直接融入壁纸构图的任意位置。
- Widget 适合独立、可复用、可拖动、可缩放的模块。一个 Desk 可有多个不同尺寸 Widget，并允许受控层叠。
- 两者可混用，共享受控能力桥；不会把所有动态内容强制变成卡片。

现有渲染器无需重写。保留 Scene、Desk、Dock、图标和切换链，新增独立 `WidgetHost`、`CapabilityBridge`、可信热点层和 Player 网络保护即可。

## 2. 运行模型

```text
room.json v2 + 包内资源
  ├─ SceneHost：background/start/switch/idle
  └─ WidgetHost：每个 Desk 的多个 Widget
       └─ sandbox="allow-scripts" iframe
            ⇄ instanceId + 结构化 postMessage
                 └─ CapabilityBridge
                      ├─ 受控只读数据
                      └─ 可信用户手势后的封闭动作
```

作者 iframe 没有 `allow-same-origin`，不能接触官方 DOM、`chrome.webview`、Tauri、gRPC、文件系统、Shell 或 Windows API。每个实例由官方容器限制位置、尺寸、z 和生命周期；切 Desk、暂停、Room 替换与销毁时撤销全部订阅和 token。

## 3. manifest

每个 Desk 必须有 `widgets` 数组；每个 Widget 必含 `id/name/src/resources/placement/config/permissions`。

- id：小写 ASCII slug，Room 内全局唯一；各 Desk 独立实例。
- src/resources：全部位于 `widgets/<id>/`；HTML 入口必须列入资源清单，声明文件必须存在，目录不得藏未声明文件。
- placement：1920×1080 逻辑画布的整数 x/y/width/height/z；最小 64×64，完整在画布内，z 为 0..255。
- config：随 Room 分享的 JSON object，最大 65,536 字节、深度 12；禁止秘密、授权和运行态。
- permissions：封闭去重枚举，只表示请求，不表示已经授予。
- 上限：每 Desk 32、全 Room 64、单 Widget 256 个资源。

完整机器限制以 `room-v2.schema.json` 为准。

## 4. 权限

| 级别 | 能力 | 默认与边界 |
|---|---|---|
| P0 | 纯本地 HTML/CSS/JS、动画和 config | 自动允许，仍受 sandbox/资源策略约束 |
| P1 | 时间、语言、视口、Desk、暂停、音频频谱、CPU/GPU/RAM 摘要 | 自动允许，字段裁剪与限频 |
| P2 | 当前媒体元数据/封面、网络摘要、Dext 代理联网 | 每 Room 明确同意 |
| P3 | Widget 配额 KV | 未来实现；本机保存，不分享 |
| P4 | Dext 导航/通知、受控系统动作、用户映射 action | 必须授权和可信用户手势 |
| 禁止 | Shell、任意路径、任意程序/URL、系统设置、设备权限 | 永不授予 |

批准记录按 Room 稳定身份、Widget id、内容哈希和版本绑定；内容或权限变化后重新询问。导出包不携带批准记录。

## 5. 系统媒体和音量

DXT-003 的可信后端已经支持：

- 当前媒体标题、作者、专辑、状态、进度、时长和能力；
- play、pause、toggle-play-pause、next、previous；
- Windows 默认输出主音量与 mute 的读取/设置。

这些接口只开放给官方宿主。Scene/Widget 未来经 `CapabilityBridge` 获取数据，经官方透明可信热点捕获真实 click/touch/keyboard 后请求动作。iframe 自报点击、定时器或加载事件不能触发系统操作。

封面是 P2 可选数据。部分播放器的 NPSMLib 封面流在 Core 中会阻塞，因此真壁纸应复用 Lively Player 已有 `livelyCurrentTrack` 封面缓存，再受控转发；Core RPC 不在轮询路径同步读封面流。

## 6. 网络与分享安全

- 默认离线，只允许当前 Room 虚拟主机资源；拦截远程 script/iframe/font、fetch/WebSocket、下载、弹窗和顶层导航。
- manifest 只可请求 `network.proxy`，不接受作者域名白名单。未来联网通过 Dext 审计代理、缓存、限额和用户授权。
- zip 限制总大小、展开大小、条目数、压缩比和单文件大小；拒绝绝对路径、`..`、链接/重解析点、重复或大小写冲突路径。
- 导入时严格校验 v2、声明资源、未知字段和危险内容；在新目录中完成后原子提交，失败无残留。
- 首次应用显示权限/文件清单；内容哈希变化后重新授权。

## 7. 布局与图标避让

- Widget 可拖动、缩放、调整层级和重叠；编辑手势由 iframe 外的官方容器处理。
- Widget 与桌面图标重叠时，落手后把被遮挡图标移动到最近合法空网格，并记录为一条可撤销操作。
- 不得把图标推入 Dock、视口外或另一个 Widget；没有合法位置时保留原位并提示冲突。
- 避让算法应为纯函数并有多分辨率、无空位和稳定排序测试。

## 8. AI 创作

AI 可生成 room.json v2、Scene、Widget HTML/CSS/JS、图片、字体和离线数据。AI 不可生成或声称能执行本机绕过能力。工作流固定为：

```text
生成 → Schema/资源/危险模式检查 → 隔离预览 → 权限审阅 → 导入/应用
```

正式提示词见 `ROOM_V2_AI_PROMPT.md`。未来应提供版本化 SDK、类型定义、最小模板和 fixtures，不能只依赖自然语言。

## 9. 后续工作包

1. `WIDGET-001`：离线 WidgetHost，多实例、拖拽、缩放、z、生命周期与图标避让。
2. `WIDGET-002`：Scene/Widget 共用只读 Capability Bridge、订阅、限频和权限 UI。
3. `WIDGET-003`：KV、Dext 内动作、可信热点与受控媒体/音量动作。
4. `WIDGET-004`：Player 网络/导航/下载拦截、代理联网、配额和熔断。
5. `ROOM-004`：v2 分享清单、授权重询问、恶意包回归和创意工坊准备。
6. `AI-001`：Room/Widget 创作 skill、SDK、模板与自动验证。

前端实现清单见 `ROOM_V2_FRONTEND_CHECKLIST.md`，系统接口见 `ROOM_V2_SYSTEM_API.md`。
