# CORE-006 配置器 Core 启动与退出验收

- 状态：待用户验收
- 分支：`feat/CORE-006-core-runtime-control`
- 提交：见本工作分支 HEAD
- 目标：配置器保留运行时，可以在连接状态旁正常退出并重新启动所属 Dext Core。
- 范围外：壁纸暂停按钮、自动重启、安装器重构、Room 和桌面交互改动。

## 自动检查

- [x] `tauri-ui`：`npm test` 62/62 与 `npm run build` 通过。
- [x] `tauri-ui/src-tauri`：`cargo test --lib` 48 通过/3 个真实环境测试按设计忽略，`cargo check` 通过。
- [x] `git diff --check` 通过；只提交本工作包具名文件。
- [x] 测试拒绝跨 worktree 和旧 Lively 身份；临时移走当前工作区 Core 二进制后实测可见失败原因、按钮保留，恢复文件后可重试。

## 人工验收

1. [ ] 从本 worktree 启动配置器和 Core，确认顶栏显示“Dext Core 已连接”和“退出 Core”，使用页的已应用 Room 正常显示。
2. [ ] 点击“退出 Core”，确认 Core、Player、Watchdog 退出，配置器不关闭；顶栏变为“Dext Core 未运行”和“启动 Core”，依赖 Core 的应用入口不可用。
3. [ ] 点击“启动 Core”，确认按钮显示启动中且不可重复点击；最终连接的是同一 worktree 的 Dext Core，顶栏恢复“已连接/退出 Core”，上次壁纸布局恢复。
4. [ ] 再做一次退出→启动循环，并在 Core 已运行时重新打开配置器，确认没有重复 Core 进程或卡住的按钮。

## 通过标准

四项人工步骤通过，自动检查通过，启动和退出只作用于本工作包识别的 Core；无用户 Room 或运行包内容被修改。

## 验收记录

- 本轮自测已完成两轮退出→启动，配置器始终保留；Core/Watchdog/Player 退出与恢复均经 `scripts/verify-runtime-identity.ps1` 核对，最终 Core PID 78316、配置器 PID 87656，均属 CORE-006 worktree。
- Core 按既有持久化布局恢复了指向 `desk-reorder-002` worktree 的壁纸 URL；没有强制重铺或修改用户 Room/布局数据。
- 跨 worktree 身份拒绝由 Rust 回归覆盖，未在真实桌面启动另一工作区 Core。
- 待用户按四项步骤确认；确认前不合并 master。
