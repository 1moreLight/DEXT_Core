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

## P5新增错误索引

| 编号 | 现象 | 分册 |
|---|---|---|
| #134 | 消费者重报同一几何仍递增版本，会形成全实例通知/重报循环 | [renderer](errors/renderer.md) |
| #135 | SDK初始化回调中销毁后仍发ready，已销毁ready返回旧身份 | [renderer](errors/renderer.md) |

| #136 | 输入探针显式链接Protocol源码但遗漏新增依赖，独立编译出现CS0246 | [backend](errors/backend.md) |

| #137 | 新命令未重设CARGO_TARGET_DIR，重复生成本地target且identity误报配置器OTHER | [toolchain](errors/toolchain.md) |

| #138 | Core快照完整但Player两次投影丢queue/deadline/安装/生命周期字段 | [backend](errors/backend.md) |
| #139 | ReleasePlayer已退出但WebView暂存锁延迟释放，探针清理掩盖原始失败 | [toolchain](errors/toolchain.md) |

| #140 | 媒体槽缺少阶段消费者且前台变化不推进修订，启动/待机输入可能失效后复活 | [backend](errors/backend.md) |

| #141 | 会话首帧默认可操作，事后分别补锁屏和前台会暴露短暂错误状态 | [backend](errors/backend.md) |

| #142 | Framework Player标准输出编码不同，Unicode跨Core管道变成替换字符 | [backend](errors/backend.md) |

| #143 | 重复Resume推进异步修订，首次恢复完成时不再重放最后快照 | [backend](errors/backend.md) |

| #144 | JSON Desk标量/null未先验形状，读取id时抛JValue异常 | [backend](errors/backend.md) |

| #145 | 隔离Player探针误用无效reload命令及未部署的构建路径 | [toolchain](errors/toolchain.md) |

| #146 | 启动时WorkerW层级不符进入现有纠正分支，身份成功不能替代物理验收 | [backend](errors/backend.md) |

| #147 | 合法240字节资源相对路径叠加安装目录超过MAX_PATH，原生CreateFileW需扩展绝对路径 | [backend](errors/backend.md) |
| #148 | Worker构造成功不代表执行成功，CSP可通过异步error拒绝 | [toolchain](errors/toolchain.md) |
| #149 | Connection-Allowlist禁止ICE但仍允许RTC构造，SecurityError自检误判Runtime | [backend](errors/backend.md) |
| #150 | 禁RTC策略不注册mDNS接口而RTC工厂仍请求，WebView2可因bad Mojo终止renderer | [backend](errors/backend.md) |

| #151 | 未跟踪新文件不在git diff --check中，须暂存后再次检查 | [toolchain](errors/toolchain.md) |

| #152 | Json.NET强制转换会接受小数整数、数字字符串及缺省几何字段 | [backend](errors/backend.md) |
| #153 | RawKeyboardFlags为位集，E0与UP组合误判DOWN，转发不能一律加extended | [backend](errors/backend.md) |
| #154 | 隔离Player默认最小化且探针DPI模式不同，客户区0或虚拟化尺寸误判输入几何 | [toolchain](errors/toolchain.md) |
| #155 | 状态探针参数是期望Desk/inactive，工作树路径不能当状态 | [toolchain](errors/toolchain.md) |
| #156 | PowerShell成功流重定向不保留Write-Host信息流 | [toolchain](errors/toolchain.md) |

| #157 | Python默认GBK读取UTF8失败及多行成员插入点错误，编辑脚本可部分执行 | [toolchain](errors/toolchain.md) |

| #158 | SetParent自动加入WS_CLIPSIBLINGS，原始样式须在重挂后再恢复 | [backend](errors/backend.md) |
| #159 | GetParent返回popup owner；重挂置顶回执成功但实际TOPMOST缺失 | [backend](errors/backend.md) |

