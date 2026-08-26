# Room↔Desk 概念模型（schema v1 蓝图）

> 定稿于 2026-08-25，用户拍板三项争议点后成文。
> 本文是 schema v1 的前置输入；实现（渲染器/配置器改造）另行排期。

## 一、实体与关系

```
Room ──── 分享单位（文件夹 → zip），自包含
 │   room.json        数据 + 清单（唯一契约）
 │   background/      背景/转场素材目录
 │   transition/      stinger 视频素材目录
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
| `background` | desk | ✓ 每页换景（string=图片 / {video} / 空=纯黑兜底） |
| `icons` + `x,y` | desk | ✓ 页面内容，稀疏网格 |
| `iconSize` | desk | ✓ 每页密度独立 |
| `switch` / `switches` | room | ✓ 切换行为，全房间一致（见下节；旧名 transition 兼容读取） |
| 外观主题（颜色/字体/Dock 样式） | — | **暂不做**（2026-08-25 拍板 YAGNI），将来若做进 `room.theme` |

## 三、转场：有向边模型（本轮核心决策）

切桌动画按 **desk 有向边** 建模：N 个桌有 N×(N-1) 条有向边（3 桌 = 6 条），来回可不同。
数据上用「房间默认 + 边级覆盖表」，想配几条配几条：

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
- **值的多态三态**（2026-08-25 扩）：字符串=预设名（slide/fade/zoom/none/text）、
  `{type:"video",src}`=stinger、`{type:"action",name}`=广播页面事件给房间脚本（见第六节）。
- 环形导航下 from/to 取实际下标（如末桌→首桌为 `"2>0"`）。

## 四、清理项

- **`transitionText` 废弃**：v1 移除该字段。text 类型转场保留在预设里，文案改固定模板
  （渲染器内部生成，不再是数据字段）。
- **`__source`**：运行时双写戳（apply_room 盖章、Core 保存回写用），非内容字段。
  schema 中标注为「传输保留，创作者/AI 不要写」。

## 五、不变量

1. `desks.length ≥ 1`
2. desk 身份 = 下标；数组顺序 = 导航顺序（环形）
3. 同一 desk 内 icon 的 (x,y) 唯一（编辑器保证；宽容读取不校验重复）
4. room.json 自包含：素材路径相对包根，一律 ASCII
5. 宽容读取：缺字段一律默认值（ERRORS #4 教训）；未知字段忽略不报错
6. 图标无 `launch` 时双击走 `action` toast 文案

## 六、房间可编程性（2026-08-25 拍板：两层路线）

> 动机场景：高达驾驶舱——整个页面即作品，切桌 = 触发自定义 HTML 动作，
> 而非仅播视频。对标 Wallpaper Engine「壁纸即网页程序」的创作者自由度。

### 6.1 Room 文件夹扩展成员（均可选）

```
rooms/gundam-room/
  room.json / background/ / transition/
  room.js     ← 房间脚本：注册事件回调，自由驱动页面
  room.css    ← 房间样式：覆盖/追加外观
```

### 6.2 声明式动作（第一层，语法糖）

转场值 `{type:"action", name:"cockpit.combat"}` → 渲染器向 `window` 广播
`dext:switch` CustomEvent（detail 含 from/to/name/dir），房间脚本监听之。
与 video 类型平级，可共存于边级覆盖表。

### 6.3 房间脚本契约 window.dext（第二层，最小集草案）

```js
dext.onReady(fn)          // 渲染器就绪（room.js 加载早于首次渲染完成）
dext.onDeskChange(fn)     // fn({from, to, dir, phase}) phase: "before"|"after"
dext.onEditChange(fn)     // fn({editing})
dext.getRoom()            // 只读视图
dext.getCurrentDesk()     // 下标
```

- 加载顺序：渲染器初始化 → 注入 room.css → 执行 room.js（try/catch 错误隔离，
  单房间脚本炸了不影响渲染器兜底渲染）。
- 风险模型与 WE 一致：脚本在壁纸 WebView 沙箱内，能碰 DOM/发 postMessage
  （= 可启动应用，同图标行为），不能出沙箱碰文件系统；
  「装不可信房间 ≈ 跑不可信网页」，创意工坊阶段再考虑提示/审核。
- 开放问题：房间脚本自身状态持久化（如驾驶舱仪表配置）暂 YAGNI；
  localStorage 在虚拟主机域下的行为需实测后定。

### 6.5 统一演出槽 slot（2026-08-25，Phase 9）

> 用户定调：视频与 HTML 统一——**视频 = 渲染器代管 `<video>` 的糖**（读包内本地路径），
> HTML = 房间自带页面自管生命周期。start / end / switch 通用，background 同形预留。
> 命名（2026-08-25 用户拍板）：三幕 = **start / switch / end**（旧名 boot/transition/shutdown 废弃）。

```jsonc
// slot 三态（统一值类型）：
{ "type": "video", "src": "start/intro.mp4", "loop": false }   // 渲染器代管，ended/error 结束
{ "type": "html",  "src": "start/index.html", "timeout": 20 }  // iframe 加载；页面 postMessage
                                                               // "dext:slotDone" 结束；timeout 兜底
{ "type": "action", "name": "cockpit.start" }                  // 广播 dext:slot 事件，立即结束
```

- **start**：渲染器加载 → renderDesk → start 槽全屏覆盖（z-index 300）→ 结束揭晓。缺省无覆盖。
- **end**：Core 发 cmd_close → Player `HandleShutdownNotice`：postMessage
  `"dext:end"` 给页面 → 渲染器播 `room.end` 槽 → ack `{type:"dext:endDone"}`
  → Player 退出；Player 侧 5s 强制上限（渲染器侧自限 4s）。**无槽房间零延迟**（立即 ack）。
- 切换 video 分支保留 stinger 专用逻辑（播到 50% 换桌），schema 与 slot 同形。
- Room 文件夹可选子目录：`start/`、`end/`（apply_room 泛化拷贝；旧 `transition/` 兼容保留）。

## 七、room.json v1 字段总表（草案）

```jsonc
{
  "desks": [                        // 必需，≥1
    {
      "name": "Desk 1",             // 缺省 "Desk N"
      "background": "background/a.png" | {"type":"video","src":"..."} | null,
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
  "switch": "slide"|{"type":"video","src":"..."},       // 房间默认，缺省 slide
  "switches": {"from>to": <同 switch 值>},               // 可选边级覆盖
  "start": <slot>,                                  // 可选启动动画
  "end": <slot>                                     // 可选退出动画
  // "__source": 运行时保留字段，勿写
}
```

## 八、待实现（另立 phase）

- [ ] 渲染器 switchDesk 接入边级查找
- [ ] 渲染器：room.js/room.css 加载（错误隔离）+ window.dext 最小事件集
- [ ] 渲染器：action 类型切换 → dext:switch 事件广播
- [ ] 配置器转场 UI 从单选升级为「默认 + 边级列表」（或矩阵视图，做法后议）
- [ ] transitionText 清理 + text 预设固定模板
- [ ] dext 契约定稿文档（AI skill 的输入之一）；配置器对 room.js 房间只读不破坏
