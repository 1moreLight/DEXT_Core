# Room↔Desk 概念模型（schema v1 蓝图）

> 初稿于 2026-08-25，2026-08-29 按环形拓扑与官方 SceneHost 方向修订。
> 本文是 schema v1 的前置输入；概念决策仍有效，当前实现状态和排期只看 ROADMAP.md。

## 一、实体与关系

```
Room ──── 分享单位（文件夹 → zip），自包含
 │   room.json        数据 + 内容清单（唯一契约）
 │   background/      Desk 背景 Scene 素材
 │   start/switch/end/ 对应演出 Scene 素材
 │   transition/      旧转场目录，仅兼容读取
 ├──▶ Desk[0..N]      页面：有序数组，环形导航（% length），≥ 1 个
 │      name / background / icons[] / iconSize
 └──▶ Icon[0..N/桌]   值拷贝语义：base64 图 + launch 快照
                      稀疏网格坐标 (x,y)，同页内唯一（拖拽交换保证）

Library（rooms/library.json）
    配置器私有应用库，不属于任何 Room；
    拖入 Desk 时快照为 Icon，此后与库无引用关系
```

要点：

- **Room = 主题包**，分享/上传/下载的单位；room.json 自包含，不引用包外资源。
- **Desk = 页面**，对应手机主屏的一页；身份 = 数组下标（无 id），顺序即导航顺序。
- **Icon 是拷贝不是引用**：从 Library 拖入即内嵌（base64 + launch 三元组快照），删库不影响桌面。

## 二、字段归属判据

> **切到另一页时希望它变吗？** 变 → desk 级；不变 → room 级。

| 字段 | 层级 | 判定 |
|---|---|---|
| `name` | desk | ✓ 页面标识 |
| `background` | desk | ✓ 每页换景；v1 目标为 image/video/html `ContentSpec`，空值纯黑兜底 |
| `icons` + `x,y` | desk | ✓ 页面内容，稀疏网格 |
| `iconSize` | desk | ✓ 每页密度独立 |
| `switch` / `switches` | room | ✓ 切换行为，全房间一致（见下节；旧名 transition 兼容读取） |
| 外观主题（颜色/字体/Dock 样式） | — | **暂不做**（2026-08-25 拍板 YAGNI），将来若做进 `room.theme` |

## 三、转场：有向边模型（本轮核心决策）

切桌动画按 **允许导航的 desk 有向边** 建模，不生成任意两桌之间的完整图。相邻 Desk 双向连接；N≥3 时首尾也双向连接。数据上用「房间默认 + 边级覆盖表」，两个方向可以不同：

```jsonc
{
  "switch": "slide",                // 房间默认（旧字段 transition 兼容读取）
  "switches": {                     // 可选：边级覆盖表（新字段，预留接口）
    "0>1": "fade",
    "1>0": { "type": "video", "src": "switch/back.mp4" },
    "2>1": "zoom"
  }
}
```

- key 格式 `"from>to"`，值为下标；方向天然区分来回。
- 渲染时查找顺序：`switches["cur>next"] ?? switch ?? (旧字段 transition) ?? "slide"`。
- 未覆盖的边全部走默认 → 现有房间零迁移。
- **当前 v0.x 值类型**：字符串预设（slide/fade/zoom/none/text）、`{type:"video",src}` stinger、`{type:"action",name}` 顶层脚本事件。v1 目标改为官方预设或 image/video/html `ContentSpec`，兼容策略由 DXT-001 定稿。
- 环形导航下 from/to 取实际下标（如末桌→首桌为 `"2>0"`）。
- **启动目标 Desk**（2026-08-29 修订）：启动画面只直连一个 Desk（无 switch），目标 Desk 可在配置器中选择；旧 Room 或缺少持久选择时默认 `desks[0]`。目标字段及真桌面运行语义由 DXT-001/UI-001 定稿。
- **Desk 环形导航**（2026-08-29 修订）：相邻 Desk 建一组双向边；Desk 数量 ≥3 时，首 Desk 与末 Desk 再建一组双向边，使每个 Desk 都有上一页和下一页。2 个 Desk 只保留一组双向边，1 个 Desk 无 switch。配置器几何中相邻边连接节点上/下，首尾环线走侧边；持久化由 UI-002 接线。

## 四、清理项

- **`transitionText` 废弃**：v1 移除该字段。text 类型转场保留在预设里，文案改固定模板
  （渲染器内部生成，不再是数据字段）。
- **`__source`**：只属于已应用的运行包，是 apply_room 盖章、Core 保存回写使用的双写戳，不是 Room 内容。源 Room 和未来导出 zip 禁止携带，配置器预览也不生成；DXT-001 需把运行包扩展与可分享契约明确分开。

## 五、不变量

1. `desks.length ≥ 1`
2. desk 身份 = 下标；数组顺序 = 导航顺序（环形）
3. 同一 desk 内 icon 的 (x,y) 唯一（编辑器保证；宽容读取不校验重复）
4. room.json 自包含：素材路径相对包根，一律 ASCII
5. 宽容读取：缺字段一律默认值（ERRORS #4 教训）；未知字段忽略不报错
6. 图标无 `launch` 时双击走 `action` toast 文案

## 六、Room Scene 与官方宿主边界（2026-08-29 修订）

