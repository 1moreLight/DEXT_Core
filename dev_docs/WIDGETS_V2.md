# Room v2 小组件：研究与开发准备

> 状态：研究结论，待用户验收；不代表 Schema 或运行时已经升级。
>
> 工作包：WIDGETS-PLAN-001（纯文档）
>
> 更新：2026-08-31
> 关联：`PROJECT.md`、`MODEL.md`、`ROOM_AUTHORING.md`、`LIVELY_API.md`、`ROADMAP.md`

## 0. 结论与目标

**Dext 可以做成可分享、可高度定制、可由 AI 像写前端一样创作的小组件平台。**

现有 Room v1 已具备正确的底座：官方宿主保留 Desktop、Dock、图标、保存和 IPC；用户 HTML 仅在受控 iframe 内运行。v2 不应推翻这个分层，而应把“小组件”提升为 Room 的正式受管内容，新增 WidgetHost、受限能力桥和分享安全策略。

本文件的目标是为 v2 开包冻结需要先解决的问题：运行方式、系统安全、权限、包格式、AI 作者接口、测试和工作包拆分。除明确写为“建议”的内容外，本文件不直接改变 v1 正式契约。

## 1. 已核对的 v1 基线

| 范围 | 已有事实 | 对 v2 的意义 |
|---|---|---|
| 官方渲染器 | `wallpapers/dext-room/main.js` 加载 `room.json`，绘制背景、图标、Dock 与切换；`background/start/switch/end` 都支持 image/video/html。 | 可以在官方 DOM 中新增小组件层，不需另写播放器。 |
| 用户 HTML | `playSlot()` 和 `mountBackground()` 以 `sandbox="allow-scripts"` iframe 挂载；HTML 不能同源访问官方页面。 | 可继续用 iframe 隔离不可信的作者代码。 |
| 子帧 IPC | Player 以 `CoreWebView2WebMessageReceivedEventArgs.Source` 与当前顶层 URL（含路径和 query）比较；不匹配的 iframe 消息直接丢弃。 | 子组件不能绕过宿主直接触发启动、保存等本机 IPC。 |
| Lively 数据 | 顶层官方页可收到音频频谱、正在播放、硬件信息、暂停状态和 LivelyProperty 更新。 | v2 可选择性地把整理后的只读数据转发给获授权 Widget。 |
| Room 分享 | Room 文件夹、自包含素材和路径约束已定；zip 导出/导入/错误提示仍是 `ROOM-001/002/003`。 | 格式适合分享，但尚未形成实际可信导入闭环。 |
| v1 Schema | v1 对象封闭，未知字段拒绝正式保存/应用。 | 不能把 `widgets` 偷塞进 v1；应显式引入 v2。 |

已知实现坐标：渲染器 `main.js` 的 `playSlot`、`mountBackground`、`renderDesk`；Player `Form1.cs` 的 `WebMessageReceived` 和 `IsTopLevelWebMessage`；Lively 原生能力说明见 `LIVELY_API.md`。安全经验见 `errors/renderer.md` #31、`errors/backend.md` #30/#34。

## 2. v2 要提供什么，不提供什么

### 要提供

- 每个 Desk 可摆放多个长期驻留的 HTML 小组件，拥有独立位置、尺寸、层级和配置。
- 作者/AI 可提交 Room manifest + 包内 HTML/CSS/JS/图片/字体，制作时钟、日历、音乐可视化、硬件仪表盘、待办、信息 HUD 和高度视觉化交互。
- 小组件按权限获得有限、可审计的 Dext 数据和动作，而不是直接获得 WebView2、文件系统、Shell 或任意 Lively IPC。
- 配置器预览、真桌面、导入和导出使用同一份 manifest 校验及安全策略。
- 只要没有请求高风险权限，下载 Room 可以离线预览，不产生系统侧作用。

### 明确不提供

