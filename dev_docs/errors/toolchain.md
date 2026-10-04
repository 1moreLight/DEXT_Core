# 踩坑记录 · 工具链篇（PowerShell / 编码 / 环境，追加式勿删）

> 格式：症状 / 根因 / 解决 / 防再犯
> 全量索引见 `../ERRORS.md`；其他分册：git / backend / frontend / renderer

## 6. 日志偶发 Unexpected WorkerW Z-order

- 根因：虚拟显示器适配器（GameViewer / Luminoncore IDDCX）干扰桌面窗口枚举
- 解决：忽略即可；测试时只留 DISPLAY1 主屏

## 8. PowerShell 5.1 读无 BOM UTF-8 JSON 中文乱码

- 症状：ConvertFrom-Json 对含中文的 room.json 报"无效对象"
- 根因：PS5.1 默认按 ANSI 读文件，多字节字符被拆坏
- 说明：仅 PS 工具链问题，浏览器 fetch 正常；PS 里需 -Encoding UTF8

## 9. PowerShell 改写 UTF-8 文件会加 BOM / 正则匹配中文易漏

- 症状：用 PS -replace + Set-Content 改 TODO.md 后文件带 BOM；含中文/反引号的行正则漏匹配
- 解决：结构化改写一律用 node -e（JSON/UTF-8 无 BOM）；打标用编辑工具逐条改
- 防再犯：dev_docs 的批量改写别走 PS 管道

## 10. node -e 里的 $1 被 PowerShell 双引号吞掉

- 症状：`node -e "...replace(/re/,'- [x] $1')"` 经 bash 工具执行后，$1 变空串，替换结果丢字
- 根因：PowerShell 双引号字符串先做自己的变量插值，$1 是 PS 的空变量
- 解决：跨 PS 传正则替换时用单引号包 node 脚本，或干脆用编辑工具逐条改

## 14. node -e 批量正则替换里的 $1 反复被 PowerShell 吞（第三次）

- 症状：ACCEPTANCE.md 批量打勾后 V1-V10 编号全丢变成 **V**
- 根因：双引号字符串里 PowerShell 先行插值 $1；单引号包脚本或用编辑工具可避免
- 解决：涉及捕获组替换一律用编辑工具逐条改；此坑已犯三次，不再用 PS 传正则替换

## 16. PS 控制台显示中文乱码 ≠ 文件乱码（虚惊）

- 症状：Add-Content 追加中文后 Select-String/Get-Content 输出全是乱码，以为文件坏了
- 根因：PS 5.1 控制台按代码页显示，文件本身是正确的 UTF-8；Read 工具读出来完全正常
- 解决：判断文件是否乱码一律用编辑/读文件工具看，别信 PS 控制台显示
- 防再犯：与 #8 区分——#8 是 PS 管道**读取解析**坏（ConvertFrom-Json 报错），本条只是**显示**层假象

## 23. vite root 限定导致 /rooms 路径 SPA fallback 返回 HTML

- 现象：预览地址 http://localhost:5174/?room=../rooms/test-dock-hud/ 时，dock 图标一直不显示；
  排查发现 fetch room.json 返回 200 但 content-type 是 text/html、长度=index.html（1549B），
  JSON.parse 失败 → loadRoom 静默回退 DEFAULT_ROOM
- 原因：vite root 指向 wallpapers/dext-room，/rooms/... 在 root 之外，vite dev 对未命中路径
  走 SPA fallback 返回 index.html（顺带导致之前所有房间预览都是默认房间）
- 解决：vite root 改为仓库根（scripts/room-preview.ps1 与 package.json dev:room），
  页面路径 /wallpapers/dext-room/?room=../../rooms/<名>/（相对解析两级上跳）
- 防再犯：改 vite root / 预览 URL 后先 Invoke-WebRequest 验证 room.json 的 Content-Type
  是 application/json 再交给用户验收

## 26. Windows 无 Bash 时 Playwright 包装脚本不可用

- 现象：调用技能附带的 `playwright_cli.sh` 时，WSL 报 `/bin/bash` 不存在。
- 根因：当前 Windows 环境有 Node/npx，但没有可执行的 Bash/WSL Linux 用户空间。
- 解决：先确认 npx 存在，再用 `npx --package @playwright/cli playwright-cli ...` 执行同一 CLI。
- 防再犯：Windows 本地 UI 验收先检查 Bash；没有时直接使用 npx 入口，不反复尝试 WSL 包装脚本。

## 32. Vite HMR 脚本被 sandbox opaque origin 的 CORS 拒绝

- 现象：正式页面正常，但用 Vite 预览 `sandbox="allow-scripts"` 的 Room HTML 时，iframe 控制台报 `@vite/client` 从 origin `null` 被 CORS 拒绝，场景自己的脚本也不执行。
- 根因：Vite 会给 HTML 自动注入 HMR 模块；没有 `allow-same-origin` 的 sandbox 具有 opaque origin，模块请求必须经过 CORS。生产包不注入 HMR，所以只在开发预览出现。
- 解决：做 sandbox HTML 浏览器验收时用 `vite ... --cors` 启动；仍保持 iframe 不增加 `allow-same-origin`。
- 防再犯：不能为了让开发 HMR 工作而放宽生产 sandbox。先区分“Vite 注入失败”和“Room 脚本本身失败”，开发服务器按需开 CORS。

## 37. PowerShell 管道吞掉原生构建失败，脚本仍显示 Done

- 现象：`dotnet build ... | Select-String " error "` 明确打印 C# error，但 `scripts/build.ps1` 继续部署插件并显示 `Done`，调用方也得到成功退出。
- 原因：原生命令的非零退出码不会自动成为 PowerShell 终止错误；把输出直接送入 `Select-String` 后，脚本既没有保存退出码，也没有主动抛错。
- 解决：每一步先捕获原生命令输出并立即保存 `$LASTEXITCODE`，筛选错误信息后对非零退出码 `throw`，成功后才进入下一步和部署。
- 防再犯：PowerShell 封装任何 `dotnet` / MSBuild / npm / cargo 检查时，都要显式检查原生命令退出码；不能用控制台是否出现 `error` 或脚本最后一行是否打印成功来判定。

## 40. master 源码已 Dext 化，但旧构建输出仍是 Lively

- 现象：从最新 master 运行 `scripts/start.ps1`，路径确实属于当前仓库，却启动 ProductName/FileDescription 均为 `Lively` 的旧 `Lively.exe`；Dext mutex/pipe 不会创建，脚本等待约 30 秒后失败，而且旧实现遗留了错误进程。
- 原因：`bin/` 是 Git 忽略的本地输出，CORE-002 的源码合并不会把验收 worktree 构建出的 Dext 二进制带进 master；旧启动脚本只检查文件存在和绝对路径，没有检查产品元数据。
- 解决：启动前读取 Core VersionInfo，要求 ProductName 与 FileDescription 都属于 Dext；缺失或不匹配且目标进程未运行时自动调用 `build.ps1 -Rebuild`，避免增量构建因旧输出时间戳而跳过；构建后再次验证；身份等待失败时只停止本次脚本新建的目标 PID。
- 防再犯：不能用“路径属于当前 worktree”替代“该路径上的二进制就是当前产品构建”。Git worktree 切换或合并后，启动入口必须同时验证路径、产品元数据和运行身份。

