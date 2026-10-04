# Dock 模块契约（2026-08-27 定稿 v0）

> 本文档是 Dock 功能（常驻图标区 + 样式自定义）的唯一接口说明。
> 数据层只有 room.json；渲染器全在 `wallpapers/dext-room/main.js`；配置器在 `tauri-ui/src/`。

## 零、与用户内容的边界

Dock 属于 Dext 官方宿主层，不属于用户的 background/start/switch/idle 内容。用户 HTML 只能在 `sandbox="allow-scripts"` 容器运行，不能直接改 Dock DOM、调用 Dock 保存或伪造运行态；屏保模式不渲染 Dock，也不开放用户内容到 Dock 的控制消息。

顶层 `room.css` 覆盖官方 DOM 是 v0.x 历史能力，与安全边界冲突。Room v2 宿主不加载 `room.css`，配置器也不再保存它。后续若恢复皮肤能力，必须转换成官方受管字段，不能重新执行任意 CSS。

## 一、数据契约：room.json 的 `dock` 节点

```jsonc
{
  "dock": {                          // 全局基线（所有桌默认），全部字段可选
    "enabled": true,                 // false = 整条 dock 隐藏（含 ‹ › 导航）
    "position": "bottom",            // bottom | top | left | right（缺省 bottom）
    "autoHide": false,               // Apple 式：空闲缩回屏幕边缘，指针靠近条带弹出
    "indicator": "text",             // text = "1 / 3 · 桌名" | dots = 圆点
    "style": {                       // 直接映射 CSS 变量，缺省 = 主题默认
      "bg": "rgba(20,20,20,0.55)",   //   --dock-bg
      "blur": 12,                    //   --dock-blur (px)
      "radius": "999px",             //   --dock-radius
      "gap": 16,                     //   --dock-gap (px)
      "pad": "10px 20px",            //   --dock-pad
      "icon": 40                     //   --dock-icon (px)
    },
    "icons": [                       // 常驻启动项，结构与桌面图标一致（无 x/y）
      {
        "label": "OpenCode",
        "icon_png": "<base64>",      // 真图标；缺省用 glyph+color 兜底
        "glyph": "🌐", "color": "#3b82f6",
        "action": "启动 OpenCode",    // 无 launch 时的 toast 文案
        "launch": { "target": "C:\\...\\OpenCode.exe", "args": "", "workdir": "..." }
      }
    ]
  },
  "desks": [
    {
      "name": "主页",
      "dock": {                       // 每桌覆盖（可选）：只写想不同的字段
        "icons": [ ... ]              //   icons 写 = 整组替换全局列表
      }                               //   其余字段继承全局
    }
  ]
}
```

### 合并规则（渲染器 `dockCfg()` 逐次读取，切桌即重算）

```
DEFAULT_DOCK ← 全局 room.dock ← desks[i].dock   （后到者覆盖）
style 按字段合并：{...全局.style, ...桌.style}
icons 桌级存在则整体替换（不追加）
```

### 宽容读取（守则：缺字段一律给默认值）

- 未知 position → bottom；indicator 非 text/dots → text
- `style` 全缺 → 主题默认（`--dext-dock-bg` 等）
- 老房间没有 `dock` 节点 → 渲染器表现与改动前完全一致（零破坏）

## 二、渲染器行为（wallpapers/dext-room）

| 函数 | 职责 |
|---|---|
| `dockCfg()` | 合并全局+桌级配置（见上），每次调用都读 `currentDesk` |
| `renderDock()` | 位置 class / autoHide class / style 变量写入（**未设置的变量用 removeProperty 清除**，防跨桌残留）；调 renderDockApps |
| `renderDockApps(cfg)` | 渲染常驻图标（真图标/emoji 兜底）、双击启动与运行状态圆点；真桌面编辑态不修改 Dock |
| 切桌链路 | `switchDesk` → `renderDesk` → `renderDock` → 该桌 dock 生效 |

### 层级（style.css）

```
toast 200 > text 转场 100 > video stinger 90 > #dock 20 > desk-staging 5 > 桌面
```
dock 在 z-index 20：转场时**始终可见**（stinger/文字转场是全屏覆盖，故意盖住）。

### 与外部通道的对接（UI 要用的接口）

| 通道 | 载荷 | 用途 |
|---|---|---|
| `dext:room` 消息（window message） | `{type:"dext:room", room:<完整v2>, deskIndex, assetBase}` | 仅 preview 模式接收固定父窗口消息；整房替换后重渲，dock 一并生效 |
| `persistRoom()` | `postMessage({type:"saveRoom", room:ROOM})` | 桌面图标位置与 Widget placement 编辑双写持久化；预览环境自动跳过 |

### DOCK-004 运行态遥测（不落盘）

Dock 图标的运行态不属于 `room.json`。图标点击仍发送既有 `msg_launch`；Core 成功代启后按
`launch.target` 进行宽容进程轮询，并经 Player 转发页面消息：