- 作者代码替换官方 `index.html`、修改官方 Dock/图标 DOM，或在顶层运行 `room.js`/`room.css`。
- 直接访问磁盘路径、注册表、Shell、PowerShell、任意进程、剪贴板、摄像头、麦克风或 Windows API。
- 下载 Room 自动启动任意 `exe`、`.lnk`、URI 或带参数的命令。
- 未授权的外网访问，或把歌曲、硬件、用户输入等数据隐式上传。
- 让 Schema、权限检查和导入检查依赖 AI “自觉遵守”。AI 输出和人工作者包同等不可信。

## 3. 推荐运行模型

```text
Room v2 manifest（受 Schema 验证）
  └─ desks[i].widgets[]
       └─ 官方 WidgetHost（位置、尺寸、层级、拖拽、销毁）
            └─ sandbox iframe（作者 HTML/CSS/JS）
                 ⇄ 结构化 postMessage + 一次性 instanceId
                      └─ 官方 Capability Bridge（逐项授权、限流、审计）
                           └─ 顶层 Dext / Lively 数据与受控动作
```

### 3.1 层级与交互

- WidgetHost 位于背景之上、官方图标与 Dock 之下；每个 Widget 被自己的容器裁剪，默认不遮挡 Dock。
- 编辑模式由官方宿主显示选择框、拖拽柄、尺寸柄和删除按钮；作者 iframe 不接收这些编辑手势。
- 使用模式下，指针只在 Widget 实际矩形内交给 iframe；与图标重叠时由官方布局规则拒绝或显示冲突，不能由作者用无限 z-index 覆盖系统 UI。
- 切 Desk、重载、暂停、Room 替换和窗口销毁时，WidgetHost 必须停止订阅、撤销计时器、移除 iframe，再建立新实例，避免旧消息和资源泄漏。

### 3.2 小组件消息协议

每次挂载生成不可预测的 `instanceId`。父子消息同时校验：当前 `iframe.contentWindow`、instanceId、消息版本、操作名和载荷 schema；未知字段和超额载荷拒绝。不得因 `postMessage` 使用了 `"*"` 就把来源验证省略。

建议只暴露一套作者 API：

```js
// Widget 内部：由模板/SDK 包装为 postMessage，不暴露 chrome.webview。
await dext.request("time.read");
dext.subscribe("audio.spectrum", (bins) => render(bins));
await dext.request("navigation.go", { desk: 1 });
```

Widget 不获得 `window.dext`（它仍是官方顶层内部接口），也不获得 `window.chrome.webview`。WidgetHost 把获准的事件推送给目标 iframe；不把 Lively 的原始注入函数直接复制进用户页面。

## 4. 权限与系统安全

权限声明在 Room v2 manifest 中只表示“请求什么”。真实授予结果必须保存到 Dext 管理的数据中，按 Room 的稳定身份、Widget id、内容哈希和版本绑定；代码或权限声明变更后重新询问。导出包绝不携带用户的批准记录。

| 级别 | 示例能力 | 默认 | 安全规则 |
|---|---|---|---|
| P0 无能力 | 静态/动画/本地交互、Room 配置只读 | 自动允许 | iframe 仍受 sandbox 与资源政策约束。 |
| P1 非敏感只读 | 当前时间、语言、窗口大小、当前 Desk、暂停状态 | 自动允许或全局开关 | 限定字段与刷新频率。 |
| P2 系统信号 | 音频频谱、当前歌曲元数据、CPU/GPU/RAM/网络摘要 | 每 Room 明确同意 | 按能力单独授权；歌曲封面/标题视为个人数据。 |
| P3 持久化 | Widget 自己的键值设置、待办数据 | 每 Room 同意 | 仅宿主提供的配额 KV；无任意文件路径；导出由用户显式选择。 |
| P4 受控动作 | 切 Desk、显示 Dext 通知、调用用户映射的应用动作 | 每动作/每 Room 同意 | 参数做 schema/白名单校验，显示来源与后果。 |
| 禁止 | Shell、任意启动、原始文件系统、系统设置、设备权限 | 永不授予 | 不因“作者可信”或 AI 生成而绕过。 |

