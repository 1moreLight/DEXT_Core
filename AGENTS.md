# Dext 开发协作规范

## 每次会话开始必做（顺序执行）

1. 读 `dev_docs/README.md` —— 文档地图、当前状态入口、接口索引
2. 读 `dev_docs/ROADMAP.md` —— 当前工作包和唯一推荐下一项
3. 读 `dev_docs/TODO.md` —— 当前分支做到哪一步；没有当前工作包时不从旧条目猜任务
4. 读 `dev_docs/ERRORS.md` —— 按本轮涉及的主题翻对应分册，避免重复踩坑

涉及产品方向或数据模型时再读 `PROJECT.md` / `MODEL.md` / `DOCK.md`；执行细则统一看 `WORKFLOW.md`。

## 单任务交付纪律（2026-08-28 起）

- **一个任务 = 一个 ROADMAP 工作包 ID = 一个 worktree = 一个分支 = 一份独立验收文件**
- 默认一次只开发一个工作包；用户明确要求并行时也必须完全隔离
- 开工前写清一句话目标、范围外事项和人工验收步骤；无法独立验收就继续拆小
- 自测通过后提交到工作分支并停在“待验收”，**用户明确回复通过之前禁止合并 master**
- 验收不通过就在同一分支继续修；需求已经变成另一个结果时另开工作包
- 验收通过后才合并、更新状态、归档 TODO、删除已合并分支和 worktree

完整流程和验收模板见 `dev_docs/WORKFLOW.md`。

## Git 协作纪律（ERRORS #17/#18/#20）

- **全项目只有一个仓库**（Orca/DEXT），master 是唯一主线；主 worktree 只负责查看、合并和清理，不直接开发
- 新工作分支使用 `feat/<工作包ID>-<slug>`（修复可用 `fix/`，纯文档可用 `docs/`）；验收合回后即删
- **一个并行会话 = 一个独立 worktree + 独立分支**，git 命令只在自己 worktree 里跑
- 提交前 `git status --short` 核对清单；只 add 本轮改动的具名文件，**慎用 `git add -A`**
- UI/后端并行开发时：谁都不能在别人正在跑 git 的工作区里执行 reset/checkout/clean

## 记录纪律

- `ROADMAP.md` 是唯一全景计划，只允许一个“下一项”；`TODO.md` 只记录当前分支，不再堆产品 backlog
- **动代码之前**先在 TODO 追加本工作包计划，并建立 `dev_docs/acceptance/<ID>-<slug>.md`
- **每完成一步**立刻在 TODO 打标；受阻写原因和恢复条件
- 过程中遇到任何错误/坑，解决后**追加**到 `dev_docs/ERRORS.md`（追加式，勿删旧条目）
- 结构性决策变更记入 `PROJECT.md` 的「决策记录」小节（带日期）
- TODO 台账只加不删；废弃的条目标 `[x] 已取消(日期)` 而不是删除
- 历史状态文档不得宣称自己是当前计划；发现陈旧内容要标“历史”，当前状态回指 ROADMAP
- 每轮对话交付必须列出与独立验收文件一致的人工步骤，用户直接在对话中确认
- **每轮代码写完必须 git commit，但 commit 不等于完成；用户验收并合并后才算完成**

## 环境要点速查

- 改了 C# / .proto → 必须先跑 `scripts/build.ps1` 再 `scripts/start.ps1`
- 只改前端（tauri-ui / wallpapers）→ `scripts/start.ps1` 即可
- 强制重铺壁纸：`cargo test --lib applies_room_wallpaper`（在 tauri-ui/src-tauri 下）
- Player 必须 Release 构建，Debug 会挂起（详见 ERRORS.md #1）
- 日志位置：`%LOCALAPPDATA%\Dext\logs\`；首行包含 Dext 运行身份、PID、Core 绝对路径、数据目录和版本
- `scripts/start.ps1` 只按当前 worktree 构建出的 Core 规范化绝对路径判断已启动；其他安装或 worktree 的 `Lively.exe` 只报告，不停止也不复用
- `scripts/verify-runtime-identity.ps1` 只读报告 Core、Player、Watchdog、配置器路径，以及 Dext mutex、pipe、data、log 状态
- 仓库已建 CodeGraph 索引（CLI v1.5.0）：**查代码一律先用 codegraph**（`explore` / `node` / `callers` / `impact`），grep/read 只做兜底
- CodeGraph 索引是快照，**不会自动跟随代码变化**：本轮动过代码后再查代码，先跑 `codegraph sync`（增量，秒级）；结果可疑时用 `codegraph status` 看 Pending Changes；大重构后用 `codegraph index` 全量重建
- 前端外观迭代：`scripts/room-preview.ps1` 实时预览（无需 Lively），指南见 `dev_docs/FRONTEND.md`
- 配置器 UI 设计：`cd tauri-ui && npm run dev:ui`（浏览器 1421，mock 数据，HMR），同见 FRONTEND.md 第零节
