# 踩坑记录 · 前端篇（配置器 Tauri/React，追加式勿删）

> 格式：症状 / 根因 / 解决 / 防再犯
> 全量索引见 `../ERRORS.md`；其他分册：git / backend / renderer / toolchain

## 5. 配置器界面裸样式（无 CSS）

- 根因：index.html 被 demo 版来回替换后恢复时丢了样式引入，main.tsx 从未 import index.css
- 解决：a5b1e61 补 `import "./index.css"`，删除无主 App.css
- 防再犯：UI 改版后先看 dist 里 css 产物是否非零

## 15. 设计模式下 invoke 报 TypeError 刷满状态栏

- 症状：浏览器设计模式（dev:ui）状态栏显示 `error: TypeError: Cannot read properties of undefined (reading 'invoke')`，盖掉「UI 设计模式」提示
- 根因：App.tsx 有两个初始化 useEffect，只有第一个做了 IS_TAURI 守卫；第二个（refreshRooms→openRoom）在浏览器里照样调 invoke（@tauri-apps/api 在非 Tauri 环境是 undefined）
- 解决：第二个 useEffect 也加 `if (!IS_TAURI) return;`
- 防再犯：设计模式下新增任何初始化逻辑，先想 IS_TAURI 守卫；新增 useEffect 时对照检查

## 22. DockEditor 先写后编译：TS 语法误入 .js + 组件编译错误堆

- 现象：审查 R11 UI 时 npm run build 一次性爆出 ~30 个错误：
  @/components/ui 无 Select/Switch（只有 button/input 原件）；named export 被 default import；
  setStatus/setDesks 未接线；icons[].label 路径键不匹配 keyof；DEFAULT_STYLE 判空；
  空 JSX 表达式；另外 main.js 里误写了 TS 类型标注 const vars: [...]
- 解决：抽 lib/dock.ts 共享类型与预设；DockEditor 改用原生 select/checkbox + 现有 Button/Input；
  per-desk 覆盖通过 setDesks 真正写回 room.json；渲染器 style 变量改 removeProperty 防残留
- 防再犯：新组件先 npm run build 再谈功能；.js 文件绝不写 TS 类型标注；
  UI 原件清单只有 button.tsx/input.tsx，选型前先 glob 确认

## 24. 配置器预览状态还在，但 iframe 已被 UI 改版移除

- 现象：顶栏「预览」按钮、`showPreview`、`postRoom` 和 `previewRef` 都存在，但点击后看不到任何预览；Dock 皮肤无法实时验证。
- 根因：R8 思维导图改版移除了 JSX 中的 `<iframe>`，却保留了全部预览状态和消息逻辑，形成半截功能。
- 解决：按 Phase 2 原结构恢复 `http://dext.localhost/index.html` iframe；`dext:room` 同时注入 roomCss，渲染器用预览专用 style 隔离覆盖包内旧 room.css。
- 防再犯：删除 UI 容器时同步检查对应 state/ref/effect 是否仍有消费者；保留入口按钮就必须有可观察结果。可用 `rg "previewRef|showPreview"` 核对定义和 JSX 引用是否成对。

## 25. 前端编译目标不支持 `Array.prototype.at`

- 现象：`npm run build` 报 TS2550，提示当前 lib 目标没有 `Array.at()`。
- 根因：项目 TypeScript 目标早于 ES2022，运行时可能支持并不代表类型配置允许。
- 解决：改用 `array[array.length - 1]` 的兼容写法。
- 防再犯：提交前必须跑 `npm run build`；在未统一升级编译目标前避免使用 ES2022 新增 API。

## 28. flex 节点内 `truncate` 未约束宽度仍会溢出

- 现象：思维导图的启动画面节点已有 Tailwind `truncate`，但名称变长后文字仍从固定宽节点左右溢出。
- 根因：节点是纵向 flex 容器；文字子项只有 `truncate`，没有占满父节点的明确宽度，浏览器仍按内容固有宽度布局。
- 解决：文字子项补 `w-full truncate`，节点补 `title` 保留完整名称提示；可变宽 Desk 节点另设最大宽度并在内部截断。
- 防再犯：flex/grid 子项做省略时同时给出可收缩的宽度约束（如 `w-full` / `min-w-0` / `max-w-*`），并用真实长文本做浏览器检查，不能只看短 mock 文案。

## 29. 撤回删除节点后选择状态仍指向不存在索引

