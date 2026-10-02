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
| #48 | v2 降级保护误把源占位目录升级为新的 v1 校验前置条件 | [backend](errors/backend.md) |
| #49 | Windows 系统媒体 API 与封面流可能永久阻塞 | [backend](errors/backend.md) |
| #50 | Player 目标框架缺少较新的 ASCII 字符判断 API | [toolchain](errors/toolchain.md) |
| #51 | 条件挂载画布的测量 effect 未依赖视图，流程连线为空 | [frontend](errors/frontend.md) |
| #52 | 自动检查全绿但未逐条对照计划，导致缺失真实入口仍过早进入待验收 | [frontend](errors/frontend.md) |
| #53 | start.ps1 的 Tauri 端口被同一 worktree 的残留 Vite 监听占用 | [toolchain](errors/toolchain.md) |
| #54 | v2 LivelyInfo 已带命名空间仍被 Player 启动参数适配器重复加前缀 | [backend](errors/backend.md) |
| #55 | 切 Desk 后能力实例未收到新的 desk.read 快照 | [renderer](errors/renderer.md) |
| #56 | Player 暂停后能力桥仍持续推送周期性数据 | [renderer](errors/renderer.md) |
| #57 | WebView 文档销毁仅依赖自然回收，后台轮询和实例没有统一失效点 | [renderer](errors/renderer.md) |
| #58 | Creator 隔离预览 token 无期限导致 staging 长期保留 | [backend](errors/backend.md) |
| #59 | 配置器只识别单一断线文案，其他连接错误被误报为身份拒绝 | [frontend](errors/frontend.md) |
| #60 | Creator 报告只显示资源数量且忙碌时可关闭造成导入竞态 | [frontend](errors/frontend.md) |
| #61 | 运行诊断命令只有导出入口，配置器内无法查看当前运行态 | [frontend](errors/frontend.md) |
| #62 | Creator confirm/discard 有 TTL 但预览资源服务仍可读取过期 token | [backend](errors/backend.md) |
| #63 | Creator 预览 URL 未复用资源路径规则，Windows 特殊路径字符可能进入服务端拼接 | [backend](errors/backend.md) |
| #64 | Offline Boundary 误判首航 Source（about:blank≠空串），Player 每次铺壁纸导航被取消黑屏 | [backend](errors/backend.md) |
| #65 | 真桌面跨层拖拽（桌面↔Dock）两版实机均不稳定，方向已取消；重启需先立输入链研究包 | [renderer](errors/renderer.md) |
| #66 | 与 LivelyInfo.json 重复追加 `--wallpaper-system-information`，Player 退出码 87 壁纸应用失败 | [backend](errors/backend.md) |
| #67 | dev 端口 1420/1423 落入 Windows 保留端口区，vite EACCES；dev 迁至 1620/1621 | [toolchain](errors/toolchain.md) |
| #68 | Lively 注入负载是 JSON 字符串未 parse，能力桥硬件/媒体/频谱静默全空 | [renderer](errors/renderer.md) |
| #69 | P1 能力"自动允许"未落地，授权 store 缺失时全部只读能力被静默丢弃 | [renderer](errors/renderer.md) |
| #70 | Playwright 测试放在 npm 包目录外时无法从测试文件位置解析 `@playwright/test` | [toolchain](errors/toolchain.md) |
| #71 | Playwright `*.spec.ts` 被同包 Vitest 一并发现，导致生命周期 API 冲突 | [toolchain](errors/toolchain.md) |
| #72 | 拖拽预览未清理稳定计时器/取消事件/过期异步回调，导致离开后仍交换或取消时提交 | [renderer](errors/renderer.md) |
| #73 | 布局 FLIP 与长按 jiggle 未分层展示，浏览器实验台看起来替换了苹果式编辑模式 | [renderer](errors/renderer.md) |
| #74 | reduced-motion 只在下一次布局生效，动画中途切换和系统偏好仍保留 FLIP/jiggle | [renderer](errors/renderer.md) |
| #75 | 把图标重排理解成两两交换，无法形成托起、占位和路径让位的 Sortable 语义 | [renderer](errors/renderer.md) |
| #76 | 拖入非法目标或 Reset 时只隐藏占位，旧路径布局/托起样式可能残留 | [renderer](errors/renderer.md) |
| #77 | Reset 只重置画面却未终止 pointer capture 与长按计时，后续事件会再次改写布局 | [renderer](errors/renderer.md) |
| #78 | 多段预览共用旧 `previewBase`，新手势取消会跳回更早的场景布局 | [renderer](errors/renderer.md) |
| #79 | 非 Reset 场景切换未取消真实拖拽，旧 pointerup 会覆盖新场景结果 | [renderer](errors/renderer.md) |
| #80 | Widget jiggle 只挂内容层，造成文字动而边框静止的割裂效果 | [renderer](errors/renderer.md) |
| #81 | Playwright 对持续旋转元素执行双击会因“元素不稳定”超时 | [toolchain](errors/toolchain.md) |
| #82 | 拖拽回归未先断言进入 dragging，缺失手势实现也可能得到取消/未保存的假绿终态 | [renderer](errors/renderer.md) |
| #83 | Dock 安全余量混用 Room 逻辑像素与屏幕像素，旋转外接框仍可能侵入禁区 | [renderer](errors/renderer.md) |
| #84 | 通用 abort 假定 pressing 也有 baseIcons，restore 会误清已发布图标快照 | [renderer](errors/renderer.md) |
| #85 | reduced-motion 只关 transition/animation，hover 与托起 transform 仍然位移 | [renderer](errors/renderer.md) |
| #86 | 在 window capture 阶段监听 blur，会把控件失焦误判成窗口失焦 | [renderer](errors/renderer.md) |
| #87 | 异步场景未等待实际发布，reduced-motion 测试可能假绿或偶发读到动画 | [toolchain](errors/toolchain.md) |
| #88 | Playwright 用真实时间验证 80ms 短窗口，跨进程断言可能在窗口结束后才开始 | [toolchain](errors/toolchain.md) |
| #89 | 图标命中区由内容自适应撑开，长短名称造成框体宽度和中心不一致 | [renderer](errors/renderer.md) |
| #90 | 固定预览属性常驻会屏蔽真实 hover/press，使实验台看似不能点击 | [renderer](errors/renderer.md) |
| #91 | 布局 cell 与命中框分设尺寸，调试边界永远无法重合且难以管理 | [renderer](errors/renderer.md) |
| #92 | 隐藏图标名称后仍保留标签高度，产生无意义空白命中区且尺寸读数易失真 | [renderer](errors/renderer.md) |
| #93 | 把编辑 jiggle 放在 `.icon-face` 会连带文字；“图标文字不抖”需求澄清后应只动画 `.icon-visual` | [renderer](errors/renderer.md) |
| #94 | renderer Playwright 使用 strictPort，自行启动的 5174 预览会阻止测试 webServer 启动 | [toolchain](errors/toolchain.md) |
| #95 | 共享 Glyph 渐变读取 `--icon-color`，真实桌面只写 backgroundColor 会让图标退回默认蓝色 | [renderer](errors/renderer.md) |
| #96 | reduced-motion 若清除整个 face transform，会连拖动所需 pointer translate 一并抹掉 | [renderer](errors/renderer.md) |
| #97 | 浏览器实验台可跨目录加载共享资源，但 WebView2 本地虚拟主机只映射生产 Room 目录，兄弟路径会令真实桌面黑屏 | [renderer](errors/renderer.md) |
| #98 | 长按进入编辑时先清空 pressing 事务，同一 pointer 无法继续拖动，只能松手回原位 | [renderer](errors/renderer.md) |
| #99 | 把长按续拖、原格锚定和 80ms 候选延迟叠在一起，会偏离已验收 Sortable 并造成难触发/跳动 | [renderer](errors/renderer.md) |
| #100 | Chromium 回归全绿不能证明 WorkerW/WebView2 的真实指针链可靠；连续修补失败后应整体回退生产交互边界 | [renderer](errors/renderer.md) |
| #101 | 保留旧拖动函数却删除唯一绑定调用，会形成看似可回退、实际永远不执行的死代码 | [renderer](errors/renderer.md) |
| #102 | 图标实验台重定义共享间距 CSS，造成真实桌面和实验台使用不同档位几何 | [renderer](errors/renderer.md) |
| #103 | Core 把鼠标移动的按键状态写成 0x20（侧键），破坏 WebView2 pointer capture；前端取消会放大旧输入错误 | [backend](errors/backend.md) |
| #104 | 配置器在异步 Room 审计完成前写编辑状态，严格校验失败后表现为“编辑无反应” | [frontend](errors/frontend.md) |
| #105 | 隔离 Player 的 geometry 缩放不一定反映在 devicePixelRatio，原生消息测试需用实收事件校准坐标 | [toolchain](errors/toolchain.md) |
| #106 | 浏览器 releasePointerCapture 后 lostpointercapture 需下一次指针事件才派发，测试不能立即断言回滚 | [toolchain](errors/toolchain.md) |
| #107 | 两个 Playwright 进程共用 renderer 测试端口和产物目录，可能出现端口拒绝与视频 ENOENT | [toolchain](errors/toolchain.md) |
| #108 | 图标深拷贝无条件展开可选 `launch`，会把旧 Glyph 图标保存成不符合 Schema 的空启动对象 | [renderer](errors/renderer.md) |
| #109 | WebView2 Player 退出后临时 user-data 仍可能短暂锁定，夹具清理需受限重试 | [toolchain](errors/toolchain.md) |
| #110 | 配置器先检查 Core 文件再探测运行身份，文件缺失时反而隐藏“启动 Core”重试入口 | [backend](errors/backend.md) |
| #111 | 用 Core 可执行文件发送 shutdown 时遇到单实例退出竞态，辅助进程反成新 Core 并锁住构建输出 | [backend](errors/backend.md) |
| #112 | 一次性过渡计时器遇系统时钟回拨会提前触发，若不重排将永久保留目标过渡 | [backend](errors/backend.md) |
| #113 | 会话入口只核对 RoomId 会让旧安装快照或绕过入口启动的内核会话被新视图读取 | [backend](errors/backend.md) |
| #114 | 协调者连接可调用视图切页请求，角色权限少了一道拒绝检查 | [backend](errors/backend.md) |
| #115 | 关闭订阅时在网关锁内同步等待内核观察者锁，可与并发推送形成锁顺序死锁 | [backend](errors/backend.md) |
| #116 | 订阅的初始回调可同步改变会话，返回值若仍用订阅前快照会落后于已推送修订 | [backend](errors/backend.md) |
| #117 | checkpoint 读取先用 File.Exists 并吞掉 IO/权限异常，会把不可读存储误报成无恢复点 | [backend](errors/backend.md) |
| #118 | 内核测试汇总把总数写死为 8，新用例通过时仍显示 8/8，掩盖实际覆盖数量 | [toolchain](errors/toolchain.md) |
| #119 | 多 worktree 各自保留数 GB Rust `target`，新配置器首次编译耗尽 C 盘并可能中断文件写入 | [toolchain](errors/toolchain.md) |
| #120 | 外置 `CARGO_TARGET_DIR` 让配置器只认内置 target 路径，误判同分支 Core 不可连接 | [backend](errors/backend.md) |
| #121 | WebView2 的 `msg_wploaded` 可早于异步 `room.json` 加载，过早发送会话快照会被页面重置 | [renderer](errors/renderer.md) |
| #122 | WorkerW 内的 Player 窗口不是普通顶层窗口，实机探针不能只用 `EnumWindows` 找输入 HWND | [toolchain](errors/toolchain.md) |
| #123 | JSON Schema 将公开 config 限为对象，但原生递归校验接受数组/字符串，会造成跨入口契约分歧 | [backend](errors/backend.md) |
| #124 | 原生v3校验抛InvalidDataException而准入边界未捕获，篡改包变成未处理异常 | [backend](errors/backend.md) |
| #125 | 新worktree不带忽略的CodeGraph索引；CLI文件分页参数是offset/limit | [toolchain](errors/toolchain.md) |
| #126 | Rust与Core对Unicode资源顺序、重复JSON键和null配置处理不同，安装成功后准入失败 | [backend](errors/backend.md) |
| #127 | file URI scheme大小写敏感检查漏掉FILE:，公开配置可能携带私人路径 | [backend](errors/backend.md) |
| #128 | 已安装样包摘要与Git换行过滤冲突，新Windows检出后摘要失效 | [toolchain](errors/toolchain.md) |

