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

## 三、配置器对接点（tauri-ui，后续 UI 接线的锚点）

### 已就位

| 文件 | 内容 |
|---|---|
| `src/lib/dock.ts` | 唯一类型源：`DockConfig` / `DockStyle` / `DockIconItem` / `DEFAULT_DOCK` / `DEFAULT_DOCK_STYLE` / `DOCK_SKIN_PRESETS`（hud/minimal/glass 三套 room.css 片段） |
| `src/components/DockEditor.tsx` | 编辑面板，props 契约：`{dock, setDock, desks, setDesks, activeDesk, touch, setStatus}`；per-desk 改动通过 `setDesks` 写回 `desks[i].dock` |
| `App.tsx` | `openRoom` 读 `room.dock`+`desks[].dock`；`saveRoom` 写 `{desks, dock, switch}`；`postRoom` 预览注入带 dock；编辑页 nav 「Dock」已挂 DockEditor |

### 待补（UI 接线时按此清单做）

1. **皮肤写入房间**：`DOCK_SKIN_PRESETS[name]` 目前只存 `localStorage` 标记；需要新增后端命令 `save_room_css(room_dir, css)` 写房间的 `room.css`（渲染器 `loadRoomAsset` 已自动加载 room.css，无需改渲染器）
2. **应用库选择器**：DockEditor 加 `apps: AppInfo[]` prop + 搜索勾选（复用 App.tsx 的 library 数据与 `mockIcon`/`resolve_app` 流程），选中 → `patchDeskIcon`/追加 icons（结构见 `DockIconItem`）
3. **拖拽进 Dock**：渲染器编辑模式拖桌面图标到 dock 区 → postMessage 新消息（如 `{type:"dockAdd", icon}`），Core 落盘；当前只能通过配置器/room.json 加
4. **分享/下载 Dock 皮肤**：随房间导出 zip 一起（room.css 在导出清单内）
5. **运行态小圆点**（Apple 运行指示）：需要 Core 进程遥测，未做

## 四、当前演示与验收状态

- 演示房间 `rooms/test-dock-hud/`：全局底部 + 两桌各自 icons（OpenCode/Steam 真图标），切桌只换应用、位置不动；autoHide 已关（功能保留）
- 鱼眼放大已整体移除（提交 ee56202，git 历史可恢复）
- 预览：`scripts/room-preview.ps1`（root=仓库根）→ `http://localhost:5174/wallpapers/dext-room/?room=../../rooms/test-dock-hud/`