```jsonc
{ "type": "dext:app-status", "target": "C:\\Apps\\Demo.exe", "running": true }
```

渲染器只在内存集合中按启动目标（大小写不敏感）维护状态，并在对应 `.dock-icon` 上切换
`is-running` 类和绿色圆点。状态随当前渲染器实例/切 Desk 重绘，不参与 `persistRoom()`；Room
重新应用或重启后配置仍由 `room.json` 提供，运行态需重新由 Core 遥测确认。缺失/非法目标和进程
查询异常按宽容原则忽略，不影响现有 Dock 点击启动。

## 三、配置器对接点（tauri-ui，后续 UI 接线的锚点）

### 已就位

| 文件 | 内容 |
|---|---|
| `src/lib/dock.ts` | 唯一类型源：Dock 配置、三套 CSS 片段和 `DOCK_PRESET_CATALOG` 模板目录 |
| `src/components/DockLibrary.tsx` | 独立 Dock 模板库卡片 + Room 内 Dock 选择器；库内浏览不修改 Room |
| `src/components/DockEditor.tsx` | 仅用于具体 Room：应用库搜索与全局/每桌常驻应用、Dock 高级参数；per-desk 改动写回 `desks[i].dock` |
| `App.tsx` | Dock 数据写 `room.dock` / `desks[i].dock`；完整 v2 builder 同时用于保存和预览，并保留 `widgets` |
| `src-tauri/src/lib.rs` | Room v2 后端不提供 `save_room_css`；应用链不复制、宿主不执行顶层作者 CSS |

### DOCK-001 历史结果与 Room v2 修正

- HUD / Minimal / Glass 以受管标记块写入，不会删除作者在 room.css 中的其他样式。
- Dock 导航页只展示可复用模板卡片和详情，不绑定当前 Room，也不会因浏览模板而落盘。
- 进入具体 Room 编辑器后才显示“当前 Room Dock”；选择模板后写入该 Room 并同步预览。
- 全局/每桌 Dock 参数归入具体 Room 的折叠设置，不再混在模板库中。
- 旧 room.css 仅为历史文件，不读取、不保存、不复制，也不注入预览或真桌面。
- DXT-001 已移除预览 `roomCss` 载荷和宿主的 room.css 加载，防止用户内容覆盖官方 Dock/IPC DOM。
- 旧 `window.dext` 只剩官方顶层宿主的内部生命周期钩子；sandbox 用户内容无法访问，也不再作为 Room 作者接口。
- 浏览器 UI 设计模式只更新内存预览状态，不调用 Tauri invoke。

### DOCK-002 已完成

- DockEditor 直接复用配置器现有应用库，可按应用名称或启动路径搜索。
- “全局 Dock”写入 `room.dock.icons`；“当前 Desk”写入 `desks[i].dock.icons`，切换思维导图 Desk 时同步当前索引。
- 应用项按 `launch.target` 去重；写入 `label`、base64 `icon_png`、`action` 和完整的 `launch.target/args/workdir`。
- 当前 Desk 没有独立 `icons` 时展示继承的全局列表；第一次增删会复制当前有效列表并建立桌级覆盖，避免意外丢掉全局应用。
- 桌级列表可以“恢复跟随全局”，即删除该 Desk 的 `dock.icons` 覆盖；其他 Dock 参数不受影响。
- 添加、移除和恢复操作都会标记 Room 未保存，继续复用现有 Room 顶栏保存、重开和预览链。

### Dock 模板文件（独立模板格式）

Dock 页“新建”不是创建空模板，而是立即选择并导入 JSON 文件。最小格式：

```jsonc
{
  "version": 1,
  "name": "Neon Line",
  "description": "可选说明",
  "css": "#dock .dock-inner { ... }",
  "preview": {
    "backdrop": "#07101d",
    "surface": "rgba(5,12,24,.82)",
    "accent": "#7cecff"
  },
  "traits": ["霓虹", "深色"]
}
```

- `version/name/css` 必填；导入项保存在配置器本地模板库，重开仍存在。
- 模板只定义视觉 CSS 和卡片元数据；位置、图标、autoHide、每桌覆盖仍属于具体 Room。
- 详情“编辑”不会进入 Room：内置模板保存为本地副本，本地模板覆盖保存。
- 示例：`dev_docs/examples/dock-template-v1.json`。

### 待补（按独立工作包接线）

1. **真桌面 Dock 管理已关闭（DESK-EDIT-001）**：删除、尺寸切换及 Desk↔Dock 拖拽均不属于真桌面编辑态；统一在配置器 `DockEditor` 添加、移除和排序 Dock 图标。
2. **分享/下载 Dock 皮肤（后续重新设计）**：Room v2 zip 不携带或执行顶层 `room.css`；皮肤需先定义官方受管格式。
3. **运行态小圆点（DOCK-004，已完成）**：Core 进程遥测和 Dock 指示已通过人工验收并合入 master。
4. **模板发布与创意工坊（DOCK-LIB-001）**：补模板导出/版本更新；创意工坊下载项进入现有本地卡片库。

