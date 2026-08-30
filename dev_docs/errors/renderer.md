# 踩坑记录 · 渲染器篇（wallpapers/dext-room，追加式勿删）

> 格式：症状 / 根因 / 解决 / 防再犯
> 全量索引见 `../ERRORS.md`；其他分册：git / backend / frontend / toolchain

## 4. 切桌永久卡死

- 根因：配置器写的 room.json 缺 transitionText 字段，main.js 对 undefined 调用函数抛异常，switching 锁死为 true
- 解决：缺字段回退默认文案（bc2af63）
- 防再犯：渲染器处处兜底（宽容读取），schema v1 要写明全部可选字段

## 19. SVG polyline points 不支持百分比坐标（R9 导图线条挤成左上角一坨）

- 现象：思维导图连线全部缩在画布左上角成一个"不明物体"小箭头，节点间反而看不到线
- 原因：<polyline points="15,48.6 ..."> 的 points 是用户单位（px），**不支持 %**；
  <line x1/y1/x2/y2> 才支持百分比。想当然把 % 塞进 points 就全挤到左上角了
- 解决：每条路由拆成 3 段 <line>（% 坐标），箭头 markerEnd 只放最后一段；
  strokeWidth 用固定值不受 % 影响
- 教训：SVG 里 polyline/polygon/path 的坐标一律是用户单位；要 % 就用 line/circle 等支持
  百分比的元素属性，或上 viewBox+preserveAspectRatio（注意描边会跟着缩放）

## 21. 主题令牌重构吃掉 CSS 属性名（dock 无底色/布局丢失）

- 现象：style.css 多处出现「-color: var(--dext-...)」这类残行，#dock 整块只剩
  backdrop-filter/box-shadow，position/flex/padding 全丢；.icon-del/.size-btn 同伤。
  始于 b4a0827（rgba→var(--dext-*) 的批量替换把「background-color:」前缀连值一起误删）
- 解决：对照 git show b4a0827~1 还原全部损坏规则，并用 node --check 式脚本全文件扫残留
- 防再犯：批量正则替换样式属性后，用正则扫 /[{};]\s*-color|^\s*-color/ 自检 + 浏览器视检一遍再提交

## 31. sandbox iframe 的完成消息与 WebView IPC 必须双层验源

- 症状：旧 HTML 场景只判断裸字符串 `dext:slotDone`，任意 frame 或顶层页面都能提前结束当前场景；同时 WebView2 会接收子 iframe 的 web message，sandbox 本身不足以保护启动/保存 IPC。
- 根因：只验证消息内容，没有绑定发送窗口、场景实例和 Player 顶层文档来源。
- 解决：每次 HTML 场景生成 `instanceId`，宿主同时校验 `event.source === iframe.contentWindow` 和结构化消息里的实例；Player 再比较 WebView message 的 `Source` 与当前顶层 URL，只允许官方顶层文档上行。
- 防再犯：跨窗口消息至少绑定来源窗口和一次性实例；涉及本机能力时还必须在最终宿主边界再次验源，不能只依赖前端 iframe sandbox。

## 33. Tauri 开发态 origin 与发布态不同导致预览被拒绝

- 症状：打包后的配置器预览正常，但 `npm run tauri dev` 中 iframe 一直停在默认 Room，内存草稿没有进入渲染器。
- 根因：渲染器只放行发布态 `http://tauri.localhost`，而 Vite 开发父页面实际是 `http://localhost:1420`。
- 解决：预览父页面使用固定双值白名单；仍校验 `event.source === window.parent`、消息结构和素材 origin，禁止 `*`。
- 防再犯：涉及 Tauri 自定义协议与开发服务器的 postMessage 时，发布态和开发态 origin 都要实测；白名单必须是明确值。
