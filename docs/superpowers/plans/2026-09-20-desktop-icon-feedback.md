# DESK-ICON-001 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Every production behavior starts with a failing test.

**Goal:** 先在浏览器中用未来生产共用的视觉层验证三种桌面图标反馈、收缩命中区和名称显示规则；人工验收前不接入真实桌面。

**Architecture:** 新建 UMD/CommonJS 共享偏好模块与共享 CSS。实验台使用与未来生产一致的 `.icon > .icon-face > .icon-visual` 分层；生产 `dext-room` 在阶段 A 不导入这些文件。

**Tech Stack:** Vanilla JavaScript/CSS、Node test runner、Playwright、Vite。

**Spec:** `docs/superpowers/specs/2026-09-20-desktop-icon-feedback-design.md`

## Global constraints

- 分支：`feat/DESK-ICON-001-icon-feedback`，基线：DESK-MOTION-001 `5d91bb2`。
- 阶段 A 可先于 DESK-MOTION-001 合并开展，但 DESK-ICON-001 不得先合并 master。
- 不修改 `wallpapers/dext-room/index.html`、`style.css`、`main.js`、设置页、Core、proto 或 Room Schema。
- 实验台必须直接加载共享模块和共享 CSS，不复制第二套实现。

## Task 1: Work package records

- [ ] 更新 ROADMAP、TODO、PROJECT 和独立验收卡。
- [ ] 固化视觉论点、共享接口、初始参数和浏览器硬门槛。
- [ ] 建立执行 ledger，记录阶段 A 与阶段 B 的依赖关系。

Expected: `git diff --check` 通过，且生产桌面文件无差异。

## Task 2: Shared preferences and DOM behavior (TDD)

- [ ] 先写 Node 失败测试：默认偏好、非法值回退、根节点 dataset 应用不替换图标节点、状态/浮层规则。
- [ ] 实现 UMD/CommonJS 共享模块，导出默认值、规范化与 DOM 偏好应用函数。
- [ ] 先写 Playwright 失败测试：网格空白不可命中、可见 face 可命中、单行省略、隐藏名称 500ms 浮层和抑制条件。
- [ ] 实现共享 DOM/CSS，保持 outer grid、face motion、visual feedback 三层分权。

Expected: Node 与定向 Playwright 从 RED 转 GREEN。

## Task 3: Browser icon lab

- [ ] 建立 `wallpapers/dext-icon-lab/`，直接加载共享模块/CSS。
- [ ] 实现三模式、名称、背景、命中区、编辑、拖动和 reduced-motion 控制。
- [ ] 使用 PNG/Glyph、短/长名称和多背景验证三种状态；界面保持单画布、少量控制和克制诊断信息。
- [ ] 增加 `npm run dev:icons`，Playwright renderer 配置继续由 Vite 自动启动。

Expected: 所有浏览器场景可交互，实验台不导入或修改生产 `dext-room` DOM。

## Task 4: Stage A verification and handoff

- [ ] 运行 Node、Vitest、build、完整 renderer Playwright、语法检查、Room Schema 与 `git diff --check`。
- [ ] 独立全分支审查；Critical/Important 必须在同一轮用 RED→GREEN 修复。
- [ ] 更新 TODO、FRONTEND、ROADMAP 和验收卡，具名暂存并提交阶段 A。
- [ ] 启动 `npm run dev:icons` 供用户人工验收，停在硬门槛。

Expected: 阶段 A 提交存在，工作树干净；真实桌面、设置页和 Core 无改动。

## Stage B gate

只有用户明确回复浏览器实验通过后，才新增真实 `.icon-visual`、全局设置字段、`dext:desktop-preferences` 消息和启动偏好快照。阶段 B 仍在同一 DESK-ICON-001 分支完成，但必须等待 DESK-MOTION-001 先合入 master。

## Task 5: Stage B gate and records

- [x] 记录 2026-09-21 用户通过阶段 A 并授权真实桌面集成。
- [x] 更新 ROADMAP、TODO、PROJECT 与验收卡，冻结阶段 B 范围和真实桌面人工验收。
- [x] 记录叠加分支裁定：允许在 DESK-MOTION-001 之上继续开发，但最终仍按 Motion → Icon 顺序合并 master。

Expected: 工作树只包含文档变化，`git diff --check` 通过。

## Task 6: Real desktop visual integration (TDD)

