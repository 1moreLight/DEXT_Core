# DXT-003 Room v2 Widget 后端与系统接口 验收

- 状态：开发中
- 分支：`feat/dxt-003-room-v2-widget-contract`
- 基线提交：契约 `c60141e`；同步 master `3d71acf`
- 目标：保持 Room v1 与 idle 原样可用，同时完成不会丢失 Widget 数据/资源的 v2 存储、复制、打包和应用后端，并交付封闭的系统媒体与 Windows 主音量接口。
- 范围外：WidgetHost 视觉渲染、Widget 布局/权限 UI、壁纸热点与可信手势层、Scene 直接调用系统接口、任意 Shell/文件/URL/通用命令、联网代理、AI skill、用户 `rooms` 和渲染器大重写。

## 自动检查

- [x] `python scripts/validate-room-schema.py`：v1/v2 正向、反向 fixtures 与自包含 v2 样包全部符合预期。
- [ ] `cargo check` 与 `cargo test --lib`：版本分派、v1/v2 写入/另存/应用/包操作、资源镜像和最终边界测试通过。
- [ ] `npm test` 与 `npm run build`：版本能力矩阵和配置器生产构建通过。
- [ ] `scripts/build.ps1` 与 `scripts/start.ps1`：新增 `.proto`/C#、Player Release、Core 及 Rust named-pipe 调用链通过。
- [ ] 系统接口定向测试：媒体动作只接受封闭枚举；主音量限制为 `0.0..1.0`；无任意命令、路径、URL 或 Scene 直连入口。
- [ ] `node --check wallpapers/dext-room/main.js`、`git diff --check`、具名文件和主 worktree用户 Room 状态核对通过。

## 人工验收

1. [ ] 打开、编辑、保存并应用一个 v1 Room；确认仍为 `version: 1`、没有 `widgets`，Desk/Dock/start/switch/idle 行为正常。
2. [ ] 对 v2 样包执行读取、覆盖保存、另存、导出、重新导入和应用；确认 manifest、`config`、placement、permissions 与全部声明 `widgets/` 资源逐项保留，失败时源 Room、目标目录和当前运行包不变。
3. [ ] 对非法/未知版本、路径逃逸、缺失或未声明 Widget 资源执行相同操作；确认在最终 Rust 边界被拒绝且没有半成品。
4. [ ] 使用系统接口读取当前媒体标题、作者、专辑、封面、播放状态和时间线；执行播放、暂停、切换、上一首、下一首，确认只影响 Windows 当前媒体会话。
5. [ ] 记下系统原主音量和静音状态，测试读取、设置音量和静音，再恢复原值；确认该接口控制 Windows 默认输出端点，而不是壁纸音量。
6. [ ] 确认非法媒体动作、越界/非有限音量和任意字符串命令均被拒绝；壁纸 Scene/Widget 当前不能直接调用系统动作，后续必须经过官方可信热点/用户手势层。
7. [ ] 从 README 打开前端接入清单和系统 API 手册，确认前端能够按类型、权限和错误语义接线，且文档明确 WidgetHost 仍属后续工作包。

## 通过标准

- v1 可读、可保存、可应用且写出不升版本、不产生 widgets。
- v2 的存储、另存、打包、导入和应用操作完整保留 Widget manifest 与声明资源；未知版本和非法包无副作用。
- 系统媒体与主音量通过封闭、可验证的 Core→Rust/Tauri 接口工作；不存在通用命令或不可信 Scene 直连入口。
- Widget manifest、限制、权限边界和显式复制迁移规则在 Schema、Rust/TS、fixtures、RPC 与正式文档中一致。
- 自动检查全部通过；用户明确回复“通过”后才允许合并 master。

## 验收记录

- 2026-08-31：用户确认六项开工决策和实施计划；从 `master@096eacd` 建立独立 worktree/分支，主 worktree 用户 Room 状态未触碰。
- 2026-08-31：自动检查通过，状态进入待验收；WidgetHost 仍未实现，v2 保持只读。
- 2026-08-31：35 个具名文件提交为 `c60141e`；未合并 master，等待用户人工验收。
- 2026-08-31：根据验收反馈补充 v2 样包的配置器入口，并明确“新建 Room 保持 v1”是兼容性要求。
- 2026-08-31：用户明确要求继续完成 v2 后端，并追加当前系统媒体、Windows 主音量、前端接入清单和系统 API 手册；验收状态退回开发中，原契约提交作为基线保留。
