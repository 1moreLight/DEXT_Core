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