### DOCK-003 历史拖入消息与持久化（仅保留后端兼容链）

> 2026-08-29 实机限制：从桌面上方/侧面向 Dock 拖动会被图标层边界限制；从 Dock 下方进入虽能触发绿色命中反馈，释放后仍可能不落入。用户决定跳过该交互目标，当前正式维护入口改为配置器 `DockEditor`；真桌面双向拖拽的输入捕获与命中重做登记为远期 `DOCK-UX-001`。
> **2026-09-05 更新**：`DOCK-UX-001` 已实施一版（ghost/吸附带/统一结束事件）并真机复验，仍不稳定；用户决定**放弃真桌面拖入 Dock**，代码已 revert。配置器 `DockEditor` 继续是 Dock 图标管理的唯一正式入口。详见下节与 ERRORS #65。

历史版本在编辑模式下把桌面图标拖到 Dock 时曾发送以下消息；DESK-EDIT-001 已删除渲染器入口与发送方，当前真桌面不会再产生该消息：

```jsonc
{
  "type": "addDockIcon",
  "scope": "desk",             // 当前实现固定写入当前 Desk 的 Dock 覆盖
  "deskIndex": 0,
  "icon": {
    "label": "Edge",
    "icon_png": "<base64>",
    "glyph": "🌐", "color": "#3b82f6",
    "action": "启动 Edge",
    "launch": { "target": "...", "args": "", "workdir": "" }
  }
}
```

Player/Core 的 `MessageType.msg_add_dock_icon`、`LivelyMessageAddDockIconCmd` 和写盘处理暂时作为旧运行包兼容链保留，但官方渲染器没有调用者。当前 Dock 图标增删、排序及每桌覆盖只由配置器 `DockEditor` 写入 Room 草稿，再经统一保存/应用链生效。

### DOCK-UX-001 双向拖拽重做（2026-09-05 已取消）

用户拍板的交付口径：桌面→Dock 为**移动**语义、只写当前 Desk 的 `dock.icons` 覆盖、仅编辑模式、
autoHide 不动。实现（ghost 拖拽视觉 + Dock 吸附带命中 + pointerup/cancel/capture-loss 统一按最后
指针位置提交 + persistRoom 单一持久化）自动检查全绿，但真机复验仍不稳定，用户决定放弃该交互目标；
实现提交 `638ee0e` 已整体 revert（`de04a33`）。结论与后续条件见 ERRORS #65：
真桌面拖拽若重启，必须先立 WebView2 指针/WorkerW 命中的专项研究包，不再直接做交互实现。
Dock 图标管理的正式入口 = 配置器 `DockEditor`。

> 2026-09-11 DESK-EDIT-001 收口：真桌面删除尺寸按钮、图标删除按钮、投放提示和 Desk↔Dock 双向拖拽；Dock 在真桌面只负责展示、双击启动、运行圆点和 Desk 导航。

## 四、当前演示与验收状态

- 演示房间 `rooms/test-dock-hud/`：全局底部 + 两桌各自 icons（OpenCode/Steam 真图标），切桌只换应用、位置不动；autoHide 已关（功能保留）
- 鱼眼放大已整体移除（提交 ee56202，git 历史可恢复）
- 预览：`scripts/room-preview.ps1`（root=仓库根）→ `http://localhost:5174/wallpapers/dext-room/?room=../../rooms/test-dock-hud/`

## 原生v3模板编辑基础（2026-10-04，P6-002开发中）
当前v3使用components中role=dock及dockComponentId、Desk.components引用，不套用上述v2 dock节点。官方三栏/导航模板的template.json描述公开placement、参数、语义数据/按钮区域及示例；config.template保留描述，appearance为参数，enabledRegions为启用语义区域，slots为数据选择，buttonSlots映射稳定Root按钮ID。所有已开放time/hardware/media/audio只读源均可选，字段路径和解释方式由作者配置。
Desk.componentOverrides仅保存差异叶子，对象递归继承、null显式覆盖、数组整体替换；逐字段恢复删除差异，默认动作相同可恢复共享按钮。语义相同的模板替换保留组件/按钮ID；删除后重建新ID，其他图标/内容仍引用的按钮保留，旧资源池不丢。私人目标/皮肤不进Room，UI由后续P6-003接入。
Dock作者只能按实际DOM/resize报告自身buttons；occupied仍只属于roomScene，官方宿主按当前Desk所引用Dock的固定placement保留区域，让普通图标/Widget避让。不引用的Desk恢复自己的保存位置，不写个人布局、不重建共享组件。Core当前只读授权与实际Tauri/Core/Player验证在P6-002 Task3/4继续；浏览器夹具不计活体完成。
