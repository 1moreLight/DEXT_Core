# Dext Room v1 定制协议

> 面向使用配置器、手工制作 Room，以及在官方骨架边界内使用 vibe coding 的创作者。
> `room.schema.json` 是机器格式真相源，`MODEL.md` 是运行语义真相源；本文说明实际应该怎样制作、保存和检查一个 Room。

## 一、允许定制什么

Dext 的运行页面始终使用官方宿主 `wallpapers/dext-room/`。官方宿主负责 Desk、Dock、图标、导航、IPC、保存、预览和生命周期，Room 不复制也不替换这套代码。

Room 作者只定制四类内容：

- `background`：某个 Desk 的长期背景。
- `start`：Room 启动时的全屏内容。
- `switch`：Desk 之间某一个方向的切换内容。
- `idle`：Lively 进入屏保/待机时显示的全屏内容。

四类内容都可以是图片、视频或 HTML。v1 不执行 Room 根目录的 `room.js`、`room.css`，也不允许用户 HTML 操作官方 Desk/Dock DOM、调用应用启动或伪造保存消息。

## 二、标准目录

```text
my-room/
├─ room.json
├─ background/
│  ├─ home.png
│  └─ code-scene/
│     ├─ index.html
│     ├─ style.css
│     └─ assets/...
├─ start/
├─ switch/
└─ idle/
```

规则：

- `room.json` 必须位于 Room 根目录。
- 内容只能放在 `background/`、`start/`、`switch/`、`idle/`。
- `src` 使用 `/` 分隔的 Room 内相对路径；禁止绝对路径、盘符、URL、反斜杠、空路径段和 `..`。
- 图片扩展名：`.png/.jpg/.jpeg/.webp/.bmp/.gif/.svg`；视频：`.mp4/.webm`；网页：`.html/.htm`。手工制作时使用小写扩展名。
- HTML 引用的 CSS、JS、字体和图片也要放在同一 Room 的对应内容目录内，使用相对路径。为了可分享，不应依赖本机绝对路径或外部网站。
- 当前配置器一次导入一个文件；单 HTML 必须把依赖内联。需要多个依赖文件时，创作者可按上面的子目录结构手工组织，成组导入 UI 属于后续 MEDIA-001。

## 三、最小 room.json

```json
{
  "version": 1,
  "startDesk": 0,
  "switches": {},
  "desks": [
    {
      "name": "主页",
      "background": null,
      "iconSize": "medium",
      "icons": []
    }
  ]
}
```

根字段：

| 字段 | 要求 | 含义 |
|---|---|---|
| `version` | 必填，固定 `1` | v1 格式标识 |
| `startDesk` | 必填，非负整数 | 启动后进入的 `desks` 数组下标 |
| `switches` | 必填，可为空对象 | 每个有向 Desk 切换的覆盖 |
| `desks` | 必填，至少一项 | Desk 顺序；数组下标也是 switch 身份 |
| `start` / `idle` | 可选 | 启动与 Lively 待机 Content |
| `switch` | 可选 | 某方向没有覆盖时的全局默认；缺省再回退 `slide` |
| `dock` | 可选 | 全局 Dock 基线 |

所有正式对象都是封闭的：不要添加 Schema 未声明的字段，也不要把播放进度、当前 Desk、Dock 运行状态等临时数据写入文件。

## 四、统一 Content

```json
{
  "name": "主页背景",
  "type": "image",
  "src": "background/home.png"
}
```

| 字段 | 规则 |
|---|---|
| `name` | 1–120 个字符，只用于配置器展示，允许重名 |
| `type` | `image`、`video` 或 `html` |
| `src` | 必须进入当前槽位对应目录，且扩展名与 `type` 一致 |

`background` 的路径必须以 `background/` 开头；`start/idle` 同理；房间级 `switch` 和 `switches` 中的 Content 都必须以 `switch/` 开头。

## 五、Desk、顺序和双向 switch

Desk 正式写出结构：

```json
{
  "name": "游戏",
  "background": {
    "name": "游戏背景",
    "type": "video",
    "src": "background/game.webm"
  },
  "iconSize": "large",
  "icons": []
}
```

- `background` 必须存在；未配置时写 `null`。
- `iconSize` 只能是 `large/medium/small`。
- `icons` 必须是数组。
- `desks` 数组顺序就是用户在编辑器中看到的页面顺序。

连接只由顺序推导：一个 Desk 无连接；两个 Desk 为一组双向连接；三个及以上为相邻双向连接，再加首尾双向连接。room.json 不额外保存线对象。

每个方向分别写入 `switches`：

```json
{
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
  }
}
```

方向值可以是 `slide/fade/zoom/none`，也可以是 switch Content。解析顺序为：`switches["from>to"]` → 房间级 `switch` → `slide`。

调整 Desk 顺序时，内容跟随 Desk 和方向，而不是旧下标。例如 `[A,B]` 改成 `[B,A]` 后，原来的 B→A 内容仍属于 B→A。配置器必须重映射 `startDesk` 和 key；新产生的相邻组合显示“需要补充切换”，不能自动生成内容。

## 六、三种内容的准确行为

| 槽位 | 图片 | 视频 | HTML |
|---|---|---|---|
| background | 静态常驻 | 静音、循环常驻 | 当前 Desk 可见期间长驻 |
| start | 显示 0.5 秒 | 完整播放 | 收到当前实例 `done` 或 60 秒超时 |
| switch | 显示 0.5 秒后换 Desk | 完整播放后换 Desk | 收到当前实例 `done` 或 60 秒超时后换 Desk |
| idle | 持续显示到唤醒 | 静音循环到唤醒 | 持续运行到唤醒；忽略 `done`，无结束超时 |

