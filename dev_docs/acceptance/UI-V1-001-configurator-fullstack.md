# UI-V1-001 配置器核心页面全栈闭环验收

- 状态：待验收
- 分支：`feat/ui-v1-001-configurator-fullstack`
- 提交：`f0fa779`（首版实现）+ `1671f25`（首轮验收反馈）+ `d7eab61`（Desk 独立应用选择框）+ `7b98683`（Desk 画布与活体测试隔离）
- 目标：完成 Room 安全管理、真实运行状态、使用页、编辑页、设置页和创意工坊空状态的前后端闭环。
- 范围外：多显示器、DXT-002 idle、DOCK-004、Dock 架构重构、用户 Room 迁移或批量改写、在线创意工坊、更新/安装器、无真实底层能力的设置，以及 Player/Core 大范围重构。

## 自动检查

- [x] `cd tauri-ui && npm test`：6 项 Desk 重映射测试通过
- [x] `cd tauri-ui && npm run build`
- [x] `cd tauri-ui/src-tauri && cargo check`
- [x] `cd tauri-ui/src-tauri && cargo test --lib`：21 项通过，2 项真实环境测试默认 ignored
- [x] `cd tauri-ui/src-tauri && cargo test --lib applies_room_wallpaper`（历史执行记录；第三轮修订后该活体测试改为显式 `-- --ignored`）
- [x] 本包未修改 C# 或 `.proto` 源文件，无需重跑 `scripts/build.ps1`
- [x] `scripts/start.ps1`：当前 worktree Core 与配置器成功启动
- [x] `scripts/verify-runtime-identity.ps1`
- [x] 深色/浅色、960px 浏览器设计模式和 1296×839 真 Tauri 视觉检查
- [x] `git diff --check` 与具名文件状态核对

## 预验收记录

- Core PID `80536`，配置器最终 PID `79752`；Core `2.2.1.5`，身份 `DEXT:DESKTOPSHELL`，pipe `Grpc_DEXT:DESKTOPSHELLJAN`，均来自本 worktree。
- 真 Tauri 已验证 `v1testRoom` 应用后显示“使用中”和“停止壁纸”，停止后 Player 退出、Core 保持连接。
- 设置真实读取 75% 全局音量；关于页三份文档和 data/log 目录使用 Rust 白名单 command 成功打开。
- 测试造成的 `wallpapers/dext-room` 运行包变化已恢复到分支基线，Playwright/截图产物已删除；未删除、迁移或批量改写用户 `rooms`。

## 验收反馈修订验证（2026-08-31）

- [x] `npm test`：6 项通过；`npm run build` 通过。
- [x] `cargo check` 与 `cargo test --lib` 通过：23 项测试，设置 patch 保留未编辑的 Core 字段。
- [x] 浏览器设计模式验证：Room 单击只选中、双击才应用；详情编辑入口、Desk“放入应用”、加入后长按拖动提示均可观察。
- [x] 深色/浅色与 1296×839 真 Tauri 检查：太阳/月亮并排，详情预览只显示背景/视频或简单占位，不含应用图标和 Dock；全局音量已移除。
- [x] 真 Core 往返验证：电池/节能开关把 `Settings.json` 对应规则由 `1` 写为 `0`；开机启动关闭时删除 `HKCU\\...\\Run\\Dext`，开启后恢复为当前 worktree 的 Dext Core 路径。
- [x] 上述三项设置均恢复验证前原值：开机启动开启，电池/节能暂停关闭；测试 Player 已停止，Core 保持连接。
- [x] 本轮未修改 C# 或 `.proto`；不新增 Desk 音量，因为 Room v1/Core 目前没有 per-Desk 音量契约。
- [x] `git diff --check` 通过；运行包、Playwright 与截图产物已精确清理，用户 `rooms` 未改写。

## 第二轮验收反馈验证（2026-08-31）

- [x] Desk“放入应用”改为当前编辑页上的独立弹层，不再切换到侧栏应用库。
- [x] 弹层只展示应用和加入状态，不包含添加、删除、扫描、搜索或删除勾选等应用库管理 UI。
- [x] 浏览器设计模式 1296×839 深浅色实测：点击应用可直接加入/移出当前 Desk，图标数同步变化；Esc、遮罩和“完成”均可关闭且保留原 Desk。
- [x] `npm test`（6 项）、`npm run build`、`cargo check`、`cargo test --lib`（23 项）和 `git diff --check` 通过；浏览器控制台无错误。
- [x] 测试期间加入的 mock 应用已移出；Playwright 临时截图与快照目录已删除，未启动真 Core、未读写用户 `rooms`。

