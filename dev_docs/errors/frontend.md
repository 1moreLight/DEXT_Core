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
