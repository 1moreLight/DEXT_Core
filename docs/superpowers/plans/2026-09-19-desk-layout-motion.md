# DESK-MOTION-001 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将浏览器确认的运动规则稳定接入真实桌面图标和 Widget，同时保留生产组件、主题与 iframe 生命周期。

**Architecture:** `DextLayout` 继续负责纯布局，`DextLayoutMotion` 负责 FLIP/WAAPI，新增 `DextDesktopLayoutController` 负责稳定节点、输入事务、预览和提交。浏览器实验台只作为运动调试器，不复刻到生产 DOM。

**Tech Stack:** Vanilla JavaScript/CSS、WAAPI、Node test runner、Playwright、Vite。

**Spec:** `docs/superpowers/specs/2026-09-19-desk-layout-motion-design.md`

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
- 支持 move 280ms、enter 180ms、exit 140ms、rollback 300ms、reduced-motion 与无 WAAPI 降级。
- 动画外层 positioner，内层图标继续承载 500ms 长按进入编辑与 0.35s 苹果式 jiggle；浏览器实验台必须证明两者可同时运行。

### Task 4：交互实验台

- 新建 `wallpapers/dext-motion-lab/`，直接加载 `../dext-room/layout-motion.js`。
- TDD 增加 `resolveIconReorder`：按目标占位做路径插入，Widget 障碍和 Dock 保留区不允许放置，输入保持不可变。
- 实现场景切换、Widget 拖动、图标托起/占位/路径让位/松手提交、Dock 禁放、连续 revision、取消/reduced-motion 和 100 图标压力场景。
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

## 阶段 B：真实桌面集成（2026-09-19 用户已明确授权）

### Task 7：稳定节点协调

- [ ] 先写 Node/Playwright 失败测试，锁定默认 MotionProfile、稳定节点复用、事件按 key 读取当前数据以及 Widget iframe 不重挂。
- [ ] 新增 `desktop-layout-controller.js`，实现计划约定的控制器接口；图标手势归控制器，Widget 使用 external gesture。
- [ ] `renderIcons()` 改为协调真实节点；外层 icon 只负责位置和 FLIP，内层 face 保留真实视觉、启动行为与苹果式抖动。
- [ ] 初始、staging、resize 立即落位；热更新、新增、移除和坐标变化走同一 motion revision。

### Task 8：Widget 与图标实时预览

- [ ] 先写真实指针失败测试：80ms 候选稳定、路径让位、Dock/Widget 障碍、pointercancel、capture 丢失、重复 pointerup 和权威更新中断。
- [ ] 图标拖动采用 placeholder + Sortable 路径重排；预览不修改 Room，有效松手一次提交。
- [ ] Widget 拖动/缩放使用 placement + icons 双快照；Widget 保持优先，图标避让，Dock 四向禁区包含 2px 抖动安全余量。
- [ ] 热布局、Desk 切换、resize、退出编辑统一使旧 transaction/revision 失效；动画异常立即落最终布局。
- [ ] 双击真正空白退出编辑；交互对象不退出；系统 reduced-motion 同时关闭 WAAPI、托起过渡和整卡抖动。

### Task 9：最终验证与交付

- [ ] Playwright 覆盖真实 renderer 的节点/iframe 复用、热消息、快速折返、启动/Dock 回归和 reduced-motion。
- [ ] 更新 README/FRONTEND、TODO、ROADMAP 和独立验收卡；设置编辑器保持范围外。
- [ ] 运行 Vitest、Node、Playwright、build、语法、Schema 和 diff check；提交全部具名文件。
- [ ] 启动真实桌面供人工验收，停在分支待确认，不合并 master。
