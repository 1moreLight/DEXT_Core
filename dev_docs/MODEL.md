# room.json v2 正式契约

> 本文件描述历史Room v2契约，仍用于保留的v2链；当前原生v3见ROOM_V3.md，实施状态见ROADMAP.md。v2机器格式真相源为仓库根目录room-v2.schema.json；源Room与导出包禁止携带运行态字段__source。
> v1 已废弃且不兼容、不迁移、不重建；当前 demo 可直接删除或改写为 v2。

## 一、Room 与官方宿主

- Room 是可分享的自包含文件夹，`room.json` 是配置器、渲染器、应用链和 zip 共用的唯一契约。
- Desk 是有顺序的一页；`desks` 数组顺序就是页面顺序，`startDesk` 是默认页下标。
- Dext 官方宿主负责 Desk、Dock、图标、导航、IPC、保存、预览、Widget 布局和生命周期。
- 作者可定制 `background/start/switch/idle` 的 image、video、HTML，以及每个 Desk 的多个 Widget。
- Scene/Widget 用户 HTML 只能在受控 sandbox iframe 中运行，不能替换官方宿主、修改 Dock/图标 DOM 或直接调用本机接口。

## 二、根结构

```jsonc
{
  "version": 2,
  "startDesk": 0,
  "start": { "name": "开机", "type": "image", "src": "start/boot.png" },
  "idle": { "name": "待机", "type": "html", "src": "idle/index.html" },
  "switch": "slide",
  "switches": { "0>1": "fade", "1>0": "zoom" },
  "dock": {},
  "desks": [{
    "name": "主页",
    "background": null,
    "iconSize": "medium",
    "icons": [],
    "widgets": []
  }]
}
```

根对象必需 `version/startDesk/switches/desks`；`version` 固定为整数 2。`desks` 至少一项。`start/idle/switch/dock` 可选。对象字段封闭，未知字段不得正式保存、应用或导入。

每个 Desk 必需 `name/background/iconSize/icons/widgets`。即使尚未使用 Widget，也必须写 `widgets: []`；编辑器尚未提供 Widget 布局 UI 时必须无损保留现有数组。

## 三、Scene Content

`background/start/switches/idle` 的用户内容统一为：

```json
{ "name": "显示名称", "type": "image|video|html", "src": "对应目录/文件" }
```

- `background` 只能引用 `background/`。
- `start` 只能引用 `start/`。
- 方向 switch 只能引用 `switch/`，也可用官方预设 `slide/fade/zoom/none`。
- `idle` 只能引用 `idle/`。
- 路径使用正斜杠、相对于 Room 根目录，禁止 URL、绝对路径、盘符、反斜杠、`.`、`..` 和重解析点逃逸。
- 图片支持 png/jpeg/webp/bmp/gif/svg，视频支持 mp4/webm，HTML 使用 html/htm。
- HTML Content 可选 `permissions` 和 `hotspots`；非 HTML Content 不得携带能力或热点。
- `hotspots` 使用 1920×1080 逻辑坐标和封闭的系统媒体/系统主音量 action id；存在热点时必须声明 `action.invoke`。

运行语义：背景图片静态、背景视频循环、背景 HTML 在 Desk 可见期间长驻；start/switch 图片显示 0.5 秒，视频播放完成，HTML 发可信 `done` 或在 60 秒超时后完成；idle 在 Lively 屏保实例内持续到唤醒。

HTML iframe 固定 `sandbox="allow-scripts"`，不加 `allow-same-origin`。Scene 完成消息必须同时通过 `event.source`、不可预测 `instanceId`、消息版本与字段校验。Dext Room Player 另在 WebView2 最终边界拒绝远程请求、跨主机导航、下载、弹窗和 Web 权限。

## 四、Desk、图标与 Dock

- `iconSize` 只允许 `large/medium/small`。
- 桌面图标需要 `label/x/y`；Dock 图标需要 `label` 且不含 x/y。
- `launch` 存在时必须完整包含 `target/args/workdir`。它只供官方桌面图标和 Dock 使用，不是 Scene/Widget API。
- `room.dock` 是全局基线，`desks[i].dock` 按字段覆盖；`style` 按字段合并，Desk 写出 `icons` 时整组替换。
- 当前 Desk、运行态圆点、播放进度、拖拽反馈、Widget 授权和本机数据都不写入 Room。