## 41. 新 worktree 缺少 node_modules，启动脚本假成功

- 现象：Core 已正确启动为 Dext，但新 worktree 执行 `npm run tauri dev` 报 `'tauri' is not recognized`；旧脚本没有检查 npm 退出码，PowerShell 最终仍返回成功，配置器没有打开。
- 原因：Git worktree 不携带被忽略的 `node_modules`；启动脚本既没有安装缺失依赖，也重复了 ERRORS #37 的原生命令退出码遗漏。
- 解决：检查 `tauri-ui/node_modules/.bin/tauri.cmd`；缺失时执行 `npm ci` 并检查退出码与安装结果；启动 Tauri 后也立即检查 `$LASTEXITCODE`，非零主动 `throw`。
- 防再犯：任何“一键启动”都必须从全新 worktree 的空构建/空依赖状态验证，不能只在长期使用且缓存齐全的主目录测试。

## 42. PowerShell 单个动态参数 splat 成字符序列

- 现象：强制重建调用 MSBuild 时，控制台完整命令变成 `/ t : R e b u i l d`，MSBuild 报未知开关；双击入口正确以非零状态停留，没有继续启动旧二进制。
- 原因：用 `if` 表达式给变量赋单元素数组时，PowerShell 管道输出被解包成普通字符串；对字符串使用 `@变量` splatting 会把每个字符当成独立参数。
- 解决：先显式初始化空数组，再在条件内用 `+=` 加入 `/t:Rebuild` 或 `-t:Rebuild`，确保传给原生命令的始终是参数数组。
- 防再犯：动态构造原生命令参数后，用一次真实命令查看完整命令行；不要假设单元素 `@(...)` 经过条件表达式后仍保持数组类型。

## 45. 普通 Rust 测试实际铺设壁纸并污染 Core 恢复布局

- 现象：每次跑完 `cargo test --lib` 后都会重新出现很早以前测试 Room 的背景；重启 Dext Core 后还会自动恢复。
- 根因：`grpc::tests::applies_room_wallpaper` 直接调用真实 Core 的 `SetWallpaper`，`apps_and_launch` 还会启动 Notepad；两项活体测试此前混在普通单元测试中。Core 随后把 `wallpapers/dext-room` 写进 `%LOCALAPPDATA%\Dext\WallpaperLayout.json`，下次启动必然恢复，而运行包里的 `room.json.__source` 仍指向旧测试 Room。
- 解决：两项测试标记为 Rust `#[ignore]`。普通 `cargo test --lib` 只跑无外部副作用的测试；需要真 Core 验收时显式运行 `cargo test --lib applies_room_wallpaper -- --ignored`，完成后再停止壁纸并核对恢复布局。
- 防再犯：凡会调用真实 RPC、启动应用、修改桌面或写入用户状态的测试都必须默认 ignored，并在命令旁写清副作用和恢复步骤；不能把“测试通过”等同于“环境没有被改变”。

## #50 Player 目标框架缺少较新的 ASCII 字符判断 API（2026-09-02）

- 现象：Dext WebView2 Player Release 构建在可信系统请求 id 校验处报 CS0117，找不到 `char.IsAsciiLetterOrDigit`。
- 原因：Player 当前目标框架未提供该较新的 `char` API。
- 处理：改为显式 `a-z` / `A-Z` / `0-9` / `-` 范围判断，保持严格 ASCII 白名单且兼容现有框架。
- 预防：Player/Core 新增安全字符校验时优先使用项目目标框架已有 API，并以 `scripts/build.ps1` Release 全构建为准。

## 53. start.ps1 的 Tauri 端口被残留 Vite 进程占用

- 现象：当前 worktree 的 Core 身份已验证，但 `start.ps1` 在 `npm run tauri dev` 阶段因端口 1423 已被占用而退出。
- 原因：同一 worktree 的旧 `vite --port 1423 --strictPort` 进程仍在监听；脚本的配置器开发端口不是动态分配。
- 处理：只读确认监听 PID、可执行文件和命令行后再决定是否由启动者清理；本次未终止不明进程，并使用独立端口/页面完成前端验证。
- 预防：启动前检查 1423/1421 监听者是否属于当前会话；不要盲目结束用户进程，必要时先复用或让用户关闭残留开发服务。

# #67 dev 端口落入 Windows 保留端口区，vite EACCES 起不来

现象：`npm run tauri dev` / `start.ps1` 的配置器步骤报 `Error: listen EACCES: permission denied ::1:142x`，beforeDevCommand 非零退出；`Get-NetTCPConnection` 查不到任何占用。

原因：Windows（Hyper-V/WSL 动态保留）把 TCP 1333–1432、1463–1562 等区间列为排除端口（`netsh interface ipv4/ipv6 show excludedportrange protocol=tcp` 可见），1420/1421/1423 全部命中，Node 无法绑定，与进程无关。

修复：配置器 dev 端口整体迁出保留区——tauri dev 用 1620（`tauri.conf.json` beforeDevCommand/devUrl + `vite.config.ts` server.port），浏览器设计模式 1621（`dev:ui`、hmr.port 与文档同步）；渲染器 `PREVIEW_PARENT_ORIGINS` 增加 `http://localhost:1620`。

防再犯：换 dev 端口或遇到 EACCES 时先对照 `netsh interface ipv4/ipv6 show excludedportrange protocol=tcp` 的排除区间，别去杀进程。

## 70. Playwright 测试放在 npm 包目录外无法解析测试依赖

- 现象：`tauri-ui` 已安装 `@playwright/test`，CLI 也能启动，但测试文件放在仓库级 `wallpapers/.../tests` 时仍报 `Cannot find module '@playwright/test'`，随后显示 `No tests found`。
- 根因：Node 从测试文件所在目录向父目录解析模块；测试位于 `tauri-ui` 之外，不会向下查找 `tauri-ui/node_modules`。Playwright 配置的 `testDir` 能发现文件，但不改变模块解析起点。
- 解决：把 renderer e2e 规格放到 `tauri-ui/tests/renderer/`，配置仍可通过 Vite 访问仓库级实验台页面；依赖、配置和测试文件处于同一个 npm 包边界。
- 防再犯：新增包级测试依赖时，测试文件应位于该 `package.json` 的目录树内；若必须跨包，先建立正式 workspace/module resolution，而不是依赖启动命令的当前目录。

## 71. Playwright spec 被 Vitest 一并发现

- 现象：独立 `npm run test:renderer:e2e` 7/7 通过，但常规 `npm test` 会加载 `tests/renderer/motion-lab.spec.ts`，随后报 `Playwright Test did not expect test.beforeEach() to be called here`。
- 根因：Vitest 和 Playwright 的默认发现模式都包含 `*.spec.ts`；两个 runner 在同一 npm 包内时，仅分开放目录不足以避免交叉收集。
- 解决：renderer Playwright 文件使用专用 `*.e2e.ts` 后缀，并在 `playwright.renderer.config.ts` 显式设置 `testMatch: "**/*.e2e.ts"`；Vitest 默认不再发现，Playwright 仍精确收集。
- 防再犯：同包引入第二个测试 runner 时必须为每个 runner 设置互斥的文件命名或 include/exclude，不依赖默认 glob 碰巧不重叠。
# #81 Playwright 会等待持续抖动的目标稳定，普通 dblclick 因而超时