| #160 | 迟到的旧play Promise按旧epoch暂停了新播放意图 | [renderer](errors/renderer.md) |
| #161 | 非行锚插入失败后仍运行未知探针模式，默认输入PASS冒充媒体 | [toolchain](errors/toolchain.md) |

| #162 | 渲染活动与输入operable耦合，失焦关输入误暂停仍应播放的实例 | [renderer](errors/renderer.md) |
| #163 | 数据订阅失败先关闭provider，错误回执被当前provider校验丢弃 | [renderer](errors/renderer.md) |

| #164 | Player暂停只缓存Core快照，媒体活动期限未同步停止，恢复前可按旧修订完成 | [backend](errors/backend.md) |
| #165 | 新官方JS未加入有限资源白名单，模块缺失导致后续测试命令超时 | [backend](errors/backend.md) |
| #166 | Unicode夹具与同文件期望同时乱码仍通过，独立原生wire期望才能发现 | [toolchain](errors/toolchain.md) |

| #167 | 硬件采样失败仍推零值且跳过等待可能忙循环 | [backend](errors/backend.md) |
| #168 | 异步数据源恢复的命令回执不表示SDK读数已到达 | [toolchain](errors/toolchain.md) |
| #169 | Windows媒体SourceAppId可能是绝对可执行路径 | [backend](errors/backend.md) |

| #170 | Player使用TryGetWebMessageAsString，原生postMessage对象会被拒绝（含顶层输入dispatch回执补充） | [backend](errors/backend.md) |

| #171 | 官方页缓存先占用畸形快照修订，后续合法状态会被误判旧 | [renderer](errors/renderer.md) |
| #172 | Core几何admission忙返回staleInput，单次发布会永久关闭输入 | [renderer](errors/renderer.md) |
| #173 | 异步宿主替身必须返回Promise；C#闭包使用前先初始化捕获上下文 | [toolchain](errors/toolchain.md) |


| #174 | 当前SDK Frame.IsDestroyed返回int，必须用实际签名 | [toolchain](errors/toolchain.md) |
| #175 | 原生帧异步化后report须等指定Core修订及geometry ready | [toolchain](errors/toolchain.md) |
| #176 | Frame.Destroyed内注销COM事件造成WebView原生崩溃 | [backend](errors/backend.md) |
| #177 | 迟到play事件不能恢复作者已pause的播放意图 | [renderer](errors/renderer.md) |

| #178 | 旧修订或销毁后的权限查询失败回调写入当前诊断 | [renderer](errors/renderer.md) |
| #179 | 新快照先更新iframe再推进原生identity，当前授权请求被拒为staleInput | [renderer](errors/renderer.md) |

| #180 | WebAudio保护方法可被借到未跟踪context或外域硬件destination | [renderer](errors/renderer.md) |
| #181 | 捕获Array.push/splice仍能经继承索引setter与species泄露私有记录 | [renderer](errors/renderer.md) |
| #182 | 私有策略普通对象回执被Object.prototype.toJSON拦截或伪造 | [renderer](errors/renderer.md) |

| #183 | 只检查存储JSON字节/深度，4097项小数组仍越过公开容器限制 | [backend](errors/backend.md) |

| #184 | Core通用原生IPC日志把消费者私有KV值写入诊断 | [backend](errors/backend.md) |
| #185 | 只设置桌面前台不能解除grid算法对最大化可见窗口的暂停 | [toolchain](errors/toolchain.md) |
| #186 | File.ReadAllText默认共享方式不能读取运行中的NLog写入文件 | [toolchain](errors/toolchain.md) |

| #187 | 无作者默认动作的按钮只有个人TargetId时，解析为空动作且不显示绑定 | [backend](errors/backend.md) |