- 现象：新增第三个 Desk 后执行撤回，节点和连线正确恢复为两个，但属性栏仍显示已不存在的 `d2`，当前 Desk 索引也越界。
- 根因：撤销快照只恢复 `desks/edges`，没有在节点数量缩小时校正 `activeDesk` 与 `graphSel` 这两个派生选择状态。
- 解决：应用快照时把 `activeDesk` 钳制到有效范围；若 `graphSel` 指向已不存在的 Desk，则清空选择。
- 防再犯：任何会改变集合长度的撤销/恢复逻辑，都要同时核对依赖该集合索引的选中项、焦点、详情面板和活动页状态。

## 35. UI 按钮存在，但真实 Tauri 链路仍走 mock 或漏保存素材

- 现象：Room 列表的“新增 Room”只追加浏览器 mock；编辑页“应用”绕过未保存草稿；已有 `saveAs` 函数没有可见入口，而且另存时只写 JSON，不复制 `background/start/switch/end`，新 Room 的内容引用全部悬空。
- 根因：UI 改版只检查按钮外观和函数是否存在，没有从真实 Tauri 入口追到 Rust 文件系统结果，也没有把 Room 当作“JSON + 四类素材目录”的整体。
- 解决：真实新增调用 `create_room`，成功后才选中并进入；编辑页应用统一走 `applyCurrent` 先保存 dirty 草稿；另存为通过 Rust 事务式创建目标并复用四类素材复制，失败时清理刚创建的目标，原 Room 保持不变。
- 防再犯：配置器入口验收必须覆盖“空库 → 新建 → 编辑 → 保存/应用 → 另存 → 重开”，并检查文件系统而不只看 React 状态；任何 Room 复制都必须同时验证 JSON、四类目录和 `__source` 边界。

## 36. 属性栏素材按钮只有外观、没有点击动作

- 现象：新增 Room 后，Desk/start 属性栏显示“图片 / 网页代码 / 视频”，但点击不打开文件选择；switch 方向只有预设下拉框。
- 根因：UI 改版留下了带“下一轮接真实导入”提示的占位按钮，却在 DXT-001 待验收时把“按钮可见”误当成内容配置已可用；既有 Rust 命令也只支持背景图片/视频和 switch 视频。
- 解决：复用并泛化 `import_background`，按 `slot + content_type` 复制到四个固定目录；Desk/start/switch 属性栏共用同一个 picker，两个 switch 方向分别更新各自 edge；选择后只更新内存草稿，明确保存才写 JSON。
- 防再犯：可交互控件进入待验收前必须逐个检查 `onClick/onChange` 和真实桌面结果；带“下一轮”提示的占位控件不能留在本轮可验收路径上。自动测试至少覆盖各目录、各类型和类型不匹配拒绝。

## 38. Core 身份只在配置器挂载时读取，退出后仍显示已连接

- 现象：从托盘退出 Dext Core 后壁纸和 pipe 已消失，但仍开着的配置器继续显示“Dext Core 已连接”；点击应用 Room 才得到连接失败。
- 根因：`core_identity` 只在 React 首次挂载时调用一次，绿色状态保存的是历史快照，不是当前连接状态。
- 解决：配置器每两秒重新验证一次 Core 身份；断线立即清空 identity，显示“Dext Core 未运行”并禁用全部应用 Room 入口；RPC 在两次轮询之间断开时也会主动降级状态。
- 防再犯：连接、进程和设备状态都不能用一次性初始化结果长期展示；必须定义刷新/事件机制，并把业务按钮可用性绑定到同一份实时状态。

## 43. Tauri `openPath` 有命令权限仍会被路径 scope 拒绝

- 现象：设置页“打开数据目录”和关于文档按钮都已渲染；补上 `opener:allow-open-path` 后，点击仍报 `Not allowed to open path`。
- 根因：Tauri opener 的命令 ACL 与路径 scope 是两层约束；前端直接提交任意绝对路径既需要广泛 scope，也扩大了 WebView 被注入时的文件打开面。
- 解决：前端只提交固定枚举；Rust `open_about_document` 重新映射并校验仓库内三份文档，`open_dext_directory` 从已验证 Core 身份派生 data/log 路径，再由原生 `OpenerExt` 打开。仅保留诊断保存所需的 `dialog:allow-save`，不授予 WebView 任意路径 opener scope。
- 防再犯：真实 Tauri 功能必须点击验证，不能以按钮出现或 TypeScript 编译通过代替；涉及文件、shell、opener 的能力优先设计为后端白名单 command，不向 WebView 开放通配路径权限。