现象：Widget 正在无限 rotate jiggle 时，`locator.dblclick()` 一直等待 element stable，直到 20 秒测试
超时；产品事件本身没有失败。

原因：Playwright 的 actionability 检查要求点击目标位置稳定，持续动画的外框永远无法满足该条件。

修复：只在验证“抖动中的交互对象收到双击但不得退出编辑”这一目标路由用例中使用
`dblclick({ force: true })`；空白舞台仍使用普通双击，拖动几何和命中由其他真实指针用例覆盖。

防再犯：对设计上持续运动的元素测试事件路由时显式处理 actionability；不要通过关闭动画让测试通过，
也不要把 force 扩散到本应验证可点击性或几何命中的用例。

# #87 异步场景测试必须先等待场景结果实际发布

现象：系统 reduced-motion 用例通常通过，但全量 Playwright 偶发读到 1 个 FLIP 动画；单独重复运行又可能
连续通过，形成看似环境负载导致的随机失败。

原因：`runScenario("widget-single")` 通过两个 `requestAnimationFrame` 延迟发布布局，测试调用后立即读取
`getAnimations()`。读得快时场景尚未执行，0 动画是假绿；恰好等到场景执行时才真正验证 reduced-motion。

修复：先等待 Alpha 的最终 `top: 240px`，证明延迟场景已经发布，再断言所有外层图标 0 动画；同时等待
body 的 `reduce-motion` 类，确认 MediaQueryList 事件已同步。定向重复 5/5 后再跑 renderer 全量。

防再犯：异步场景测试必须先等待一个只有场景完成后才成立的产品条件；不能把“当前没有动画”当成
“即将执行的场景不会动画”。

# #88 短时序边界不能用真实等待加跨进程轮询验证

现象：图标目标稳定时间明确为 80ms，但 Playwright 用例在 `waitForTimeout(40)` 后检查占位仍偶发看到
已激活；单独重复 10 次也会随机失败，生产计时器本身没有提前触发。

原因：`waitForTimeout(40)` 只保证至少等待 40ms，随后 locator 断言还要跨进程调度；机器繁忙时第一次
读取 DOM 已超过 80ms。`toHaveAttribute` 的自动轮询也无法证明一个已经错过的瞬时“未激活”状态。

修复：在进入拖动后安装并暂停 Playwright Clock，先推进 79ms 断言仍未激活，再推进 1ms 断言激活。
曾临时把生产稳定时间改为 79ms，确认新断言会在 79ms 处失败；恢复 80ms 后定向重复 10/10。

防再犯：验证几十毫秒级 debounce/dwell 边界时必须控制页面时钟；真实时间只适合等待最终条件，不能
用来证明短窗口内的否定状态。
# #94 renderer Playwright 前必须停掉手工 5174 预览

现象：先运行 `npm run dev:icons` 后，再执行 `npm run test:renderer:e2e -- --grep ...`，Playwright 在收集/执行
测试前报 `http://127.0.0.1:5174/... is already used`，无法形成有效 RED 或 GREEN 证据。

原因：renderer 配置使用 `strictPort` 并由 Playwright 自己管理 Vite webServer，不复用外部已启动的预览服务。

修复：运行 renderer Playwright 前先停止手工 `dev:icons` / `dev:motion` 会话；测试结束后再重启预览供人工验收。
不能把端口冲突或 `No tests found` 当成 TDD 的有效红测，必须看到断言因目标行为缺失而失败。

防再犯：定向测试也统一通过 `npm run test:renderer:e2e -- --grep "..."` 调用项目配置；开始前先确认 5174
未被占用，结束交付时才恢复人工预览。

# #105 隔离 Player 的 native/CSS 坐标缩放与 devicePixelRatio 不一致

现象：真实 Room 的 Release WebView2 回归中，向图标中心发送 native x=88，页面收到 pointerdown.clientX=110；向目标中心发送 x=280，页面收到 350，排序落入隔壁格。页面 `devicePixelRatio` 仍是 1，直接用它换算仍失败。

原因：独立 Player 的 `--wallpaper-geometry 800x600` 与实际承载窗口之间存在 1.25 倍几何缩放；这一缩放不等于页面报告的 devicePixelRatio。旧 `probe.html` 命中区宽，未暴露目标格错位。

修复：测试先对已知图标中心发送一次按下，读取真实 `pointerdown.clientX`，用「实收 CSS x / 发出 native x」校准本次 Player 的坐标，再发送十轮拖动。结果每轮都在 pointerup 前跟手、预览时 Room 未变、松手仅一次保存；测试资源从产品 Room 复制并核对 SHA256。

防再犯：测试 WebView2 输入时同时记录发出的 Win32 client 坐标和页面实收 pointer 坐标；不把 `devicePixelRatio` 当作 Player 窗口几何缩放的唯一来源。隔离 Player 测试仍不替代 WorkerW 物理鼠标验收。

# #106 releasePointerCapture 的失捕事件不一定同步派发

现象：Playwright 在图标拖动中调用 `releasePointerCapture(1)` 后立即等待回滚，图标仍保持 dragging 和预览位置；误以为失捕监听没有工作。

原因：浏览器把失捕变更暂存到待处理 pointer capture 队列；下一次指针事件到来时才派发 `lostpointercapture`。只有调用 release 并不等于已经投递失捕事件。

修复：测试先确认持有 pointer capture，调用 release，再发送一次 mouse.move；此时 `lostpointercapture` 到达，图标和同伴回滚，随后旧 pointerup 不保存。真实自动化可模拟浏览器事件顺序，不合成一个跳过 pointer 队列的假事件。

防再犯：对 capture 生命周期的测试要区分「请求释放」与「失捕事件已派发」；对用户可见状态断言应等下一次真实指针事件。

# #107 Renderer Playwright 不能并行启动两次

现象：全量 renderer 测试尚未退出时，另起定向测试立即报 5174 端口被占；原进程随后在旧 motion-lab 用例收尾时保存视频报 `ENOENT`，虽其交互断言已通过。

原因：两进程争用同一 Vite strictPort 和 `tauri-ui/test-results/renderer` 产物目录，定向进程可能清理全量进程仍需写入的失败文件。

修复：停止并行调用，待全量进程完全退出后单独复验失败用例与新增断言（2/2 通过），再单独重跑完整套件。

防再犯：同一 worktree 的 `npm run test:renderer:e2e` 串行执行；只可与不会触碰 5174 或 renderer 产物目录的测试并行。

# #109 WebView2 Player 退出后临时用户目录可能短暂保持锁定

现象：隔离 Player 的十次真实 Room 拖动全部通过，但测试在 `finally` 递归删除临时夹具时偶发
`UnauthorizedAccessException`，把已通过的产品行为误报为测试失败。

