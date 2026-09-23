# DESK-REORDER-002 稳定输入上的路径重排验收

- 状态：自动检查通过，分支待真实桌面人工验收；用户确认前不合并 master。
- 基线：最新 master `436080e`（含已验收的 CONFIG-EDIT-001）；本分支已完成 rebase。
- 分支：`feat/DESK-REORDER-002-stable-sortable`。
- 目标：不替换旧直接拖动，追加实时路径插入和同伴让位动画。
- 范围外：Core 输入重写、Widget 手势重做、Room Schema、新设置、整体恢复旧排序分支。
- 计划：`docs/superpowers/plans/2026-09-22-stable-desktop-reorder.md`。

## 自动检查（实施时执行）

- [x] 原生消息十轮及隔离 Release Player 真 Room 原生拖动十轮。旧 flags=8 对照复现，正确路径无提前取消。
- [x] Node 路径、空格、非法源布局、footprint、Widget/Dock 障碍、反向预览、一次性结算。
- [x] 真实 Room 浏览器交互：拖动时节点身份、跟手、路径让位、无效释放、快速折返、热布局中止和一次保存；Widget iframe 不重挂。
- [x] reduced-motion 同伴无 WAAPI，路径预览及提交仍可用；已有测试覆盖名称静止、偏好排队、空白退出与应用启动。
- [x] Vitest 55/55、前端 build、Renderer Playwright 55/55、Node 27/27、语法、Room Schema、`git diff --check`；Core/Player Release 构建通过。当前运行路径只读核对显示实际桌面仍由旧 prefs worktree 运行，未当作本包实机通过。

## 真实桌面人工验收

1. [ ] 长按约 500ms 松手，再次按住拖动，连续十次立即跟手；仅图形抖动，文字静止，当前拖动名称隐藏。
2. [ ] 跨过三至五个图标并快速折返，同伴依次平滑让位，无占位框/位置提示/闪回；空格落位不搬动其它图标。
3. [ ] 有效松手保存新位置，重启后保持；无变化松手不额外保存，Widget iframe 不重载。
4. [ ] Widget、Dock、桌面边界外松手及取消恢复基线；Widget 自身仍可拖动/缩放。
5. [ ] 拖动中新增/移除、切 Desk、缩放、偏好更新：旧 pointerup 不覆盖新布局，五项偏好仍生效。
6. [ ] 双击真正空白退出编辑；图标启动、Widget 热点、Dock 点击正常，交互对象双击不误退出。
7. [ ] 开启 reduced-motion 后仍能拖动/排序/保存，无抖动或让位动画。

## 记录

本轮只确认计划，不把 master 当前版本的合并授权视为本包验收。七项人工检查及必选自动检查通过后，由用户明确回复通过才合并；不清理仍运行或有未提交用户数据的工作区。

2026-09-23 自动验证：`scripts/build.ps1` 已在此 worktree 构建 Release Player；`dotnet run --project tests/Dext.Input.Tests -- <本分支 Release Player>` 完整通过，含十次实际 Room 两段式拖动，并验证旧 Glyph 图标排序保存后不会被补入非法空 `launch`。Vitest 55/55、前端 build、Renderer Playwright 全量 55/55；Node 27/27。`scripts/validate-room-schema.py` 全部 fixture 通过。`verify-runtime-identity.ps1` 报告实际 Core/Player/配置器仍来自 `DEXT_Core-desk-prefs-001`（返回码 1 表示非本 worktree），所以尚未进行本包 WorkerW 实机验收。

2026-09-23 最新主线重放验证：CONFIG-EDIT-001 合入 master 后，本分支 rebase 到 `436080e`；Vitest 57/57、Rust 43 通过/3 个真实环境测试按设计忽略、前端 build、Renderer Playwright 55/55、Node 27/27、Room Schema 与 `git diff --check` 全部通过。下一步只从本 worktree 启动并重铺真实 WorkerW，不使用旧 worktree 进程冒充验收。

2026-09-23 真实桌面已就绪：忽略测试 `applies_room_wallpaper` 通过并完成强制重铺；运行身份核对为 Core PID 74152、Player PID 27812、配置器 PID 86844，三个可执行文件及 Player 的 `wallpaper-url` 全部来自 `D:\use\Orca\DEXT\DEXT_Core-desk-reorder-002`。当前只剩上述七项人工验收，用户确认前不合并 master。
