# CONFIG-EDIT-001 配置器 Room 打开与可恢复修复 Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` task-by-task. Every behavior change starts with a failing test.

**Goal:** 让配置器编辑入口可靠打开或给出可操作错误，并以可恢复方式处理未声明 Widget 资源。

**Architecture:** Rust 将发布级严格校验拆成可复用的声明资源校验与孤儿审计，新增编辑审计和恢复命令；React 只消费结构化结果并原子提交状态。严格保存/预览/应用/导出路径不变。

**Tech Stack:** React/TypeScript/Vitest、Tauri Rust、serde、现有 Room v2 校验器。

**Spec:** `docs/superpowers/specs/2026-09-23-config-editor-recovery-design.md`；验收卡：`dev_docs/acceptance/CONFIG-EDIT-001-room-open-recovery.md`。

## Task 1：结构化编辑审计

**Files:** `tauri-ui/src-tauri/src/lib.rs`

- [ ] 为“存在孤儿但声明资源安全”及“缺失声明资源仍失败”写 Rust RED 测试。
- [ ] 拆分严格资源校验，新增 `inspect_room_for_edit` 及共享权限审查 helper。
- [ ] 确认现有保存/导出/应用仍调用严格校验，运行定向 Rust 测试。

## Task 2：可恢复隔离

**Files:** `tauri-ui/src-tauri/src/lib.rs`

- [ ] 为保留相对路径、只移动孤儿、复制失败不删源写 Rust RED 测试。
- [ ] 实现 `quarantine_room_orphan_resources`，恢复根目录可注入测试，生产使用 Dext local data。
- [ ] 注册命令并运行定向 Rust 测试。

## Task 3：原子前端流程

**Files:** `tauri-ui/src/App.tsx`, `tauri-ui/src/lib/room-integrity.ts`, `tauri-ui/src/lib/room-integrity.test.ts`，必要组件文件。

- [ ] 为审计状态、守卫文案和恢复结果写 Vitest RED 测试。
- [ ] `openRoom` 改为成功后一次性写状态；失败显示原因，可修复项进入受限编辑。
- [ ] 增加孤儿警告、文件清单和“移至恢复目录并继续”；保存/预览/应用显式禁用或拦截。
- [ ] 前端定向测试及 build 通过。

## Task 4：验证与交付

- [ ] Rust 全量测试、`npm test`、`npm run build`、`git diff --check`。
- [ ] 核对未改真实桌面、Room Schema 和 DESK-REORDER 分支。
- [ ] 更新 TODO/ERRORS/验收卡，提交本分支，停在人工待验收。
