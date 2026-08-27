# Dock 外观定制指南（给 AI / 房间作者的样式接口）

> 目标：**不动渲染器、不动后端**，只靠房间自带文件就能把 Dock 改成任何样子。
> 机制：渲染器加载房间时自动注入 `room.css`（样式层）+ `room.js`（脚本层），
> 出错自动隔离不影响渲染器。本文档列出全部可覆写的钩子，AI 或作者按此生成样式代码即可。

## 零、快速上手（30 秒验证）

```powershell
scripts/room-preview.ps1 -Room <房名>     # 浏览器打开，热刷新
```

在 `<房名>/room.css` 写任意覆写 → 保存 → 浏览器即时生效 → 满意后配置器「应用」上线。
（`apply_room` 已随包拷贝 room.css，**后端零改动**。）

## 一、DOM 骨架（可覆写钩子全集）

```html
<div id="dock" class="dock-bottom dock-autohide dots has-apps">   <!-- 定位层：JS 管 class，别改它的定位 -->
  <div class="dock-inner">                                         <!-- 视觉壳：所有外观都改这里 -->
    <div id="dock-apps">                                           <!-- 常驻图标区 -->
      <div class="dock-icon"><img class="icon-img" 或 <div class="icon-glyph">…<button class="icon-del dock-icon-del">×</div>
      <div class="dock-sep"></div>                                 <!-- 分隔线（有图标才显示） -->
    </div>
    <button id="prev-desk" class="dock-btn">‹</button>             <!-- 切桌按钮 -->
    <span id="desk-indicator">1 / 3 · 主页</span>                  <!-- 指示器：文字 或 <i> 圆点 -->
    <button id="next-desk" class="dock-btn">›</button>
    <div id="size-group"><button class="size-btn" data-size="large|medium|small">大/中/小</button></div>
    <button id="edit-done" class="dock-btn">✓</button>
  </div>
</div>
```

## 二、CSS 变量（room.json `dock.style` 映射到 #dock，缺省即默认值）

| 变量 | 默认 | 说明 |
|---|---|---|
| `--dock-bg` | `var(--dext-dock-bg)` = rgba(20,20,20,0.55) | 背景色 |
| `--dock-blur` | `12px` | 毛玻璃 |
| `--dock-radius` | `999px` | 圆角 |
| `--dock-gap` | `16px` | 元素间距 |
| `--dock-pad` | `10px 20px` | 内边距 |
| `--dock-icon` | `40px` | 图标尺寸 |

全局主题令牌（style.css `:root`）：`--dext-accent` / `--dext-success` / `--dext-danger` / `--dext-text` / `--dext-dock-bg` / `--dext-dock-hover` / `--dext-btn-bg` / `--dext-radius`。

## 三、状态类（JS 按配置/交互切换，选择器里直接用）

| 类 | 触发条件 | 常配的覆写 |
|---|---|---|
| `.dock-bottom/.dock-top/.dock-left/.dock-right` | 挂在 `#dock` | 竖排布局、贴边微调 |
| `.dock-autohide` | autoHide:true | 边缘悬停条带 `#dock.dock-autohide::before` |
| `.dots` | indicator:"dots" | 圆点样式 `#desk-indicator i` / `i.on` |
| `.has-apps` | 有常驻图标 | 分隔线显隐 |
| `body.editing` | 编辑模式 | 抖动动画/删除徽章显隐（`body.editing .dock-icon` 等） |

## 四、配方示例（AI 生成样式的参考模板）

```css
/* 1) 直角深色任务栏风 */
#dock .dock-inner { border-radius: 0; padding: 6px 24px; background: rgba(0,0,0,0.85); }

/* 2) 霓虹描边胶囊 */
#dock .dock-inner { border: 1px solid rgba(56,189,248,0.6); box-shadow: 0 0 18px rgba(56,189,248,0.35), inset 0 0 12px rgba(56,189,248,0.12); }
.dock-icon .icon-glyph { border: 1px solid rgba(56,189,248,0.5); }

/* 3) 换字体（HUD 风，参照 rooms/cockpit-room/room.css） */
#dock { font-family: Consolas, monospace; letter-spacing: 0.2em; }

/* 4) 顶部细条 dock */
#dock.dock-top .dock-inner { border-radius: 0 0 12px 12px; padding: 4px 20px; gap: 12px; }

/* 5) 圆点指示器改形状 */
#dock.dots #desk-indicator i { width: 6px; height: 6px; border-radius: 2px; background: #888; }
#dock.dots #desk-indicator i.on { background: var(--dext-accent); transform: scale(1.4); }

/* 6) 隐藏分隔线/导航（想当纯 App 坞用） */
#dock .dock-sep { display: none; }
```

## 五、脚本层 room.js（`window.dext` 契约，详见 MODEL.md §6）

```js
window.dext.onReady(({deskCount}) => {})                 // 房间就绪
window.dext.onDeskChange(({from,to,dir,phase}) => {})    // 切桌（phase: before/after）
window.dext.onEditChange(({editing}) => {})              // 进出编辑模式
window.dext.getRoom()                                    // 当前 room 对象（含 dock 配置）
window.dext.getCurrentDesk()                             // 当前桌下标
// 自定义事件：dext:slot（start/end/switch 槽）、dext:switch（切桌动画分派）
```

适合：dock 图标进场动画、切桌时 dock 高亮过渡、按桌显示不同 dock 尾巴。

## 六、AI 生成样式的交付工作流

1. 读本文档 + `DOCK.md`（数据契约）+ 目标房间的 room.json（看现有 dock 配置）
2. 只生成两个文件：`room.css`（覆写钩子见上表）`room.js`（可选脚本）
3. 自检：`node --check room.js`（如有 JS）；CSS 用浏览器 devtools 验证
4. 预览：`scripts/room-preview.ps1 -Room <房名>`，切桌/编辑模式都过一遍
5. 上线：配置器「应用」→ `apply_room` 自动带上两个文件（后端不用动）

## 七、界限（别越界）

- **别改** `#dock` 的 `position/left/bottom/transform`（定位由 JS 的 position 配置管）；要改布局改 `.dock-inner`
- **别改** `wallpapers/dext-room/style.css`——那是所有房间共享的渲染器本体，皮肤一律走房间 room.css
- room.js 抛错会被隔离（不影响渲染器），但别依赖窗口级 `chrome.webview` IPC（那是渲染器专属）
- 配置器「皮肤预设」（DOCK.md 三节）将来会把预设片段写进 room.css，与手工写不冲突
