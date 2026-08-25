# 踩坑记录（追加式，勿删旧条目）

> 格式：症状 / 根因 / 解决 / 防再犯

## 1. RPC 永远超时 + 桌面弹出独立浏览器窗口

- 症状：set_wallpaper 调用挂起超时，屏幕上出现普通浏览器窗口而非壁纸
- 根因：Player 以 Debug 构建时走 `IsDebugBuild()` 分支——显示窗口而不是把 hwnd 发给 Core，Core 的 ShowAsync 无限等待
- 解决：Player 一律 Release 构建（scripts/build.ps1 已保证）
- 防再犯：任何手动 dotnet build 后必须确认是 Release 配置

## 2. tonic 连不上 Lively Core

- 根因：GrpcDotNetNamedPipes 使用自定义线协议，不是标准 HTTP/2 over pipe
- 解决：tauri-ui/src-tauri/src/grpc.rs 手写协议帧
  （RequestInit→Headers→Payload→StreamEnd→Trailers），一次调用一条管道连接
- 防再犯：别试图换回 tonic/http2；改协议先对照 transport.proto

## 3. protox 编译失败

- 根因：C# 侧 .proto 文件带 UTF-8 BOM，protox 不接受
- 解决：拷贝到 tauri-ui/src-tauri/proto/ 时去 BOM；C# Grpc.Tools 不受影响
- 防再犯：改 wallpaper.proto 后同步副本必须重新去 BOM

## 4. 切桌永久卡死

- 根因：配置器写的 room.json 缺 transitionText 字段，main.js 对 undefined 调用函数抛异常，switching 锁死为 true
- 解决：缺字段回退默认文案（bc2af63）
- 防再犯：渲染器处处兜底（宽容读取），schema v1 要写明全部可选字段

## 5. 配置器界面裸样式（无 CSS）

- 根因：index.html 被 demo 版来回替换后恢复时丢了样式引入，main.tsx 从未 import index.css
- 解决：a5b1e61 补 `import "./index.css"`，删除无主 App.css
- 防再犯：UI 改版后先看 dist 里 css 产物是否非零

## 6. 日志偶发 Unexpected WorkerW Z-order

- 根因：虚拟显示器适配器（GameViewer / Luminoncore IDDCX）干扰桌面窗口枚举
- 解决：忽略即可；测试时只留 DISPLAY1 主屏

## 7. WebView2 虚拟主机限制

- 规律：页面只能加载壁纸包目录内的文件（https://<hash>.localhost/ 映射包根目录）
- 影响：视频等大素材必须落盘到包内/房间文件夹内才能播放；绝对路径引用无效
- 关联决策：Room=文件夹方案

## 8. PowerShell 5.1 读无 BOM UTF-8 JSON 中文乱码

- 症状：ConvertFrom-Json 对含中文的 room.json 报"无效对象"
- 根因：PS5.1 默认按 ANSI 读文件，多字节字符被拆坏
- 说明：仅 PS 工具链问题，浏览器 fetch 正常；PS 里需 -Encoding UTF8

## 9. PowerShell 改写 UTF-8 文件会加 BOM / 正则匹配中文易漏

- 症状：用 PS -replace + Set-Content 改 TODO.md 后文件带 BOM；含中文/反引号的行正则漏匹配
- 解决：结构化改写一律用 node -e（JSON/UTF-8 无 BOM）；打标用编辑工具逐条改
- 防再犯：dev_docs 的批量改写别走 PS 管道

## 10. node -e 里的 $1 被 PowerShell 双引号吞掉

- 症状：
ode -e "...replace(/re/,'- [x] $1')" 经 bash 工具执行后，$1 变空串，替换结果丢字
- 根因：PowerShell 双引号字符串先做自己的变量插值，$1 是 PS 的空变量
- 解决：跨 PS 传正则替换时用单引号包 node 脚本，或干脆用编辑工具逐条改

## 13. 双写往目录路径 WriteAllText 必抛异常被裸 catch 吞掉