### 4.1 应用启动的特殊规则

现有 `msg_launch` 是顶层官方桌面图标使用的通道，不是 Widget API。v2 Widget 如需“打开应用”，只能请求 `actionId`；这个 id 必须由用户在配置器中从本机应用库映射并明确批准。分享包不能自带可执行路径、参数或工作目录，也不能把 `actionId` 自动映射为同名应用。

### 4.2 网络、资源与隐私

`sandbox` 隔离 DOM 和顶层 IPC，但不是网络防火墙。v2 必须在 Player/宿主层强制资源政策，而不是依赖作者在 HTML 中自行写 CSP：

- 默认离线：仅允许当前 Room 的虚拟主机资源；`connect-src`、远程 script、远程 iframe、下载和顶层导航默认拒绝。
- 需要网络时，manifest 请求精确的来源/用途，配置器显示域名和数据类别；用户批准后只放行该白名单，不能用通配符。
- 由 WebView2 的导航与资源请求拦截在最终执行边界实施；预览必须使用同等限制，不能在配置器预览中放行、真桌面中再拒绝。
- 每个 Widget 设 CPU/内存/帧率、请求频率、消息长度、订阅数和存储配额；连续崩溃或超额时自动隔离并提示用户。
- 禁止直连时，天气等联网内容应由 Dext 可审计的代理/缓存服务提供，而不是把用户系统数据随请求一并转给任意站点。

### 4.3 持久化和数据所有权

Widget 数据采用宿主管理的命名空间，例如 `roomStableId/widgetId/contentHash`，API 限制为配额内 KV/JSON。作者不能枚举其他 Room、读写 `room.json`、读取 Dext 配置或访问本机目录。用户应能在配置器查看大小、清除数据、导出自己的数据，并在卸载 Room 时选择保留或删除。

## 5. Room v2 格式方向（草案）

v2 的目的不是给 v1 加一个任意 JSON 袋子，而是使可分享小组件的可验证信息进入 Schema。建议新建固定目录 `widgets/`，并使用 `version: 2`。

```jsonc
{
  "version": 2,
  "startDesk": 0,
  "switches": {},
  "desks": [
    {
      "name": "工作台",
      "background": null,
      "iconSize": "medium",
      "icons": [],
      "widgets": [
        {
          "id": "music-meter",
          "name": "音乐频谱",
          "src": "widgets/music-meter/index.html",
          "placement": { "x": 72, "y": 96, "width": 420, "height": 220 },
          "config": { "accent": "#7cecff" },
          "permissions": ["audio.spectrum", "now-playing.read"]
        }
      ]
    }
  ]
}
```

正式 Schema 仍需决定坐标单位、缩放/多分辨率策略、最小/最大尺寸、Widget 数量上限、深度限制和可序列化 `config` 的最大字节数。最低规则应包括：

- `id` 在一个 Room 内唯一；`src` 必须位于 `widgets/`，使用正斜杠相对路径，不含 URL、盘符、反斜杠、`.` 或 `..`。
- `placement` 为有限非负数，且尺寸有合理上下限；不接收 CSS 字符串、HTML 片段或 JavaScript 表达式。
- `permissions` 是封闭枚举、去重、可由宿主识别；未知权限使导入/应用提示，而不是静默授予。
- `config` 只允许受大小和深度限制的 JSON 值；秘密、令牌、批准记录和运行态不得进入 Room 文件。
- 仅 manifest 列出的资源可被包校验器和 WidgetHost 使用；Room 不能覆盖官方渲染器文件。

### 5.1 版本和迁移原则