| #188 | 原生鼠标UP生成完成证明但NotifyNative传false，画布默认按钮不收到激活 | [backend](errors/backend.md) |
| #189 | 导航先推进Core修订，私有宿主提前取消真实动作回执并误报staleInput | [backend](errors/backend.md) |
| #190 | 输入探针误用未提供的operable诊断字段；COM Type与Protobuf.Type名称冲突 | [toolchain](errors/toolchain.md) |
| #191 | 聚焦Progman/应用列表缺项不等于桌面可点击，凭据宿主可覆盖真实命中；重启前台需复核 | [toolchain](errors/toolchain.md) |


| #192 | 控制探针并发前置/计时接口/标题容量/参数和真实进程名核对 | [toolchain](errors/toolchain.md) |
| #193 | Windows控制等锁和解析设备后才取消，写入前必须复核 | [backend](errors/backend.md) |

| #194 | 退出夹具读取未完成展示的确认窗、覆盖窗口命中及恢复异常掩盖主失败 | [toolchain](errors/toolchain.md) |

| #195 | 生命周期探针误用协调器角色/无存储夹具、未暴露桌面与非活动HTML done计时 | [toolchain](errors/toolchain.md) |
| #196 | Player退出只解绑而不退役会话会覆盖已提交Desk；主动关闭与故障恢复须分开 | [backend](errors/backend.md) |

| #197 | GIF状态暂停并非画面冻结；原生WebView暂停需要可见性与展示完成屏障 | [renderer](errors/renderer.md) |

| #198 | WinForms隐藏不等于原生controller隐藏，暂停可报ERROR_INVALID_STATE | [renderer](errors/renderer.md) |
| #199 | 布局与暂停探针必须核对真实接口、活动消息与附着后的DPI | [toolchain](errors/toolchain.md) |

| #200 | 显式损坏个人图标覆盖不能回退作者默认值 | [renderer](errors/renderer.md) |

| #201 | 精确多边形不能用包围框签输入；同动作不同呈现实例需分开 | [backend](errors/backend.md) |
| #202 | 几何交点舍入与SVG焦点隐藏属性 | [renderer](errors/renderer.md) |
| #203 | 转场deadline/JArray层次与精确几何夹具复制清单 | [toolchain](errors/toolchain.md) |

| #204 | 子文档借用属性getter会暴露父文档隐藏输入wrapper | [renderer](errors/renderer.md) |
| #205 | 捕获RegExp.test仍会进入作者覆盖的exec | [renderer](errors/renderer.md) |
| #206 | 新snapshot修订不能复活已撤销的原生文档nonce | [backend](errors/backend.md) |

| #207 | 原生Window默认receiver/onerror多参数与收养节点currentTarget须保持真实派发语义 | [renderer](errors/renderer.md) |

| #208 | UP时分配序号无法在DOWN关联原生frame；长按截止时不能新建完成 | [backend](errors/backend.md) |

| #209 | 输入文档描述误用于嵌套媒体frame；旧Player需显式Compile且无Environment.ProcessId | [backend](errors/backend.md) |

| #210 | 原生SDK wire通过不等于整轮通过；WebView profile退出后仍短暂占用 | [toolchain](errors/toolchain.md) |

| #211 | WinForms.Focus未使非激活Player派发键；先原生controller再路由作者frame | [renderer](errors/renderer.md) |

| #212 | 归一化多边形宽度的机器舍入不能用严格等于测试 | [renderer](errors/renderer.md) |

| #213 | 源动作夹具需进入desktop并沿创建票据的bridge确认；短路out变量不能靠Require推断赋值 | [toolchain](errors/toolchain.md) |
| #214 | 键盘回执夹具fire需先给receiver；部分文件文本替换失败只接续未写入部分 | [toolchain](errors/toolchain.md) |
| #215 | SVG焦点若只画边界快照会留在旧坐标；移动轮廓须本地随帧重算 | [renderer](errors/renderer.md) |

| #216 | 单个焦点gesture丢连续Tab；早到键必须等待最终焦点并保留原QPC | [backend](errors/backend.md) |

