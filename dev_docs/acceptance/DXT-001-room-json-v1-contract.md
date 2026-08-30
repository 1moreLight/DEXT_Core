# DXT-001 room.json v1 契约与统一场景渲染 验收

- 状态：待验收
- 分支：`feat/dxt-001-room-json-v1-contract`
- 提交：待提交（上一轮 `86ad139`；完整实现基线 `ed13a33`）
- 目标：定稿 room.json v1，并让现有官方宿主、配置器预览、Rust 应用和 Player/Core 回写链按同一契约安全运行。
- 范围外：end 的完整编辑入口、Desk 排序、成组 HTML 依赖导入、Room zip 导入导出、旧 Room 迁移、Dock 拖拽重做、运行态字段、无关 Player/Core 重构。Desk/start/switch 已存在的素材按钮因用户验收反馈纳入本包并接通真实导入。

## 自动检查

- [x] `room.schema.json` 能接受全部 valid 夹具并拒绝全部 invalid 夹具。
- [x] 语义检查覆盖 `startDesk`、switch key/索引/相邻环形拓扑、固定内容目录和源 Room 禁止 `__source`；官方示例也通过源形态校验。
- [x] `node --check wallpapers/dext-room/main.js` 通过。
- [x] Playwright 真实浏览器检查通过：图片 0.5 秒、视频播完、HTML source+instance 双校验、伪造消息拒绝和完成后清理。
- [x] 真实 Tauri 开发态预览通过：内存新增 Desk 后 iframe 立即显示第 3 Desk，源文件 SHA-256 前后相同。
- [x] `cd tauri-ui && npm run build` 通过。
- [x] `cd tauri-ui/src-tauri && cargo check && cargo test --lib -- --skip grpc::tests::apps_and_launch` 通过（10 项；新增测试覆盖四个固定目录与三类内容；跳过项会实际启动 Notepad，与本包无关）。
- [x] 上述 Rust 测试包含 `grpc::tests::applies_room_wallpaper`，真实 Core 链路通过。
- [x] 另存为测试确认四类素材全部复制、目标不含 `__source`、原 Room 不变；前端新增/应用/另存入口通过 TypeScript 构建。
- [x] Playwright 配置器冒烟通过：编辑模式 Room 列表存在“新增 Room”，进入 Room 后“保存 / 另存为 / 应用”入口均可见；仅使用浏览器 mock，未触发真实文件写入。
- [x] `scripts/build.ps1` 以 Release Player 完成全量 C# 构建；随后 `scripts/start.ps1` 正常启动 Core、Player 和配置器。
- [x] Git 差异只包含 DXT-001 契约、原地适配、安全修复、测试、示例和文档；未混入其他 worktree 改动。

## 人工验收

1. [ ] 打开 v1 验收 Room，确认先播放 `start`，完成后进入 `startDesk`；没有 start 时直接进入该 Desk。
2. [ ] 确认 background 图片静态常驻、视频循环、HTML 在官方图标和 Dock 下方运行，且都不能覆盖或操作官方层。
3. [ ] 在 Desk A 与 Desk B 间往返，确认 A→B 和 B→A 分别使用 room.json 中各自的有向 switch。
4. [ ] 分别检查 switch 图片显示约 0.5 秒、视频完整播放后才换 Desk、HTML 发出当前实例完成消息后才换 Desk。
5. [ ] 使用 3 个以上 Desk，确认只有相邻双向和首尾双向方向有效；缺失方向不会自动生成内容，也不会锁死切换。
6. [ ] 检查 start/end 图片约 0.5 秒；start/end 视频完整播放；HTML 超时、报错或伪造/迟到消息时安全回退且旧 iframe/媒体被清理。
7. [ ] 在配置器打开预览并修改内存中的 Desk/Dock 数据，确认预览立即更新，但源 `room.json`、运行包和 `__source` 都没有变化。
8. [ ] 保存源 Room 后重开，确认 `version/startDesk/start/end/switch/switches/dock/desks` 均保留，未知或运行态字段不会被写出。
9. [ ] 应用 Room 后确认运行包 `room.json` 含 Rust 注入的真实 `__source`；源 Room 与未来可导出内容不含 `__source`。
10. [ ] 在真桌面移动/删除图标并保存，确认运行包和源 Room 都更新，但源 Room 仍不含 `__source`，页面伪造路径不能改变回写目标。
11. [ ] 检查全局 `room.dock` 与当前 Desk 覆盖：普通/style 字段合并，Desk `icons` 整组替换，`icons: []` 明确为空。
12. [ ] 用缺字段、未知字段、非法资源和非法 switch 的夹具打开：读取端不崩溃，可选缺失或单项非法只在内存中降级；任何不符合正式 v1 的源 Room 在保存/应用时明确拒绝，不被静默当成合法文件。
13. [ ] 从 Room 列表（包括空库）点击“新增 Room”，确认成功后才进入新 Room；取消命名或创建失败时仍停在列表，不进入空编辑页。
14. [ ] 修改 Room 后直接点编辑页“应用”，确认草稿先保存再应用；再点“另存为”，确认新 Room 保留四类素材和当前 v1 数据，原 Room 内容不变。
15. [ ] 新增或打开 Room，点 Desk/启动画面的“图片 / 网页代码 / 视频”，确认会打开对应文件选择；选中后素材复制到 `background/` 或 `start/`，预览更新，但保存前 `room.json` 不变。
16. [ ] 点一条 switch 线，分别给 A→B 和 B→A 选择不同素材；确认文件复制到 `switch/`，两方向互不覆盖，保存并重开后仍各自保留。

## 通过标准

- 所有自动检查和人工必选项通过；不存在绕过官方宿主 IPC/保存边界的已知路径。
- room.json v1、配置器预览、运行时渲染和包内/源目录持久化使用同一套字段与语义。
- 工作分支已提交并停在待验收；用户明确回复通过前不合并 master。

## 验收记录

- 2026-08-30：开发侧自动检查、浏览器时序/隔离回归和真实 Tauri 预览不落盘检查通过。
- 2026-08-30：补齐真实新增/应用/另存入口；9 项 Rust 测试确认素材复制、失败回滚、`__source` 和原 Room 边界。
- 2026-08-30：浏览器配置器入口冒烟通过，临时 Playwright 会话和快照已清理。
- 2026-08-30：用户验收不通过——新增 Room 后，Desk 属性栏“图片 / 网页代码 / 视频”按钮没有真实反应；回到同一分支修复。
- 2026-08-30：接通 Desk/start/switch 的真实文件选择和统一内容复制；自包含单 HTML 为本轮明确边界，待重新验收。
- 待用户确认。
