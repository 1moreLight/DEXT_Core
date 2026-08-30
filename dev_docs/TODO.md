# 总任务台账 · 当前（只加不删）

> 标记规则：`[ ]` 计划中 · `[~]` 进行中 · `[?]` 待用户验收 · `[x]` 完成/已迁移(日期) · `[!]` 受阻(原因)
> 新计划一律**追加**；做完立即打标；废弃标 `[x] 已取消(日期)`，不删除。
> 已完成历史见 `TODO-archive.md`；会话被中断时：从这里最后一条未完成项继续。
> 2026-08-28 起，产品 backlog 只放 `ROADMAP.md`；本文件只记录已开分支的执行过程。此前未完成项保留原位，并标明迁移后的工作包。

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
- [x] 已拆分迁移至 ROADMAP：DOCK-001 / DOCK-002 / DOCK-003（2026-08-28）
- [x] Dock UI 接线已拆分迁移至 ROADMAP：DOCK-001 / DOCK-002 / DOCK-003 / ROOM-001（2026-08-28）

## R11.2 全景开发列表文档化（2026-08-28）

- [x] 梳理「有 UI 无后端」清单（codegraph 交叉验证：save_room_css/export_room/import_room/validate_room/dockAdd 均不存在；DockEditor 零 invoke）
- [x] codegraph 查漏补缺：4 个备而不用命令（launch_app/get_wallpapers/set_wallpaper/core_stats 前端从未调用）；tauri-ui/main.js 死文件；MODEL.md §八 实际已做项对照
- [x] 新建 `dev_docs/ROADMAP.md`：全景开发列表，按前端/后端/跨端/契约分层，带优先级与依赖关系
- [x] 已由新工作包 ID 和 WORKFLOW.md 取代（2026-08-28）

## 当前阶段：R10 思维导图收尾（2026-08-27 进行中）

> WIP 已提交（b9cd53d）：Snapshot 增 desks/hasStart、seedEdges 支持无启动画面、openRoom mock 模式、几何测量 state。

- [x] 已拆分迁移至 ROADMAP：UI-001 / UI-002 / UI-003（2026-08-28）
- [x] 旧阶段总自测入口关闭；由每个新工作包独立定义自测（2026-08-28）
- [x] 旧阶段总验收入口关闭；由每个新工作包独立验收（2026-08-28）

## 待验收（历史阶段的遗留确认项）

- [x] Phase 2 未勾项保留在 ACCEPTANCE.md，转为历史回归素材，不阻塞当前工作（2026-08-28）
- [x] Phase 5 未勾项保留在 ACCEPTANCE.md，转为历史回归素材，不阻塞当前工作（2026-08-28）
- [x] Phase 6 未勾项保留在 ACCEPTANCE.md，转为历史回归素材，不阻塞当前工作（2026-08-28）
- [x] Phase 6.5 未勾项保留在 ACCEPTANCE.md，转为历史回归素材，不阻塞当前工作（2026-08-28）
- [x] Phase 7 未勾项保留在 ACCEPTANCE.md，转为历史决策参考（2026-08-28）
- [x] Phase 8 未勾项保留在 ACCEPTANCE.md，转为历史回归素材，不阻塞当前工作（2026-08-28）
- [x] Phase 9 未勾项转为历史回归素材；相关功能被改动时纳入当轮验收（2026-08-28）
- [x] Phase 9.1 未勾项转为历史回归素材；相关功能被改动时纳入当轮验收（2026-08-28）
- [x] LIVELY_API.md 结论转为研究参考；实际采用时另开工作包验证（2026-08-28）
- [x] room.js 兼容回归迁移至 UI-001 / UI-002 等触及配置器保存的工作包（2026-08-28）

## 排队中：渲染器与 Schema

- [x] 已迁移至 ROADMAP DXT-001（2026-08-28）：
      固化 x/y、iconSize、background/transition 多态、__source 等现有字段；
      宽容读取原则（缺字段一律给默认值，见 ERRORS #4 教训）
- [x] 已拆分迁移至 ROADMAP ROOM-001 / ROOM-002（2026-08-28）
- [x] 已迁移至 ROADMAP ROOM-003（2026-08-28）
- [x] 已迁移至 ROADMAP UX-002（2026-08-28）
- [x] 已迁移至 ROADMAP CORE-001（2026-08-28）

## 远期

