# DXT-003 Room v2 Widget 契约 验收

- 状态：待验收
- 分支：`feat/dxt-003-room-v2-widget-contract`
- 提交：待提交
- 目标：保持 Room v1 与 idle 原样可用，同时交付可独立校验、不会被降级覆盖的 Room v2 Widget 契约与版本边界。
- 范围外：WidgetHost/实际渲染、能力桥、权限执行、存储、联网、应用启动、Widget 布局 UI、ROOM-004 分享安全闭环、AI skill、DOCK-004、UI-USE-001、用户 `rooms` 和渲染器重写。

## 自动检查

- [x] `python scripts/validate-room-schema.py`：v1/v2 正向、反向 fixtures 与自包含 v2 样包全部符合预期。
- [x] `cargo check` 与 `cargo test --lib`：版本分派、Widget 语义、v2 只读边界和运行包不变测试通过（25 passed，2 个显式活体测试 ignored）。
- [x] `npm test` 与 `npm run build`：2 个测试文件、10 项测试和前端生产构建通过。
- [x] `node --check wallpapers/dext-room/main.js`：未改写的 v1 渲染器语法正常。
- [x] `git diff --check`、具名文件和主 worktree 用户 Room 状态核对通过。`codegraph sync` 已在代码变更后尝试；独立 worktree 无 `.codegraph` 索引并返回 Not initialized，按项目纪律未自行初始化，后续以精确本地查询兜底。

## 人工验收

1. [ ] 打开、编辑、保存并应用一个 v1 Room；确认仍为 `version: 1`、没有 `widgets`，Desk/Dock/start/switch/idle 行为正常。
2. [ ] 打开随仓库提供的 v2 样包；确认显示 v2 与 Widget 数量，并明确提示 WidgetHost 尚未实现。
3. [ ] 确认 v2 的编辑、覆盖保存、降级另存、应用、v1 iframe 预览和当前 zip 导入导出均被阻止；样包、当前运行包和桌面不被修改。
4. [ ] 运行 Schema 校验；确认合法样包通过，重复 id、非法路径、未知权限、非法 placement、过深/过大 config 和 `end` fixtures 被拒绝。
5. [ ] 对照 v1→v2 迁移前后 fixtures；确认只复制 v1 字段与四类素材规则、改为 version 2 并为各 Desk 加空 widgets，不修改源 v1、不产生授权或可变数据。
6. [ ] 确认 v1/v2 都只接受 `idle`；`end` 不兼容且不会被恢复。

## 通过标准

- v1 可读、可保存、可应用且写出不升版本、不产生 widgets。
- v2 可识别、可只读打开、可独立严格校验；在 WidgetHost 前不能进入任何会丢失 widgets 或误应用的写入链。
- Widget manifest、限制、权限边界和显式复制迁移规则在 Schema、Rust/TS、fixtures 与正式文档中一致。
- 自动检查全部通过；用户明确回复“通过”后才允许合并 master。

## 验收记录

- 2026-08-31：用户确认六项开工决策和实施计划；从 `master@096eacd` 建立独立 worktree/分支，主 worktree 用户 Room 状态未触碰。
- 2026-08-31：自动检查通过，状态进入待验收；WidgetHost 仍未实现，v2 保持只读。
