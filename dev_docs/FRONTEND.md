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
npm run dev:ui        # vite 端口 1621，自动开浏览器
```

- **VS Code 分屏**：Ctrl+Shift+P → "Simple Browser: Show" → `http://localhost:1621` → 拖到右侧
- 改 `src/App.tsx` / `src/*.css` → HMR 秒刷（无需重启）
- mock 数据在 `App.tsx` 顶部（MOCK_APPS/MOCK_ROOMS/MOCK_DESKS，canvas 生成彩色首字母图标）；
  要什么假数据直接改那里
- 预览按钮（dext:// iframe）在设计模式自动隐藏；保存/应用等 invoke 操作会报错——设计模式不管它们
- **注意**：`npm run tauri dev` 也占 1620 端口，设计模式用 1621，两者可并存

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
  - 视频背景/切桌动画/长按移动编辑 → 全部正常可用；尺寸切换、删除和 Desk↔Dock 拖拽已从真桌面移除
  - 配置器内嵌预览使用 `?preview=1`，只接受发布态 `http://tauri.localhost` 或开发态允许源的完整 v2 草稿和 `lib://` 素材根目录
  - 待机节点预览使用 `?preview=1&screensaver=1`，隐藏 Desk/Dock 并只显示 idle；缺少 idle 时为黑屏
  - 单独用 Vite 检查 sandbox HTML 时需开启 CORS；否则 Vite 注入的 `@vite/client` 会被 opaque origin 拒绝，生产运行不受影响

### 自动重排动画实验台与真实桌面（DESK-MOTION-001）

```powershell
# 仓库根；启动 127.0.0.1:5174 并打开独立实验台
npm run dev:motion

# 首次安装 Chromium（Windows 直接使用 npx，不依赖 Bash/WSL）
cd tauri-ui
npx playwright install chromium

# 自动启动 Vite，运行 renderer e2e
npm run test:renderer:e2e
```

实验台地址为 `http://127.0.0.1:5174/wallpapers/dext-motion-lab/`，提供 Widget 单/多图标让位、连续 revision、Sortable 图标路径重排、Dock 禁放、新增、移除、无解回弹、取消、reduced-motion 和 100 图标压力场景。它直接加载 `wallpapers/dext-room/layout.js` 与 `layout-motion.js`，不是演示副本。

Playwright 失败时在 `tauri-ui/test-results/renderer/` 保留 trace、截图和视频（Git 忽略）。测试文件必须留在 `tauri-ui/tests/renderer/`，否则 Node 不会从仓库级 `wallpapers/` 目录向下解析 `tauri-ui/node_modules`（ERRORS #70）。

实验台只验证运动规则与默认参数，不代表生产外观。阶段 B 已把同一求解器和动画引擎接入真实桌面；生产仍使用现有图标、Widget iframe、主题、编辑边框与 Dock，不复用实验台示例卡片。

### 图标反馈实验台（DESK-ICON-001）

```powershell
cd tauri-ui
npm run dev:icons
```

地址为 `http://127.0.0.1:5174/wallpapers/dext-icon-lab/`。实验台直接加载生产目录中的 `wallpapers/dext-room/icon-feedback.js` 与 `.css`，提供“图标光晕 / 紧凑内容框 / 纯净无边框”、默认直接交互、固定正常/悬停/按下/编辑/拖动诊断状态、名称显示、真实命中区、reduced-motion 和多背景检查。图标中心与名称基线固定；只有编辑和拖动产生运动。共享文件必须留在 `dext-room` 内，因为正式 WebView2 虚拟主机只映射该目录。

默认“交互”状态像 Widget 实验台一样直接操作真实命中框：hover 和 pointerdown 使用真实指针状态，短按选择当前 TARGET；长按 300ms 进入苹果式编辑抖动，编辑中拖动会托起并跟手，松手恢复原网格。此阶段不重排、不保存，双击真正画布空白退出编辑；透明网格边缘始终不响应。固定五状态只用于逐帧诊断对比。

布局定位格与实际命中区统一为同一个 footprint。显示名称时，小 72×80、标准 80×84、大 84×88；隐藏名称时收紧为 64×64、72×72、80×80。另有独立的小 48px、标准 56px、大 64px 图标视觉大小，切换只缩放图形/光晕，不改变 footprint 或 gap。紧凑、标准、宽松只控制 footprint 之间的 4×12、20×28、40×40 gap。五项参数由全局 Core 设置保存，不写入 Room Schema。DESK-PREFS-001 分支把共享视觉层接入真实 Room；原 `.icon` 仍拥有 pointer capture，内部 face/visual 仅装饰，偏好热切换不重挂 Widget iframe。浏览器实验台的命中区调试标记不进入生产外观。

阶段 A 用于浏览器调参与运动诊断，不代表真实壁纸外观。生产 DESK-PREFS-001 保持旧 500ms 长按进入编辑、松手后再次按下直接拖动；仅 `.icon-visual` 以 ±3° / 150ms 抖动，名称静止。关闭名称后稳定悬停 500ms 显示浮层，编辑、按下或拖动期间抑制。双击真正桌面空白才退出编辑。