视频由官方宿主静音播放。v1 不提供自定义图片时长、视频中点换页或 `swapAt`；复杂时序应在 HTML 内实现。

`idle` 不负责判断用户是否空闲。待机时间、全屏保护、多屏布局、淡入、音量、输入唤醒和唤醒锁屏都使用 Lively 的全局屏保设置。Lively 启动独立屏保实例时，Dext 只显示 `idle`，不播放 start、不显示 Desk 图标或 Dock；未配置或加载失败时显示黑屏。用户输入后屏保实例直接关闭，原 Room 保留待机前的 Desk。

## 七、HTML 场景接口与安全边界

用户 HTML 运行在 `sandbox="allow-scripts"` iframe 中，没有 `allow-same-origin`、顶层导航或弹窗权限。宿主在 URL 查询参数中提供：

- `dextInstanceId`：当前场景实例的随机 ID。
- `dextKind`：`background/start/switch/idle`。

start/switch 完成时使用：

```html
<script>
  const params = new URLSearchParams(location.search);
  const instanceId = params.get("dextInstanceId");
  const kind = params.get("dextKind");

  function sceneDone() {
    parent.postMessage({
      type: "dext:scene",
      event: "done",
      instanceId
    }, "*");
  }

  // 只用于 start/switch；idle 由 Lively 唤醒关闭，不发送 done。
  // sceneDone();
</script>
```

宿主只接受来自当前 iframe 窗口且 `instanceId` 完全匹配的消息。旧实例、其他 iframe 或伪造 ID 无效。`ready` 可作为同结构事件发送，但当前生命周期以 `done` 为完成依据。background 是长驻内容，不需要发送 `done`。

用户 HTML 只能绘制自己的内容层，不能依赖 `window.dext`，不能直接读写 Room、控制官方 Dock/图标或调用 WebView 本机能力。宿主会在完成、错误、取消或超时后销毁 iframe/媒体和监听器。

## 八、图标与 Dock

桌面图标至少包含 `label/x/y`；Dock 图标至少包含 `label`，且不得包含 `x/y`。有启动目标时必须完整写出：

```json
{
  "label": "终端",
  "x": 0,
  "y": 0,
  "launch": {
    "target": "wt.exe",
    "args": "",
    "workdir": ""
  }
}
```

Dock 合并顺序是“官方默认 → `room.dock` → 当前 `desk.dock`”。普通字段覆盖，`style` 按字段合并；Desk 写出 `icons` 时整组替换全局图标，`icons: []` 表示当前 Desk 明确为空，缺少 `icons` 才表示继承全局。

可用 Dock 字段以 `room.schema.json` 为准：`enabled/position/autoHide/indicator/style/icons`。应用运行圆点、展开状态、进程列表和拖拽反馈只存在于运行时。

## 九、配置器操作与持久化

```text
新建/打开 Room
  → 选择 Desk、start、独立待机节点或某个方向的 switch
  → 选择图片、网页代码或视频
  → 素材立即复制到对应固定目录，内存草稿更新
  → 点击保存，才替换源 Room 的 room.json
  → 点击应用，将合法 v1 和四类素材镜像到运行包
```

- 取消文件选择不会产生修改。
- 已选择但未保存时，`room.json` 不变；复制出的未引用素材可能暂时留在目录中，孤儿清理由后续素材工作包处理。
- 配置器预览只读取内存草稿，不修改源 `room.json`、运行包或 `__source`。
- “另存为”写出新的干净 v1 并复制四个素材目录，原 Room 不变。
- “应用”只接受合法 v1；运行包由官方宿主代码加 Room 的四类素材组成。

`__source` 只允许由 Dext 注入运行包，用于真桌面编辑后回写源 Room。源 Room、配置器草稿和未来导出 zip 禁止包含 `__source`；Room 作者永远不要手写或信任这个字段。

## 十、错误与兼容策略

- v1 不兼容无 `version: 1` 的旧 Room，不自动迁移。
- 读取时缺少可选字段使用默认值；单个非法 Content 只停用该项，不能拖垮其他 Desk。
- `startDesk` 非法时运行预览回退第一个 Desk并提示；正式保存/应用必须先修正。
- 未知字段、非法路径、类型与扩展名不匹配、空 Desk 数组或非相邻 switch 都不能作为正式 v1 保存/应用。
- `version > 1` 可以尽力预览，但禁止覆盖保存。

## 十一、发布前检查

开发者在仓库根目录运行以下命令，可以确认官方 Schema、语义校验器和正反夹具彼此一致；它不会读取任意自定义 Room：

```powershell
python scripts/validate-room-schema.py
```

普通创作者通过配置器“保存”和“应用”当前 Room；这两个入口会执行正式 v1 校验并拒绝非法写出。手工制作的 Room 还应确认：

1. `room.json` 通过根目录 `room.schema.json`，且 `startDesk` 与所有 switch 下标有效。
2. 所有 `src` 都存在、位于正确固定目录、扩展名与类型一致。
3. 只配置相邻双向和三页以上首尾双向 switch；两个方向分别测试。
4. HTML 不依赖 Room 外文件；start/switch 能发送当前实例 `done`，idle 不发送 `done` 并能持续运行。
5. 源文件没有 `__source`、运行态字段、顶层 `room.js` 或 `room.css`。
6. 图片、视频、HTML、Dock 继承、保存后重开和应用到真桌面都按预期运行。

结构参考：`dev_docs/fixtures/room-v1/valid/full.json`。该文件用于格式校验，引用的是示例路径，不是可直接运行的完整 Room。
