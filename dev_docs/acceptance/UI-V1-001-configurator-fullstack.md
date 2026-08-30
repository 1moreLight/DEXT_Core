# UI-V1-001 配置器核心页面全栈闭环验收

- 状态：待验收
- 分支：`feat/ui-v1-001-configurator-fullstack`
- 提交：`f0fa779`（实现；后续提交仅同步待验收状态）
- 目标：完成 Room 安全管理、真实运行状态、使用页、编辑页、设置页和创意工坊空状态的前后端闭环。
- 范围外：多显示器、DXT-002 idle、DOCK-004、Dock 架构重构、用户 Room 迁移或批量改写、在线创意工坊、更新/安装器、无真实底层能力的设置，以及 Player/Core 大范围重构。

## 自动检查

- [x] `cd tauri-ui && npm test`：6 项 Desk 重映射测试通过
- [x] `cd tauri-ui && npm run build`
- [x] `cd tauri-ui/src-tauri && cargo check`
- [x] `cd tauri-ui/src-tauri && cargo test --lib`：23 项通过
- [x] `cd tauri-ui/src-tauri && cargo test --lib applies_room_wallpaper`
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

## 人工验收

1. [ ] 启动 Dext，确认 Core、Player 和配置器来自 UI-V1-001 当前 worktree 构建路径。
2. [ ] 使用页单击未应用 Room 会立即应用并显示详情；当前 Room 主按钮变为“停止”，停止后 Core 与配置器仍连接，外部停止也会同步为空闲。
3. [ ] 新增、删除、多选、导入和导出 Room；删除可恢复、重名不覆盖、非法 zip 被拒绝且库中无残留。
4. [ ] 图片、视频和 HTML Room 共用固定 16:9 预览框，加载失败时尺寸稳定并说明原因。
5. [ ] 编辑页侧栏顺序为 Room → 应用库 → Dock；应用库删除按钮常驻，未选禁用、选中启用。
6. [ ] 删除首、中、尾 Desk 后，`startDesk`、当前选择、撤销/重做和双向 Switch 正确；新邻接不继承不存在的旧效果。
7. [ ] Desk 与 Switch 属性栏显示预览、素材名称、相对路径、类型和状态；只有“内置效果”显示效果列表。
8. [ ] 设置页可真实读写开机启动、配置器主题、全屏/电池/节能暂停、壁纸音量和桌面可见时声音，重启后仍保存。
9. [ ] 更改 Room 库路径时不迁移旧 Room；可以打开 Dext 数据/日志目录并导出包含真实 Core 身份和路径的诊断。
10. [ ] 关于页显示 Dext 配置器/Core 版本、路径、LICENSE 与上游 Lively fork 归属；创意工坊只显示“敬请期待”。
11. [ ] 页面没有多显示器和无效 FPS/质量/更新入口，也未修改 DXT-002、DOCK-004 或用户 `rooms`。

## 通过标准

- 所有必选自动检查通过。
- 十一项人工验收均可观察且无阻断问题。
- 工作分支已提交并保持干净；用户确认前不合并 master。

## 验收记录

- 待用户确认。