- [x] 已迁移至 ROADMAP CORE-004（2026-08-28）：AppCatalogService 提取后按 alpha 包围盒裁剪、内容统一占比 ~80% 居中
      （实测 173 个图标占比 81%~100% 分布，85 个非方形内容；提取可升 96px 再缩回提清晰度）
      上线后需刷新既有房间的内嵌 base64 图标
- [x] 已迁移至 ROADMAP AI-001（2026-08-28）
- [x] 已迁移至 ROADMAP CORE-003（2026-08-28）
- [x] 已迁移至 ROADMAP MARKET-001（2026-08-28）

## R12 开发体系收敛（2026-08-28）

> 目标：把后续开发固定成「一个任务 = 一个独立 worktree/分支 = 一份独立验收 = 验收后合并」，让用户始终能看清当前在做什么、做到哪一步、下一步是什么。

- [x] 建立本轮独立 worktree + `feat/ops-001-devdocs-workflow` 分支，主线不直接改（2026-08-28）
- [x] 统一 dev_docs 文档职责、阅读顺序、状态口径和冲突优先级（2026-08-28）
- [x] 建立单任务开发流程与标准验收模板，明确验收前禁止合并（2026-08-28）
- [x] 重整 ROADMAP 为可独立开发/验收的工作包，并标出唯一推荐下一项（2026-08-28）
- [x] 清理或标注过期状态，消除 TODO / ROADMAP / MODEL / FRONTEND_WORK 的口径冲突（2026-08-28）
- [x] 文档一致性检查、git status 核对并提交本轮具名文件（2026-08-28）
- [x] 根据用户反馈补齐 Dock 缺口并调整开发顺序：DOCK-001/002/003/004 + ROOM-001（2026-08-28）
- [x] 用户按 `acceptance/OPS-001-devdocs-workflow.md` 验收通过（2026-08-28，“开始”）
- [x] OPS-001 已合并 master（2026-08-28，merge `26ee399`），工作分支/worktree 进入清理

## DOCK-001 皮肤自动写入 room.css（2026-08-28）

> 目标：配置器选择 HUD / Minimal / Glass 后，预设 CSS 立即写入当前 Room、实时进入预览，并在重新打开房间后继续生效。
> 范围外：应用库选择器、桌面拖入 Dock、运行态圆点、Room zip 导出。

- [x] [!] 当前 worktree 无 `.codegraph/`，按纪律未自行建索引；改用普通搜索核对 Tauri command 注册、DockEditor 入口、房间打开与预览消息链（2026-08-28）
- [x] Rust 新增受约束的 `save_room_css` 命令和覆盖测试（2026-08-28）
- [x] DockEditor 接入真实保存回调；浏览器设计模式保持可用且不调用 Tauri（2026-08-28）
- [x] 配置器打开 Room 时读取既有 room.css，皮肤切换后实时更新预览（2026-08-28）
- [x] 渲染器预览消息支持隔离注入 room.css，不影响真桌面正常加载（2026-08-28）
- [x] 同步 README / DOCK.md 接口状态（2026-08-28）
- [x] 自测：Rust 相关测试 + cargo check + npm run build + node --check（2026-08-28）
- [x] git status 核对具名文件并提交到 `feat/dock-001-save-room-css`（2026-08-28）
- [x] 已取消原验收入口：用户反馈 Dock 页不应直接修改当前 Room（2026-08-28）

### DOCK-001 验收反馈修订（2026-08-28）

> 用户确认：Dock 在编辑侧栏中应作为独立模板库，以卡片形式浏览/选择，并承接未来创意工坊下载项；只有进入具体 Room 编辑器后，才选择该 Room 使用哪个 Dock。

- [x] 将 Dock 导航页从 Room 配置表单改成独立模板卡片库（2026-08-28）
- [x] 在 Room 编辑器内增加“当前 Room Dock”选择入口，选择后才写 room.css（2026-08-28）
- [x] 把全局/每桌 Dock 参数设置移入具体 Room 编辑上下文（2026-08-28）
- [x] Dock 模板库选择不得修改当前 Room；Room 选择继续实时预览并持久化（2026-08-28）
- [x] 登记 Dock 模板文件/本地库/创意工坊接入为后续独立工作包 DOCK-LIB-001（2026-08-28）
- [x] 更新 DOCK.md、验收卡并重跑自动检查；浏览器浅色/深色视觉检查通过（2026-08-28）
- [x] 提交修订到原 DOCK-001 分支（2026-08-28）
- [x] 已取消第一版修订验收入口：用户要求详情按钮改为编辑，并增加 Dock 文件导入（2026-08-28）

