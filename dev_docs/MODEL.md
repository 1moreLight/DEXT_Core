# room.json v1/v2 正式契约（DXT-003 修订）

> v1 于 2026-08-30 定稿，DXT-002 将退出内容修订为 Lively 待机内容；DXT-003 于 2026-08-31 增加独立 v2 Widget 契约。机器可校验格式见仓库根目录 `room.schema.json`（v1）与 `room-v2.schema.json`（v2）；本文件解释版本分派、字段、继承和持久化语义。
> Schema 描述源 Room / 未来导出形态，故意不允许运行包内部字段 `__source`。
> 面向 Room 创作者的实际操作、HTML 完成消息和发布检查见 `ROOM_AUTHORING.md`。

## 一、Room 和官方宿主的边界

- **Room** 是一个可分享的文件夹，`room.json` 是配置器、渲染器和未来 zip 共用的数据契约。
- **Desk** 是 Room 中有顺序的一页；`desks` 数组顺序就是配置器里排好的页面顺序。
- Dext 官方 HTML 宿主负责 Desk、Dock、图标、导航、IPC、保存、预览和生命周期。
- 用户只定制 `background`、`start`、`switch`、`idle` 的内容，可以是图片、视频或 HTML。
- 用户 HTML 只能在受控内容容器中运行，不能替换官方宿主、直接操作 Dock 或伪造保存/运行态消息。
- v1 是重构后的新格式，不承担旧 Room、旧 `transition`、顶层 `room.js` / `room.css` 或旧素材目录的兼容与迁移。

## 二、v1 结构与字段

以下名称优先复用当前 UI 和既有 Room 字段，不增加 Desk ID，也不另建一套同义结构。

```jsonc
{
  "version": 1,
  "startDesk": 0,

  "start": {
    "name": "开机画面",
    "type": "image",
    "src": "start/boot.png"
  },
  "idle": {
    "name": "待机画面",
    "type": "html",
    "src": "idle/index.html"
  },

  "switch": "slide",
  "switches": {
    "0>1": {
      "name": "主页到游戏",
      "type": "video",
      "src": "switch/home-to-game.mp4"
    },
    "1>0": {
      "name": "游戏到主页",
      "type": "html",
      "src": "switch/game-to-home/index.html"
    }
  },

  "dock": {},
  "desks": [
    {
      "name": "主页",
      "background": {
        "name": "主页背景",
        "type": "image",
        "src": "background/home.png"
      },
      "iconSize": "medium",
      "icons": [],
      "dock": {}
    },
    {
      "name": "游戏",
      "background": {
        "name": "游戏背景",
        "type": "html",
        "src": "background/game/index.html"
      },
      "iconSize": "medium",
      "icons": []
    }
  ]
}
```

### 内容对象

`background`、`start`、`switches`、`idle` 中的用户内容统一复用三个字段：

| 字段 | 作用 |
|---|---|
| `name` | 配置器中的用户可读名称；只负责展示，不作为身份，允许重名 |
| `type` | `image` / `video` / `html` |
| `src` | Room 根目录内的相对路径 |

正式 v1 写入时三项都存在；缺少任何一项的 Content 都不是合法写出格式。宽容读取可临时停用该内容，但不能把非法对象原样写回。

房间级 `switch` 继续作为运行时安全默认，可以是官方预设名，也可以使用同样的 `name/type/src` 内容对象；`switches` 保存具体方向的覆盖。即使运行时存在默认值，配置器遇到新相邻方向时仍按第三节提示用户补充，不把默认值偷偷复制成方向内容。

### 根对象

| 字段 | 必需 | 语义 |
|---|---|---|
| `version` | 是 | 固定整数 `1` |
| `startDesk` | 是 | 启动后进入的 Desk 数组下标 |
| `switches` | 是 | 有向边覆盖；允许空对象 |
| `desks` | 是 | 至少一个 Desk，数组顺序即页面顺序 |
| `start` / `idle` | 否 | 启动内容与 Lively 屏保实例使用的待机 Content |
| `switch` | 否 | 缺少方向覆盖时的安全默认；预设为 `slide/fade/zoom/none` |
| `dock` | 否 | 全局 Dock 基线 |

### Desk 与图标