原因：Player 主进程退出后，WebView2 子进程或文件句柄仍可能短暂占用 user-data 下的 `.tmp`；一次立即删除没有覆盖 Windows 的释放延迟。

修复：夹具仍严格限制在系统 Temp 下，退出后对 `IOException` / `UnauthorizedAccessException` 做有上限的短重试；最终仍锁定只报告残留路径，不把产品交互断言改写为通过。

防再犯：带 WebView2 user-data 的隔离测试必须等待文件句柄收敛；递归删除前继续校验目标绝对路径位于 Temp，不扩大删除范围。

# #118 内核测试汇总写死用例数量

现象：新增 checkpoint 读取回归后控制台列出 10 条 PASS，末行却仍显示 `8/8 session checks passed`。

原因：测试夹具把总数写死为 8，新增用例时未同步改汇总。

修复：`Check` 每调用一次递增总数，最终由动态总数和失败数计算汇总；本轮输出已正确显示 `10/10`。

# #119 多 worktree Rust 编译产物耗尽 C 盘

现象：V3-P2A-001 新 worktree 首次运行 `scripts/start.ps1` 时，配置器 Rust 构建报 `os error 112` 磁盘空间不足；同一阶段文件补丁曾写入失败并留下零字节文件。

原因：多个 DEXT worktree 的 `tauri-ui/src-tauri/target` 各占约 5–15 GiB，C 盘剩余不足 1 GiB。编译失败后的文件不能假定仍保持原内容。

修复：先停相关 Cargo/配置器进程，核对每个 target 的 worktree 归属，再用 `cargo clean --manifest-path` 清掉 9 个 target；D 盘重定向的 `CARGO_TARGET_DIR` 也用 `cargo clean` 清除。合计约 65 GiB，随后重新核对受影响源码、重建并复测。Core/Player 从现有 C# 输出恢复运行，配置器暂不重建以保留清理成果。

防再犯：开新 worktree 前盘点 C/D 空间；Rust 构建可明确设置 D 盘 `CARGO_TARGET_DIR`。清理只针对确认的项目 target，不删除共享 Cargo registry；遇磁盘写入失败要检查改动文件长度与内容。

# #122 WorkerW Player 输入窗口不在普通顶层枚举里

现象：真实 Core/Player 已激活，实机鼠标探针用 `EnumWindows` 取 Player PID 却找不到 WebView2 输入 HWND；误用 `FindWindowExW(IntPtr.Zero, ...)` 还可能命中别的 Chromium 窗口，坐标尺寸不符。

原因：Player Form 被 Core 重新挂到 WorkerW，已不是普通顶层窗口。Win32 的空父句柄搜索会扩大到全桌面。

修复：探针从 Core 日志中读取该 Player 上报的 `Hwnd`，再核对 HWND 所属 PID，沿 `Chrome_WidgetWin_0/1` 找输入句柄；原生鼠标点击使真实 Core 修订 1→3，Desk A→B。
# #125 worktree的CodeGraph索引不是共享状态（2026-10-02）

- 现象：新worktree运行sync/index提示未初始化；node的start-line/end-line参数不存在。
- 原因：`.codegraph`是忽略的本地快照，不随Git worktree创建；CLI v1.5.0使用`--offset`/`--limit`。
- 处理：先查已索引主工作区定位符号；新代码不在索引时读实际工作区文件。没有索引不替用户决定初始化。CLI不确定先看`--help`；主索引结果须与工作分支当前源码核对。
# #128 内容摘要夹具需要冻结Git检出字节（2026-10-02）

- 现象：工作区测试通过；`git cat-file --filters HEAD:...`显示Windows新检出转CRLF，清单和SVG摘要都变。
- 修复：`.gitattributes`将room-v3安装夹具标为`-text`，按原始字节保存。
- 检查：测试实际Gitcheckout filter结果SHA256，不只对现有工作文件求摘要；新共享Unicode夹具同样遵守该规则。

## #137 共享Rust目标目录需在每个新命令显式传递（2026-10-03）

PowerShell工具调用的进程环境不跨调用继承。本轮start未设置CARGO_TARGET_DIR，误在worktree生成约1.72GiB临时target；随后identity独立命令未设置同值，会把实际共享目录配置器标OTHER。停止本轮进程后改为每次start与identity都显式设置D:\use\Orca\DEXT\build-cache\v3-player-bridge，重跑全项OK；确认临时target绝对路径位于本worktree且非reparse point后删除重复缓存，保留共享缓存。

## #139 WebView子进程延迟释放临时目录（2026-10-03）

隔离ReleasePlayer正常退出后，WebView lockfile可继续短暂占用；finally递归删除立即抛错会掩盖原始字段缺失错误。CIM后续确认该探针子进程已结束。探针改为有界20次/500ms清理重试，仍锁定则报告精确目录并保留原始断言；旧失败夹具在确认temp边界/非链接/进程退出后定点删除。不得通过杀全体WebView进程处理。

## #145 Player IPC探针须使用真实入口与真实重载（2026-10-03）

build.ps1把Release Player部署到Core的bin/x64/Debug/net9.0-windows10.0.18362.0/Plugins/WebView2；不能猜单独Player项目bin路径。Form1现有cmd_reload分支被注释，向stdin发该命令不会重载；探针等待新ready超时。改用页面受控测试指令执行location.reload，确认真实新文档ready后再断言墓碑与新代次。未顺带改变既有cmd_reload产品行为。

## #148 Worker安全探针必须等待异步结果（2026-10-03）

new Worker返回对象后立刻terminate并判为“执行成功”会误判CSP：浏览器可能在后续error事件拒绝脚本。探针应等待实际message或error，设置有界超时，并在finally释放Worker。此处修正前主文档worker结果false，修正后真实ReleasePlayer的worker拒绝证据通过；不能用constructor是否抛错单独证明所有Worker边界。

## #151 新文件需要暂存检查（2026-10-03）

git diff --check只覆盖已跟踪差异，本轮新ResourceWireProbe.cs末尾空格直到git diff --cached --check才发现。已删除空格并重新检查；保持具名暂存后的格式门槛，不因工作区diff通过就省略它。

## #154 原生窗口探针先正常布局并匹配Core DPI（2026-10-03）

独立Player默认最小化，webView客户区0x0时网页仍有旧controller viewport，几何正确拒绝。探针先ShowWindow不抢焦点并SetWindowPos完成正常布局。Console默认DPI不感知时同一客户区读640x480，Player读800x600；原生探针先SetProcessDpiAwarenessContext(PerMonitorV2)，与Core一致，实际640x480/dpi120、CSS427x320/dpr1.5通过。另默认重叠STATIC窗口可能有8/31px非客户区偏移；隐藏坐标夹具使用明确无边框负坐标窗口。不要放宽生产校验来修夹具。

## #155 先读状态探针参数（2026-10-03）

--v3-status的第二参数是期望Desk名或inactive，不是仓库路径。本轮误传路径导致Expected live <path>，而真实状态active=False符合已恢复v2；改用--v3-status inactive通过。参数与RuntimeIdentity核验路径分开。

