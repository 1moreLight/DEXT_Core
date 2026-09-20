# DESK-ICON-001 桌面图标反馈与命中区优化验收

- 状态：待验收（阶段 A：浏览器实验，未接入生产）
- 分支：`feat/DESK-ICON-001-icon-feedback`
- 基线：DESK-MOTION-001 `5d91bb2`
- 设计：`docs/superpowers/specs/2026-09-20-desktop-icon-feedback-design.md`
- 计划：`docs/superpowers/plans/2026-09-20-desktop-icon-feedback.md`
- 目标：用未来生产共用的视觉层，在浏览器中确认三种图标反馈、收缩后的真实命中区和名称显示规则。
- 范围外：阶段 A 不修改真实桌面、设置页、Core、proto、Widget、Dock 或 Room Schema。

## 阶段 A 自动检查

- [x] Node：图标偏好 3/3；连同既有 motion/controller/bridge 共 18/18。
- [x] Playwright：新增图标实验台 5/5；连同真实桌面与 motion 实验台共 44/44。
- [x] Vitest 50/50、前端 build、语法、Room Schema 与 diff check。
- [ ] 独立代码审查无 Critical/Important。

## 阶段 A 浏览器人工验收

1. [ ] 运行 `cd tauri-ui && npm run dev:icons`，打开图标实验台。
2. [ ] 在明亮、深色和复杂背景上切换“图标光晕 / 紧凑内容框 / 纯净无边框”，确认反馈克制且不再像整格 Android 卡片。
3. [ ] 打开“显示实际命中区”，确认 96×120 网格的透明边缘不响应，图标和可见名称区域正常响应。
4. [ ] 检查 PNG/Glyph、短名称和长名称；长名称单行省略，关闭名称后稳定悬停约 500ms 才显示浮层。
5. [ ] 进入编辑和拖动状态，确认抖动、托起与三种视觉反馈互不覆盖；拖动/按下期间不出现名称浮层。
6. [ ] 开启 reduced-motion，确认缩放、过渡和抖动关闭，但 hover、命中区和名称规则仍有效。

> 硬门槛：用户明确回复阶段 A 通过前，不开始真实桌面、设置页或 Core 集成。

## 验收记录

- 2026-09-20：用户批准 DESK-ICON-001 计划并要求先做浏览器实验；独立 worktree 从 DESK-MOTION-001 `5d91bb2` 建立。
- 2026-09-20：阶段 A 共享模块与实验台实现完成；真实浏览器截图发现并通过先失败的 Playwright 回归移除 button 默认 2px 白边框。生产 `wallpapers/dext-room`、设置页和 Core 保持零差异。
- 2026-09-20：自动检查为 Node 18/18、Vitest 50/50、renderer Playwright 44/44、前端 build、语法与 Room Schema 全绿；等待独立审查后提交阶段 A。
