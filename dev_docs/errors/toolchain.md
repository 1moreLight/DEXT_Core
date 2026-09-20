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
