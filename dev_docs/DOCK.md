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
| `src/lib/dock.ts` | 唯一类型源：Dock 配置、三套 CSS 片段和 `DOCK_PRESET_CATALOG` 模板目录 |
| `src/components/DockLibrary.tsx` | 独立 Dock 模板库卡片 + Room 内 Dock 选择器；库内浏览不修改 Room |
| `src/components/DockEditor.tsx` | 仅用于具体 Room 的高级参数；per-desk 改动写回 `desks[i].dock` |
| `App.tsx` | Dock 导航页挂模板库；Room 编辑器内才挂选择器和参数设置；打开/保存/预览继续走 room.json + room.css |
| `src-tauri/src/lib.rs` | `save_room_css(room_dir, css)` 校验目录含 room.json 后覆盖写 room.css |

### DOCK-001 已完成（待用户验收）

- HUD / Minimal / Glass 以受管标记块写入，不会删除作者在 room.css 中的其他样式。
- Dock 导航页只展示可复用模板卡片和详情，不绑定当前 Room，也不会因浏览模板而落盘。
- 进入具体 Room 编辑器后才显示“当前 Room Dock”；选择模板后写入该 Room 并同步预览。
- 全局/每桌 Dock 参数归入具体 Room 的折叠设置，不再混在模板库中。
- 重开 Room 会读取既有 room.css，并从受管标记恢复当前预设高亮。
- 配置器预览通过 `dext:room` 消息附带 roomCss；预览专用 `<style>` 隔离覆盖包内旧样式，不影响真桌面加载流程。
- 浏览器 UI 设计模式只更新内存预览状态，不调用 Tauri invoke。

### 待补（UI 接线时按此清单做）

1. **应用库选择器（DOCK-002）**：DockEditor 加应用搜索勾选，选中后写入全局或每桌 icons。
2. **拖拽进 Dock（DOCK-003）**：渲染器编辑模式拖桌面图标到 dock 区 → 新上行消息 → Core 落盘。
3. **分享/下载 Dock 皮肤（ROOM-001）**：随房间导出 zip 一起，room.css 必须在导出清单内。
4. **运行态小圆点（DOCK-004）**：需要 Core 进程遥测。
5. **模板文件与创意工坊（DOCK-LIB-001）**：把内置目录扩展为本地模板文件；下载项进入同一卡片库，模板编辑/版本更新独立验收。

## 四、当前演示与验收状态

- 演示房间 `rooms/test-dock-hud/`：全局底部 + 两桌各自 icons（OpenCode/Steam 真图标），切桌只换应用、位置不动；autoHide 已关（功能保留）
- 鱼眼放大已整体移除（提交 ee56202，git 历史可恢复）
- 预览：`scripts/room-preview.ps1`（root=仓库根）→ `http://localhost:5174/wallpapers/dext-room/?room=../../rooms/test-dock-hud/`
