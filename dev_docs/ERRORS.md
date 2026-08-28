# 踩坑记录 · 总索引（追加式，勿删旧条目）

> 按主题分五册，**编号全局唯一**，任何文档里的 `ERRORS #N` 引用都有效。
> 新坑按主题写进对应分册，编号继续递增。

| 编号 | 主题 | 分册 |
|---|---|---|
| #1 | RPC 超时 + Player Debug 分支 | [backend](errors/backend.md) |
| #2 | tonic 连不上（自定义线协议） | [backend](errors/backend.md) |
| #3 | protox 拒绝 BOM | [backend](errors/backend.md) |
| #4 | 切桌永久卡死（缺字段兜底） | [renderer](errors/renderer.md) |
| #5 | 配置器无 CSS | [frontend](errors/frontend.md) |
| #6 | WorkerW Z-order（虚拟显示器） | [toolchain](errors/toolchain.md) |
| #7 | WebView2 虚拟主机限制 | [backend](errors/backend.md) |
| #8 | PS5.1 读 UTF-8 中文乱码 | [toolchain](errors/toolchain.md) |
| #9 | PS 写文件加 BOM / 中文正则漏匹配 | [toolchain](errors/toolchain.md) |
| #10 | node -e $1 被 PS 吞 | [toolchain](errors/toolchain.md) |
| #11 | WebWebView2 path 是文件非文件夹 | [backend](errors/backend.md) |
| #12 | File.Exists 判断文件夹恒 false | [backend](errors/backend.md) |
| #13 | WriteAllText 目录 + 裸 catch 吞异常 | [backend](errors/backend.md) |
| #14 | $1 被 PS 吞（第三次） | [toolchain](errors/toolchain.md) |
| #15 | 设计模式 invoke TypeError | [frontend](errors/frontend.md) |
| #16 | PS 控制台乱码 ≠ 文件乱码 | [toolchain](errors/toolchain.md) |
| #17 | 并行会话 git add 互扫 | [git](errors/git.md) |
| #18 | 并行会话冲掉未提交改动 | [git](errors/git.md) |
| #19 | SVG polyline 不支持 % 坐标 | [renderer](errors/renderer.md) |
| #23 | vite root 限定 → rooms 返回 HTML 兜底 | [toolchain](errors/toolchain.md) |
| #22 | DockEditor 先写后编译 + TS 语法进 .js | [frontend](errors/frontend.md) |
| #21 | 令牌重构吃掉 CSS 属性名 | [renderer](errors/renderer.md) |
| #20 | 双仓库 + 幽灵 worktree 注册 | [git](errors/git.md) |
| #24 | 配置器预览状态还在但 iframe 已被 UI 改版移除 | [frontend](errors/frontend.md) |
| #25 | 前端编译目标不支持 `Array.prototype.at` | [frontend](errors/frontend.md) |

## 分册

- [git.md](errors/git.md) —— 仓库/分支/worktree/并行会话协作
- [backend.md](errors/backend.md) —— C# / Rust / RPC / 运行时
- [frontend.md](errors/frontend.md) —— 配置器 Tauri/React
- [renderer.md](errors/renderer.md) —— wallpapers/dext-room 渲染器
- [toolchain.md](errors/toolchain.md) —— PowerShell / 编码 / 环境

> 排障时：先想这个坑属于哪一层 → 直接翻对应分册 → 没有再看索引找邻近主题。
