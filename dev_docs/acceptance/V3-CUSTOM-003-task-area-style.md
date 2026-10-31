# V3-CUSTOM-003 融合任务区外观编辑 验收

- 状态：待验收
- 分支：`feat/V3-CUSTOM-003-task-area-style`
- 提交：`78ce9d926b0e4d4b126d83d33235328cd6e0860e`
- 目标：配置器可为主题 Dock 编辑 `dextTaskArea` 矩形与 5 个样式参数，并支持 Desk 差异 / 恢复继承
- 范围外：字体、活动指示器、排列方式；CUSTOM-002 声明 UI；应用 Dock 全局＋追加；改写任务区输入 / 窗口管理；任意任务项 DOM 自绘

## 自动检查

- [x] `cd tauri-ui && npx vitest run src/features/room-editor/task-area-config.test.ts` → 4/4
- [x] `cd tauri-ui && npx tsc --noEmit` → 通过；`dock-template` 7 + `v3-document` 3 回归通过

## 人工验收

1. [ ] 打开或创建原生 v3 Room，确保存在主题 Dock（可用融合样包 `rooms/v3-fusion-lab`，或任意本地 HTML Dock）。打开 Dock 编辑区，可见「应用任务区」区块；共享配置下可编辑矩形与 iconSize / gap / radius / surface / accent。
2. [ ] 切换到「当前 Desk 差异」，仅改当前 Desk 的任务区底色（surface）与图标尺寸（iconSize）；另一 Desk 仍显示共享值。
3. [ ] 保存、关闭、重新打开同一 Room：共享值与 Desk 差异均仍在；点「恢复继承」后当前 Desk 差异消失并跟随共享值。
4. [ ] （Windows / Release Player）保存并应用后，带差异的 Desk 上官方任务区外观与编辑一致；继承 Desk 保持共享外观。Linux 云 VM 无法完成本步。

## 通过标准

- 编辑入口不依赖官方模板区域描述；无模板本地 Dock 也能声明任务区。
- Desk 差异只存变更叶子；恢复继承清除差异。
- 未改字体 / 指示器 / 横排等硬编码官方 CSS；未改应用 Dock pin 语义。
- 用户明确回复「通过」前不得合并 master。

## 已知限制

- Linux 云环境无 WorkerW / Release Player，实机任务区呈现仅人工步骤 4。
- Core `DockThemeEligibility` 与宿主 `resolveTaskArea` 已消费字段；本包只补配置器写入链。
