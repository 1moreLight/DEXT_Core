# Room v2 前端与 WidgetHost 开发准备清单

> 状态：UI-V2-001 实现核对清单；离线 WidgetHost、可信热点和受控能力桥已接入，联网代理仍明确不做。
> 关联：`MODEL.md`、`WIDGETS_V2.md`、`ROOM_V2_SYSTEM_API.md`、`ROOM_V2_AI_PROMPT.md`。

## 一、产品结论

Room v2 同时支持两种创作形态，它们共享同一套受控能力桥，但不互相替代：

1. **Scene 内嵌展示**：作者或 AI 直接把背景 HTML 的某个视觉部位做成时钟、进度条、CPU/RAM 仪表、媒体标题、封面或音量条。它适合与画面构图强绑定、需要任意形状和像素级布局的内容。
2. **WidgetHost 小组件**：一个 Desk 可以放多个独立 Widget；每个 Widget 可拖动、缩放、调整层级、单独配置和复用。它适合日历、待办、播放器、天气、监控面板等模块化内容。

因此不是“不做小组件”，而是**不把所有动态前端都强迫拆成固定卡片**。一张墙面可以完全由 Scene 自由构造，也可以叠加多个 Widget，还可以两者混用。

现有渲染器不需要整体重写。保留 `playSlot()`、`mountBackground()`、Desk、Dock、图标和切换链，在官方宿主中新增 `WidgetHost`、`CapabilityBridge` 和可信热点层即可。

## 二、建议层级

```text
官方转场 / toast
官方 Dock
官方编辑框、拖拽柄、冲突提示、可信热点层
桌面图标
WidgetHost：多个受管 Widget 容器
Scene：background HTML/image/video
```

- 作者代码不能提高到官方编辑层、Dock 或 toast 之上。
- 每个 Widget iframe 只能占用宿主分配的矩形；作者的 `z-index` 只在自身 iframe 内有效。
- Scene 可在整张背景中任意布局，但系统动作必须由官方可信热点覆盖层接收用户手势，不能让 Scene 直接调用本机接口。
- 待机 `idle` 使用独立生命周期；是否开放只读数据应单独定义，默认不开放系统动作。

## 三、WidgetHost 必做项

### 3.1 多实例与布局

- 每个 Desk 支持 `0..32` 个 Widget，全 Room 最多 64 个。
- 使用 `placement {x,y,width,height,z}`，基于 1920×1080 逻辑画布保存；实际视口按居中等比 `contain` 映射。
- Widget 可以重叠，z 由官方宿主管理；选择、置顶、置底和删除只在编辑模式出现。
- 切 Desk、Room 替换、暂停和 Player 销毁时，必须完整卸载旧 iframe、订阅、计时器和消息 token。
- 配置器层级树与真实画布已提供布局 UI；保存 Room 必须原样保留 `desks[i].widgets` 与声明资源。

### 3.2 拖动、缩放与图标避让

- 拖动和缩放手势由 iframe 外的官方容器处理，作者页面不能伪造编辑手势。
- 拖动过程中显示 1920×1080 逻辑网格、边缘吸附、Dock 安全区和重叠提示。
- Widget 与 Widget 可允许重叠；是否自动整理由用户选择，不擅自改作者构图。
- Widget 遮住桌面图标时，官方宿主计算冲突并把图标移动到最近的合法空网格；一次移动必须作为同一条可撤销编辑记录。
- 自动移动不得把图标推入 Dock、视口外或另一个 Widget；没有合法位置时保持原状并明确提示冲突。
- 图标避让只在用户结束拖动或缩放时提交，移动过程中只显示预览，避免持续改写 Room。

建议把避让算法做成纯函数：输入 Desk 图标、Widget 矩形、网格和保留区，输出稳定、可测试的新坐标。不要把它塞进 DOM 事件回调。

### 3.3 沙箱

- Widget iframe 固定 `sandbox="allow-scripts"`，不加 `allow-same-origin`。
- 默认禁止远程脚本、远程 iframe、下载、弹窗、顶层导航和任意网络直连。
- 每个实例生成不可预测的 `instanceId`；消息同时校验 `event.source`、实例、协议版本、操作名、字段和大小。
- Scene/Widget 均不能获得 `window.chrome.webview`、Tauri `invoke`、gRPC、文件路径或通用命令字符串。
- 一个 Widget 崩溃、超额或发非法消息时只隔离该实例，不能拖垮整个 Desk。

