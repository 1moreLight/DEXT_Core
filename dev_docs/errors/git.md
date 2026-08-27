# 踩坑记录 · Git 协作篇（追加式，勿删旧条目）

> 格式：症状 / 根因 / 解决 / 防再犯
> 全量索引见 `../ERRORS.md`；其他分册：backend / frontend / renderer / toolchain

## 17. 并行会话共用一个工作区：git add 互相扫走对方的文件

- 症状：本轮新建 dev_docs/LIVELY_API.md 后 `git add <三个文件>` + commit，结果 commit 只含 2 个文件；
  新文件既不在 commit 里、也不在 status 未跟踪列表里，疑似丢失
- 根因：另一个并行会话在同一工作区做 Phase 9，其提交（70f0599）把磁盘上我已写好的 LIVELY_API.md
  一并 add 进去了；轮到我 add 时该文件已与 HEAD 一致 → 零差异 → 不进我的 commit。
  文件内容其实毫发无损，只是"搭了别人的车"入库
- 排查手法：`git log --all -- <文件>` 看它真正进的是哪个 commit；`git diff HEAD -- <文件>` 确认盘上内容
- 防再犯：多会话同仓库时 ①提交前 `git status --short` 核对清单 ②只 add 本轮明确改动的具名文件，
  慎用 `git add -A`/`git add .` ③发现文件"消失"先怀疑被并行提交收编，别急着重写

## 18. 并行会话在本工作区跑 git，未提交改动被冲（重灾版）

- 症状：编辑 App.tsx 报"文件不存在"；src 目录短暂消失后回来，但内容退回旧版本；git status 干净（磁盘=HEAD）
- 根因：另一会话（DEXT0.1 worktree）的 git reset/checkout 类操作跑到了**本工作区**（#17 的重灾版——那次只是 add 互扫，这次直接把未提交工作抹了）；此前对方的 Phase 9 提交还把本会话当时未提交的 App.tsx 中间态一并扫进了他们的 commit（双向互污）
- 解决：git 里还在的部分（CoverStack/自动播放/Rust 协议）直接用；纯前端丢失轮次凭记忆重做；**迭代期间暂停另一会话**；UI 迭代改为逐轮小提交防再冲
- 防再犯：①多会话并行时，各自只在自己 worktree 里跑 git；②任何会话跑 reset/checkout/clean 前先确认 cwd 是自己的 worktree；③UI 迭代轮次完成即 commit，不留大片未提交状态

## 20. 双仓库 + 幽灵 worktree 注册（2026-08-27 整理期发现）

- 症状：UI 会话与后端会话提交"打架"、提交内容错乱；`git worktree list` 出现不属于本仓库的 worktree
- 根因：开发初期把仓库整体复制了一份（midDOW → Orca/DEXT），复制时连 `.git/worktrees/` 注册表一起拷了。
  结果：①两个独立仓库内容相同但 .git 不同，各自检出同名分支（tauri-ui），一提交就分叉；
  ②被复制的 worktree（DEXT0.1）物理 .git 文件指向旧仓库，但新仓库注册表里也有它 → 幽灵注册，
  在新仓库里跑 worktree 命令会误伤旧仓库的注册
- 解决（2026-08-27）：定唯一主仓库（Orca/DEXT），master 快进到全部工作，退役误导性分支名；
  从旧仓库 `git worktree remove` 真实 worktree 后再 `git worktree prune` 清幽灵注册；
  旧仓库目录改名归档（只读备份，不再使用）
- 防再犯：①**全项目只保留一个仓库**，复制仓库 = 制造第二个真相源；
  ②worktree 注册表随 .git 拷贝会残留幽灵，新仓库必须 `git worktree prune`；
  ③检查双仓库：`git rev-parse --git-dir` 对比两边是否同一个路径
- 排查手法：`git worktree list` 出现 `prunable` 标记 = 幽灵注册；两个仓库同名分支哈希不同 = 已分叉
