# DOCK-003 桌面图标拖入 Dock 验收

- 状态：已通过
- 分支：`feat/dock-003-desktop-icon-drag`
- 提交：已合并到 master（merge 提交见交付报告）
- 目标：在真实 Room 的桌面编辑模式将桌面图标拖入 Dock，经 Player/Core 消息链写入 room.json，并在存在 `__source` 时同步源房间。
- 范围外：DOCK-004 运行态指示圆点；应用库扫描、清理、排序或创意工坊；Dock 模板、Room zip 导入导出；多显示器；与拖拽无关的 Dock 外观重构。

## 自动检查

- [x] `node --check wallpapers/dext-room/main.js`
- [x] `cd tauri-ui/src-tauri && cargo test --lib applies_room_wallpaper`（启动本 worktree Core 后通过）
- [x] `cd tauri-ui/src-tauri && cargo check`
- [x] `cd tauri-ui && npm run build`
- [x] `git diff --check`
- [x] 如修改 C#/.proto：`scripts/build.ps1`（Player Release）及 `scripts/start.ps1`（已启动验证流程；真机拖拽待人工验收）

## 人工验收

1. [ ] 打开真实 Room，进入桌面编辑模式；长按桌面图标后可拖动。
2. [ ] 将桌面图标拖到 Dock 的明确 drop 区域，看到成功反馈，Dock 出现该图标。
3. [ ] 确认 Dock 图标保留真实图标、名称和完整启动信息。
4. [ ] 重复拖入同一个启动目标，不产生重复 Dock 图标。
5. [ ] 拖拽到非 Dock 区域时，原桌面图标行为不受破坏。
6. [ ] 保存 Room、重新打开 Room，Dock 图标仍存在。
7. [ ] 检查 room.json：全局/桌级 Dock 作用域正确，`icon_png`、`launch.target/args/workdir` 均保留。
8. [ ] 如果 Room 有 `__source`，确认包内房间和源房间均已更新。
9. [ ] 在预览模式执行拖拽时，不应写入真实文件。
10. [ ] 现有 Dock 应用点击启动、桌面图标删除、切 Desk 和既有 Dock 配置不回归。
11. [ ] 编辑模式将 Dock 图标拖到桌面虚线 drop 区，桌面出现该图标且 Dock 当前作用域移除；继承全局 Dock 时其他 Desk 不受影响。

## 通过标准

- 所有必选项通过；没有阻断问题。

## 验收记录

- 用户验收通过（2026-08-29）；已合并 master
