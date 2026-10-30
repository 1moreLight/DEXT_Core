# V3-CUSTOM-002 本地 Dock 公开声明编辑验收

- 状态：待验收
- 分支：`feat/V3-CUSTOM-002-dock-declarations`
- worktree：`/home/ubuntu/worktrees/v3-custom-002-dock-declarations`
- 提交：见分支最新 commit（提交后填写）
- 目标：导入本地 Dock HTML 后，可编辑其公开声明（capabilities / buttonIds / config），保存、重开与应用后声明仍完整；不默认授予全部能力。
- 范围外：Room 场景 / Widget 通用声明复用 UI；官方模板区域编辑器改造；任务区样式编辑；应用 Dock 全局+Desk 追加语义；自动解析 HTML 推断声明；授权面板改造成作者声明入口。

## 自动检查
- [x] `cd tauri-ui && npm test -- src/features/room-editor/component-declarations.test.ts`（5/5）
- [x] `cd tauri-ui && npm test -- src/features/room-editor/v3-document.test.ts src/features/room-editor/dock-template.test.ts`（合计 15/15）
- [x] `cd tauri-ui && npx tsc --noEmit` 通过

## 人工验收
1. [ ] 在配置器打开或新建原生 v3 Room，点「添加本地 Dock」导入含时钟与上一页按钮的本地 HTML Dock；确认导入后能力默认全空（未自动全开），并看到下方「本地 Dock 公开声明」。
2. [ ] 勾选 `time.read` 与 `desk.navigate`，添加名为「上一页」的按钮并设默认动作为上一页；可选填写公开 config JSON（例如 `{"theme":"clock"}`）并点「应用 config」。
3. [ ] 保存后关闭并重新打开该 Room：声明的能力、按钮与 config 仍在。
4. [ ] 保存并应用后，在「本机数据授权」中可为该 Dock 消费者允许时间读数；桌面上时钟可读且上一页按钮可切页（需 Windows / Release Player）。

## 通过标准
- 本地 Dock 导入不默认写入模板那套全量 capabilities。
- 作者声明经保存/重开仍在 `room.json` 的 `components[].capabilities` / `buttonIds` / `config` 与 `buttons[]`。
- 授权仍是应用后的独立步骤，声明≠授权。
- 官方模板 Dock 仍走原模板区域编辑器，本包不破坏其路径。

## 改动摘要
- 新增 `component-declarations.ts`：本地 Dock 能力/按钮/config 纯函数编辑；模板 Dock 拒绝改写。
- 新增 `V3DockDeclarationEditor.tsx`：非模板 Dock 的声明 UI。
- `V3DockEditor` 空模板分支挂上声明编辑器；`V3RoomEditor.pick` 导入后提示编辑声明，仍写 `capabilities:[]`。

## 自测限制（Linux 云环境）
本环境无法完整跑 Windows Core / Release Player / 真桌面授权与切页；人工步骤 4 保留给用户本机。本包以 Vitest 纯逻辑与配置器 UI 接线为自动证据。

## 记录
2026-10-30：实现完成，停在待验收，禁止合并 master。
