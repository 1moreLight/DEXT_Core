# Dock 模块契约（2026-08-27 定稿 v0）

> 本文档是 Dock 功能（常驻图标区 + 样式自定义）的唯一接口说明。
> 数据层只有 room.json；渲染器全在 `wallpapers/dext-room/main.js`；配置器在 `tauri-ui/src/`。

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
| `renderDockApps(cfg)` | 渲染常驻图标（真图标/emoji 兜底）、编辑模式 × 删除（splice 后 persistRoom） |
| 切桌链路 | `switchDesk` → `renderDesk` → `renderDock` → 该桌 dock 生效 |

### 层级（style.css）

```
toast 200 > text 转场 100 > video stinger 90 > #dock 20 > desk-staging 5 > 桌面
```
dock 在 z-index 20：转场时**始终可见**（stinger/文字转场是全屏覆盖，故意盖住）。

### 与外部通道的对接（UI 要用的接口）

| 通道 | 载荷 | 用途 |
|---|---|---|
| `dext:room` 消息（window message） | `{type:"dext:room", room:{desks, dock}, deskIndex}` | 配置器实时预览注入；整房替换后重渲，dock 一并生效 |
| `persistRoom()` | `postMessage({type:"saveRoom", room:ROOM})` | 桌面编辑（含 dock 删图标）双写持久化；预览环境自动跳过 |
| `window.dext` | getRoom()/onDeskChange 等（MODEL.md §6） | 房间脚本读取 dock 配置 |

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
| `App.tsx` | Dock 导航页挂模板库；Room 编辑器内才挂选择器和参数设置；打开/保存/预览继续走 room.json + room.css |
| `src-tauri/src/lib.rs` | `save_room_css(room_dir, css)` 校验目录含 room.json 后覆盖写 room.css |

### DOCK-001 已完成

- HUD / Minimal / Glass 以受管标记块写入，不会删除作者在 room.css 中的其他样式。
- Dock 导航页只展示可复用模板卡片和详情，不绑定当前 Room，也不会因浏览模板而落盘。
- 进入具体 Room 编辑器后才显示“当前 Room Dock”；选择模板后写入该 Room 并同步预览。
- 全局/每桌 Dock 参数归入具体 Room 的折叠设置，不再混在模板库中。
- 重开 Room 会读取既有 room.css，并从受管标记恢复当前预设高亮。
- 配置器预览通过 `dext:room` 消息附带 roomCss；预览专用 `<style>` 隔离覆盖包内旧样式，不影响真桌面加载流程。
- 浏览器 UI 设计模式只更新内存预览状态，不调用 Tauri invoke。

### DOCK-002 已实现（待用户验收）

- DockEditor 直接复用配置器现有应用库，可按应用名称或启动路径搜索。
- “全局 Dock”写入 `room.dock.icons`；“当前 Desk”写入 `desks[i].dock.icons`，切换思维导图 Desk 时同步当前索引。
- 应用项按 `launch.target` 去重；写入 `label`、base64 `icon_png`、`action` 和完整的 `launch.target/args/workdir`。
- 当前 Desk 没有独立 `icons` 时展示继承的全局列表；第一次增删会复制当前有效列表并建立桌级覆盖，避免意外丢掉全局应用。
- 桌级列表可以“恢复跟随全局”，即删除该 Desk 的 `dock.icons` 覆盖；其他 Dock 参数不受影响。
- 添加、移除和恢复操作都会标记 Room 未保存，继续复用现有 Room 顶栏保存、重开和预览链。

### Dock 模板文件 v1

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

1. **拖拽进 Dock（DOCK-003，已实现待验收）**：渲染器编辑模式拖桌面图标到 dock 区 → `addDockIcon` 上行消息 → Core 落盘。
2. **分享/下载 Dock 皮肤（ROOM-001）**：随房间导出 zip 一起，room.css 必须在导出清单内。
3. **运行态小圆点（DOCK-004，待验收）**：Core 进程遥测已接入，待人工验收及时清除与多 Desk 刷新。
4. **模板发布与创意工坊（DOCK-LIB-001）**：补模板导出/版本更新；创意工坊下载项进入现有本地卡片库。

### DOCK-003 拖入消息与持久化

编辑模式下，桌面图标拖到 Dock 的可见 drop 区会按启动目标去重，并发送：

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

Player 将其转换为 `MessageType.msg_add_dock_icon` / `LivelyMessageAddDockIconCmd`，Core 在包内 `room.json` 的 `desks[deskIndex].dock.icons` 追加完整图标与启动信息；若目标已存在或启动目标为空则跳过。写包内成功后，读取 `__source` 并按目录/文件两种形态同步源房间。预览环境没有 `window.chrome.webview`，只更新内存预览，不触发写盘。

同一编辑模式下也支持 Dock → 桌面：拖动 Dock 图标到桌面网格的虚线 drop 区，会将图标完整复制回当前 Desk 的 `icons` 并从当前 Desk Dock 移除；继承全局 Dock 的图标通过建立桌级覆盖实现“只从当前 Desk 移出”，不会影响其他 Desk。目标位置已有桌面图标或启动目标重复时保持原 Dock 不变。

## 四、当前演示与验收状态

- 演示房间 `rooms/test-dock-hud/`：全局底部 + 两桌各自 icons（OpenCode/Steam 真图标），切桌只换应用、位置不动；autoHide 已关（功能保留）
- 鱼眼放大已整体移除（提交 ee56202，git 历史可恢复）
- 预览：`scripts/room-preview.ps1`（root=仓库根）→ `http://localhost:5174/wallpapers/dext-room/?room=../../rooms/test-dock-hud/`