- 每个 Desk 正式写出时必须有 `name/background/iconSize/icons`；`background` 未配置时写 `null`。
- `iconSize` 只允许 `large/medium/small`。
- 桌面图标必须有 `label/x/y`；Dock 图标必须有 `label` 且禁止 `x/y`。
- `launch` 一旦存在，必须完整写出 `target/args/workdir`；没有启动目标的展示图标可以省略 `launch`。
- 所有对象字段封闭；运行态字段或拼错字段不属于 v1。

## 三、Desk 顺序、默认 Desk 和 switch

### 顺序与连接

- `desks` 数组顺序就是 Desk 顺序，Desk 身份继续使用数组下标，不新增持久 ID。
- 1 个 Desk 没有 switch。
- 2 个 Desk 只有一组双向连接。
- 3 个及以上 Desk：相邻 Desk 双向连接，并增加首尾双向连接。
- 连接关系由 `desks` 顺序自动推导，不在 room.json 里重复保存线或拓扑对象。
- UI 中每对 Desk 只显示一条双向线和一个 switch 入口；`switches` 仍分别保存两个方向。

### 默认 Desk

- 复用 UI-003 已有的 `startDesk`，表示启动画面连接的默认 Desk。
- 启动时不恢复上次停留的页面：有 `start` 就播放后进入 `startDesk`，没有 `start` 就直接进入 `startDesk`。
- `startDesk` 缺失、越界或非法时回退到 `desks[0]`。
- 当前停留的 Desk、播放进度、HTML ready 状态等只属于运行时，不写入 room.json。

### 调整 Desk 顺序

切换内容跟随 Desk 本身和方向，不跟随旧数组位置：

```text
原顺序 [A, B]：A→B = 甲，B→A = 乙
新顺序 [B, A]：B→A = 乙，A→B = 甲
```

配置器调整顺序时必须同时重映射 `startDesk` 和 `switches` 的下标。新顺序形成了以前不相邻的组合时：

- 不自动复制、猜测或生成 switch。
- UI 明确标记“需要补充切换”。
- 编辑中的草稿允许暂存；点击“应用”前必须提示仍缺少哪些方向。
- 正式保存只保留当前相邻与首尾连接使用的方向；撤销/重做可在编辑会话中恢复调整前状态。

## 四、图片、视频和 HTML 的行为

### 图片

- background 图片静态常驻，不自动添加缩放、位移或其他动效。
- start 图片静态显示 0.5 秒，然后进入 `startDesk`。
- switch 图片静态显示 0.5 秒，然后切换 Desk。
- idle 图片在 Lively 屏保实例中静态显示到用户唤醒。
- 0.5 秒是官方固定行为，不为它增加 room.json 时间字段。

### 视频

- background 视频作为当前 Desk 的长驻背景，由官方宿主管理循环。
- start 视频完整播放后进入 `startDesk`。
- switch 视频完整播放后才切换 Desk，不在中点提前换页。
- idle 视频在 Lively 屏保实例中静音循环到用户唤醒。
- v1 不增加 `swapAt` 等时间字段；需要自定义复杂节奏时使用 HTML。

### HTML

- background HTML 在 Desk 可见期间长驻于受控内容容器。
- start/switch/idle HTML 由官方 `playSlot` 放进 `sandbox="allow-scripts"` iframe。
- 宿主把不可预测的 `dextInstanceId` 放进 iframe URL；内容页只能发
  `{type:"dext:scene",event:"ready"|"done",instanceId}`。
- 宿主同时校验 `event.source === 当前 iframe.contentWindow` 和 `instanceId`；旧实例、同页伪造和其他 iframe 消息均无效。
- HTML 不获得 `allow-same-origin`、顶层导航或弹窗权限；Player 也只接受顶层官方页面的 WebView IPC，因此内容页不能启动应用、保存 Room 或操作官方 DOM。
- start/switch HTML 有 60 秒安全超时并处理当前实例的 `done`；idle HTML 忽略 `done`、不设结束超时，由 Lively 唤醒时关闭整个屏保实例。

### Lively 待机边界

- 待机时间、全屏与媒体保护、多屏布局、淡入、音量、输入唤醒和唤醒锁屏全部使用 Lively Core 现有 `ScreensaverService`。
- 屏保通过独立 Topmost 壁纸实例运行；Dext 收到屏保启动标记后只挂载 `room.idle`，不播放 start，也不渲染 Desk、图标或 Dock。
- Room 缺少或无法加载 `idle` 时显示黑屏；用户输入后 Lively 直接关闭屏保实例，底层原 Room 保留原 Desk 和运行状态。
- 普通切换 Room、关闭壁纸或退出 Lively 立即关闭 Player，不再向页面发送结束动画消息。