- 症状：修完 #12 后源库仍不同步，且零日志
- 根因：__source 是文件夹，WriteAllText(文件夹) 抛 IOException；内层 catch{} 静默吞掉，两轮排查全被它蒙蔽
- 解决：Directory.Exists(src) 时拼 src+room.json 再写；内层 catch 一律记日志
- 防再犯：**禁止裸 catch**——吞掉的异常就是排障时的黑洞

## 12. 双写用 File.Exists 判断文件夹路径永远 false

- 症状：SaveRoom 写包内成功但源房间从不同步，无任何报错日志
- 根因：__source 戳存的是房间文件夹，代码却用 File.Exists（对目录恒 false）静默跳过
- 解决：File.Exists || Directory.Exists
- 防再犯：存在性判断前先想清楚路径是文件还是目录

## 11. WebWebView2 构造参数 path 是入口文件不是文件夹

- 症状：SaveRoom 报 Could not find a part of the path ...\\index.html\\room.json，桌面编辑无法持久化
- 根因：想当然把构造参数 path 当壁纸文件夹，实际是入口 html 文件路径
- 解决：File.Exists(path) 时取 Path.GetDirectoryName 再拼 room.json
- 防再犯：拼壁纸内文件路径前先确认 path 语义（日志里看实际值）

## 14. node -e 批量正则替换里的  反复被 PowerShell 吞（第三次）

- 症状：ACCEPTANCE.md 批量打勾后 V1-V10 编号全丢变成 **V**
- 根因：双引号字符串里 PowerShell 先行插值 ；单引号包脚本或用编辑工具可避免
- 解决：涉及捕获组替换一律用编辑工具逐条改；此坑已犯三次，不再用 PS 传正则替换

## 15. 设计模式下 invoke 报 TypeError 刷满状态栏

- 症状：浏览器设计模式（dev:ui）状态栏显示 `error: TypeError: Cannot read properties of undefined (reading 'invoke')`，盖掉「UI 设计模式」提示
- 根因：App.tsx 有两个初始化 useEffect，只有第一个做了 IS_TAURI 守卫；第二个（refreshRooms→openRoom）在浏览器里照样调 invoke（@tauri-apps/api 在非 Tauri 环境是 undefined）
- 解决：第二个 useEffect 也加 `if (!IS_TAURI) return;`
- 防再犯：设计模式下新增任何初始化逻辑，先想 IS_TAURI 守卫；新增 useEffect 时对照检查

## 16. PS 控制台显示中文乱码 ≠ 文件乱码（虚惊）

- 症状：Add-Content 追加中文后 Select-String/Get-Content 输出全是乱码，以为文件坏了
- 根因：PS 5.1 控制台按代码页显示，文件本身是正确的 UTF-8；Read 工具读出来完全正常
- 解决：判断文件是否乱码一律用编辑/读文件工具看，别信 PS 控制台显示
- 防再犯：与 #8 区分——#8 是 PS 管道**读取解析**坏（ConvertFrom-Json 报错），本条只是**显示**层假象

## 17. 并行会话共用一个工作区：git add 互相扫走对方的文件

- 症状：本轮新建 dev_docs/LIVELY_API.md 后 `git add <三个文件>` + commit，结果 commit 只含 2 个文件；
  新文件既不在 commit 里、也不在 status 未跟踪列表里，疑似丢失
- 根因：另一个并行会话在同一工作区做 Phase 9，其提交（70f0599）把磁盘上我已写好的 LIVELY_API.md
  一并 add 进去了；轮到我 add 时该文件已与 HEAD 一致 → 零差异 → 不进我的 commit。
  文件内容其实毫发无损，只是"搭了别人的车"入库
- 排查手法：`git log --all -- <文件>` 看它真正进的是哪个 commit；`git diff HEAD -- <文件>` 确认盘上内容
- 防再犯：多会话同仓库时 ①提交前 `git status --short` 核对清单 ②只 add 本轮明确改动的具名文件，
  慎用 `git add -A`/`git add .` ③发现文件"消失"先怀疑被并行提交收编，别急着重写