v1 的严格封闭模型已经发布，因此保持 v1 原样可读、可应用、可导出。支持 Widgets 的客户端再解析 v2；旧客户端应显示“不支持 v2”，绝不删除 `widgets` 后保存。是否提供 v1→v2 迁移由独立工作包决定；迁移只复制已有字段，不自动给 Widget 授权，也不引入新的执行内容。

## 6. AI 创作协议

AI 是作者工具，不是安全边界。AI 可生成以下内容：

- `room.json` v2 manifest；
- `widgets/<id>/` 内的 HTML、CSS、JS、图片、字体和本地数据；
- 不需要系统权限的视觉、交互和演示逻辑；
- 对能力请求、资源大小、网络来源和人工测试步骤的说明。

AI 不应生成或声称能执行：直接 `chrome.webview` 调用、OS 命令、绝对路径、本机程序启动、未申明网络请求、秘密凭据，或绕过 iframe sandbox 的代码。

后续 AI skill 应采用“生成 → 静态检查 → 隔离预览 → 用户审阅权限 → 导入/应用”的链路。静态检查可发现已知危险模式和非法路径，但不替代运行时 iframe、资源拦截和权限校验。为让 AI 可靠，Dext 需提供版本化 Widget SDK、能力类型定义、最小示例、Schema fixture 和错误信息，而不是只给一段自然语言提示词。

## 7. 分享与导入安全

Room v2 分享包仍是自包含 zip。`ROOM-001/002/003` 的安全基线应覆盖 v2，或在它们开工前先冻结“版本分派导入器”方向，避免先做只能识别 v1 的公开导入器再返工。

导入前必须至少执行：

1. 限制 zip 总大小、展开大小、条目数、压缩比和单文件大小，防 zip bomb。
2. 拒绝绝对路径、`..`、符号链接/重解析点、重复或大小写冲突路径和不允许的文件类型。
3. 解析版本对应 Schema，检查所有声明资源存在且在允许目录；不得保留 `__source`、用户批准记录或运行态字段。
4. 生成清单（文件哈希、Widget id、请求权限、联网域名、资源占用），在用户应用前显示。
5. 导入至新建受控 Room 目录并原子提交；任一步失败不得污染现有 Room 或运行包。
6. 首次应用时先以 P0/P1 预览；P2+ 权限和网络必须明确确认。内容或 manifest 哈希改变后重新询问。

签名、作者身份、商店评级、恶意内容检测和订阅更新属于创意工坊阶段；它们不替代本地包的路径、权限和运行时隔离。

## 8. 渲染器改动范围与质量门

不建议重写渲染器或迁移到另一套框架。现有 `playSlot` 与 `mountBackground` 继续负责场景；v2 新增独立模块/边界：

- `WidgetHost`：mount/unmount、布局、编辑命中、iframe 生命周期、暂停和资源回收。
- `CapabilityBridge`：所有 widget 消息、instance token、权限、订阅、限流与审计的唯一入口。
- `Room v2 reader/validator`：严格写出、宽容预览和版本分派；不得让错误 Widget 拖垮整个 Desk。
- `Player protection`：保留顶层来源检查，并增加最终网络/导航/下载限制；WidgetHost 不是 Player 校验的替代品。
- `Configurator`：预览使用真实 WidgetHost；编辑布局、配置、权限审阅和数据清理必须区分“草稿”与“已授予”。

开始实现前先补最小自动化覆盖：恶意 iframe IPC、旧实例消息、非法路径、权限变更重新询问、网络默认拒绝、资源超额、Room 替换清理、v1/v2 互不误写，以及桌面/预览行为一致性。现有关键渲染和 IPC 路径测试较少，安全改动不能只靠手工演示。

## 9. 推荐工作包与依赖

