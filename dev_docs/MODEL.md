# room.json v1 正式契约（DXT-001）

> 2026-08-30 定稿。机器可校验格式见仓库根目录 `room.schema.json`；本文件解释字段、继承、宽容读取和持久化语义。
> Schema 描述源 Room / 未来导出形态，故意不允许运行包内部字段 `__source`。

## 一、Room 和官方宿主的边界

- **Room** 是一个可分享的文件夹，`room.json` 是配置器、渲染器和未来 zip 共用的数据契约。
- **Desk** 是 Room 中有顺序的一页；`desks` 数组顺序就是配置器里排好的页面顺序。
- Dext 官方 HTML 宿主负责 Desk、Dock、图标、导航、IPC、保存、预览和生命周期。
- 用户只定制 `background`、`start`、`switch`、`end` 的内容，可以是图片、视频或 HTML。
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
  "end": {
    "name": "关机画面",
    "type": "html",
    "src": "end/index.html"
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

`background`、`start`、`switches`、`end` 中的用户内容统一复用三个字段：

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
| `start` / `end` | 否 | 对应目录的 Content |
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
- end 图片静态显示 0.5 秒，然后退出。
- 0.5 秒是官方固定行为，不为它增加 room.json 时间字段。

### 视频

- background 视频作为当前 Desk 的长驻背景，由官方宿主管理循环。
- start 视频完整播放后进入 `startDesk`。
- switch 视频完整播放后才切换 Desk，不在中点提前换页。
- end 视频完整播放后退出；官方宿主仍需有不可由 Room 关闭的安全超时。
- v1 不增加 `swapAt` 等时间字段；需要自定义复杂节奏时使用 HTML。

### HTML

- background HTML 在 Desk 可见期间长驻于受控内容容器。
- start/switch/end HTML 由官方 `playSlot` 放进 `sandbox="allow-scripts"` iframe。
- 宿主把不可预测的 `dextInstanceId` 放进 iframe URL；内容页只能发
  `{type:"dext:scene",event:"ready"|"done",instanceId}`。
- 宿主同时校验 `event.source === 当前 iframe.contentWindow` 和 `instanceId`；旧实例、同页伪造和其他 iframe 消息均无效。
- HTML 不获得 `allow-same-origin`、顶层导航或弹窗权限；Player 也只接受顶层官方页面的 WebView IPC，因此内容页不能启动应用、保存 Room 或操作官方 DOM。
- HTML 场景有 60 秒安全超时；end 整体另受 Player 65 秒退出上限保护。实例完成、报错、取消或超时后必须移除消息监听、iframe 和媒体资源。

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
配置器应用：复制源 Room 到运行包，并只在运行包盖 __source
桌面编辑保存：先写运行包，再通过 __source 同步源 Room
未来导出 zip：从源 Room 导出，禁止携带 __source
```

- `__source` 不是 Room 内容字段，只是运行包回写源目录使用的内部戳。
- 源 Room、配置器预览和导出 zip 中出现 `__source` 都属于非法输入，写出时必须移除。
- `write_room` 会先剥离 `__source` 再验证并原子替换源文件；`apply_room` 只接受合法 v1，并从 Rust 已解析的真实源目录生成戳。
- 桌面保存时页面提交的 `__source` 永远不可信。Core 只从应用时生成的现有运行包读取可信戳；包内继续保留该戳，写源 Room 前从 JSON 副本移除。
- 切换当前 Desk、播放 start/switch/end、HTML 临时状态和 Dock 运行态不得触发真实 Room 保存。
- 用户编辑当前 Desk 的背景、图标或 Dock 配置并明确保存时，才持久化对应 Desk 内容。

## 七、缺失、未知和非法数据

Schema 负责定义严格的官方写出格式，读取端负责不崩溃；“宽容读取”不等于把非法文件悄悄当成合法文件。

- 缺少普通可选字段：使用官方默认值，并在内存中继续打开。
- 单个背景、start、switch 或 end 非法：只停用并标红这一项，其他 Desk 继续可预览。
- 新相邻方向没有 switch：按第三节显示待补充提示，不自动制造内容。
- `version: 1` 出现未知字段：提示用户；明确保存时清理为官方 v1 格式。
- 遇到未来的 `version > 1`：允许尽力预览，但禁止覆盖保存。
- `desks` 缺失或为空：显示一个临时空 Desk 和修复提示，不自动改原文件，也不允许直接应用。
- `startDesk` 非法：回退 `desks[0]` 并提示。
- `src` 不存在、越界或类型不匹配：只停用对应内容并提示。
- v1 不读取或迁移无 `version: 1` 的旧 Room；旧格式文件显示“不受支持”，不自动改写。

## 八、路径和未来 zip 保证

- v1 内容目录固定为 `background/`、`start/`、`switch/`、`end/`。
- `src` 必须是相对 Room 根目录的规范路径，禁止绝对路径、盘符、URL、`..` 和逃逸 Room 根目录的形式。
- HTML 内容及其依赖资源必须自包含在 Room 包内。
- v1 不把顶层 `room.js` / `room.css` 当作用户可执行扩展；用户代码进入对应 HTML 内容目录。
- 应用 Room 时只镜像以上四个目录；旧 `transition/`、`room.js`、`room.css` 会从运行包清理，不能污染下一 Room。
- Schema 至少保证版本可识别、Desk 非空、字段封闭、类型明确、switch key 可解析、索引合法和路径形态安全。
- 真正的 zip 解包、重名处理和文件系统安全属于 ROOM-001/ROOM-002；DXT-001 只提前提供可校验、自包含的格式边界。

## 九、DXT-001 已实现边界与后续

DXT-001 同时交付 Schema、现有官方宿主的 image/video/html 运行、安全隔离、配置器完整 v1 预览/保存，以及 Rust/Player/Core 持久化闭环；原计划的 SCENE-001 已并入本包，不再另写播放器。

后续工作包：

- UI-001：为 background/start/end 提供真实素材按钮；DXT-001 只保证打开、保留、预览和保存既有 Content。
- UI-002：提供 Desk 排序和方向素材编辑完整 UI；DXT-001 已保留既有 `switches` 并对缺失方向显示“需要补充切换”。
- MEDIA-001：素材选择与复制。
- ROOM-001/ROOM-002：zip 导出和导入。