## #156 保存PowerShell所有输出流（2026-10-03）

scripts/build.ps1和identity使用Write-Host，普通>只保存成功流，文件可能为空而工具里构建实际通过。需要原始归档时用*>捕获全部流。该阶段构建和完整identity以实际工具返回为证据，测试成功流日志有内容；不得宣称空文件保留了原始构建输出。

## #157 编辑脚本明确编码并替换完整成员（2026-10-03）

Windows Python Path.read_text()默认GBK，读Form1的UTF8内容失败时此前文件修改已经执行；恢复时先查git diff，明确encoding=utf-8-sig，避免重复应用已完成修改。按方法首行后的换行插入新成员会拆开表达式方法，导致CS1519；应匹配并替换整个成员块，再编译相关实际源文件测试。本轮两项均已修复，完整build通过。

## #161 非行锚插入和未知探针模式导致错误测试出口（2026-10-03）

媒体探针编辑用12空格子串匹配policyUnavailable，亦匹配16空格的嵌套分支，count断言失败。后续PowerShell未检查Python退出码仍跑新模式；旧Program对未知多参数落入默认隐藏输入检查，输出PASS却并未运行媒体检查。该结果已明确排除出媒体证据。改为带换行的精确行锚、全部替换验证完才写文件、Python非零立即停止；Program对未知模式/无效参数数量显式拒绝，运行脚本同时要求目标媒体PASS标记。未知模式负例实际拒绝；修正后真实媒体探针执行通过。不要以命令退出0或任意PASS当作目标模式确实执行。

## #166 同源Unicode样本与期望同时错误会掩盖夹具损坏（2026-10-03）

旧HEAD的RuntimeMessageChecks中“日期”已经变成三个乱码字符，构造样本与同文件assert一起损坏，单位投影仍通过。独立RuntimeWireProbe保留原中文期望，实际Player正常传递乱码样本，因期望不一致失败；不是Json.NET本轮回归。修正样本JSON及C#assert为ASCII Unicode转义，保留真正Unicode值和独立wire期望。运行消息20/20、实际缓存/撤销/重载等五组通过。读取/编辑统一UTF8，并保留独立端到端Unicode断言，不能改期望去接受乱码。

## #168 异步SDK数据回执与真实读数状态（2026-10-03）

接入真正私有data IPC后，命令barrier回执先于异步来源到达，实际ReleasePlayer恢复检查timeHidden=true。该失败属于夹具旧同步假设，不是Core授予错误。改为最多5秒等待作者实际readout.hidden变false再报告，暂停仍检查即时拒绝；不使用固定sleep或修改期望接受隐藏值。最终SDK/private data IPC暂停恢复通过，模拟Core属性仍明确保留。

## #173 新宿主探针必须遵守真实异步与闭包契约（2026-10-03）

main等待acceptSnapshot Promise，假宿主返回Array.push数字，导致.catch失败并让播放恢复误报false；替身改为async明确返回Promise。新C# Next闭包在context初始化前读取，且var同时声明两个变量，CS0165/CS0819导致探针未执行；先初始化独立Core fixture上下文并拆声明，再跑真实ReleasePlayer。编译失败与假契约失败均不计实际运行证据；修复后完整官方页验证通过。


## #174 当前SDK的Frame.IsDestroyed返回int而非bool（2026-10-03）

新增原生帧媒体控制器直接写!IsDestroyed触发CS0023；当前安装WebView2 1.0.3595.46使用0/1返回。以实际SDK/完整Release构建为准，比较==0；缓存FrameId，销毁后不靠其他属性读取身份。

## #175 原生帧策略异步化后，命令回执可先于指定Core快照应用（2026-10-03）

整页探针发revision3紧接report，旧revision2的inputReady仍为true时提前返回，误报文档丢失。命令携带expectedRevision，poll等待页面精确修订和当前geometry ready，再读文档/媒体。原官方探针和新增媒体探针共同修正，不能用IPC到达当异步处理完成。

### #175 追加：真实Core重启后的音频观察值也必须等实际来源（2026-10-03）

WebAudio实际Core探针原先仅等视频decoded/inputReady，标题观察缓存仍是初始audio suspended/time0。首次重启音频断言失败且原桌面恢复成功；改作者statechange报告并要求两AudioContext真实running/time>0.05，再验证新文档而非推断状态。无需改生产政策，也不以固定sleep接受旧观察。native-core-webaudio-ready最终通过，首次失败记录保留。

### #145 追加：WebAudio探针须使用Core已部署的ReleasePlayer路径（2026-10-03）

误传Lively.Player.WebView2/bin/Release/net462不存在路径，命令失败不计媒体证据。正确路径是同分支Core bin/x64/Debug/net9.0-windows10.0.18362.0/plugins/webview2/Lively.Player.WebView2.exe，build.ps1部署Release版本后再运行。

### #173 追加：消费者存储新夹具的var多声明不计功能RED（2026-10-03）

新测试误写var path=...,before=...触发CS0819，先拆独立声明；纠正后的RED仅保留尚缺ReadStorage/WriteStorage/Storage字段。最初语法失败不计生产存储行为证据；新增4097项数组后来实际Accepted/Denied失败才属于实现边界缺陷（#183）。

## #185 grid播放规则与前台测试的前置条件（2026-10-03）

真实Core探针卡starting，PlaybackPaused=true、Locked=false。只读设置显示ProcessMonitorAlgorithm=grid；实际可见窗口枚举有maximized应用，WindowUtil.IsDisplayCoveredByWindowGrid遇任何IsZoomed返回covered，与Core暂停一致。FocusDesktop只改变前台，不最小化其他可见窗口，所以不能解除覆盖暂停。这次不是KV实现失败RED。隔离测试在Core停止后临时选择真实foreground算法，原Settings逐字节备份/finally恢复；不伪造Windows事实、不改无关应用窗口，也不把这次运行计为grid/idle/锁屏组合通过。

## #186 读取活体NLog须保留现有写入共享（2026-10-03）

新增日志隐私检查用File.ReadAllText，活体NLog正在写同一文件，触发IOException sharing violation；实际KV本身已成功。用FileStream(FileAccess.Read,FileShare.ReadWrite)+StreamReader只读当前Core PID的日志，随后才真正复现#184的marker泄露。恢复finally仍须覆盖诊断本身失败，不能将读取失败误计为隐私保护通过。

### #173 追加：HTML夹具多层大括号与C#原始字符串（2026-10-03）

为KV日志marker把原始HTML字符串改成$$插值后，JS的连续闭合大括号触发CS9007。改普通原始字符串+固定占位Replace，UUID构成的本地marker无作者输入；纠正语法后才运行行为RED。两项原有WebViewProbe nullable警告未变，本轮StringReader新警告已消除。