Desk 拓扑由数组顺序推导：相邻 Desk 双向连接，三页以上增加首尾双向连接。调整顺序时配置器必须同步重映射 `startDesk` 与 `switches`，不能猜测或自动生成新方向内容。

## 五、Widget manifest

一个 Desk 可有多个 Widget。每项必含：

```jsonc
{
  "id": "now-playing",
  "name": "正在播放",
  "src": "widgets/now-playing/index.html",
  "resources": ["widgets/now-playing/index.html"],
  "placement": { "x": 600, "y": 120, "width": 640, "height": 320, "z": 1 },
  "config": {},
  "permissions": ["now-playing.read"]
}
```

- `id` 为小写 ASCII slug，在 Room 内全局唯一；各 Desk 条目是独立实例。
- `src/resources` 全部位于 `widgets/<id>/`，入口为 HTML，入口必须列入去重资源清单；声明文件必须存在，Widget 目录不得藏未声明文件。
- `placement` 使用 1920×1080 逻辑画布整数矩形；最小 64×64，必须完全在画布内，z 为 0..255。未来 WidgetHost 按居中等比 `contain` 映射。
- 每 Desk 最多 32 个、全 Room 最多 64 个 Widget；每个最多 256 个资源。
- `config` 是随 Room 分享的普通 JSON object，紧凑 UTF-8 最大 65,536 字节、最大深度 12；不得放凭据、授权或运行态。
- `permissions` 是封闭、去重枚举，只表达请求，不代表授权。批准记录按 Room/Widget/内容哈希保存在本机，绝不进入分享包。

正式权限列表以 Schema 为准。网络默认离线，未来只允许经 Dext 审计代理；manifest 不接受域名白名单、可执行路径或通用命令。

## 六、Scene 与 Widget 的分工

- 与画面构图强绑定的时钟、进度条、媒体封面、性能仪表优先直接做进 background HTML Scene，可任意形状和位置。
- 需要独立拖动、缩放、复用和组合的内容做 Widget。一个 Desk 可同时放多个不同尺寸 Widget并允许受控层叠。
- Scene 和 Widget 可混用，共享同一受控数据桥；不要求把整个 Room 切成固定卡片。
- Widget 遮住桌面图标时，未来由官方宿主把图标移动到最近合法空网格；作者代码不得移动或隐藏图标。

## 七、保存、另存、应用与 zip

```text
预览：内存中的完整 v2 草稿，不写文件
保存：剥离 __source，严格验证 v2，原子替换 room.json
另存：写新的干净 v2，镜像 background/start/switch/idle/widgets
应用：严格验证 v2 和声明资源，镜像到运行包，仅运行包注入可信 __source
导出：只从源 Room 生成自包含 v2 zip，禁止 __source、本机授权和运行数据
导入：安全解包、严格验证 v2 与全部声明资源后原子提交
```

任何版本、Schema、路径、资源或语义检查失败都必须发生在目标修改之前，不得污染源 Room、运行包或当前桌面。v1 与未知版本只可显示“不支持”或进入安全删除边界，不能读取为草稿、保存、应用、预览、导入或导出。

`__source` 只允许存在于运行包，且页面提交的值永远不可信。Core 只从当前运行包读取应用时生成的可信戳，写源 Room 前再次剥离。

## 八、系统数据与动作边界

Scene/Widget 不得直接调用 Tauri、gRPC、WebView IPC 或 Windows API。未来只能经官方 `CapabilityBridge` 获取经过授权和限频的数据，经官方可信热点在真实用户手势后执行封闭动作。

当前后端已提供系统媒体读、play/pause/toggle/next/previous，以及 Windows 默认输出主音量读写。它们是宿主接口，不是作者页面接口。Shell、任意程序/URL/路径、通用命令字符串和直连网络永不开放给分享内容。

前端与安全接入见 `ROOM_V2_FRONTEND_CHECKLIST.md` 和 `ROOM_V2_SYSTEM_API.md`。