## 五、Dock 继承

- `room.dock` 是全局基线。
- `desks[i].dock` 只覆盖当前 Desk 明确写出的字段。
- 普通字段按“默认值 → 全局 → 当前 Desk”覆盖；`style` 按字段合并。
- Desk 写出 `icons` 时整组替换全局列表；`icons: []` 表示当前 Desk 明确为空。
- Desk 没有 `icons` 表示继承全局；恢复跟随全局时删除 Desk 的 `icons` 字段。
- Dock 的运行态圆点、展开状态、临时拖拽反馈和当前进程列表不得写入 room.json。

## 六、预览、保存、应用和 `__source`

```text
配置器预览：只使用内存草稿，不写文件
配置器保存：写源 Room 的 room.json，不写 __source
配置器另存：写新的干净 v1，并复制 background/start/switch/idle；原 Room 不变
配置器应用：复制源 Room 到运行包，并只在运行包盖 __source
桌面编辑保存：先写运行包，再通过 __source 同步源 Room
未来导出 zip：从源 Room 导出，禁止携带 __source
```

- `__source` 不是 Room 内容字段，只是运行包回写源目录使用的内部戳。
- 源 Room、配置器预览和导出 zip 中出现 `__source` 都属于非法输入，写出时必须移除。
- `write_room` 会先剥离 `__source` 再验证并原子替换源文件；`apply_room` 只接受合法 v1，并从 Rust 已解析的真实源目录生成戳。
- `save_room_as` 把当前内存草稿写成新的 v1，同时复制原 Room 的四类素材目录；任一步失败都清理刚创建的目标，不修改原 Room。
- 桌面保存时页面提交的 `__source` 永远不可信。Core 只从应用时生成的现有运行包读取可信戳；包内继续保留该戳，写源 Room 前从 JSON 副本移除。
- 切换当前 Desk、播放 start/switch/idle、HTML 临时状态和 Dock 运行态不得触发真实 Room 保存。
- 用户编辑当前 Desk 的背景、图标或 Dock 配置并明确保存时，才持久化对应 Desk 内容。

## 七、缺失、未知和非法数据

Schema 负责定义严格的官方写出格式，读取端负责不崩溃；“宽容读取”不等于把非法文件悄悄当成合法文件。

- 缺少普通可选字段：使用官方默认值，并在内存中继续打开。
- 单个背景、start、switch 或 idle 非法：只停用并标红这一项，其他 Desk 继续可预览；屏保中的 idle 非法则黑屏。
- 新相邻方向没有 switch：按第三节显示待补充提示，不自动制造内容。
- `version: 1` 出现未知字段：提示用户；明确保存时清理为官方 v1 格式。
- 遇到 `version: 2`：只读显示契约与 Widget 数量并允许独立严格校验，不进入 v1 预览；遇到未知版本：只显示不支持。两者都禁止写入和应用。
- `desks` 缺失或为空：显示一个临时空 Desk 和修复提示，不自动改原文件，也不允许直接应用。
- `startDesk` 非法：回退 `desks[0]` 并提示。
- `src` 不存在、越界或类型不匹配：只停用对应内容并提示。
- v1 不读取或迁移无 `version: 1` 的旧 Room；旧格式文件显示“不受支持”，不自动改写。

## 八、路径和未来 zip 保证

- v1 内容目录固定为 `background/`、`start/`、`switch/`、`idle/`。
- `src` 必须是相对 Room 根目录的规范路径，禁止绝对路径、盘符、URL、`..` 和逃逸 Room 根目录的形式。
- HTML 内容及其依赖资源必须自包含在 Room 包内。
- v1 不把顶层 `room.js` / `room.css` 当作用户可执行扩展；用户代码进入对应 HTML 内容目录。
- 应用 Room 时只镜像以上四个目录；旧 `transition/`、`end/`、`room.js`、`room.css` 会从运行包清理，不能污染下一 Room。
- Schema 至少保证版本可识别、Desk 非空、字段封闭、类型明确、switch key 可解析、索引合法和路径形态安全。
- 真正的 zip 解包、重名处理和文件系统安全属于 ROOM-001/ROOM-002；DXT-001 只提前提供可校验、自包含的格式边界。

