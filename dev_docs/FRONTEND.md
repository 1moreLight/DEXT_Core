# Dext 前端开发指南

> 本项目有**两个前端**，工作流不同，别混：
> ① **配置器**（tauri-ui/，React+TS+Tailwind）→ 设计模式见「第零节」
> ② **桌面渲染器**（wallpapers/dext-room/，纯 HTML/JS/CSS）→ 见「第一节」及以后

## 目标架构：官方宿主 + 用户 Scene（尚未实现）

- 本文后面的函数表描述当前 v0.x 渲染器；目标架构由 ROADMAP 的 DXT-001 / SCENE-001 分两包落地。
- 官方宿主继续拥有 Desk、Dock、图标、导航、编辑、IPC、保存和关闭流程。
- 用户内容只挂载在 background/start/switch/end 的受控 Scene 容器中，不能替换官方宿主。
- 四类 Scene 都支持 image/video/html；类型保留在 room.json，运行时由官方 HTML 宿主统一承载。
- 图片可由官方宿主加轻微动态效果；视频由宿主管理播放；HTML 通过受控 ready/swap/done 生命周期通信。
- 当前 `cockpit-room`、start/end HTML 槽可复用作验证基础；background、switch、隔离与消息校验仍需 SCENE-001 实现。
- 顶层 `room.js` / `room.css` 是当前 v0.x 能力，与目标安全边界存在冲突；在 SCENE-001 定稿兼容策略前，不把它作为新 Room 的推荐扩展方式。

## 零、配置器 UI 设计模式（React，mock 数据）

配置器依赖 Tauri IPC（invoke），纯浏览器里会全挂——所以内置了 **mock 设计模式**：
检测到非 Tauri 环境（浏览器）时自动填充假应用/假房间/假 Desk，界面完整可交互，专供 UI 设计。

```powershell
cd tauri-ui
npm run dev:ui        # vite 端口 1421，自动开浏览器
```

- **VS Code 分屏**：Ctrl+Shift+P → "Simple Browser: Show" → `http://localhost:1421` → 拖到右侧
- 改 `src/App.tsx` / `src/*.css` → HMR 秒刷（无需重启）
- mock 数据在 `App.tsx` 顶部（MOCK_APPS/MOCK_ROOMS/MOCK_DESKS，canvas 生成彩色首字母图标）；
  要什么假数据直接改那里
- 预览按钮（dext:// iframe）在设计模式自动隐藏；保存/应用等 invoke 操作会报错——设计模式不管它们
- **注意**：`npm run tauri dev` 也占 1420 端口，设计模式用 1421，两者可并存

## 一、桌面渲染器实时预览

### VS Code 内分屏（推荐：左边代码右边 UI，不离开编辑器）

```
1. 起服务：  cd tauri-ui && npm run dev:room   （桌面渲染器，5174；root=仓库根，rooms/ 可直接 fetch）
2. Ctrl+Shift+P → "Simple Browser: Show" → 填 http://localhost:5174/wallpapers/dext-room/
   想看指定房间：http://localhost:5174/wallpapers/dext-room/?room=../../rooms/<房间名>/
3. 预览标签页拖到右侧分屏 → 左改代码右实时变（Vite HMR 生效）
```

> ⚠️ room 参数路径是相对渲染器页面解析的，**必须写成 `../../rooms/<名>/`**；
> vite root 必须为仓库根（见 scripts/room-preview.ps1），否则 `/rooms/...` 会走 SPA
> fallback 返回 HTML，room.json 解析失败 → 静默用 DEFAULT_ROOM（ERRORS #23）。

也可装微软 Live Preview 扩展：对 index.html 右键 Show Preview（仅渲染器适用）。

```powershell
# 独立浏览器方式（效果相同）
scripts\room-preview.ps1
```

- 改 `index.html` / `style.css` / `main.js` 任意文件 → 浏览器**即时刷新**，无构建步骤
- **不需要 Lively 运行**，不需要核心，纯前端
- 预览环境差异（都是设计好的守卫，别"修"它们）：
  - 双击图标 → toast 提示"不在 Lively 环境内"（IPC 守卫，不会真启动应用）
  - 编辑保存 → `persistRoom()` 静默跳过（不写盘）
  - 视频背景/切桌动画/长按编辑/尺寸切换 → 全部正常可用

## 二、验证到真桌面

预览满意后：配置器「重新应用」或重启 Lively（渲染器文件就是壁纸包内文件，重载即生效）。
改了 C#/.proto 才需要 `scripts/build.ps1`——纯前端永远不用。

## 三、文件结构

