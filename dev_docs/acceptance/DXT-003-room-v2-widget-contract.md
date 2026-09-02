# DXT-003 Room v2 Widget 后端与系统接口 验收

- 状态：待验收
- 分支：`feat/dxt-003-room-v2-widget-contract`
- 基线提交：契约 `c60141e`；同步 master `3d71acf`
- 实现提交：`695e3e7`
- 目标：把项目收口为唯一原生 Room v2，完成不会丢失 Widget 数据/资源的存储、复制、打包和应用后端，并交付封闭的系统媒体与 Windows 主音量接口。
- 范围外：WidgetHost 视觉渲染、Widget 布局/权限 UI、壁纸热点与可信手势层、Scene 直接调用系统接口、任意 Shell/文件/URL/通用命令、联网代理、AI skill、用户 `rooms` 和渲染器大重写。

## 自动检查

- [x] `python scripts/validate-room-schema.py`：唯一 v2 Schema、正反 fixtures 与自包含样包全部符合预期，v1 manifest 被拒绝。
- [x] `cargo fmt --check`、`cargo check` 与 `cargo test --lib`：26 通过、3 个显式活体用例未自动运行；v2 写入/另存/应用/包操作与资源边界通过。
- [x] `npm test` 与 `npm run build`：9 个前端测试和生产构建通过。
- [x] `scripts/build.ps1` 与 `scripts/start.ps1`：新增 `.proto`/C#、Player Release、Core、配置器及 named-pipe 调用链通过。
- [x] 系统接口活体测试：真实读取 Apple Music 元数据；play/pause 探测后恢复原状态；主音量修改后恢复原 level/mute；非法动作与越界音量单测通过。
- [x] `node --check wallpapers/dext-room/main.js`、`git diff --check` 与具名文件/主 worktree Room 状态扫描通过；未运行会铺设壁纸的 `applies_room_wallpaper`。

## 人工验收

1. [ ] 新建 Room，确认直接生成 `version: 2`、每个 Desk 带 `widgets: []`，并能编辑、保存、预览、另存、导出、重新导入和应用；全链路不出现 v1 中间文件。
2. [ ] 对带 Widget 的 v2 样包执行读取、覆盖保存、另存、导出、重新导入和应用；确认 manifest、`config`、placement、permissions 与全部声明 `widgets/` 资源逐项保留，失败时源 Room、目标目录和当前运行包不变。
3. [ ] 对非法/未知版本、路径逃逸、缺失或未声明 Widget 资源执行相同操作；确认在最终 Rust 边界被拒绝且没有半成品。
4. [ ] 使用系统接口读取当前媒体标题、作者、专辑、播放状态和时间线；执行播放、暂停、切换、上一首、下一首，确认只影响 Windows 当前媒体会话。封面由未来 Widget Bridge 复用 Lively Player 的 `livelyCurrentTrack` 缓存，Core RPC 当前把封面视为可选空字段。
5. [ ] 记下系统原主音量和静音状态，测试读取、设置音量和静音，再恢复原值；确认该接口控制 Windows 默认输出端点，而不是壁纸音量。
6. [ ] 确认非法媒体动作、越界/非有限音量和任意字符串命令均被拒绝；壁纸 Scene/Widget 当前不能直接调用系统动作，后续必须经过官方可信热点/用户手势层。
7. [ ] 从 README 打开前端接入清单、系统 API 手册和 AI 提示词，确认 Scene 可把系统展示融入任意构图、一个 Desk 可有多个可拖动/层叠 Widget、遮挡图标由官方宿主避让，且 WidgetHost 仍属后续工作包。

## 通过标准

- 新建、读取、编辑、保存、另存、预览、应用和 zip 只接受/产生原生 v2；v1 与未知版本均不得进入运行链。
- v2 的存储、另存、打包、导入和应用操作完整保留 Widget manifest 与声明资源；未知版本和非法包无副作用。
- 系统媒体与主音量通过封闭、可验证的 Core→Rust/Tauri 接口工作；不存在通用命令或不可信 Scene 直连入口。
- Widget manifest、限制与权限边界在 Schema、Rust/TS、fixtures、RPC 与正式文档中一致；不存在 v1 迁移或降级规则。
- 自动检查全部通过；用户明确回复“通过”后才允许合并 master。

## 验收记录

- 2026-08-31：用户确认六项开工决策和实施计划；从 `master@096eacd` 建立独立 worktree/分支，主 worktree 用户 Room 状态未触碰。
- 2026-08-31：早期契约阶段曾进入待验收；该“v2 只读”结论已被后续 v2-only 全链实现取代。
- 2026-08-31：35 个具名文件提交为 `c60141e`；未合并 master，等待用户人工验收。
- 2026-08-31：早期曾讨论保留 v1；该兼容要求随后由用户明确取消。
- 2026-08-31：用户明确要求继续完成 v2 后端，并追加当前系统媒体、Windows 主音量、前端接入清单和系统 API 手册；验收状态退回开发中，原契约提交作为基线保留。
- 2026-08-31：用户确认所有现有 Room 都是 demo，取消 v1 兼容、迁移与降级；DXT-003 改为原生 v2-only，完成前无需验收。
- 2026-09-02：v2-only 后端、Widget 资源全链、系统媒体/主音量接口、三份前端/安全/AI 文档和全部自动检查完成，重新进入待验收。
- 2026-09-02：实现与文档提交为 `695e3e7`；主 worktree 用户 `rooms/` 改动未触碰，分支停在待验收，用户明确通过前禁止合并 master。