## 九、Room v2 Widget 契约与版本边界

### 9.1 版本分派和过渡期操作矩阵

读取端必须先识别根 `version`，再分派到独立校验器，不能把 v2 删除未知字段后当作 v1：

| 版本 | 读取/列出 | 编辑/覆盖保存/另存 | 应用/预览 | 当前 zip |
|---|---|---|---|---|
| v1 | 正常 | 正常；写出仍为 v1 且无 `widgets` | 正常 | 正常 |
| v2 | 可列出、只读打开、独立严格校验 | 全部拒绝，禁止降级 | 全部拒绝，不进入 v1 iframe 或运行链 | 导入/导出均拒绝 |
| 未知版本 | 显示版本与“不支持” | 全部拒绝 | 全部拒绝 | 全部拒绝 |

所有 Rust 写入、另存、应用和 zip 最终边界都必须复核版本。拒绝操作发生在任何目标修改之前，不得改变源 Room、运行包或当前桌面。WidgetHost 尚未实现，因此 v2 的“打开”只表示查看契约信息，不执行 Widget。

### 9.2 v2 Widget manifest

v2 继承 v1 的全部正式字段和 `idle` 语义，固定 `version: 2`；每个 Desk 必须额外包含 `widgets` 数组。每个 Widget 必含：

- `id`：小写 ASCII slug，Room 内全局唯一；每个 Desk 是独立实例。
- `name`、`src`、`resources`：入口必须是 HTML；所有路径位于 `widgets/<id>/`，使用正斜杠且无 URL、盘符、反斜杠、`.` 或 `..`。`src` 必须列入去重的 `resources`；样包中声明资源必须存在，Widget 目录也不得藏有未声明文件。
- `placement`：1920×1080 逻辑画布中的整数 `x/y/width/height/z`；最小 64×64、完整位于画布内，z 为 0..255。未来 WidgetHost 以居中等比 `contain` 映射到实际视口。
- `config`：JSON object；紧凑 UTF-8 JSON 最大 65,536 字节，根对象计深度 1，最大深度 12。
- `permissions`：封闭、去重枚举。每 Desk 最多 32 个 Widget，全 Room 最多 64 个；单 Widget 最多声明 256 个资源。

权限只表达请求，不代表已经授予或实现：P1 自动允许时间、语言、视口、当前 Desk、暂停态、音频频谱和 CPU/GPU/RAM 摘要；P2 明确同意歌曲信息/封面、网络摘要和 Dext 代理联网；P3/P4 仅为未来配额 KV、Dext 内导航/通知和用户映射 action 保留声明。网络默认离线、禁止 Widget 直连；manifest 不接受任意域名白名单、程序路径或执行参数。

`config` 是 Room 内容，跟随复制与未来导出。授权和未来宿主管理的 KV/待办等可变数据只保留本机，不随 Room 复制、另存或导出。

### 9.3 v1→v2 显式复制规则

升级先严格验证源 v1，再创建新的 v2：保留全部 v1 字段以及 `background/start/switch/idle` 四类素材，改为 `version: 2`，为每个 Desk 添加空 `widgets` 并创建 `widgets/`。不得修改源 v1，也不得复制授权或运行数据。DXT-003 只交付规则和 `dev_docs/fixtures/room-migration/` 前后 fixtures，不提供迁移命令或 UI。

## 十、DXT-002/DXT-003 已实现边界与后续

DXT-001 交付 v1 Schema、统一内容宿主、配置器预览/保存和持久化闭环；DXT-002 在同一 v1 内以 `idle` 替换 `end`，复用 Lively 屏保链，并接通独立待机节点、持续内容和立即关闭。DXT-003 增加独立 v2 Schema、版本分派、Widget manifest/fixtures 和只读保护，但不实现 WidgetHost。

后续工作包：

- UI-001：补内容移除和更完整的名称编辑体验；Desk/background、start、idle 与 switch 的三类按钮已经接通。
- UI-002：提供 Desk 排序和方向重映射；两个方向的 switch 三类按钮已由 DXT-001 接通，缺失方向仍显示“需要补充切换”。
- MEDIA-001：处理非自包含 HTML 的成组依赖导入、引用检查和孤儿素材；DXT-001 只导入单个自包含 HTML 文件。
- ROOM-001/ROOM-002：zip 导出和导入。
