# DESK-MOTION-001 实施计划

## 交付纪律

本计划在 `feat/DESK-MOTION-001-layout-motion` 独立分支执行。每个行为先写会失败的测试，再写最小实现。阶段 A 完成并提交后必须停在浏览器人工验收；未经用户明确通过，不执行阶段 B。

## 阶段 A：浏览器先行

### Task 1：工作包与契约

- 更新 ROADMAP/TODO/PROJECT 和 DESK-LIVE 验收归档。
- 新建设计、计划和独立验收卡。
- 记录视觉论点、接口、时序、reduced-motion 和硬门槛。

### Task 2：纯身份与布局 diff（TDD）

- 新建 `wallpapers/dext-room/layout-motion.js` 和 Node 测试。
- 先覆盖规范化 launch identity、兼容签名重复序号、move/enter/exit、excludeKeys 与 revision 纯状态。
- 实现可供 CommonJS 与浏览器全局使用的纯函数层。

### Task 3：DextLayoutMotion 控制器（TDD）

- 用真实 DOM/浏览器行为验证稳定节点复用、FLIP transform、最终 left/top、enter/exit 和过期 completion。
- 实现 `apply(items,{mode,excludeKeys})`、`cancel({restore})`、`dispose()`。
- 支持 move 220ms、enter 180ms、exit 140ms、rollback 260ms、reduced-motion 与无 WAAPI 降级。

### Task 4：交互实验台

- 新建 `wallpapers/dext-motion-lab/`，直接加载 `../dext-room/layout-motion.js`。
- 实现场景切换、Widget 拖动、80ms 图标交换预览、连续 revision、取消/reduced-motion 和 100 图标压力场景。
- 保持单一舞台、克制诊断栏和清晰交互状态。

### Task 5：Playwright 与开发命令

- 仅新增 `@playwright/test` 开发依赖。
- 新建 Playwright 配置和 renderer e2e；Vite 自动绑定 `127.0.0.1:5174`。
- 失败时保存 trace、截图和视频；文档写明 Windows `npx playwright install chromium` 和 npm 命令。
- 根/tauri-ui package scripts 增加 `dev:motion`、`test:renderer:e2e`。

### Task 6：阶段 A 验证与提交

- 运行 Node、Vitest、build、Playwright、语法检查和 `git diff --check`。
- 更新 TODO、FRONTEND 与验收卡，提交阶段 A。
- 启动 `npm run dev:motion` 供用户人工验收；不得修改真实桌面 `main.js`。

## 阶段 B：真实桌面集成（仅在用户明确通过阶段 A 后）

### Task 7：稳定节点协调

- `renderIcons()` 改为按稳定身份复用/协调节点。
- 事件处理按 key 查询当前图标数据，移除旧索引闭包。
- 初始、staging、resize 使用即时模式；热更新走动画控制器。

### Task 8：Widget 与图标实时预览

- Widget 拖动继续实时求解，由控制器展示让位；pointerup 只提交一次，取消/无解恢复。
- 图标进入占用格稳定 80ms 后预览交换；松手提交，取消恢复。
- 任意动画错误立即降级为最终布局，不影响保存或启动。

### Task 9：最终验证与交付

- 补真实 renderer e2e、chrome.webview 消息与快速折返回归。
- 更新 README/FRONTEND 函数表、时序和 reduced-motion 规则。
- 跑全量自动检查并提交，停在真实桌面待验收，不合并 master。
