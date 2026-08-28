# Dext 全景开发路线图（按端区分）

> 创建：2026-08-28。本文件是**唯一**的全景任务清单，按前端/后端/跨端/契约分层；
> 与 `TODO.md`（总台账·当前轮）配套：TODO 管「正在做」，本文件管「全貌与优先级」。
> 状态标记：`[x]` 完成 · `[~]` 进行中 · `[ ]` 计划中 · `[!]` 受阻

## 一、总览

```
┌─ 前端（2 个）──────────────────────────────┐
│ ① 配置器 tauri-ui/（React+TS+Tailwind）      │
│ ② 渲染器 wallpapers/dext-room/（纯静态三件套）│
├─ 后端（2 个）──────────────────────────────┤
│ ③ Rust tauri-ui/src-tauri/（Tauri 命令+gRPC）│
│ ④ C# lively-core-separation/（Lively fork）  │
├─ 契约 room.json ────────────────────────────┤
│ ⑤ 唯一交换格式；schema v1 定稿中             │
└─────────────────────────────────────────────┘
```

优先级定义：**P0 = 当前阶段（R10 收尾）** · P1 = 下一批（Dock 接线）· P2 = 分享与校验 · P3 = 远期。

---

## 二、前端任务

### A. 配置器（tauri-ui/src/，React）

| # | 任务 | 优先级 | 状态 | 说明 |
|---|---|---|---|---|
| A1 | hasStart 开关 UI | P0 | [ ] | state `hasStart` 已有，缺 UI 开关；TODO「R10 收尾」 |
| A2 | **边级转场落盘** ⭐ | P0 | [ ] | `saveRoom` 补写 `switches`、`openRoom` 读回 seedEdges。**纯前端**：渲染器 `resolveTransition` 已读 `switches`（main.js），后端 write_room 通用无需动 |
| A3 | 几何测量接入导图布局 | P0 | [ ] | `geom` state 已定义但 `void` 挂起（App.tsx:428-435） |
| A4 | 导图素材按钮接真实导入 | P0 | [ ] | 「图片/网页代码/视频」占位按钮（App.tsx:1578-1586, tooltip「下一轮接真实导入」）；依赖后端 A4b |
| A5 | 撤销栈持久化 | P1 | [ ] | 50 步历史（past/future）纯内存，刷新即丢 |
| B2 | DockEditor 应用库选择器 | P1 | [ ] | 加 `apps: AppInfo[]` prop + 搜索勾选（复用 App.tsx library 数据与 mockIcon 流程），选中写 `dock.icons`；锚点 DOCK.md §三.2-2 |
| C3 | 导入 json 校验入口 | P2 | [ ] | 报错说人话，AI 生成内容友好；依赖后端 C1b |
| E2 | 设置 Tab | P3 | [ ] | 库路径、主题等偏好集中（库路径逻辑已有 localStorage，搬到设置页） |
| E1 | 创意工坊 Tab | P3 | [ ] | 目前纯占位（App.tsx:1644-1648） |

### B. 渲染器（wallpapers/dext-room/，纯静态）

| # | 任务 | 优先级 | 状态 | 说明 |
|---|---|---|---|---|
| B3a | 拖拽进 Dock（渲染器侧） | P1 | [ ] | 编辑模式拖桌面图标到 dock 区 → 发新上行消息 `dockAdd`；依赖后端 B3b 五层链路 |
| D5 | transitionText 清理 | P2 | [ ] | main.js:755 仍用 `transitionTextEl`；文案已固定模板，字段可清（MODEL.md §四） |
| E5 | 右键菜单 | P3 | [ ] | 图标操作等；双击启动已有，右键排队（TODO 排队中） |
| E6a | Dock 运行态小圆点（显示） | P3 | [ ] | Apple 式运行指示；依赖后端 E6b 遥测数据 |

---

## 三、后端任务

### C. Rust 侧（tauri-ui/src-tauri/）