| #217 | 作者纯矩阵逐帧重发几何并清焦点；取样保持需排最新视觉帧 | [renderer](errors/renderer.md) |
| #218 | 持续样包旧SDK与小窗口有效布局叠加；设计基准不代替多尺寸 | [toolchain](errors/toolchain.md) |

| #219 | 作者固定矩阵不能叠加小窗口有效布局；publish中geometry信号需保留 | [renderer](errors/renderer.md) |
| #220 | 探针提前读取尚未挂载组件导致自身轮询中断 | [toolchain](errors/toolchain.md) |

| #221 | 零序号取最近完成的旧回退让迟到动作借用新输入 | [backend](errors/backend.md) |
| #222 | dotnet run未知参数进入测试程序；部署与实际Player回归须按依赖等待 | [toolchain](errors/toolchain.md) |

| #223 | P6工具脚本默认GBK和JS模板转义导致执行中断；UI主题需等绘制后截图 | [toolchain](errors/toolchain.md) |
| #224 | 持续样包两Desk重复图标ID，正式Rust契约会拒绝 | [renderer](errors/renderer.md) |

| #225 | 非规范宿主路径使原生主机哈希不同；排队回执冒称应用成功 | [backend](errors/backend.md) |
| #226 | 原生库改名返回扩展路径，选中状态与库列表不匹配 | [frontend](errors/frontend.md) |
| #227 | P6原生选择器夹具/诊断cwd/选择器前缀及正常退出顺序 | [toolchain](errors/toolchain.md) |

| #228 | Dock组件只有按钮几何准入，不能按Scene发布occupied；固定框需由官方宿主避让 | [renderer](errors/renderer.md) |

| #229 | worktree复用node_modules junction后Vite字体落在默认fs.allow之外，预览403但构建正常 | [toolchain](errors/toolchain.md) |

| #230 | 配置器授权控件等待真实持久化后确认；不透明Player帧按DOM定位，关窗不为探针扩JS权限 | [toolchain](errors/toolchain.md) |

| #231 | ActiveRoom实际camelCase来源字段错误使本机面板不可用 | [frontend](errors/frontend.md) |
| #232 | 视觉定位误用桌面动作operable条件；独立可见几何，保留输入规则 | [renderer](errors/renderer.md) |

| #233 | 目标库/定位回执丢未保存按钮选择；绑定状态需采用当前有效动作 | [frontend](errors/frontend.md) |

| #234 | 删除目标成功须关闭同ID旧表单，避免保存意外重建 | [frontend](errors/frontend.md) |

| #235 | 普通图标新增须同时检查Desk图标与Room按钮额度；已有按钮可复用 | [frontend](errors/frontend.md) |

| #236 | 试验台适配须沿正式SDK动作结构，诊断采样需跟随当前视觉帧 | [frontend](errors/frontend.md) |

| #237 | 自动审批检查超时未执行时只重试一次原参数，不重跑已执行写入 | [toolchain](errors/toolchain.md) |
| #238 | 顶层Dock原型初次Shown窗口不能只凭逻辑visible=false跳过原生隐藏 | [renderer](errors/renderer.md) |
| #239 | 原生Dock资格必须读取dockComponentId，偏好enabled不等于宿主运行 | [backend](errors/backend.md) |
| #240 | 隐藏Dock须沿实际WebView祖先取HWND；共享上下文不能仍独占DesktopPlayer角色 | [backend](errors/backend.md) |

| #241 | 独立Dock须保留作者画布/有效几何，实际输入与可见性同步后才报窗口可用 | [renderer](errors/renderer.md) |

| #242 | 原生Dock自然输入与转发须去重，可信Dock切页不能被桌面暂停队列卡住 | [renderer](errors/renderer.md) |

| #243 | 任务栏恢复须独立看护/落盘，ABM_SETSTATE返回TRUE不能证明隐藏或恢复 | [backend](errors/backend.md) |
| #244 | 批量编辑非终止错误会返回exit0，须Stop/锚点与具名状态核对 | [toolchain](errors/toolchain.md) |

