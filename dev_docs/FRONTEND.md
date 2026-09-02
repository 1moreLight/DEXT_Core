# Dext 前端开发指南

> 本项目有**两个前端**，工作流不同，别混：
> ① **配置器**（tauri-ui/，React+TS+Tailwind）→ 设计模式见「第零节」
> ② **桌面渲染器**（wallpapers/dext-room/，纯 HTML/JS/CSS）→ 见「第一节」及以后

## 当前架构：官方宿主 + 用户内容（DXT-002）

- DXT-001 已原地扩展现有宿主；原 SCENE-001 已并入，不另写重复播放器。
- 官方宿主继续拥有 Desk、Dock、图标、导航、编辑、IPC、保存和关闭流程；Lively Core 负责待机检测和唤醒。
- 用户内容只挂载在 background/start/switch/idle 的受控容器中，不能替换官方宿主。
- 四类内容统一写 `name/type/src`，类型为 image/video/html；运行时由官方 HTML 宿主承载。
- 图片保持纯静态：background 长驻，start/switch 固定显示 0.5 秒，idle 持续显示到唤醒，不叠加默认动效。
- switch 视频完整播放后才换 Desk；HTML 通过受控 ready/换页/完成消息通信。
- 顶层 room.js/room.css、action、旧 transition/transitions 和视频中点换页均不再读取。
- 用户 HTML 固定进入 `sandbox="allow-scripts"`；只用当前实例 `dext:scene ready/done` 消息，不接触官方 IPC。

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
  - 配置器内嵌预览使用 `?preview=1`，只接受发布态 `http://tauri.localhost` 或开发态允许源的完整 v2 草稿和 `lib://` 素材根目录
  - 待机节点预览使用 `?preview=1&screensaver=1`，隐藏 Desk/Dock 并只显示 idle；缺少 idle 时为黑屏
  - 单独用 Vite 检查 sandbox HTML 时需开启 CORS；否则 Vite 注入的 `@vite/client` 会被 opaque origin 拒绝，生产运行不受影响

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
│    ├─ .dext-scene-slot        start/switch/idle 的统一 image/video/html 覆盖层
│    ├─ #transition-video-wrap  历史 DOM，占位保留但当前 Room 不再直接使用
│    ├─ #transition             预设动画兼容层
│    └─ #toast
├─ style.css    顶部 :root 主题变量（--dext-*），改外观优先动这里
└─ main.js      全部逻辑（无框架、无构建，保持这样）
```

### main.js 关键函数

| 函数 | 职责 |
|---|---|
| `loadRoom()` | 正常模式只读取 v2 并进入 startDesk；screensaver 模式只显示 idle；preview 模式等待 v2 内存草稿 |
| `renderDesk(index)` | 主层渲染入口 = mountBackground + renderIcons + 指示器 + 尺寸按钮高亮 |
| `mountBackground(bgEl, videoEl, desk)` | v2 Content/null：图片静态、视频循环、HTML sandbox 长驻 |
| `renderIcons(layer, desk, s)` | 图标循环：坐标钳制、真图标/emoji 兜底、双击启动、删除钮、长按 |
| `attachPress / startDrag` | 长按 500ms 进编辑；编辑态拖拽（稀疏格子，占用格交换） |
| `enterEdit / exitEdit` | 编辑模式开关（body.editing 类驱动 CSS） |
| `resolveTransition / switchDesk` | 有向 edge → 房间默认 → slide；Content 完成后换 Desk，预设走原动画注册表 |
| `playSlot()` | start/switch 按完成语义播放；idle persistent 模式使图片常驻、视频循环、HTML持续运行 |
| `playVideoTransition()` | 保留原函数名的薄适配层，内部统一调用 playSlot，不再中点换页 |
| `persistRoom()` | 删除页面副本的 `__source` 后上行；preview 自动跳过，Core 使用包内可信戳双写 |
| `ICON_SIZES` | 大/中/小三档（图标、格子、字号联动） |

## 四、room.json v2 示例

```jsonc
{
  "version": 2,
  "startDesk": 0,
  "switch": "slide",
  "switches": {
    "0>1": { "name": "进入游戏", "type": "video", "src": "switch/to-game.mp4" },
    "1>0": "fade"
  },
  "desks": [
    {
      "name": "Desk 1",
      "background": { "name": "主页", "type": "image", "src": "background/x.png" },
      "iconSize": "medium",
      "icons": [
        {
          "label": "Edge",
          "x": 0, "y": 0,                        // 稀疏格子坐标（行优先，列数随尺寸/屏宽动态）
          "icon_png": "<base64 png 可选>",
          "glyph": "🌐", "color": "#3b82f6",     // 无 icon_png 的兜底
          "action": "启动 浏览器",
          "launch": { "target": "...", "args": "", "workdir": "" }
        }
      ],
      "widgets": []
    }
  ]
}
```

源 Room 严禁 `__source`；只有 Rust 应用后的运行包带该戳。完整封闭字段和路径规则见 `MODEL.md` / `room-v2.schema.json`。

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
6. **内容骨架样例**：为作者提供 background/start/switch/idle Scene 和 Widget HTML 骨架与消息示例
7. **多分辨率**：1366/1920/2560 宽下图标密度与 Dock 尺寸检查

## 七、纪律（务必）

- **不引入**构建步骤、框架、npm 依赖——渲染器保持纯静态三件套
- **不破坏**三个守卫：IPC postMessage 守卫、宽容读取（缺字段给默认）、persistRoom 预览跳过
- **禁止裸 catch**（ERRORS #13）；改完 node --check main.js
- 每轮：TODO 计划先行 → 预览自测 → 真桌面复验 → ACCEPTANCE.md 清单 → commit
- 配置器（tauri-ui/）是另一个前端，别和渲染器混着改；两边共享的只有 room.json