## 四、Scene 内嵌系统展示

背景 HTML 可以把任意视觉元素声明为数据绑定点，例如：

```html
<span data-dext-text="time.local"></span>
<div data-dext-progress="system.cpu.percent"></div>
<img data-dext-image="media.artwork" alt="当前媒体封面">
```

上面是作者可采用的表现形态；当前正式桥由官方宿主把经过权限检查、限频和裁剪的数据以 `dext:capability` 结构化消息送进 Scene/Widget。作者可以自由决定元素长什么样、在什么位置和如何动画，不需要先创建一个矩形卡片。

适合 Scene 的例子：

- 建筑窗户变成 CPU 占用灯条；
- 唱片机转盘显示当前封面，唱针表现播放/暂停；
- 天空中的月亮显示电量或时间进度；
- 游戏 HUD 的某一角显示 RAM、GPU 或网络摘要；
- 墙上的真实钟面显示系统时间。

这些数据只能影响页面表现。需要控制系统时，必须转成下一节的可信热点。

## 五、可信热点与点击

Room 可以声明“某个位置可点击”，但作者页面本身不执行系统操作：

```text
作者声明热点矩形 + action id
  → 官方宿主绘制透明可信命中层
  → 真实 pointerup / keyboard activation
  → 校验 Room 授权、当前实例、动作和参数
  → 调用封闭 Dext 系统 API
```

首批只考虑：

- `system.media.play`
- `system.media.pause`
- `system.media.toggle-play-pause`
- `system.media.next`
- `system.media.previous`
- `system.volume.set`（0..1）
- `system.volume.mute`

热点不能携带 Shell、可执行路径、URL、PowerShell、任意文件路径或自定义命令。分享包只带受支持的 action id 和受 Schema 约束的参数；用户授权只存本机。

## 六、前端接入顺序

1. 已完成：只渲染本地资源、无外网的 WidgetHost，多 Widget、拖动、缩放、z、卸载和预览一致性。
2. 已完成：Scene/Widget 共用只读 Capability Bridge，覆盖时间、视口、Desk、暂停、音频频谱、CPU/GPU/RAM、媒体封面和主音量。
3. 已完成：复用 Player 的 `livelyCurrentTrack` 与频谱回调，避免作者侧读取本机媒体流。
4. 已完成：官方可信热点和封闭媒体/音量动作；未授权、非用户手势和 iframe 直接调用均拒绝。
5. 已完成：配置器权限审阅、冲突提示、图标自动避让、撤销/重做和数据清理。
6. 明确不做：Dext 代理联网；分享清单和 AI 创作 skill 已完成本地安全部分，后续只扩展契约。

## 七、最低自动测试

- 一个 Desk 同时挂载多个 Widget，切 Desk/替换 Room 后旧实例完全失效。
- 拖动、缩放、z 排序和 1920×1080 映射在不同宽高比下稳定。
- Widget 与图标重叠后图标移动到最近合法空位；无空位时不丢图标。
- Scene 可在任意位置显示只读数据，不要求固定 Widget 尺寸。
- iframe 伪造 instanceId、旧实例、未知 action、超大消息、非用户手势全部拒绝。
- 直接 `fetch`、远程资源、顶层导航、下载和 `chrome.webview` 不可用。
- 预览和真实 Player 使用同一宿主协议与权限默认值。
- Room 保存、另存、应用和 zip 完整保留 Widget manifest 与声明资源。

## 八、人工验收重点

1. 在一个 Desk 放置至少三个不同尺寸的 Widget，拖动、缩放、重叠和调层级。
2. 把 Widget 拖到图标区域，确认被遮挡图标只在落手后自动移到合法空位，并可撤销。
3. 使用一个艺术化 Scene，把钟、媒体标题和性能进度条嵌入画面具体位置，确认不出现强制卡片边界。
4. 点击 Scene/Widget 的播放、暂停和音量热点，确认只有真实用户手势能触发，作者脚本自动调用无效。
5. 导出并在另一台机器导入，确认布局和内容保留，但系统授权不会跟随分享包。