| #245 | Dock窗口回报不代替有效输入窗口，实际高度/DPI需从原生测量读取 | [backend](errors/backend.md) |
| #246 | room-v3的-text规则保留复制CRLF；新样包固定LF后检查暂存差异 | [toolchain](errors/toolchain.md) |
| #247 | 常驻选项不能以当前已占位为前提；AppBar注册不证明真实最大化工作区 | [backend](errors/backend.md) |
| #248 | 原生另存不能复用v2固定资源目录；复制或删除RPC未确认需保留恢复记录 | [backend](errors/backend.md) |

| #249 | 未来Room要求须先兼容判定；只读清单不能进旧编辑器规范化 | [backend](errors/backend.md) |

| #250 | 安装清理不能按前缀路径递归删除；部分删除重试需目录身份与剩余摘要 | [backend](errors/backend.md) |
| #251 | 可搬移发布版不能沿用编译机宿主/许可路径；配置器和Core须同v3配置 | [toolchain](errors/toolchain.md) |

| #252 | 私人另存恢复记录写在RPC之后留下崩溃空窗；已有Core复用绕过v3发布元数据 | [backend](errors/backend.md) |

| #253 | 恢复清理只按旧目录名找作品，已发布Room改名后误删个人覆盖 | [backend](errors/backend.md) |

| #254 | 集中Release构建暴露C#语言/作用域/预处理行错误，文件描述取AssemblyTitle，跨盘CSS字体导入残留构建路径 | [toolchain](errors/toolchain.md) |

| #255 | 焦点丢失误清按钮几何，回到桌面没有新发布导致点击永久失效 | [backend](errors/backend.md) |
| #256 | 发布托盘误找旧配置器路径；回归项目遗漏共享回执类型，本机依赖缺失需离线恢复 | [toolchain](errors/toolchain.md) |

| #257 | 应用Room漏启用默认导航，空本机数据使切页被权限拒绝；动作失败缺少用户提示与结果日志 | [backend](errors/backend.md) |
| #258 | 作者几何去重与宿主焦点清表冲突，保留文档却丢失按钮声明 | [backend](errors/backend.md) |

| #259 | 作者Dock重复焦点外框及已配置导航的额外作者等待影响点击反馈 | [backend](errors/backend.md) |

| #260 | 滑动方向只比较Desk索引导致首尾循环反向；v3添加应用入口过于隐蔽 | [backend](errors/backend.md) |

| #261 | 每次原生点击重复验证整套安装资源；缓存需随Player释放并调整重新应用顺序 | [backend](errors/backend.md) |
| #262 | Windows编码后命令过长使批量样包写入未启动；安装检查需要已存在的目标父目录 | [toolchain](errors/toolchain.md) |
| #263 | v3本机数据授权只挂Dock，Widget声明已到Core却无配置器入口 | [frontend](errors/frontend.md) |
| #264 | 观测台误用内部媒体/音量字段；只读消费误绑桌面前台使小窗口清空读数 | [backend](errors/backend.md) |
| #265 | 主线导入Room与新样包路径重合，合并前须保存本机文件/删除状态；恢复不混入提交 | [git](errors/git.md) |

| #266 | 原生应用Dock刷新不得在按下/抬起之间替换按钮；状态轮询不能吞掉配置点击 | [frontend](errors/frontend.md) |

| #267 | 预览窗口未Show时DPI尚未初始化，锚点须从已显示Dock的DIP坐标传递 | [frontend](errors/frontend.md) |

| #268 | PowerShell Replace(char,空串)重载错误不会默认终止后续编译/提交 | [toolchain](errors/toolchain.md) |
| #269 | 预览保留图标但点击闭包捕获旧窗口快照，动作须按稳定key读取最新组 | [frontend](errors/frontend.md) |

| #270 | PowerShell传给rg的路径通配符不展开，应用真实目录和-g文件过滤 | [toolchain](errors/toolchain.md) |