- [x] 先写真实 `dext-room` Playwright 失败测试：共享 `.icon-visual` 分层、footprint/实际命中一致、节点与 Widget iframe 不替换、标签隐藏/浮层、视觉大小和 reduced-motion。
- [x] 真实桌面加载共享偏好模块/CSS；稳定图标节点补齐 visual/label/tooltip 分层，外层继续只负责坐标和 FLIP。
- [x] 新增 `dext:desktop-preferences` 消息并用同一 controller 原地应用偏好；编辑、拖动和热布局更新不重建节点。
- [x] 保持 Dock、Widget、Scene、应用启动和 Room Schema 不变。

Expected: Node 与真实桌面定向 Playwright RED→GREEN；运动层与视觉层 transform 互不覆盖。

## Task 7: Global settings and live delivery (TDD)

- [x] proto 增加反馈风格、名称显示、footprint、视觉大小和间距字段；历史设置的零值映射到 halo + shown + standard。
- [x] Rust 设置视图/patch 保留未修改字段，并返回 `not_needed / applied / deferred` 投递状态。
- [x] 设置页增加五项偏好控制；保存成功立即投递当前官方 Dext Room，失败保留设置并提示下次加载生效。
- [x] Player/Core 在官方可信宿主加载完成后下发完整偏好快照；重启、切 Desk 和重铺壁纸保持一致。

Expected: Vitest、Rust、C# 与 Player/renderer 回归 RED→GREEN；旧设置无需迁移文件即可得到默认值。

## Task 8: Stage B verification and handoff

- [x] 运行 Vitest、build、Rust、C# Release、Node、完整 renderer Playwright、语法、Schema、生产边界与 diff check。
- [x] 更新 README/FRONTEND/PROJECT/ROADMAP/TODO/验收卡和错误记录。
- [x] 完成全分支自审；Critical/Important 用 RED→GREEN 修复，Minor 记录后交付。
- [x] 具名暂存并提交，启动真实桌面供人工验收；不合并 master。

运行态记录（2026-09-21）：`scripts/start.ps1` 初次检测到主 worktree Core PID 29524 占用 Dext mutex/pipe并按安全规则拒绝复用；用户关闭旧实例后，本 worktree Core/Watchdog/Player/配置器全部启动。强制重铺活体测试通过，Player 壁纸路径也已核对为本 worktree。

Expected: 分支干净、阶段 B 提交存在；Motion 仍是 Icon 合并 master 的前置。

## Stage A acceptance amendment (2026-09-20)

- [x] 用 RED→GREEN 覆盖统一 footprint、布局格/命中框四边重合、名称切换几何不变和框间 gap 不命中。
- [x] `DesktopIconPreferences` 增加 `hitTargetSize`，提供 small 72×80、standard 80×84、large 84×88 三档。
- [x] 实验台以同一 footprint 承担布局与命中，框大小与纯 gap 间距独立控制；阶段 A 不接入真实桌面或设置页。
- [x] 验收补充：默认增加真实 hover/press/短按选择、500ms 长按编辑、编辑中跟手托起/回位及双击空白退出；固定五状态保留为诊断工具。
- [x] 两条 Playwright 场景先证明旧版缺少直接交互，再覆盖真实命中路由和完整长按/拖动/退出生命周期。
- [x] 验收补充：`DesktopIconPreferences.visualSize` 增加 48/56/64px 三档，和 footprint/gap 独立；Node 与真实 bounding box Playwright 先 RED 后 GREEN。
- [x] 验收补充：隐藏名称时三档 footprint 收为 64×64 / 72×72 / 80×80，显示名称仍为 72×80 / 80×84 / 84×88；gap 不变。
- [x] 验收补充：图标 jiggle 调整为 ±1.5° / 280ms；500ms 长按、Widget 与 reduced-motion 规则不变，并以真实 CSSAnimation 关键帧回归锁定。
- [x] 后续验收反馈取代上一条实验参数：长按改为 300ms，图标 jiggle 改为 ±5° / 150ms；名称浮层仍为 500ms，Widget 与 reduced-motion 规则不变。
- [x] 后续验收反馈再次收敛：保留 300ms 长按与 150ms 周期，将图标 jiggle 幅度从 ±5° 调整为 ±3°。
- [x] 文字跟随修正：在同一 face 的 ±3° 关键帧加入 ±1.5px 水平位移，以真实矩阵回归保证图形、文字和命中边框整体运动。
- [x] 用户澄清后取代上一条：文字必须保持静止；撤销整体平移，将 ±3° / 150ms jiggle 移到 `.icon-visual`，face 与 label 不运行编辑动画。