## #190 原生输入探针误读诊断字段和Type名称冲突
- 2026-10-03，新探针要求observation.operable，但生产readDiagnostics未提供此字段；Core实际operable=true，SDK timer正确inputRequired，探针却没有发送鼠标。改读真实RPC状态，缺字段不当false事实。
- COM Shell测试代码的Type和Google.Protobuf.WellKnownTypes.Type歧义导致编译失败；明确System.Type。两者都是探针错误，未计生产功能RED；原数据在finally恢复。
- 新字段先核对提供方契约，记录未通过运行的真实状态，不能只记录成功分支。文档命令模板的Markdown反引号也曾提前结束JS字符串，工具执行前解析失败；修模板后才运行，未重跑已执行编辑。

## #191 聚焦桌面不等于实际桌面可点击
- 2026-10-03，输入探针FocusDesktop后Windows注入命中应用，Core正确转paused且无证明。Orca窗口列表及实际WindowFromPoint核对：像素107,56归ChatGPT PID42576/Chrome_RenderWidgetHostHWND，桌面仍被覆盖。未修改正确的生产暂停/前台策略。
- 只对自动桌面输入夹具临时调用Shell.MinimizeAll，并先记录原可见窗口的IsIconic/IsZoomed；落点须属于实际Progman/WorkerW根。finally UndoMinimizeAll，核对所有仍存在原窗口的状态，恢复原前台与鼠标，再写恢复证据。这轮属于Windows注入，不能代替人工物理验收。
- 重启首次FocusDesktop发生在Player最终初始化之前；实读前台PID24248/Qt51512QWindowToolSaveBits。待实际桌面阶段后仅重聚焦一次并记录，恢复门槛全过，不循环伪造Windows事实或绕过授权。


## #192 系统控制探针前置、计时接口和观察容量必须按提供方契约
- 2026-10-03，新回归误用ManualClock.Now，改既有Advance，不把测试编译错误计生产RED。
- 两消费者同时发无输入audioControl，一项inputRequired，另一项正确单attachment忙拒绝controlUnavailable。探针有限重试忙请求后再要求inputRequired，保留生产界限；不要求并发请求必能同时进入。
- 八次输入累积完整回执/KV后标题观察丢失，扩大读取容量仍未解决。只在测试观察器投影必要消费字段与KV owner（实际私有存储另验），最终完整JSON2842字符；历史失败运行保留，不写成整轮成功。
- --v3-status第二参数是inactive或预期Desk，误传.应失败；修正确inactive参数。进程名是Lively.Player.WebView2.exe，错误少点的别名不能作为缺失依据，须按真实PID/绝对路径核对。

## #194 原生退出探针必须等真实可点击的确认窗并保留主失败
- 2026-10-03，私有许可新测试错用不存在的夹具接口、PersonalButtonOverride位置参数和安装更换预期；按真实接口/TargetId命名参数/网关Denied纠正。Rust新测试误用grpc::desktop与私有pipe函数、有效身份使用C:\Dext却被真实debug worktree检查拒绝；按proto模块、公开pipe投影和编译worktree修正。JS替身把初始化也回requiresConfirmation导致无frames，改只对activate回该状态。C#短路out局部未赋值先修编译；这些不计生产行为RED。
- 历史安装器已不存在，先重新构建当前worktree install_v3；缺二进制的一轮原数据恢复，不计运行时失败。工具JS模板在定义变量前插值曾在调用前失败，不当作执行。
- 初版只按标题找窗，尚未检查初始化和真实可点击状态；第一次finally正常Core关闭因尚未取消的原生模态窗超时，掩盖原异常。精确Core PID/路径下点击原生No取消后正常退出，按before文件逐字节/缺失状态恢复并核验；不强杀，不清用户目录。
- 后续保留primary exception并在finally仅取消本测试Core拥有的确认。仅IsWindowVisible/默认No还不足以表示真实鼠标已命中：实际WindowFromPoint命中Chrome_RenderWidgetHostHWND的覆盖窗口，取消未到达Dext。等待真实No/Yes按钮的OS命中PID（有界3s），不把确认强行前置、不改生产输入策略；此后实际No保持、Yes整套正常退出均通过。
- 完整退出后的“仅为恢复再次启动Core”额外检查遇异步原壁纸恢复未完成；该辅助Core已正常退出，文件备份精确恢复，失败历史保留。夹具改完整退出后直接恢复原保存文件并保持普通Windows桌面；后续常规start再检查原v2身份。No/Yes局部通过不冒充整轮恢复通过。
- 最后普通Core/配置器正常关闭与hash比较已经成功，脚本末尾新一行单独接*>导致只写日志的后缀报错。不能重跑已完成的关闭动作；改只读重新核验四文件和零残留并用完整脚本块重定向，native-exit-final-cleanup.log通过。

## #195 生命周期探针要使用真实角色、持久化夹具与活动时间
- 2026-10-03，同Kernel retire测试先误用coordinator导航/完成，随后默认TransientCheckpointStore永不Read，导致新Restore为Rejected；改真实DesktopPlayer lease与独立MemoryCheckpointStore，不放宽生产角色或Restore条件。不存在路径/错误接口不计生产行为RED。
- 独立Player探针前两轮在Core正常重启后被覆盖应用保持前台，KV按生产规则拒绝，没走到Kill；保留两轮失败及finally原数据恢复证据，不计独立故障RED。复用OS鼠标作者导航和真实showdesktop曝光后整轮通过，不降低权限或前台条件。
- 四媒体夹具先无条件创建slot.html但只在HTML声明它，被生产安装器严格inventory拒绝；仅HTML创建文件后通过。HTML初版setTimeout(done)在非活动暂停期到期，生产notOperable正确拒绝且夹具吞掉结果；改实际AudioContext活动时钟+当前生命周期并记录完成/错误、有限间隔重试，active-time整轮通过。不是生产done放行变更。
- Player私有暂停后JS interval可能停止，必须同步包装生产dextNativePlaybackChanged写观测屏障；不得用暂停后的新interval标题当暂停证据。GIF实际动画冻结单独用owned全屏Player中心OS像素采样，naturalWidth或500ms预算只能证明解码/预算，不能证明画面冻结。

## #199 布局与暂停测试要核对真实协议和阶段（2026-10-03）
布局回归首次误用不存在的SetPlaybackFacts；已有SetRuntimeFacts才是当前接口。Starting不能由已Desktop直接SetLifecycle绕过，测试应按真实media slots启动/BeginDocument进入。编译与夹具状态错误不计生产行为RED。
原生controller真的暂停后，JS收不到新command/barrier，PostWebMessage的安全布局metadata可排队至resume；改原生完成IPC屏障，暂停中发送Core响应，恢复后三种回执任意合法顺序验证，再用活动JS屏障确认普通paused响应未穿过。不能为了测试而唤醒/放宽作者或动作。
本轮一次命令误写--native-input-wire，既有Program入口是--v3-input-wire；未运行的夹具不算行为失败。实际窗口还原另一轮parent/style/bounds全部匹配、dpi=120而预附着顶层dpi=144。夹具负屏幕父窗附着本身改变所在显示器DPI，正确门槛是idle前已附着的DPI与restore后匹配；保留完整实际值诊断，不取消DPI校验。
- 常规启动的--v3-status参数是expectedDesk，不是Core路径；本轮误传路径仍可观察真实active=False但整体命令按夹具预期抛错，不写成status命令通过。正常退出与原数据核验另独立成功。
- 2026-10-03，新增固定layout-model.js后先用--no-build运行旧测试assembly，其复制清单缺新脚本导致renderUnavailable；编译最新探针后又因模拟Core方法清单未加入layoutRead而主动拒绝。更新三个官方夹具复制清单、两个模拟Core封闭只读回复后真实ReleasePlayer整轮通过。两次都是旧夹具不符合新协议，不记作生产缺陷；实际Core读布局另独立验证。
- 纯布局“先移动”夹具首次把最近合法位置限定右移，实际上向下移动更近且原尺寸可放；调整障碍为仅窄缝与完整空位的真实比较，保留最近位置规则。

