# DXT-002 Room 待机画面接入 验收

- 状态：待验收
- 分支：`feat/dxt-002-idle-screensaver`
- 提交：`f140603`（最新 master 刷新实现）
- 目标：复用 Lively Core 屏保链，让 Room 的可选 `idle` 内容在独立屏保实例中持续显示到唤醒，同时移除普通关闭时的 end 动画等待。
- 范围外：旧 Room 迁移、Room zip、成组 HTML 导入、Dock 改造、新待机计时器和 Dext 待机设置页。

## 自动检查

- [x] `python scripts/validate-room-schema.py`：正反夹具全部通过，`end` 被拒绝。
- [x] `node --check wallpapers/dext-room/main.js` 与 `git diff --check master...HEAD` 通过。
- [x] `cargo check`、`cargo test --lib`：22 项通过，2 项显式活体测试按规定忽略。
- [x] `npm test`：6 项通过；`npm run build` 生产构建通过。
- [x] `scripts/build.ps1` 完成 C#、Release Player、Watchdog 与插件部署。
- [x] `scripts/start.ps1` 与 `scripts/verify-runtime-identity.ps1`：Core/配置器来自本 worktree，Dext 产品、mutex、pipe、data、log 身份正确。
- [x] Playwright 1440×900 浏览器态检查：待机节点独立显示，属性栏图片/HTML/视频入口存在，控制台 0 error / 0 warning。
- [x] Git 差异不包含 DOCK-004、主 worktree 用户 `rooms/` 或范围外重构；QA 产物未进入仓库。

## 人工验收

1. [ ] 打开 Room 编辑器，确认导图中存在不连接 Desk 的“待机画面”节点。
2. [ ] 分别选择图片、视频和自包含 HTML，确认素材进入 `idle/`，预览立即切到纯待机画面，保存并重开后仍保留。
3. [ ] 启动 Lively 屏保，确认待机实例不播放 start、不显示 Desk 图标或 Dock，并覆盖整个桌面。
4. [ ] 确认图片持续显示、视频静音循环、HTML 持续运行且不会因 `done` 或 60 秒超时退出。
5. [ ] 移动鼠标、点击或按键后，屏保立即关闭并回到待机前的 Desk，不重播 start。
6. [ ] 删除 Room 的 `idle` 后再次启动屏保，确认始终显示黑屏。
7. [ ] 普通预览、应用 Room、切换 Room、关闭壁纸和退出 Lively 不会误进待机，也不再等待 end 动画。
8. [ ] 分别选择 Lively 的“当前壁纸”和“单独屏保壁纸”，确认对应 Dext Room 都读取自己的 `idle`。
9. [ ] 验证 Lively 现有待机时间、淡入、音量、多屏和唤醒锁屏设置仍然有效，room.json 不新增这些运行偏好。

## 通过标准

- Room Schema、配置器、Rust 持久化、Lively 屏保启动标记和渲染器使用同一套 `idle` 语义。
- 普通关闭立即完成；待机完全由 Lively 生命周期控制；原桌面实例和当前 Desk 不受影响。
- 自动检查通过，用户明确验收后才允许合并 master。

## 验收记录

- 2026-08-30：用户确认实施 DXT-002 计划；开发 worktree、分支和验收卡已建立。
- 2026-08-30：Schema/JS/前端/Rust/C# 自动检查通过；真实配置器只读预验收确认独立待机节点、三类素材按钮、待机黑屏预览及切回普通 Desk 预览均正常，未保存或修改测试 Room。
- 2026-08-31：用户明确确认“采用 idle、废弃 end”；本分支开始更新到最新 master，旧自动检查结果不作为本轮最终结果，需全部重跑。
- 2026-08-31：实现重放到 master `da24514` 后提交为 `f140603`；Schema、JS、前端、Rust、C# Release 构建、Dext 身份启动和浏览器态视觉检查全部通过，进入待用户真机验收。