> 高达驾驶舱的画面可以由作者用 HTML/CSS/JS 创作，但 Desk、Dock、图标、导航、IPC、保存和关闭流程仍属于 Dext 官方宿主。作品能高度自定义内容，不能替换软件底座。

### 6.1 v1 目标分层

- **官方宿主层**：Dext 自带并维护的 HTML/CSS/JS 骨架，负责 Desk、Dock、图标、输入、IPC、持久化、预览和生命周期。
- **用户 Scene 内容层**：只进入 background/start/switch/end 的受控容器，可为 image、video 或 html。
- image/video 是官方 SceneHost 的简单输入；html 是高级作者或官方骨架/vibe coding 生成的内容页面。
- room.json 保留真实类型，配置器重开后仍知道用户选的是图片、视频还是 HTML。
- 静态图片可由官方宿主统一叠加轻微动态效果；该效果属于渲染策略，不把动画进度等运行态写入 room.json。
- HTML Scene 只能通过受控消息表达 ready、换页时机和 done；允许的消息、来源校验、超时和失败回退由 SCENE-001 定稿实现。

### 6.2 内容类型草案

```jsonc
{ "type": "image", "src": "background/idle.png" }
{ "type": "video", "src": "background/cruise.mp4", "loop": true }
{ "type": "html",  "src": "background/combat/index.html" }
```

DXT-001 决定最终字段、各槽允许的选项与默认值。推荐保持一个共享的 `ContentSpec` 形状，避免四套播放器契约分叉。

### 6.3 当前 v0.x 与目标的差距

- `cockpit-room` 已证明 HTML 内容能在现有 WebView2/Lively 链路中运行；start/end 已有 HTML 原型。
- background 当前只稳定支持图片/视频，switch 仍包含预设、视频和 action/顶层 room.js 路线，尚未统一成 SceneHost。
- 顶层 `room.js` / `room.css` 可以直接影响官方 DOM，与 v1 “用户只控制内容层”的安全边界冲突。现阶段保留兼容，不把它写成新 Room 的推荐创作入口。
- 当前 `window.dext` 和 `dext:slotDone` 是能力原型，不等于最终隔离协议；SCENE-001 必须补来源校验、允许消息清单、超时、失败回退和资源边界。

### 6.4 统一 Scene 生命周期目标

> 运行底座统一是官方 HTML SceneHost；image/video/html 是三种内容输入。start / end / switch / background 共用内容模型，但生命周期可按用途不同。

```jsonc
// 当前原型示意；最终字段由 DXT-001 定稿：
{ "type": "image", "src": "start/intro.png" }
{ "type": "video", "src": "start/intro.mp4", "loop": false }
{ "type": "html",  "src": "start/index.html", "timeout": 20 }
```

- **start**：渲染器加载 → renderDesk → start Scene 全屏覆盖 → 结束揭晓。缺省无覆盖。
- **end**：Core 发 cmd_close → Player 转发 `dext:end` → 渲染器播 end Scene → ack `dext:endDone` → Player 退出；Player 侧 5s 强制上限，无 Scene 零延迟。
- **switch**：需要明确“何时换 Desk”和“何时结束”；video 可用默认中点，HTML 通过受控消息请求，异常时由官方超时回退。
- **background**：默认长驻并随 Desk 切换，不允许自行写 Room 或操纵 Dock。
- Room 目标素材目录：`background/`、`switch/`、`start/`、`end/`；旧 `transition/` 只兼容读取。

## 七、room.json v1 字段总表（草案）

```jsonc
{
  "desks": [                        // 必需，≥1
    {
      "name": "Desk 1",             // 缺省 "Desk N"
      "background": <ContentSpec> | null,
      "iconSize": "large"|"medium"|"small",   // 缺省 medium
      "icons": [
        {
          "label": "...",
          "icon_png": "<base64>",   // 可选；缺省用 glyph+color 兜底
          "glyph": "🌐", "color": "#3b82f6",
          "action": "...",          // 无 launch 时 toast 文案
          "launch": {"target":"...","args":"...","workdir":"..."},  // 可选
          "x": 0, "y": 2            // 稀疏网格；旧数据自动补齐
        }
      ]
    }
  ],
  "switch": <ContentSpec或官方预设>,                      // 房间默认，缺省由 DXT-001 定稿
  "switches": {"from>to": <同 switch 值>},               // 可选边级覆盖
  "start": <slot>,                                  // 可选启动动画
  "end": <slot>                                     // 可选退出动画
  // "__source": 运行时保留字段，勿写
}
```

## 八、实现状态说明（2026-08-28 核对）

当前已经实现：

- 渲染器按 `switches["from>to"] → switch → 旧字段` 查找边级转场。
- `room.js` / `room.css` 加载和 `window.dext` 最小事件集（v0.x 兼容能力，不是 v1 安全边界）。
- action 类型的 `dext:switch` 广播。
- start/switch/end 的 video/html/action 原型播放器。

仍未闭环：

- 配置器打开 Room 时还原 `switches`，并在保存时落盘（ROADMAP UI-002）。
- schema v1 与 JSON Schema 正式文件（ROADMAP DXT-001）。
- background/start/switch/end 的统一 image/video/html SceneHost、安全隔离和生命周期（ROADMAP SCENE-001）。
- `transitionText` 代码残留清理（ROADMAP CLEAN-003）。
- AI 创作契约与示例（ROADMAP AI-001）。

本节只解释模型与现状的差距，不再作为任务清单。