### DOCK-001 第二轮验收反馈修订（2026-08-28）

> 用户确认：Dock 模板详情的主按钮应为“编辑”，不能跳转 Room；Dock 页增加“新建”，点击后要求选择并导入 Dock 文件。Room 是否使用某个 Dock 仍只在具体 Room 编辑器决定。

- [x] 定义最小 Dock 模板文件 v1：名称、说明、预览色、标签和 CSS（2026-08-28）
- [x] 增加“新建”按钮和系统文件选择；校验导入后写入本地模板库（2026-08-28）
- [x] Dock 详情主按钮改为“编辑”；内置模板保存为本地副本，本地模板可覆盖保存（2026-08-28）
- [x] Room 内选择器同时显示内置和已导入模板，选择后写入当前 Room（2026-08-28）
- [x] 更新 DOCK.md、验收卡和后续 DOCK-LIB-001 边界（2026-08-28）
- [x] 自动构建、浏览器视觉检查和桌面导入调用链检查通过（2026-08-28）
- [x] 提交第二轮修订到原 DOCK-001 分支（2026-08-28）
- [x] 用户按第二轮修订后的验收卡确认通过（2026-08-28，回复“ok 先暂时下一步”）

### DOCK-001 验收收口（2026-08-28）

- [x] 将 Dock 选择时由实际 CSS/代码渲染外观缩略图登记为未来工作包 DOCK-PREVIEW-001（2026-08-28）
- [x] 更新 DOCK-001 验收记录和 ROADMAP 状态，明确 DOCK-002 为唯一下一项（2026-08-28）
- [x] 合并 `feat/dock-001-save-room-css` 到 master（`d2d8d53`），合并后最小检查通过，分支/worktree 已清理（2026-08-28）
- [x] 开发运行产生的 `wallpapers/dext-room/room.css` / `room.json` 状态保存为可恢复 stash，未混入提交（2026-08-28）

## DOCK-002 从应用库选择常驻图标（2026-08-28）

> 目标：在具体 Room 的 DockEditor 中搜索现有应用库，把真实应用加入全局或当前 Desk Dock，并通过现有 Room 保存链保留图标和启动信息。
> 范围外：桌面图标拖入 Dock、Player/Core 桌面编辑 IPC、运行态圆点、应用库扫描/清理规则、Dock 模板与创意工坊。
> 人工验收：在桌面配置器打开一个 Room，分别给全局 Dock 和当前 Desk 添加应用，保存并重开 Room，确认作用域、真图标与启动行为均正确。

- [x] 阅读项目入口、路线图、流程、Dock 契约和前端/Git/工具链错误分册，确认 DOCK-002 是唯一当前工作包（2026-08-28）
- [x] 从最新 master 建立独立 worktree `dock-002-app-library-icons` 和分支 `feat/dock-002-app-library-icons`，确认基线干净（2026-08-28）
- [x] 使用现有 CodeGraph 快照核对 DockEditor、应用库数据、Room 保存和预览链；新 worktree 无 `.codegraph/`，未自行初始化（2026-08-28）
- [x] 在 DockEditor 增加应用搜索、全局/当前 Desk 作用域和真实应用增删（2026-08-28）
- [x] 核对新增项写入 `label/icon_png/action` 与 `launch.target/args/workdir`，继续由现有 `saveRoom` 序列化全局和桌级 Dock（2026-08-28）
- [x] `npm run build` 通过；UI 设计模式浅色/深色、搜索、去重、两个作用域、切 Desk 和恢复全局检查通过（2026-08-28）
- [x] 更新 DOCK 契约、验收卡与 ROADMAP/TODO 待验收状态（2026-08-28）
- [x] 核对 Git 状态，只暂存本轮 6 个具名文件并提交实现 `b1cf63a`（2026-08-28）
- [x] 用户按 `acceptance/DOCK-002-app-library-icons.md` 验收通过（2026-08-29）
- [x] 验收清单保留在专属文档，未删除；记录提交 `25c22dd`（2026-08-29）
- [x] 合并 `feat/dock-002-app-library-icons` 到 master（`e070e79`），合并后构建复核通过（2026-08-29）
- [x] DOCK-002 收口完成，下一项提升为 DOCK-003；已合并分支/worktree 待清理（2026-08-29）

## DOCK-003 桌面图标拖入 Dock（2026-08-29）

目标：渲染器编辑模式把桌面图标拖入 Dock，经 Player/Core 消息链写入当前 Room，并在存在 `__source` 时双写包内与源房间。
范围外：DOCK-004 运行态指示圆点、应用库扫描/清理/排序、Dock 模板与 Room zip、多显示器、无关 Dock 外观重构。