| # | 任务 | 优先级 | 状态 | 说明 |
|---|---|---|---|---|
| B1 | **`save_room_css(room_dir, css)`** | P1 | [ ] | 写房间 `room.css`；**apply_room 已自动拷贝该文件**，渲染器 loadRoomAsset 自动加载，无需改渲染器；锚点 DOCK.md §三.2-1 |
| A4b | `import_background` 扩展 kind | P0 | [ ] | 导图素材需要 start/end/switch 新 kind（现只有 image/video/transition，lib.rs:226-268） |
| C2 | `export_room_zip` / `import_room_zip` | P2 | [ ] | Room 打包/解包，素材压缩 ≤1920w JPEG（TODO 排队中） |
| C1b | `validate_room_json` | P2 | [ ] | schema v1 校验，人话报错（TODO 排队中） |
| D2 | 处理 4 个备而不用命令 | P2 | [ ] | `launch_app`/`get_wallpapers`/`set_wallpaper`/`core_stats` 已注册但前端**从未调用**（grep 确认）；接入 UI（设置页显示 core_stats）或标记废弃 |

### D. C# Lively Core 侧（lively-core-separation/）

| # | 任务 | 优先级 | 状态 | 说明 |
|---|---|---|---|---|
| B3b | dockAdd 落盘（五层链路） | P1 | [ ] | 新上行消息：MessageType 枚举 → Lively.Models.Message → IpcMessageConverter → Player Form1 → Core WebWebView2 switch（模式见 README.md §四-L2） |
| D3 | 枚举过滤失效快捷方式 | P2 | [ ] | AppCatalogService 跳过目标不存在的 .lnk（TODO 排队中） |
| D4 | 图标归一化 | 远期 | [ ] | 提取后按 alpha 包围盒裁剪、占比 ~80% 居中；可升 96px 提取再缩回；需刷新既有房间 base64（TODO 远期） |
| E6b | Core 进程遥测 | P3 | [ ] | Dock 运行态小圆点数据源（新 RPC/IPC）；DOCK.md §三.2-5 |

---

## 四、跨端任务（前后端都要动）

| # | 任务 | 前端部分 | 后端部分 | 优先级 | 状态 |
|---|---|---|---|---|---|
| B3 | 拖拽进 Dock | 渲染器发 `dockAdd` 消息（B3a） | C# 五层链路落盘（B3b） | P1 | [ ] |
| A4 | 导图素材导入 | 按钮+文件框（A4） | Rust import_background 扩 kind（A4b） | P0 | [ ] |
| C3 | 校验闭环 | 导入 UI 展示错误 | Rust 校验命令（C1b） | P2 | [ ] |
| E4 | 多显示器 | 渲染器多屏渲染 | Core 多屏托管 / SetWallpaper monitor_id | 远期 | [ ] |

---

## 五、契约 / 文档层（独立于前后端）

| # | 任务 | 优先级 | 状态 | 说明 |
|---|---|---|---|---|
| C1 | **schema v1 定稿 + JSON Schema 文件** | P2 | [ ] | 固化 x/y、iconSize、background/transition 多态、`__source` 保留；宽容读取原则（ERRORS #4 教训）；**A2 落盘 `switches` 前建议先照 MODEL.md §三 定稿** |
| E3 | AI skill | 远期 | [ ] | schema 文档 + 示例房间 ×3 + 提示词模板（TODO 远期） |

---

## 六、纯清理

| # | 任务 | 说明 |
|---|---|---|
| D1 | 删除 `tauri-ui/main.js` | 5KB 旧渲染器残留副本（2026-08-26），GBK 乱码，不在 vite 构建内（入口 src/main.tsx） |

---

## 七、依赖关系速查

```
A2(边级落盘) ── 建议先 ──▶ C1(schema 定稿 switches 字段)
A4(素材按钮) ── 依赖 ──▶ A4b(import_background 扩 kind)
B3a(渲染器拖拽) ── 依赖 ──▶ B3b(C# 五层链路)
C3(校验入口) ── 依赖 ──▶ C1b(validate 命令)
E6a(小圆点显示) ── 依赖 ──▶ E6b(Core 遥测)
B4(皮肤随导出) ── 依赖 ──▶ B1(save_room_css) + C2(export_room_zip)
```

## 八、推进节奏建议

1. **P0（纯前端，R10 收尾）**：A1 → A2 → A3 → A4/A4b
2. **P1（Dock 接线）**：B1（一条 Rust 命令，见效最快）→ B2 → B3（唯一动 C# 的任务，改动面最大）
3. **P2（分享与校验）**：C1 → C2 → C1b/C3 → D3 → D2 → D5
4. **P3/远期**：E1/E2 页面 → E5 右键 → E4 多屏 → E6 遥测 → D4 图标归一化 → E3 AI skill