设置页“偏好设置”的五项全局控制通过 Rust→Core→Player 投递带 revision 的 `dext:desktop-preferences`；Player loaded 快照 revision 0 不覆盖较新修改。桌面以 footprint 和 gap 重算列行；只搬冲突/越界图标，Widget/Dock 为障碍，移动时以 requestId 保存 Room 并等待 `dext:room-save-result`，失败回滚，结果未知只提示未确认。配置器新增应用读取同一五项设置计算网格；投递成功 UI 只说“已发送”，不等于渲染或保存成功。Windows 测试：`cd tauri-ui; npm test; npm run build; npm run test:renderer:e2e`，在仓库根运行 `node --test wallpapers/dext-room/icon-preferences-layout.test.cjs`。

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
│    ├─ #dock                   底部 Dock（常驻应用 / ‹ 指示器 › / ✓），不随动画动
│    ├─ .dext-scene-slot        start/switch/idle 的统一 image/video/html 覆盖层
│    ├─ #transition-video-wrap  历史 DOM，占位保留但当前 Room 不再直接使用
│    ├─ #transition             预设动画兼容层
│    └─ #toast
├─ style.css    顶部 :root 主题变量（--dext-*），改外观优先动这里
├─ layout.js    纯布局求解（Widget 优先避让 + 图标路径重排）
├─ layout-motion.js  稳定身份、diff、默认 MotionProfile 与 FLIP/WAAPI 控制器
├─ desktop-layout-controller.js  真实桌面稳定节点、输入事务、预览与提交协调器
└─ main.js      全部逻辑（无框架、无构建，保持这样）
```

### main.js 关键函数

| 函数 | 职责 |
|---|---|
| `loadRoom()` | 正常模式只读取 v2 并进入 startDesk；screensaver 模式只显示 idle；preview 模式等待 v2 内存草稿 |
| `renderDesk(index)` | 主层渲染入口 = mountBackground + renderIcons + Dock/指示器 |
| `mountBackground(bgEl, videoEl, desk)` | v2 Content/null：图片静态、视频循环、HTML sandbox 长驻 |
| `renderIcons(layer, desk, s)` | 当前生产按 `15147f2` 逐次重建图标，并为每个节点调用 `attachPress(el, i)`；热布局只重建图标层 |
| `attachPress / startDrag` | 500ms 长按进入编辑；编辑态第二次按下后直接按 pointer 更新 left/top，松手交换/落位并保存 |
| `startWidgetDrag` | Widget placement 与 icons 双快照事务；预览只动真实节点，有效松手后原子更新内存并持久化一次 |
| `enterEdit / exitEdit` | 编辑模式开关（body.editing 类驱动 CSS） |
| `dext:room-layout` | Core/Player 定向布局消息：替换目标 Desk 图标；当前 Desk 保留已挂载 Widget/Scene，新增时可直接进入编辑并高亮 |
| `dext:desktop-preferences` | Core/Player 仍可投递全局图标偏好快照；当前回退后的生产 Room 暂不消费，待后续稳定重新集成 |
| `resolveTransition / switchDesk` | 有向 edge → 房间默认 → slide；Content 完成后换 Desk，预设走原动画注册表 |
| `playSlot()` | start/switch 按完成语义播放；idle persistent 模式使图片常驻、视频循环、HTML持续运行 |
| `playVideoTransition()` | 保留原函数名的薄适配层，内部统一调用 playSlot，不再中点换页 |
| `persistRoom()` | 删除页面副本的 `__source` 后上行；preview 自动跳过，Core 使用包内可信戳双写 |
| `ICON_SIZES` | 大/中/小三档（图标、格子、字号联动） |

### layout.js / layout-motion.js / desktop-layout-controller.js 接口

| 接口 | 职责 |
|---|---|
| `createMotionItems(icons, positionOf)` | 规范化 launch 身份；兼容 action/label/glyph 并为重复签名追加序号 |
| `resolveIconReorder(icons, draggedIndex, target, grid, obstacles, reserved)` | 将拖起图标插入目标占位，沿路径顺移其他图标；Widget/Dock 障碍拒绝且不改输入 |
| `diffMotionItems(previous, next, excludeKeys)` | 计算 move/enter/exit/stay；被拖动节点仍落最终坐标但不做 FLIP move |
| `new DextLayoutMotion(container, options)` | 建立稳定 key→DOM 映射；调用方提供节点创建/更新和 reduced-motion 来源 |
| `apply(items, {mode, excludeKeys})` | 立即写最终 left/top，再执行 move/enter/exit；revision 中断从当前视觉位置续接 |
| `cancel({restore})` | 取消当前 revision；预览模式可按 300ms 回到进入预览前的完整布局 |
| `dispose()` | 取消动画并释放控制器拥有的节点与状态 |

当前生产时序恢复为 `15147f2` 的直接拖动：长按 500ms 进入编辑并按旧行为重建当前 Desk；松手后再次按住图标立即开始拖动，`pointermove` 直接写节点 left/top，不等待候选格，也没有 placeholder/FLIP 让位。`pointerup` 按指针所在格提交：空格直接落位，占用格两两交换，然后保存并重绘。图标层真正空白处双击退出；Widget 继续使用原有独立拖动/缩放逻辑。进入/退出编辑会重建图标与 Widget iframe，当前生产不消费五项新图标偏好，也没有新的 reduced-motion 装饰动画规则；这些能力只保留在两个浏览器实验台和后续重新集成代码中。

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
3. **编辑模式视觉**：移动反馈与进入/退出的过渡（目前是瞬变）；不再增加删除、尺寸或 Dock 投放控件
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