- [x] 阅读入口/路线图/台账/错误分册及 IPC、Player/Core、Rust 持久化专题，确认 DOCK-003 为唯一下一项并核对 master 基线（2026-08-29）
- [x] 使用 CodeGraph 定位渲染器拖拽/Dock、Player/Core IPC、消息契约与 Room 双写实现（2026-08-29）
- [x] 设计并接入 dock 图标新增消息载荷与 Player/Core 转发处理（2026-08-29）
- [x] 实现渲染器 Dock drop 区、去重、反馈与预览不落盘守卫（2026-08-29）
- [x] 完成包内/`__source` 双写持久化与宽容字段处理（2026-08-29）
- [x] 更新 DOCK.md、ROADMAP、验收卡；运行自动检查并提交独立分支（2026-08-29）
- [x] 首版提交并停在待用户验收（2026-08-29）
- [x] 用户验收通过（2026-08-29）

### DOCK-003 验收反馈追加：Dock → 桌面（2026-08-29）

- [x] 编辑模式支持 Dock 图标拖回当前 Desk 桌面网格，保留完整启动信息并从当前 Dock 作用域移除（2026-08-29）
- [x] 更新 DOCK.md 与验收清单，完成渲染器语法/差异检查（2026-08-29）
- [x] 重新提交，用户验收通过（2026-08-29）
- [x] 合并到 master 并完成 DOCK-003 收口，下一项为 DOCK-004（2026-08-29）

## ROOM-FIX-001 Room 应用隔离清理（2026-08-29）

> 目标：应用新 Room 时镜像替换运行包内属于 Room 的文件，确保 cockpit 的脚本、样式和素材不会污染随后应用的普通 Room。
> 范围外：DOCK-004 运行态、Dock 拖拽交互、`__source` 契约重构、C# / proto、多显示器及其他路线图项目。
> 人工验收：依次应用 cockpit-room 和 my-room，确认切回 my-room 后 cockpit HUD/淡字/样式完全消失，my-room 配置仍正常，重启后也不复现。

- [x] 从 master 建立独立 worktree 与 `fix/room-fix-001-apply-isolation` 分支，保留主工作区用户改动（2026-08-29）
- [x] 阅读项目入口、路线图、流程、模型与后端/渲染器错误分册，并用 CodeGraph 定位 `apply_room` 污染链（2026-08-29）
- [x] 建立独立验收卡，冻结目标、范围外事项和回归步骤（2026-08-29）
- [x] 提取可测试的 Room 文件同步逻辑；源 Room 校验通过后镜像替换运行包内可选文件和素材目录（2026-08-29）
- [x] 增加 cockpit → 普通 Room 清理回归测试及非法 room.json 不破坏运行包测试（2026-08-29）
- [x] 追加 ERRORS #27，并更新 README / PROJECT 的 Room 应用契约（2026-08-29）
- [x] Rust 定向测试、`applies_room_wallpaper`、cargo check、前端构建、渲染器语法和差异检查通过（2026-08-29）
- [x] Release 全量构建并启动本 worktree，实测 cockpit → my-room 后旧脚本/样式/素材均删除且桌面无 HUD/淡字（2026-08-29）
- [x] 只暂存本工作包具名文件并提交实现 `54e165e`，进入待用户验收（2026-08-29）
- [x] 用户按 `acceptance/ROOM-FIX-001-room-apply-isolation.md` 验收通过（2026-08-29，回复“通过 合并”）
- [x] 合并到 master（merge `e22f3f4`），ROOM-FIX-001 收口，DOCK-004 继续为唯一下一项（2026-08-29）

## DXT-001 需求讨论决策写回（2026-08-29）

> 目标：把用户已确认的 room.json v1 使用规则写入现有 dev_docs，删除当前模型中的过时产品口径；本轮仍不创建 Schema、不改代码。
> 范围外：`room.schema.json`、SceneHost 实现、配置器接线、旧 Room 迁移、素材导入和 zip 导入导出。
> 人工确认：阅读 MODEL.md 的三 Desk 示例，确认顺序调整后双向 switch 跟随 Desk、图片 0.5 秒规则、视频完整播放和 `name/type/src` 均符合本轮讨论。