## 第三轮验收反馈验证（2026-08-31）

- [x] 真 Tauri 1296×839 验证：属性栏同时显示 `v1testRoom` 两个 Desk 的真实背景缩略画布，点击 Desk 2 后导图选择、名称和素材路径同步更新；深浅色均无阻断问题。
- [x] `npm test`（6 项）、`npm run build`、`cargo check`、`cargo test --lib` 通过；Rust 结果为 21 项通过、2 项活体测试 ignored。
- [x] 根因确认：旧背景来自 `grpc::tests::applies_room_wallpaper` 调用真实 Core 后持久化的 `rooms/v1testRoom` 运行包；`apps_and_launch` 也会启动 Notepad，两项现均需显式 `-- --ignored`。
- [x] 已通过配置器停止旧测试壁纸：Player 退出、Core 保持连接，`%LOCALAPPDATA%\Dext\WallpaperLayout.json` 为 `[]`；再次运行普通 Rust 测试后仍未启动 Player 或改写布局。
- [x] `wallpapers/dext-room` 的运行态变化已保存为可恢复 stash `runtime v1testRoom snapshot before UI-V1-001 feedback cleanup`，随后恢复分支基线；用户 `rooms/v1testRoom` 仅只读检查，未删除或改写。
- [x] 新增 ERRORS #45，并同步 AGENTS、README、PROJECT、WORKFLOW、旧总验收和 UI v1 计划中的活体测试命令及副作用说明。

## 人工验收

1. [ ] 启动 Dext，确认 Core、Player 和配置器来自 UI-V1-001 当前 worktree 构建路径。
2. [ ] 使用页单击 Room 只选中并显示详情，不切换壁纸；双击才应用。当前 Room 可停止，停止后 Core 与配置器仍连接，外部停止也会同步为空闲。
3. [ ] Room 详情栏“编辑”可直接进入所选 Room 编辑模式；“应用此 Room”仍是独立动作。
4. [ ] Room 详情固定 16:9 预览只显示简单背景；图片/视频可预览，HTML 或加载失败时显示稳定的简单占位，不出现应用图标或 Dock。
5. [ ] 新增、删除、多选、导入和导出 Room；删除可恢复、重名不覆盖、非法 zip 被拒绝且库中无残留。
6. [ ] 编辑页侧栏顺序为 Room → 应用库 → Dock；应用库删除按钮常驻，未选禁用、选中启用。
7. [ ] Desk 属性栏“放入应用”在当前编辑页原地打开独立应用选择框，不跳转侧栏应用库；选择框不显示添加、删除、扫描或删除勾选，点击应用直接加入/移出当前 Desk，关闭后仍停留在原 Desk，并提示可在桌面长按图标拖动位置。
8. [ ] 删除首、中、尾 Desk 后，`startDesk`、当前选择、撤销/重做和双向 Switch 正确；新邻接不继承不存在的旧效果。
9. [ ] Desk 与 Switch 属性栏显示素材名称、相对路径、类型和状态；只有“内置效果”显示效果列表。
10. [ ] 设置页主题显示并排太阳/月亮图标按钮；开机启动、电池供电暂停、节能模式暂停通过真实 Core Settings RPC 保存，重启后仍生效；页面不再显示全局音量。
11. [ ] 更改 Room 库路径时不迁移旧 Room；可以打开 Dext 数据/日志目录并导出包含真实 Core 身份和路径的诊断。
12. [ ] 关于页显示 Dext 配置器/Core 版本、路径、LICENSE 与上游 Lively fork 归属；创意工坊只显示“敬请期待”。
13. [ ] 页面没有 Desk 音量假控件、多显示器和无效 FPS/质量/更新入口，也未修改 DXT-002、DOCK-004 或用户 `rooms`。
14. [ ] 选中 Desk 后，属性栏以缩略画布展示当前 Room 的全部 Desk 背景；图片/视频可辨认，HTML/空背景有稳定占位，点击任一画布会同步选择对应导图节点和 Desk。
15. [ ] 普通 `cargo test --lib` 不启动应用、不铺设壁纸，也不把旧测试 Room 写入 Dext 的恢复布局；需要真实 Core 的活体测试只能通过显式 ignored 命令运行。

## 通过标准

- 所有必选自动检查通过。
- 十五项人工验收均可观察且无阻断问题。
- 工作分支已提交并保持干净；用户确认前不合并 master。

## 验收记录

- 待用户确认。