| 顺序 | 工作包 | 独立交付与验收重点 | 依赖 |
|---|---|---|---|
| 0 | **WIDGETS-PLAN-001** | 本研究和开发准备文档；不动运行时。 | 无 |
| 1 | **DXT-003 Room v2 Widget 契约** | v2 Schema、fixtures、版本分派、迁移/兼容规则和独立验收样包。 | WIDGETS-PLAN-001；先明确 DXT-002 的契约去留。 |
| 2 | **WIDGET-001 WidgetHost 离线运行** | 官方层渲染多个沙箱 Widget，完成布局/编辑/生命周期；不开放系统数据、存储、联网或启动。 | DXT-003 |
| 3 | **WIDGET-002 受控只读能力桥** | instance/source 校验、P0/P1/P2 数据订阅、限流、权限 UI 与桌面/预览一致性。 | WIDGET-001；Lively API 真机验证。 |
| 4 | **WIDGET-003 存储与受控动作** | 配额 KV、数据管理、Dext 内导航、用户映射的应用 action；无任意 launch。 | WIDGET-002 |
| 5 | **WIDGET-004 网络与资源隔离** | Player 最终网络/导航/下载策略、联网授权、配额/熔断与回归测试。 | WIDGET-001；可与后续项协调但不混包。 |
| 6 | **ROOM-004 v2 分享安全闭环** | 在 ROOM-001/002/003 基础上，v2 zip 导入导出、检查清单、权限重询问和原子失败回归。 | DXT-003、WIDGET-002、现有 ROOM-001/002/003 |
| 7 | **AI-001 Room/Widget 创作 skill** | 版本化 SDK、模板、fixtures、AI 生成/检查/预览工作流。 | WIDGET-001、ROOM-004；P2+ 能力可后续扩展。 |

当前路线中的 `UI-001`、`UI-002`、`MEDIA-001`、`ROOM-001/002/003` 仍不被本研究自动替换。若用户决定“v2 优先于公开分享”，应在 DXT-003 开工时正式调整 ROADMAP：使导入导出从一开始支持版本分派，而非先发布仅 v1 的格式闭环。

## 10. 开工前必须确认的决策

以下问题在 DXT-003 前需要用户确认或通过原型验证：

1. Widget 布局以 CSS px、逻辑画布单位还是百分比保存；缩放/DPI/未来多屏如何处理。
2. P1 默认公开范围，以及当前歌曲封面和硬件网络摘要是否一律归为 P2。
3. 是否允许联网 Widget；若允许，采用“禁止直连、Dext 代理”还是“用户批准的精确域名白名单”。
4. 持久化数据是否跟随 Room 复制、另存和导出，还是只保留在本机。
5. Widget 是否允许在所有 Desk 共享一实例，还是每 Desk 独立实例；第一版建议每 Desk 独立，语义最简单。
6. v1→v2 是显式复制升级还是编辑时可选升级；第一版建议只提供显式升级，且不自动修改源 Room。

## 11. DXT-003 的最低人工验收预案

1. 用 v1 Room 打开、保存、应用，确认没有出现 `widgets` 或版本误升。
2. 用合法 v2 Room 打开，确认每个 Widget 只加载 `widgets/` 中声明的文件，图标/Dock 仍属于官方层。
3. 修改为非法路径、未知权限、重复 id、超尺寸 placement 或错误版本，确认预览给出人话提示，保存/应用拒绝且不破坏当前运行包。
4. 在 Widget 中伪造顶层 IPC、旧实例消息和未获授权的能力请求，确认均无系统副作用且留可诊断日志。
5. 首次应用请求 P2/P3/P4 或联网时，确认用户看见来源、数据/动作和拒绝选项；拒绝后 Widget 仍可降级运行。
6. 导入恶意 zip（路径逃逸、压缩炸弹、额外可执行文件）时，确认不写入 Room 库、不启动内容且有可理解的错误。

## 12. 本轮研究状态

本文件基于当前 Dext v1 代码与 `LIVELY_API.md` 核对形成。它确认 v2 小组件方向技术可行，并将“前端自由创作”与“系统能力最小授权”分开。下一步不是直接开放 Lively API，而是在用户确认本研究后，单独开 `DXT-003` 或先按用户调整路线图的优先级。
