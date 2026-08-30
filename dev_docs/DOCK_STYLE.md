# Dock v0.x 外观定制指南（历史，不适用于 room.json v1）

> 历史说明：以下内容记录 DXT-001 之前的 `room.css` / `room.js` 钩子，只用于回溯。
> room.json v1 的官方宿主不加载这两个顶层文件，作者与 AI 不得按本文生成新 Room；用户代码只能进入 background/start/switch/end 的 sandbox HTML。Dock 未来如需皮肤，必须使用尚待定义的官方受管格式。

## 零、快速上手（30 秒验证）

```powershell
scripts/room-preview.ps1 -Room <房名>     # 浏览器打开，热刷新
```

以下验证流程仅适用于历史分支；当前 v1 `apply_room` 会清理运行包中的 room.css，不能上线该样式。

配置器内置 HUD / Minimal / Glass 预设会自动维护
`/* dext-dock-skin:start ... */` 到 `/* dext-dock-skin:end */` 区块；切换预设只替换该区块，不删除作者的其他 CSS。

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

## 五、v1 之后怎么做

- 本文前四节只用于理解旧 Dock 外观和当前受管 `dock.style` 字段，不再是作者交付教程。
- 新 Room 不得生成顶层 `room.js` / `room.css`，也不能把 `window.dext` 当作用户接口。
- 当前可持久化的 Dock 外观只限 `DOCK.md` 已列出的受管字段；更完整的皮肤发布格式留给后续独立工作包。