## 分册

- 2026-09-21 拖动反馈修正：图标 face 的 180ms transform 过渡叠加预览时外层坐标重排，会导致跟手滞后、跳动；拖起对象外层需固定，只对其他对象执行 FLIP。空白退出需监听整个 document，并排除指针捕获重定向到的 `.icon` 和其他交互对象。连续 12 次真实指针拖放已验证。
- 2026-09-21 排序模型纠正：真实图标改回最早验收的两段式 Sortable；长按只进编辑，编辑态再次按下拖动，跨格立即占位，拖起对象外层落目标格、内层补偿到指针下。上一条“同一 pointer 续拖 + 外层固定 + 80ms 延迟”结论已由 #99 取代。空白双击在 document 捕获阶段处理。

- [git.md](errors/git.md) —— 仓库/分支/worktree/并行会话协作
- [backend.md](errors/backend.md) —— C# / Rust / RPC / 运行时
- [frontend.md](errors/frontend.md) —— 配置器 Tauri/React
- [renderer.md](errors/renderer.md) —— wallpapers/dext-room 渲染器
- [toolchain.md](errors/toolchain.md) —— PowerShell / 编码 / 环境

> 排障时：先想这个坑属于哪一层 → 直接翻对应分册 → 没有再看索引找邻近主题。

| #129 | 暂存写入和最终发布先检查路径后操作，链接/目录替换可越过校验 | [backend](errors/backend.md) |
| #130 | FILE_RENAME_INFO长度不含NUL，但FileName缓冲区必须提供终止符 | [backend](errors/backend.md) |

| #131 | Explorer代启成功分支未传应用arguments，私有绑定启动丢失参数 | [backend](errors/backend.md) |
| #132 | 桌面暂停状态错误阻止仍可见Dock的绑定动作 | [backend](errors/backend.md) |

| #133 | 动作缓存授权后等待个人读取，关闭/撤权/修改已生效却仍派发旧应用 | [backend](errors/backend.md) |
