# Dext 开发协作规范

## 每次会话开始必做（顺序执行）

1. 读 `dev_docs/PROJECT.md` —— 产品是什么、结构、已定决策、工作流命令
2. 读 `dev_docs/TODO.md` —— 总任务台账（当前），看进行到哪一步
3. 读 `dev_docs/ERRORS.md` —— 踩坑总索引，按主题翻分册（errors/git、backend、frontend、renderer、toolchain），不要重复踩

> 查接口（room.json 字段 / TRANSITIONS / Tauri commands / gRPC / IPC 消息）看 `dev_docs/README.md` 总纲。

## Git 协作纪律（2026-08-27 定，ERRORS #17/#18/#20 血泪）

- **全项目只有一个仓库**（Orca/DEXT），master 是唯一主线；新工作一律开分支 `feat/xxx`，做完合回即删
- **一个并行会话 = 一个独立 worktree + 独立分支**，git 命令只在自己 worktree 里跑
- 提交前 `git status --short` 核对清单；只 add 本轮改动的具名文件，**慎用 `git add -A`**
- UI/后端并行开发时：谁都不能在别人正在跑 git 的工作区里执行 reset/checkout/clean

## 工作纪律

- **动代码之前**先更新 `dev_docs/TODO.md`：把本轮要做的计划追加进去（只加不删）
- **每完成一步**立刻在 TODO.md 打标：`[x] 完成日期`；受阻用 `[!] 原因`
- 过程中遇到任何错误/坑，解决后**追加**到 `dev_docs/ERRORS.md`（追加式，勿删旧条目）
- 结构性决策变更记入 `PROJECT.md` 的「决策记录」小节（带日期）
- TODO 台账只加不删；废弃的条目标 `[x] 已取消(日期)` 而不是删除
- **每轮工作必须提供人工验收清单**：在对话结尾直接列出本轮全部验收步骤（不写入 md 文件），用户在对话中确认
- **每轮代码写完必须 git commit**（自测通过后提交，信息简明描述本轮改动）

## 环境要点速查

- 改了 C# / .proto → 必须先跑 `scripts/build.ps1` 再 `scripts/start.ps1`
- 只改前端（tauri-ui / wallpapers）→ `scripts/start.ps1` 即可
- 强制重铺壁纸：`cargo test --lib applies_room_wallpaper`（在 tauri-ui/src-tauri 下）
- Player 必须 Release 构建，Debug 会挂起（详见 ERRORS.md #1）
- 日志位置：`%LOCALAPPDATA%\Lively Wallpaper\logs\`
- 仓库已建 CodeGraph 索引（CLI v1.5.0）：**查代码一律先用 codegraph**（`explore` / `node` / `callers` / `impact`），grep/read 只做兜底
- CodeGraph 索引是快照，**不会自动跟随代码变化**：本轮动过代码后再查代码，先跑 `codegraph sync`（增量，秒级）；结果可疑时用 `codegraph status` 看 Pending Changes；大重构后用 `codegraph index` 全量重建
- 前端外观迭代：`scripts/room-preview.ps1` 实时预览（无需 Lively），指南见 `dev_docs/FRONTEND.md`
- 配置器 UI 设计：`cd tauri-ui && npm run dev:ui`（浏览器 1421，mock 数据，HMR），同见 FRONTEND.md 第零节
