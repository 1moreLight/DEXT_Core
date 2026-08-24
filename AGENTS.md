# Dext 开发协作规范

## 每次会话开始必做（顺序执行）

1. 读 `dev_docs/PROJECT.md` —— 产品是什么、结构、已定决策、工作流命令
2. 读 `dev_docs/TODO.md` —— 总任务台账，看当前进行到哪一步
3. 读 `dev_docs/ERRORS.md` —— 踩坑记录，不要重复踩

## 工作纪律

- **动代码之前**先更新 `dev_docs/TODO.md`：把本轮要做的计划追加进去（只加不删）
- **每完成一步**立刻在 TODO.md 打标：`[x] 完成日期`；受阻用 `[!] 原因`
- 过程中遇到任何错误/坑，解决后**追加**到 `dev_docs/ERRORS.md`（追加式，勿删旧条目）
- 结构性决策变更记入 `PROJECT.md` 的「决策记录」小节（带日期）
- TODO 台账只加不删；废弃的条目标 `[x] 已取消(日期)` 而不是删除
- **每轮工作必须提供人工验收清单**：追加到 `dev_docs/ACCEPTANCE.md`（不放聊天消息里），用户亲自验证后在该文件打 `[x]`

## 环境要点速查

- 改了 C# / .proto → 必须先跑 `scripts/build.ps1` 再 `scripts/start.ps1`
- 只改前端（tauri-ui / wallpapers）→ `scripts/start.ps1` 即可
- 强制重铺壁纸：`cargo test --lib applies_room_wallpaper`（在 tauri-ui/src-tauri 下）
- Player 必须 Release 构建，Debug 会挂起（详见 ERRORS.md #1）
- 日志位置：`%LOCALAPPDATA%\Lively Wallpaper\logs\`
- 仓库已建 CodeGraph 索引：查代码优先 `codegraph explore/node`，其次 grep/read
