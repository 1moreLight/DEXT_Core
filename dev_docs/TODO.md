# 总任务台账 · 当前（只加不删）

> 标记规则：`[ ]` 计划中 · `[~]` 进行中 · `[x]` 完成(日期) · `[!]` 受阻(原因)
> 新计划一律**追加**；做完立即打标；废弃标 `[x] 已取消(日期)`，不删除。
> 已完成历史见 `TODO-archive.md`；会话被中断时：从这里最后一条未完成项继续。

## R11 Dock 高度自定义探索（2026-08-27 开工，UI 接入等用户指令）

- [x] [!]→[x] 修复 style.css 主题令牌重构吃掉属性名的事故（ERRORS #21，对照 b4a0827~1 还原）
- [x] 渲染器 dock 自定义：room.json 新增 `dock` 配置节（宽容读取）
      enabled / position(bottom|top|left|right) / magnify(鱼眼) / indicator(text|dots)
      style{bg,blur,radius,gap,pad} / icons[] 常驻启动项（结构同桌面图标）
- [x] 编辑模式支持删除 dock 图标；persistRoom 自动覆盖持久化
- [x] 自测：node --check main.js 通过（CSS 括号平衡校验通过）
## R11.1 Dock 追加能力：per-desk 覆盖 + Apple 式 auto-hide（2026-08-27）

- [x] desks[i].dock 可覆盖全局 dock（icons/style/position 均可按桌定制）
- [x] dock 新增 autoHide 开关：空闲时缩进屏幕边缘，指针靠近弹出
- [x] DOM 微调：dock 内容包一层 .dock-inner（视觉与定位分离，为后续外观定制铺路）
- [x] 自测 node --check；UI 接入继续等指令
- [x] 配置器 Dock 编辑页（App.tsx + DockEditor.tsx）——可视化编辑全局+dock per-desk，保存即写入 room.json 的 dock / desks[i].dock 字段；皮肤预设（HUD/Minimal/Glass）一键写入 localStorage，实际使用时把对应 CSS 片段贴进 room.css
- [x] ERRORS #21 记录：style.css 主题令牌重构误删 background/布局属性已修复
- [x] R11 代码审查（2026-08-27）：DockEditor 重写（原生控件/每桌写回/编译全绿），渲染器 style 变量残留修复，ERRORS #22
- [ ] 配置器 Dock 编辑页接入 —— 等用户指令

## 当前阶段：R10 思维导图收尾（2026-08-27 进行中）

> WIP 已提交（b9cd53d）：Snapshot 增 desks/hasStart、seedEdges 支持无启动画面、openRoom mock 模式、几何测量 state。

- [~] R10 收尾：hasStart 开关 UI、几何测量接入导图布局、mock/真机双端自测
- [ ] 自测：node --check + npm run build + cargo check 全绿
- [ ] 用户验收（对话清单）

## 待验收（历史阶段的遗留确认项）

- [ ] Phase 2 用户验收：清单见 ACCEPTANCE.md「Phase 2」
- [ ] Phase 5 用户验收（ACCEPTANCE.md「Phase 5」T1-T6）
- [ ] Phase 6 用户验收：两个设计模式可用（ACCEPTANCE.md「Phase 6」P1-P4 + Q1-Q3）
- [ ] Phase 6.5 用户验收（ACCEPTANCE.md「Phase 6.5」L1-L7）
- [ ] Phase 7 用户验收：阅读 MODEL.md 确认模型（ACCEPTANCE.md「Phase 7」）
- [ ] Phase 8 用户验收（ACCEPTANCE.md「Phase 8」）
- [ ] Phase 9 用户验收（对话清单：start 动画 / end 动画 / 无槽房间不受影响）
- [ ] Phase 9.1 用户验收（同 Phase 9 清单，名字换 start/switch/end）
- [ ] 研究专项用户验收：对话确认 LIVELY_API.md 结论无异议
- [ ] 配置器：对含 room.js 的房间不破坏（编辑 room.json 主体照常）

## 排队中：渲染器与 Schema

- [ ] room.json schema v1 定稿 + JSON Schema 校验文件：
      固化 x/y、iconSize、background/transition 多态、__source 等现有字段；
      宽容读取原则（缺字段一律给默认值，见 ERRORS #4 教训）
- [ ] Room 文件夹化收尾：房间导出 zip / 导入（素材导入压缩 ≤1920w JPEG）
- [ ] 配置器导入 json 校验入口（报错说人话，AI 生成内容友好）
- [ ] 右键菜单（图标操作等）
- [ ] 枚举过滤失效快捷方式（AppCatalogService 跳过目标不存在的 .lnk）

## 远期

- [ ] 图标归一化：AppCatalogService 提取后按 alpha 包围盒裁剪、内容统一占比 ~80% 居中
      （实测 173 个图标占比 81%~100% 分布，85 个非方形内容；提取可升 96px 再缩回提清晰度）
      上线后需刷新既有房间的内嵌 base64 图标
- [ ] AI skill：schema 文档 + 示例房间 ×3 + 提示词模板
- [ ] 多显示器支持
- [ ] 创意工坊分发形态调研（上传格式、预览图、订阅机制）
