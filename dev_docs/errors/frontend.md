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