```
wallpapers/dext-room/
├─ index.html   DOM 骨架：
│    #desk
│    ├─ #desk-viewport          切桌动画的舞台（overflow hidden）
│    │   ├─ #desk-main          当前桌（.desk-video + .desk-bg + .icon-layer）
│    │   └─ #desk-staging       过渡时"来客桌"挂这里，动画完清空
│    ├─ #dock                   底部 Dock（‹ 指示器 › / 大中小 / ✓），不随动画动
│    ├─ #transition-video-wrap  视频转场覆盖层（stinger）
│    ├─ #transition             旧式黑屏文案转场（transition=text 时用）
│    └─ #toast
├─ style.css    顶部 :root 主题变量（--dext-*），改外观优先动这里
└─ main.js      全部逻辑（无框架、无构建，保持这样）
```

### main.js 关键函数

| 函数 | 职责 |
|---|---|
| `loadRoom()` | fetch room.json，缺省用 DEFAULT_ROOM，宽容读取 |
| `renderDesk(index)` | 主层渲染入口 = mountBackground + renderIcons + 指示器 + 尺寸按钮高亮 |
| `mountBackground(bgEl, videoEl, desk)` | 背景多态：字符串=图片路径 / `{type:"video",src}`=视频 / 空=黑底 |
| `renderIcons(layer, desk, s)` | 图标循环：坐标钳制、真图标/emoji 兜底、双击启动、删除钮、长按 |
| `attachPress / startDrag` | 长按 500ms 进编辑；编辑态拖拽（稀疏格子，占用格交换） |
| `enterEdit / exitEdit` | 编辑模式开关（body.editing 类驱动 CSS） |
| `switchDesk(delta)` | delta 即方向（+1/-1）；按 transitionSpec 分发到注册表/视频/文字 |
| `TRANSITIONS` | **动画注册表（扩展接口）**：`{ dur, run(stage, dir, done), cleanup }`，现有 slide/fade/zoom/none；视频转场是特例 `playVideoTransition`（stinger：播到一半换桌） |
| `persistRoom()` | postMessage → Player → Core 双写（包内 + 源房间），预览环境自动跳过 |
| `ICON_SIZES` | 大/中/小三档（图标、格子、字号联动） |

## 四、当前 schema（v0.x，宽容读取：缺字段必须给默认值）

```jsonc
{
  "desks": [
    {
      "name": "Desk 1",
      "background": "background/x.png"          // 或 {"type":"video","src":"background/x.mp4"} 或 ""
      "iconSize": "medium",                      // large | medium | small，缺省 medium
      "icons": [
        {
          "label": "Edge",
          "x": 0, "y": 0,                        // 稀疏格子坐标（行优先，列数随尺寸/屏宽动态）
          "icon_png": "<base64 png 可选>",
          "glyph": "🌐", "color": "#3b82f6",     // 无 icon_png 的兜底
          "action": "启动 浏览器",
          "launch": { "target": "...", "args": "", "workdir": "" }
        }
      ]
    }
  ],
  "transition": "slide",                         // 或 {"type":"video","src":"transition/x.mp4"}
  "__source": "D:\\...\\rooms\\my-room"          // 配置器盖的戳，桌面编辑双写用，渲染器别动它
}
```

## 五、主题变量（改外观的第一入口）

```css
:root {
  --dext-accent: #3b82f6;      /* 主色 */
  --dext-success: #10b981;     /* 完成/激活（绿） */
  --dext-danger: #ef4444;      /* 删除（红） */
  --dext-text: #ffffff;
  --dext-dock-bg: rgba(20, 20, 20, 0.55);
  --dext-dock-hover: rgba(255, 255, 255, 0.28);
  --dext-btn-bg: rgba(255, 255, 255, 0.12);
  --dext-radius: 12px;
}
```

## 六、外观打磨任务池（本会话的工作内容，做完打标）

1. **Dock 精致化**：间距/圆角/毛玻璃参数、按钮 hover 反馈层次、指示器排版
2. **图标交互态**：hover 底衬与缩放反馈、label 阴影可读性、选中/拖拽中的视觉
3. **编辑模式视觉**：抖动幅度节奏、删除钮尺寸、进入/退出的过渡（目前是瞬变）
4. **排版**：label 字体栈（现 Segoe UI/微软雅黑）、字重、行高、多行截断
5. **空状态**：无图标 desk 的引导提示、无背景 desk 的黑底质感（可加微妙渐变噪点）
6. **过渡打磨**：slide 曲线/视差比例参数化、stinger 视频的 swapAt 可配（现固定 50%）
7. **多分辨率**：1366/1920/2560 宽下图标密度与 Dock 尺寸检查

## 七、纪律（务必）

- **不引入**构建步骤、框架、npm 依赖——渲染器保持纯静态三件套
- **不破坏**三个守卫：IPC postMessage 守卫、宽容读取（缺字段给默认）、persistRoom 预览跳过
- **禁止裸 catch**（ERRORS #13）；改完 node --check main.js
- 每轮：TODO 计划先行 → 预览自测 → 真桌面复验 → ACCEPTANCE.md 清单 → commit
- 配置器（tauri-ui/）是另一个前端，别和渲染器混着改；两边共享的只有 room.json
