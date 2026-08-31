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
| #26 | Windows 无 Bash 时 Playwright 包装脚本不可用 | [toolchain](errors/toolchain.md) |
| #27 | apply_room 只覆盖不删除导致跨 Room 运行包污染 | [backend](errors/backend.md) |
| #28 | flex 节点内 `truncate` 未约束宽度仍会溢出 | [frontend](errors/frontend.md) |
| #29 | 撤回删除节点后选择状态仍指向不存在索引 | [frontend](errors/frontend.md) |
| #30 | 页面提交的 `__source` 造成任意路径回写 | [backend](errors/backend.md) |
| #31 | sandbox iframe 的完成消息与 WebView IPC 必须双层验源 | [renderer](errors/renderer.md) |
| #32 | Vite HMR 脚本被 sandbox opaque origin 的 CORS 拒绝 | [toolchain](errors/toolchain.md) |
| #33 | Tauri 开发态 origin 与发布态不同导致预览被拒绝 | [renderer](errors/renderer.md) |
| #34 | Core 同进程并发保存复用临时文件名 | [backend](errors/backend.md) |
| #35 | UI 按钮存在但真实 Tauri 链路仍走 mock/漏保存素材 | [frontend](errors/frontend.md) |
| #36 | 属性栏素材按钮只有外观、没有点击动作 | [frontend](errors/frontend.md) |
| #37 | PowerShell 管道吞掉原生构建失败，脚本仍显示 Done | [toolchain](errors/toolchain.md) |
| #38 | Core 身份只在配置器挂载时读取，退出后仍显示已连接 | [frontend](errors/frontend.md) |
| #39 | 独立 worktree 共享用户 Room 时，未合并字段会被旧分支严格校验阻断 | [backend](errors/backend.md) |
| #40 | master 源码已 Dext 化，但忽略的旧构建输出仍是 Lively，启动脚本只检查存在性而误启动 | [toolchain](errors/toolchain.md) |
| #41 | 新 worktree 没有 node_modules，启动脚本找不到 Tauri 后仍返回成功 | [toolchain](errors/toolchain.md) |
| #42 | PowerShell 条件表达式返回单个原生参数时退化成字符串，splat 后按字符传给 MSBuild | [toolchain](errors/toolchain.md) |
| #43 | Tauri `openPath` 有命令权限仍会被路径 scope 拒绝 | [frontend](errors/frontend.md) |
| #44 | Windows canonicalize 的 `\\?\` 前缀破坏 Room 活动态匹配 | [backend](errors/backend.md) |
| #45 | 普通 Rust 测试实际铺设壁纸并污染 Core 恢复布局 | [toolchain](errors/toolchain.md) |
| #46 | 删除 Room 复用 v1 内容校验导致旧/损坏 Room 无法清理 | [backend](errors/backend.md) |
| #47 | 普通窗口预览标记误当屏保标记会错误进入 idle | [backend](errors/backend.md) |

## 分册

- [git.md](errors/git.md) —— 仓库/分支/worktree/并行会话协作
- [backend.md](errors/backend.md) —— C# / Rust / RPC / 运行时
- [frontend.md](errors/frontend.md) —— 配置器 Tauri/React
- [renderer.md](errors/renderer.md) —— wallpapers/dext-room 渲染器
- [toolchain.md](errors/toolchain.md) —— PowerShell / 编码 / 环境

> 排障时：先想这个坑属于哪一层 → 直接翻对应分册 → 没有再看索引找邻近主题。
