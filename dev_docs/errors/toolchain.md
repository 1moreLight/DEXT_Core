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