- [x] 从最新 master 创建独立 Orca worktree，并使用纯文档分支 `docs/dxt-001-contract-decisions`（2026-08-29）
- [x] CodeGraph 优先检查：新 worktree 的 `.codegraph` 未初始化，未自行建索引；普通搜索确认 UI 已使用 `startDesk`（2026-08-29）
- [x] 重写 MODEL.md 的 v1 方向，删除旧兼容、默认图片动效、视频中点换页和临时新名词（2026-08-29）
- [x] 同步 PROJECT/README/FRONTEND/DOCK/ROADMAP 的当前口径与现状边界（2026-08-29）
- [x] 文档一致性检查通过；仅 7 个具名 dev_docs 文件，无代码、Schema、Room 或 UI 改动（2026-08-29）

## DXT-001 room.json v1 契约与统一场景渲染（2026-08-30）

> 目标：在一个工作包内定稿 room.json v1，并原地改造现有渲染、配置器预览、Rust 应用和 Player/Core 回写链，使 image/video/html 场景、安全隔离与持久化边界真正生效。
> 范围外：end 的完整编辑入口、Desk 排序、成组 HTML 依赖导入、Room zip 导入导出、旧 Room 迁移、Dock 拖拽重做、运行态字段和无关 Player/Core 重构。用户验收反馈后，现有 Desk/start/switch 属性栏按钮的真实导入已纳入本包。
> 人工验收：按 `acceptance/DXT-001-room-json-v1-contract.md` 使用 v1 验收 Room，依次检查启动、双向切换、三类内容、预览不落盘、Dock 继承和 `__source` 边界。

- [x] 核对 master、ROADMAP、UI-003、DOCK-004 和全部 worktree；确认只在 `feat/dxt-001-room-json-v1-contract` 开发（2026-08-30）
- [x] 完整阅读入口、模型、流程、Dock、前端、IPC、持久化及错误分册（2026-08-30）
- [x] 使用 CodeGraph 盘点 `playSlot`、`mountBackground`、`resolveTransition`、`switchDesk`、`playVideoTransition`、`dockCfg`、`persistRoom`、配置器预览和 `sync_room_to_package`；确认可原地改造（2026-08-30）
- [x] 创建独立验收卡并冻结 Schema、宽容读取、安全隔离和持久化标准（2026-08-30）
- [x] 创建封闭的 `room.schema.json`、有效/无效夹具和可重复 Schema 检查（2026-08-30）
- [x] 原地扩展现有渲染器：background/start/switch/end 的 image/video/html、固定图片时序、视频完整播放、HTML sandbox/实例消息/超时/清理（2026-08-30）
- [x] 修正 `startDesk`、有向相邻 switch、缺失方向安全回退、Dock 继承和运行态不落盘（2026-08-30）
- [x] 配置器打开/保存/预览保留完整 v1；预览只用内存草稿和源素材协议，不执行包内旧 Room 代码（2026-08-30）
- [x] Rust 新建/保存/应用链写出干净 v1，只同步四个素材目录，并仅在运行包注入可信 `__source`（2026-08-30）
- [x] Player/Core 只接受顶层官方宿主 IPC；运行包保留 `__source`，源 Room 回写前剥离且不信任页面提交路径（2026-08-30）
- [x] 更新 README / ROADMAP / PROJECT / MODEL / FRONTEND / DOCK / LIVELY_API 及相关错误记录，移除 DXT/SCENE 分包旧口径和误导性的 room.js 教程（2026-08-30）
- [x] 运行 Schema、JS、Rust、TypeScript、Release C# 构建及真实预览/桌面回归（2026-08-30）
- [x] 核对 40 个具名文件并提交 `ed13a33`，工作包进入待验收（2026-08-30）
- [x] 收口真实 UI 入口：新增 Room 仅成功后进入编辑、编辑页应用先保存草稿、另存为复制四类素材并保持原 Room 不变；前端构建、Rust check 与 9 项测试通过（2026-08-30）
- [x] 提交 UI/Rust 收口修正 `86ad139`，继续停在 DXT-001 待验收分支（2026-08-30）
- [x] Playwright 只读冒烟确认 Room 列表“新增 Room”和编辑页“保存 / 另存为 / 应用”入口可见；未触发真实写盘并已清理临时快照（2026-08-30）
- [x] 用户验收发现属性栏“图片 / 网页代码 / 视频”只有外观、无真实动作；已在同一分支接通 Desk/start/switch 的文件选择、固定目录复制、内存预览和 v1 保存，前端构建、Rust check 与 10 项测试通过（2026-08-30）
- [?] 用户按独立验收卡确认通过后才允许合并 master