## #203 精确几何测试夹具应保留协议层次（2026-10-03）
DOM转场snapshot必须同时给transitionId和deadlineUtc，否则模型正确拒绝；首次新增遮挡测试忽略acceptSnapshot拒绝后仍以目标Desk断言，出现2项夹具失败。补合法deadline后全生产JS205/205。
Json.NET new JArray(singleJArray)会选复制构造器摊掉一层；polygons[][]夹具应使用new JArray { inner }。未进真实parser分支的夹具失败不记生产RED。新增geometry.js必须更新官方index与实机夹具复制清单，测试源码改动后不能用旧--no-build assembly。

- 2026-10-03 Core输入探针补证：先等operable/作者timer再显示桌面的顺序可能自锁；曝光/空白聚焦应前置，等待原生前台采样，再测无输入。不能假定SetForegroundWindow调用后已获得桌面前台。此次空白实际像素命中Credential Dialog Xaml Host，系统CredentialUIBroker.exe在运行；安全DesktopPoint检查拒绝了鼠标点击。原权限拒绝保持，四轮finally恢复原数据和窗口，不关闭不属于测试的系统凭据窗。用户关闭该窗后再补实际Core证明；这一外部条件不等于生产多边形缺陷。

## #210 原生SDK wire必须连同自建profile清理通过（2026-10-04）
actualReleasePlayer+正式SDK功能首轮通过（按下等待、同UP一次正数Core请求），但Player正常退出后WebView仍短暂持有自建user-data文件，2s重试预算不足，finally报告清理失败；保留整轮失败记录，不用前面的局部PASS代替完成。
只枚举本轮Dext-v3-author-input-wire-前缀，核实绝对路径位于GetTempPath内后用PowerShell Remove-Item -LiteralPath删除自建目录；没有删除用户Dext资料或通用WebView缓存。夹具清理改有界100×100ms，随后实际整轮exit0，临时目录为0。
SDK新增拒绝测试首轮未设置超时而等待旧实现不拒绝，工具会话中断后给该测试500ms上限；真实行为RED保留，后续SDK正确立即拒绝。首个SDK多方法夹具误写desk.next，真实接口为desk.navigate({type:'desk.next'})；夹具接口错误不计生产RED。Windows源码LF/CRLF混合时不能用Environment.NewLine拼跨行锚点，先核实唯一单行锚点；替换失败在写盘前停止，不反复重跑已成功的前半段mutation。
## #213 源动作夹具需进入desktop并沿创建票据的bridge确认（2026-10-04）
新增source动作检查初次把有start媒体的Fixture仍留在Starting，Request返回Queued而非桌面Accepted；退出确认又误用Fixture.View，与实际IssueHostInput的私有bridge连接不一致，得到Denied。先SetLifecycle Desktop并沿同一bridge.ConfirmNativeExit调用，再临时读取HEAD生产文件对正确行为重跑RED，恢复本轮实现后GREEN281/281；原失败证据保留，不把夹具错误当生产RED。
移动wire解析两个out数组不能放在Require(a&&b)后使用第二数组：C#不能从自定义Require推断第一分支为true，CS0165。拆成两个独立Require(TryCreate(...))后编译通过，真实移动wire随后整轮exit0；不是降低精确几何要求。
### #191 补充：UI清单不列出凭据宿主，不能证明桌面已解除覆盖（2026-10-04）
CredentialUIBroker进程MainWindowHandle=0，Orca list-apps不列出该应用，list-windows pid返回app_not_found，均不能证明Windows真实像素命中桌面。source-action-native-core-live在空桌面点击前再次WindowFromPoint，命中Credential Dialog Xaml Host全屏，安全断言终止，未点击/关闭凭据窗。finally恢复原壁纸、四文件字节/缺失状态、Room哈希及临时窗口旗标，Core已正常退出。
实际Core OS门槛仍等待系统窗真正解除；不得只因可见应用列表未列出而重试或填写通过，自己的隔离Player真实可信边沿仍可继续补本地证据。

## #214 键盘回执夹具必须保持真实receiver参数（2026-10-04）
native-input-guardian夹具fire(target,type,options)首轮误用fire(type,options)，因此事件未走root捕获，不能记生产RED。修正receiver为f.node后同一功能仍实质RED27/28（缺keydown/up回执），加入真实键回执后28/28；原失败日志保留。Core新SampleKeyboard/SampledVisual缺API的编译RED单独记录，不冒称行为RED。
跨多文件mutation在第一文件已写盘后，第二文件的SampledMouse模式锚点断言失败；核实实际input is{SampledMouse:true}语法，再只执行未写入后半段，避免重复修改已成功文件。查代码的几次旧文件名假设（RoomNativeInputQueue/RoomNativeSampleChecks/guardian大小写）不匹配；先rg --files得到实际WebWebView2.Input/NativeEventSampleChecks/native-input-guardian.js再读。最终diff --check与完整四阶段构建通过。

## #218 持续样包SDK副本与设计基准检查（2026-10-04）
资源检查发现rooms/v3-continuous/scene仍带旧SDK副本；复制当前生产SDK后Schema、全部声明资源及字节一致通过。复制样包要检查嵌入SDK，不能只看creator-kit本体测试绿。
首轮实际Player采用640×480/scale1.5，实际CSS视口427×320触发既有CSS像素尺寸保留/临时移位；固定基准作者矩阵叠加后仪表盘出画布。修正样包基准布局并以1920×1080/scale1验证同仪表盘底部→整页→返回，多尺寸/个人有效布局组合仍保持待做；不能把改验证窗口写成响应式通过。
编写shell here-string时内嵌JS模板反引号使functions.exec整段SyntaxError、未执行任何修改；改用普通字符串拼接后接续。日志__EVIDENCE__占位符曾漏替换和rg括号过度转义，修正精确路径/简单模式后继续；没有反复重跑已完成实机或网络矩阵。

## #220 观测轮询须等组件实际挂载（2026-10-04）
首次effective-layout-author-wire超时：轮询入口立即对尚不存在的component.instrument调用getBoundingClientRect，异常使后续setTimeout不再执行，宿主本身继续正常capabilities/data。在每次轮询先等待实际节点再读取矩形，保留原位置/尺寸/ready门槛后wire2整轮通过。诊断脚本不能把自身时序异常归因于生产渲染器；Core包/回复fixture仍标明。
检索路径须用rg --files确认，测试文件位于dext-room-v3本层，creator-kit/v3无README；读取日志前须展开__EVIDENCE__占位符，直接读取占位路径会报不存在。以上均已按实际路径接续，无创建占位文件。

