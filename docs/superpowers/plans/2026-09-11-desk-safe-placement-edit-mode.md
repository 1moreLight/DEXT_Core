# Desk Safe Placement and Minimal Edit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 Desk 应用时立即放入不冲突的网格位置，并把真桌面长按编辑态收敛为只移动图标。

**Architecture:** 在 `widget-layout.ts` 提供配置器和画布共用的桌面图标网格与空位查找函数，`toggleDeskApp` 只为新图标分配位置且不改旧图标。渲染器删除图标/Dock 删除与跨层拖拽、尺寸切换 UI，只保留现有桌面网格拖动、Widget 编辑和退出入口；DockEditor 继续作为 Dock 管理入口。

**Tech Stack:** React 19、TypeScript、Vitest、无框架浏览器 JavaScript/CSS/HTML。

**Spec:** `dev_docs/acceptance/DESK-EDIT-001-safe-placement-edit-mode.md`

## Global Constraints

- Room 只支持 v2；继续读取和写出已有 `desk.iconSize`，本包只移除真桌面切换入口。
- 新增图标不得移动已有图标；必须避开已有图标、Widget 安全边距和 Dock 保留区。
- 真桌面长按编辑态保留桌面图标移动、Widget 移动/缩放、完成与 Esc；删除图标、尺寸切换和 Desk↔Dock 拖拽全部移除。
- DockEditor 仍是 Dock 图标增删与排序的唯一正式入口；Dock 启动和运行圆点不变。
- 不修改 C#、`.proto` 或 `addDockIcon` 后端兼容链。

---

### Task 1: 新增图标空位分配

**Files:**
- Modify: `tauri-ui/src/lib/widget-layout.ts`
- Modify: `tauri-ui/src/lib/widget-layout.test.ts`
- Modify: `tauri-ui/src/components/DesktopCanvasEditor.tsx`
- Modify: `tauri-ui/src/App.tsx`

**Interfaces:**
- Consumes: `Desk`、`RoomIcon`、`WidgetDefinition`、`ROOM_CANVAS`。
- Produces: `DESKTOP_ICON_GRIDS`；`desktopIconGrid(iconSize) => IconGrid`；`findOpenDeskIconCell(desk, grid?, roomDock?) => {x:number,y:number} | null`。

- [x] **Step 1: Write the failing tests**

  在 `widget-layout.test.ts` 增加字面量用例：稀疏坐标选择首个空格、跳过 Widget/Dock 区域、满网格返回 `null`，并断言输入 Desk/旧图标坐标未被修改。

- [x] **Step 2: Run tests to verify they fail**

  Run: `npm test -- src/lib/widget-layout.test.ts`

  Expected: FAIL，因为 `findOpenDeskIconCell` / `DESKTOP_ICON_GRID` 尚不存在。

- [x] **Step 3: Write minimal implementation**

  在 `widget-layout.ts` 用行优先扫描网格；已有图标使用显式坐标，缺坐标时使用其数组序号的网格回退；候选格与 Widget 安全区域或有效全局/桌级 Dock 保留区相交时跳过。`DesktopCanvasEditor` 与新增逻辑按 `iconSize` 共用 large/medium/small 网格。

- [x] **Step 4: Wire application addition**

  `toggleDeskApp` 在新增分支调用 `findOpenDeskIconCell` 并写入 `x/y`；无空位时不写历史、不置 dirty、不添加，并显示“Desk 没有可用的图标位置”。移除分支维持现状。

- [x] **Step 5: Run focused and full checks**

  Run: `npm test -- src/lib/widget-layout.test.ts`

  Run: `npm test`

  Expected: 新增用例及全套测试通过。

### Task 2: 真桌面编辑态只保留移动

**Files:**
- Modify: `wallpapers/dext-room/index.html`
- Modify: `wallpapers/dext-room/main.js`
- Modify: `wallpapers/dext-room/style.css`

**Interfaces:**
- Consumes: 现有 `attachPress`、`startDrag`、Widget 编辑层、`exitEdit`。
- Produces: 只有桌面网格内移动语义的图标编辑态；只读 Dock 运行态。

- [x] **Step 1: Remove edit-only controls and mutation paths**

  删除尺寸按钮和 Dock 投放提示 DOM；删除桌面/Dock 删除按钮；删除 Desk→Dock 与 Dock→Desk 命中、移动和事件绑定；`startDrag` 松手只执行桌面格子交换或移动。

- [x] **Step 2: Remove orphaned styles and listeners**

  删除 `.icon-del`、`.dock-icon-del`、`#size-group`、`#dock-drop-hint`、跨层 drop target 与 Dock dragging/edit jiggle 样式，以及尺寸按钮监听和高亮代码；保留图标拖动反馈、Widget 编辑样式与完成按钮。

- [x] **Step 3: Verify renderer behavior**

  Run: `node --check wallpapers/dext-room/main.js`

  Run: `npm run dev:room`

  Expected: 长按进入编辑后桌面图标可移动，尺寸/删除/Dock 投放入口不可见；Dock 双击启动路径仍存在。

### Task 3: 契约、记录与交付

**Files:**
- Modify: `dev_docs/README.md`
- Modify: `dev_docs/ROADMAP.md`
- Modify: `dev_docs/TODO.md`
- Modify: `dev_docs/DOCK.md`
- Modify: `dev_docs/FRONTEND.md`
- Modify: `dev_docs/acceptance/DESK-EDIT-001-safe-placement-edit-mode.md`

**Interfaces:**
- Consumes: Task 1 与 Task 2 的最终行为。
- Produces: 当前实现一致的唯一文档口径和人工验收步骤。

- [x] **Step 1: Update product-facing documentation**

  将渲染器编辑描述改成“图标只移动”；明确 DockEditor 是增删/排序唯一入口；记录 `iconSize` 仍兼容但真桌面无切换入口。

- [x] **Step 2: Run final verification**

  Run: `npm test`

  Run: `npm run build`

  Run: `node --check wallpapers/dext-room/main.js`

  Run: `python scripts/validate-room-schema.py`

  Run: `git diff --check`

  Expected: 所有命令退出码 0。

- [ ] **Step 3: Commit named files**

  先用 `git status --short` 核对，仅暂存本计划列出的具名文件，再提交到 `feat/DESK-EDIT-001-safe-placement-edit-mode`；提交后将验收卡和 ROADMAP 标为待验收，不合并 `master`。