## #222 测试run参数与依赖等待（2026-10-04）
dotnet run --project ... --nologo将未识别参数交测试程序，报Unknown action probe mode；改用已编译--no-build不传参数，才取得真实295/299行为RED，不能把命令失败计生产RED。
启动实际Player后exec_command可能返回活session；后续build/部署须先等待其退出，避免写入正在使用的Player输出。本轮首次回归/构建都通过，但先后次序不足以确认回归使用最新部署，故部署完成后以positive-input-official-wire-final再验证当前实际二进制整轮，通过后不扩大复测范围。

## 223. P6作者文件与界面检查的工具执行顺序
- 现象：Python read_text未指定encoding，在Windows按GBK读取中文源码而中断；JS String.raw中的反引号或美元插值又曾在工具解析前失败。首轮UI主题截图也早于过渡绘制完成，出现瞬时颜色。
- 修复：所有文本读写显式UTF-8；嵌入代码用字符拼接避免外层JS插值，解析失败未产生文件改动后才重试。实际浏览器功能整轮最终通过，深浅截图等待主题绘制。
- 防再犯：工具进程失败和产品功能RED分开记录；中断后核对已写文件；查看真实exit code，命令串最后成功不等于前面成功。P6首轮Rust全套因样包重复ID未绿，最终34/34才算通过。

## #227 原生UI探针明确夹具、目录和退出次序（2026-10-04）
覆写冻结的__TAURI_INTERNALS__.invoke未截到dialog，选择返回null，素材状态等待超时，未算导入通过。改为只截实际Vite dialog模块的选择文件返回，生产Tauri invoke/import/write/apply/RPC均保持；prompt亦为输入夹具，原生系统选择框仍待最终验收。
首次保存失败探针打开错Room；先确认编辑器名称/路径，再临时移动自有资源，真实失败反馈/原字节保持通过。卡片可访问名含“已选中”，锚定开头等待不到；改唯一房间名匹配。观察器相对路径cwd为tauri-ui，首次文件不存在后改绝对路径。清理后误把*>作为新语句，日志写入失败；不重做递归删除，以只读精确恢复/进程/监听/目录检查保存最终日志。
第一轮先关Core，再CloseMainWindow，配置器窗口关闭但进程驻留，报PostMessage无效HWND；核对PID/共享二进制绝对路径后停止自有进程，watcher exit-1如实保留。后两轮先关配置器、再普通Core退出，watcher78843/75916 exit0；原四文件/缺失与localStorage恢复，进程/监听/自有资源0。未操作凭据宿主或做Core OS点击。

### 2026-10-04 P6-002复核（沿用#223/#227）
编辑脚本在tauri-ui cwd却带repo前缀时，首个write_text即FileNotFoundError；npm exec也不会自动切换项目目录，tsc相对project路径必须与实际cwd一致。改为明确repo或tauri-ui绝对工作目录再定位文件；本轮失败脚本未写任何源码，重试后构建/夹具通过。HTML生成拼接引号曾留下字面量+template+，读取实际作者文件后修正，两个作者浏览器夹具通过。
测试复用同Room切换模板时不能清空旧资源清单；保存所有实际导入资源后正式安装通过。这是夹具错误，未改生产安装校验。依赖通过已核对node_modules junction复用，编译目标显式指定已有缓存。

## #229 node_modules junction的字体真实路径未被Vite允许（2026-10-04）
现象：复用已核对依赖目录的worktree构建/编辑功能通过，但Vite日志显示Geist字体403，浏览器回落到系统字体。
原因：Vite把资源解析到junction真实目标，默认允许范围只包含当前项目和Vite客户端。
修复：保留searchForWorkspaceRoot默认范围，并仅增加已解析node_modules真实目录。浏览器编辑检查记录所有失败资源、等document.fonts.ready并要求零失败；后续预览重新截图。未开放其他目录，生产打包资源原本正常。

## #230 授权控件应等待持久化，实际Player帧与本机关窗（2026-10-04）
首轮UI运输夹具直接import预打包react-dom_client的命名createRoot，模块没有该导出；改默认ReactDOM.createRoot后才得到实际“缺复选框”RED。用于故意保存失败/旧副本的Playwright check要求立即勾选，与生产确认后更新/失败保持相冲突；这些步骤改click后等待错误和最终状态。真实RPC也需click后等待确认勾选，不把瞬时回滚算产品失败。
真实Player顶层为安装哈希.localhost，sandbox子帧URL可能为空；不能按源文件URL或dext-room-v3字样寻找。先核对官方顶层title、实际iframe src匹配当前组件entry，再读真实子帧DOM；两生产模板/accepted几何通过，未把不透明帧当不存在或注入fixture。
默认Tauri权限没有window.minimize/close，JS调用拒绝。未为测试扩大权限；按owned PID/绝对路径核对后CloseMainWindow正常OS关窗/进程退出，再普通Core退出，watcher39064 exit0。原localStorage/四文件精确恢复。清理命令末行错误追加独立2>&1导致命令exit1，但删除/恢复已完成；沿#227不重跑递归删除，用独立只读恢复/所有权/进程/监听检查exit0保存证据。

### 2026-10-04 P6-003本地编辑检查（沿#223/#227）
C#顶层Program的Copy常量不能由partial测试类直接使用（CS8801），改为该检查内独立copyId；TS项目库不含String.replaceAll，改global replace，不扩大目标库。命令曾在tauri-ui cwd重复加tauri-ui前缀，首个写入即失败，改正确路径且未重跑初始化/原始备份。大型exec的String.raw内Markdown反引号也会解析失败，不执行任何脚本；用普通文本记录再执行。

## #237 自动审批检查超时不是脚本已执行（2026-10-04）
P7创作写入调用返回CreateProcess Rejected：automatic permission approval review未在deadline完成，未创建进程。它不等于源实现失败或需要改变目标权限。确认返回明确表示未执行后，用同一cmd/workdir/require_escalated参数只重试一次成功；追加型写入不得对已运行/未知结果盲目重跑。以后先保存命令参数，重试前区分创建拒绝与运行中句柄，避免重复追加或重置用户数据。

### #237 补充：生成PowerShell源码时不要在JS模板里放裸反引号
P2b资产写入命令在functions.exec解析阶段报SyntaxError，未执行任何文件写入；原因是PowerShell续行符反引号直接终结了JS String.raw模板。移除续行、使用单行Start-Process后原写入成功。执行状态以工具返回为准，不把脚本解析失败算产品失败，也不重复已执行的追加命令。

### #237 补充：PowerShell下rg路径通配符用-g，不直接拼目录星号
P8查代码两条命令把RoomSession*或DextRoomRuntime*作为路径参数，rg按字面路径返回Windows os error123。改为已确认目录配-g '*.cs'及明确文件定位完成；没有重跑写入命令或把定位失败算产品失败。后续代码定位先按CodeGraph可用状态，再用rg的过滤器。
