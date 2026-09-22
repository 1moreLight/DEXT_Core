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

## OPS-003 开发优先级与 dev_docs 记录指南（2026-08-30）

> 目标：把“暂缓 idle、先隔离 Dext Core 身份，再补 Room 编辑与导入导出闭环”的顺序写入唯一路线图，并让用户能按一套简单规则持续使用 dev_docs 记录开发。
> 范围外：不修改产品代码、Schema、Room 文件或验收中的 DXT-002/DOCK-004，不合并任何功能分支。
> 人工验收：从 README 进入文档体系，确认能判断现在做什么、一次开发怎样记录、完成后怎样验收和归档；再从 ROADMAP 确认唯一下一项为 CORE-002。

- [x] 阅读 README、ROADMAP、TODO、ERRORS、PROJECT、MODEL、WORKFLOW 和 DOCK，确认当前文档状态（2026-08-30）
- [x] 从最新 master 建立独立 worktree 和 `docs/ops-003-devdocs-priority-reset` 分支（2026-08-30）
- [x] 建立独立验收文件，冻结纯文档范围和人工检查步骤（2026-08-30）
- [x] 更新 ROADMAP：DXT-002 保持待验收但暂缓，CORE-002 成为唯一下一项，随后依次补 Room 编辑、导出、导入和校验闭环（2026-08-30）
- [x] 更新 README：增加用户日常记录方法、文档写入路由和可复用的开工提示词（2026-08-30）
- [x] 更新 PROJECT：记录 Dext 自有 Core 必须与原版 Lively 隔离的结构性决定（2026-08-30）
- [x] 完成纯文档一致性检查；变更仅包含本工作包 5 份具名 dev_docs 文件，提交 `fc12818` 并停在待用户验收（2026-08-30）
- [x] 用户确认 OPS-003 验收通过并授权合并（2026-08-30，回复“合并”）
- [x] 合并到 master（merge `eb5e9ff`），CORE-002 保持唯一下一项（2026-08-30）

## UI-V1-001 配置器核心页面全栈闭环（2026-08-31）

> 目标：完成 Room 安全管理、真实运行状态、使用页、编辑页、设置页和创意工坊空状态的前后端闭环，并以当前 worktree 的真实构建进入待验收。
> 范围外：多显示器、DXT-002 idle、DOCK-004、Dock 架构重构、用户 rooms 迁移或批量改写、在线创意工坊、更新/安装器、无真实底层能力的假设置，以及 Player/Core 大范围重构。
> 人工验收：按 `dev_docs/acceptance/UI-V1-001-configurator-fullstack.md` 依次验证 Room 管理与运行状态、统一预览、编辑器 Desk/Switch、真实设置、诊断/关于和创意工坊空状态。

- [x] 从本地最新 master `a24f331` 创建独立 worktree 与 `feat/ui-v1-001-configurator-fullstack` 分支（2026-08-31）
- [x] 冻结目标、范围外事项、视觉/内容/交互原则和独立验收步骤（2026-08-31）
- [x] 使用 master 的 CodeGraph 快照梳理初始调用链；当前 worktree `codegraph status` 为 Not initialized，按纪律不自行建索引，后续使用 `rg` 精确兜底（2026-08-31）
- [x] 阶段 1：实现 Room 安全删除/zip 导入导出、真实 active room/停止壁纸与设置 RPC 基础（2026-08-31）
- [x] 阶段 2：重构使用页 Room 工具栏、单击应用/停止、紧凑详情栏和统一 16:9 预览（2026-08-31）
- [x] 阶段 3：重构编辑页侧栏、应用库删除、Desk 删除重映射与 Desk/Switch 属性栏（2026-08-31）
- [x] 阶段 4：实现只包含真实能力的设置页、存储诊断、关于信息和创意工坊空状态（2026-08-31）
- [x] 补齐 6 项 Desk 纯函数测试与 23 项 Rust 测试；`npm test`、`npm run build`、`cargo check`、`cargo test --lib`、强制重铺、运行身份和深浅色/常用窗口视觉检查通过（2026-08-31）
- [x] 真 Tauri 验证应用/活动态/停止、设置 RPC、诊断/关于入口；修复 opener ACL/scope 与 Windows `\\?\` 活动态路径问题（ERRORS #43/#44，2026-08-31）
- [x] 同步 README/PROJECT/LIVELY_API/ERRORS/RE_UI 与验收卡；精确恢复测试改动的运行包并移除 QA 产物，用户 `rooms` 未改写（2026-08-31）
- [x] 核对 26 个具名文件并提交到 `feat/ui-v1-001-configurator-fullstack`（实现提交 `f0fa779`），状态同步后停在待验收（2026-08-31）
- [x] 用户按独立验收卡确认通过（2026-08-31，回复“都合并，我已经停止我的 Dext 进程了，可以了”）
- [x] 合并到 master（merge `61ea4c8`），更新最终状态；运行包快照以可恢复 stash 保存，用户 Room 状态临时 stash 将在收口后原样恢复（2026-08-31）

### UI 设计工作模型

- 视觉命题：冷静、克制的 Windows 桌面工具界面，以 Room 预览和主工作区为视觉锚点，使用少量 Dext 青色作为唯一操作强调。
- 内容计划：使用页先呈现 Room 操作与预览；编辑页以导图工作区和属性上下文为主；设置页按常规、性能、存储诊断、关于组织；创意工坊只保留一个明确空状态。
- 交互命题：页面/详情切换使用短促连续过渡；预览加载和应用状态有稳定占位与状态反馈；危险操作通过选择态、确认和进行中锁定形成清晰节奏。

### UI-V1-001 验收反馈修订（2026-08-31）

> 目标：让 Room 的查看、编辑和应用动作边界清晰，补齐 Desk 添加应用入口，并把设置页收敛到真实且必要的能力。
> 范围外：不新增 Desk 级音量假设置，不修改 Room v1/Core 音量契约，不触碰 DXT-002、DOCK-004、用户 `rooms` 或 Player/Core 大范围实现。
> 人工验收：按同一验收卡复查单击/双击 Room、详情编辑、纯背景预览、Desk 放入应用、太阳/月亮主题按钮和三项真实系统设置。

- [x] 核实 Room 使用页、编辑页、纯背景预览和 Settings RPC 现有实现（2026-08-31）
- [x] Room 卡片改为单击选中、双击应用；详情栏增加当前 Room 的快速编辑入口（2026-08-31）
- [x] Room 详情预览只显示背景内容，不渲染桌面应用图标或 Dock（2026-08-31）
- [x] Desk 属性栏增加“放入应用”入口，并提示加入后可在桌面长按图标拖动（2026-08-31）
- [x] 主题改为并排太阳/月亮图标；移除全局音量 UI，并明确不新增无契约的 Desk 音量（2026-08-31）
- [x] 核实开机启动、电池供电暂停、节能模式暂停的 Core Settings RPC 映射与持久化（2026-08-31）
- [x] 重跑前端/Rust 检查和深浅色/真 Tauri 交互验证，精确清理运行包产物（2026-08-31）
- [x] 更新验收卡、ROADMAP/TODO 状态并提交修订 `1671f25`；继续停在待用户验收，禁止合并 master（2026-08-31）

### UI-V1-001 第二轮验收反馈修订（2026-08-31）

> 目标：把 Desk“放入应用”从应用库管理中拆出，在当前 Desk 编辑界面原地完成纯应用选择。
> 范围外：不改变侧栏应用库的添加、删除与扫描管理能力，不修改 Room/Desk 数据契约，不新增应用来源或批量管理功能。
> 人工验收：进入任一 Desk 编辑页，点击“放入应用”，确认原地出现只含应用的选择框；点击应用可直接加入或移出当前 Desk，关闭后仍停留在原 Desk，且框内没有添加、删除、扫描或删除勾选。

- [x] 记录第二轮验收反馈，核对 Desk“放入应用”和侧栏应用库的现有状态与职责（2026-08-31）
- [x] 实现 Desk 内独立应用选择框，点击应用直接加入或移出当前 Desk（2026-08-31）
- [x] 验证弹层在深浅色和常用窗口尺寸下的布局、关闭与 Desk 保持行为（2026-08-31）
- [x] 重跑前端/Rust 检查，更新验收卡并提交同一工作分支 `d7eab61`（2026-08-31）

### UI-V1-001 第三轮验收反馈修订（2026-08-31）

> 目标：把 Desk 属性栏改成能同时浏览各 Desk 背景的缩略画布，并阻止普通 Rust 测试重新铺设和持久化旧测试 Room。
> 范围外：不删除或改写用户 `rooms/v1testRoom`，不改变 Room v1 数据契约、Desk 拓扑或真实“应用 Room”按钮的行为。
> 人工验收：打开有多个 Desk 的 Room，确认属性栏以缩略画布展示全部 Desk 背景并可点击切换选中 Desk；重启前清除当前旧测试壁纸，确认普通 `cargo test --lib` 不再启动 Player、铺设壁纸或恢复旧 Room。

- [x] 读取运行包、Core 本地布局和日志，确认旧背景来自持久化的 `rooms/v1testRoom` 运行包（2026-08-31）
- [x] 实现 Desk 属性栏缩略画布，支持图片、视频、HTML 与空背景状态，并同步导图选择（2026-08-31）
- [x] 将会修改桌面/启动应用的 Rust 活体测试改为显式 opt-in，更新开发命令与踩坑记录（2026-08-31）
- [x] 清除当前旧测试壁纸持久化状态，完成前端/Rust/真实运行身份与深浅色验证并提交 `7b98683`（2026-08-31）

### UI-V1-001 第四轮验收反馈修订（2026-08-31）

> 目标：允许用户安全删除旧版或损坏但仍位于 Room 库直属目录中的 Room，不再把 v1 格式校验错误地用作删除前置条件。
> 范围外：不让旧 Room 通过编辑、应用、导入或导出校验，不自动升级旧格式，不删除 Room 库外目录或符号链接。
> 人工验收：选择截图中的 `black-room` 等无 `version: 1` 旧 Room，点击删除并确认后应进入 Windows 回收站且列表刷新；库根目录、库外目录和重解析点仍必须被拒绝。

- [x] 根据截图定位删除失败来自 `direct_room_in_library` 复用了 v1/素材严格校验（2026-08-31）
- [x] 拆分删除边界校验与 v1 内容校验，为旧/损坏 Room 增加无外部副作用的回归测试（2026-08-31）
- [x] 运行前端/Rust 回归并在真 Tauri 将 `black-room` 移入 Windows 回收站验证，随后提交 `9a6d1d1`（2026-08-31）

### UI-V1-001 第五轮验收反馈修订（2026-08-31）

> 目标：加强使用页和编辑页的 Room 选中反馈，让当前选择在深浅色下都能被快速辨认，并继续与绿色“使用中”状态明确区分。
> 范围外：不改变 Room 单击/双击、多选、应用、删除或编辑数据逻辑，不调整卡片网格尺寸和应用中状态语义。
> 人工验收：分别在使用页和编辑页选择不同 Room，确认选中卡片显示青色双层高亮与“已选中/已选择”标记；同时检查“选中但未使用”和“选中且使用中”，青色选择态与绿色使用态不得混淆。

- [x] 记录第五轮验收反馈并核对使用页、编辑页现有 Room 选择态（2026-08-31）
- [x] 统一加强两页的青色 Room 选中态，并修正多选模式下取消勾选后的残留高亮（2026-08-31）
- [x] 运行前端测试、构建、深浅色与常用窗口视觉检查，更新验收卡并提交实现 `1b2ceb7`；继续停在待用户验收（2026-08-31）

### UI-V1-001 第六轮验收反馈修订（2026-08-31）

> 目标：让 Room Dock 的应用选取与 Desk“放入应用”使用同一种原地纯应用选择框，并保留全局 Dock / 当前 Desk Dock 的作用域选择。
> 范围外：不改变应用库管理、Dock 样式参数、Room 数据契约或 Desk 桌面图标逻辑，不删除 Dock 已选应用列表和自定义占位图标能力。
> 人工验收：进入 Room 编辑的 Dock 参数，分别选择“全局 Dock”和当前 Desk 后点击“放入应用”；确认原地弹层只显示应用，点击可加入/移出对应作用域，关闭后仍停留在 Dock 参数页且应用库管理操作不会出现。

- [x] 记录第六轮验收反馈并核对 Desk 弹层与 Dock 内嵌选择器的现有职责（2026-08-31）
- [x] 提取共用纯应用选择弹层，并将 Dock 应用选取改为作用域内原地打开（2026-08-31）
 - [x] 运行前端测试、构建与深浅色交互检查，更新验收卡并提交实现 `779bff2`；继续停在待用户验收（2026-08-31）

## WIDGETS-PLAN-001 Room v2 小组件研究与开发准备（2026-08-31）

> 目标：形成可执行的 Room v2 小组件运行、安全、权限、分享与 AI 创作准备方案。
> 范围外：不修改 `room.schema.json`、渲染器、Player/Core、配置器或现有 Room；不改变当前 ROADMAP 的唯一下一项。
> 人工验收：从 README 能找到研究文档；阅读后能明确 v1 现状、v2 边界、权限模型、网络安全和后续独立工作包。

- [x] 阅读当前产品/模型/Lively API、渲染器与 Player 的安全边界，并完成 CodeGraph 核对（2026-08-31）
- [x] 建立独立 worktree `widgets-v2-research-prep` 与 `docs/widgets-v2-research-prep` 分支，保留主工作区用户 Room 改动（2026-08-31）
- [x] 建立验收卡，冻结本轮纯文档范围（2026-08-31）
- [x] 编写 v2 小组件研究与开发准备文档：运行模型、安全模型、契约草案、AI 创作边界和分包计划（2026-08-31）
- [x] 将文档加入 README 地图，并在 ROADMAP 登记为待验收的研究交付（2026-08-31）
- [x] 核对 Markdown 链接、工作包 ID、状态和 Git 改动范围；`git diff --check` 通过，等待用户验收（2026-08-31）
- [x] 用户确认研究文档通过并授权合并 master（2026-08-31）
- [x] 合并 `docs/widgets-v2-research-prep` 至 master（merge `484c5f6`）；v2 实现仍保持排队（2026-08-31）

## DXT-002 Room 待机画面接入·最新 master 刷新（2026-08-31）

> 目标：在最新 master 上正式采用 Room `idle` 并废弃 `end`，复用 Lively 屏保生命周期持续显示待机内容，为 DXT-003 提供唯一生命周期基线。
> 范围外：不实现 Room v2 Widget Schema/WidgetHost，不修改 Dock 待验收分支，不迁移旧 end Room，不新增待机计时器、联网或系统权限。
> 人工验收：在配置器为独立待机节点选择图片/视频/HTML，保存并应用后启动 Lively 屏保，确认只显示 idle；输入后回到原 Desk；普通关闭立即完成，带 end 的 Room 被拒绝。

- [x] 用户确认采用 idle、废弃 end，DXT-003 在 DXT-002 验收合并后启动（2026-08-31）
- [x] 只读审计所有 worktree、未合并分支、stash 和 master 用户 Room 改动；确认本轮继续原 DXT-002 独立 worktree（2026-08-31）
- [x] 将旧活体测试运行包保存到可恢复 stash，开始把 DXT-002 重放到最新 master（2026-08-31）
- [x] 解决文档、Rust 和 React 冲突，保持最新 Room 管理/UI 能力并移除 idle 临时兼容层（2026-08-31）
- [x] 运行 Schema、渲染器、前端、Rust、C# Release 构建与启动检查；浏览器态待机节点视觉/控制台检查通过（2026-08-31）
- [x] 更新验收卡和 ROADMAP；实现提交 `f140603`，状态收口后进入待验收（2026-08-31）
- [x] 用户按 `dev_docs/acceptance/DXT-002-idle-screensaver.md` 验收通过（2026-08-31，回复“通过 合并”）
- [x] 合并到 master（merge `6544e52`）；DXT-003 提升为唯一下一项，工作分支/worktree 收口清理（2026-08-31）

## DXT-003 Room v2 Widget 后端与系统接口（2026-08-31）

> 目标：将项目收口为唯一原生 Room v2 契约，完成可独立校验且可由配置器安全存储、复制、打包和应用的 Widget 后端，并通过封闭 RPC/Tauri 接口提供当前系统媒体和 Windows 默认输出主音量能力。
> 范围外：本包不实现 WidgetHost 视觉渲染、配置器 Widget 布局 UI、权限确认 UI、壁纸热点/可信手势层、Scene 直连系统接口、任意 Shell/文件/URL/命令、Dext 代理联网、ROOM-004 分享授权清单、AI skill，也不修改用户 `rooms`。
> 人工验收：按 `dev_docs/acceptance/DXT-003-room-v2-widget-contract.md` 验证所有新建与运行链只使用 v2、全流程保留 Widget 数据与资源、v1/未知/恶意包拒绝、媒体读写动作和系统主音量接口，以及前端接入与安全边界文档。

- [x] 核对 `master@096eacd`、worktree、未合并分支、stash 与主 worktree 用户 Room 状态；创建独立 worktree 和 `feat/dxt-003-room-v2-widget-contract`（2026-08-31）
- [x] 冻结六项开工决策：1920×1080 逻辑画布、宽松 P1、Dext 代理联网、本机可变数据、每 Desk 独立实例、显式复制升级（2026-08-31）
- [x] 建立独立验收卡并将 ROADMAP 标为开发中（2026-08-31）
- [x] 新增 Room v2 Schema、正反 fixtures、自包含样包和版本分派校验脚本（2026-08-31）
- [x] 实现 Rust v1/v2/未知版本分派、v2 Widget 语义校验和只读操作边界（2026-08-31）
- [x] 实现 TypeScript 版本能力矩阵、v2 只读提示/禁用与相关测试（2026-08-31）
- [x] 同步 README/PROJECT/MODEL/WIDGETS_V2 正式契约，并将版本守卫回归记录为 ERRORS #48（2026-08-31）
- [x] 运行 Schema、Rust、TS、前端构建、渲染器语法与差异检查；`codegraph sync` 已按要求尝试，但独立 worktree 未初始化索引，未擅自初始化（2026-08-31）
- [x] 只暂存本工作包 35 个具名文件并提交为 `c60141e`；更新为待验收，等待用户明确确认（2026-08-31）
- [x] 用户决定不在契约边界停下，继续同一 DXT-003 分支完成 v2 后端和系统接口；同步 master（含 DOCK-004 收口）为 `3d71acf`（2026-08-31）
- [x] 用户确认项目当前 Room 均为 demo，正式取消 v1 兼容、迁移与降级；本包改为原生 v2-only（2026-08-31）
- [x] 删除 v1 Schema、fixtures、版本分派和兼容重建路径；新建、编辑、保存、另存、预览、应用与 zip 全部原生 v2（2026-09-02）
- [x] 让 v2 的写入、另存、应用、导入和导出完整镜像/校验 `widgets/` 声明资源且失败无残留（2026-09-02）
- [x] 在 Core gRPC 增加封闭的系统媒体快照/动作与默认输出主音量读写接口，并在 Rust/Tauri 暴露受控命令（2026-09-02）
- [x] 增加 Rust/Schema/前端回归，证明未知版本、非法资源、非法媒体动作和越界音量均在最终边界被拒绝；C# 由完整 Release 构建和活体 RPC 覆盖（2026-09-02）
- [x] 编写 `ROOM_V2_FRONTEND_CHECKLIST.md`、`ROOM_V2_SYSTEM_API.md` 与 `ROOM_V2_AI_PROMPT.md`，明确 Scene/多 Widget 分工、可信宿主手势、图标避让、权限和系统安全边界（2026-09-02）
- [?] Schema、Rust、TypeScript、前端、C# Release、真实启动与媒体/音量活体检查通过；具名文件提交为 `695e3e7`，等待用户按独立验收卡确认（2026-09-02）
- [x] 用户回复“通过 合并”，确认 DXT-003 验收通过；本工作包进入 master 合并、归档与 worktree/分支清理（2026-09-02）
## DOCK-004 运行态指示圆点（2026-08-29）

目标：Dock 图标按其启动目标显示应用是否运行；应用退出后状态及时清除。
范围外：Dock 拖拽、应用库扫描/清理/排序、模板与 Room zip、多显示器及其他路线图项目。

- [x] 阅读入口、路线图、台账、错误分册及 Dock/前端/IPC/Player/Core/Rust 持久化专题，确认 DOCK-004 是唯一下一项并核对 master 基线（2026-08-29）
- [x] 从 master 建立独立 worktree `dock-004-runtime-indicator` 与分支 `feat/dock-004-runtime-indicator`，确认基线干净（2026-08-29）
- [x] 新增 Core → Player → 渲染器的运行态消息与目标进程轮询，启动/退出宽容处理（2026-08-29）
- [x] 渲染器维护内存运行态并在 Dock 图标显示/清除圆点，切 Desk/重载时正确刷新且不持久化（2026-08-29）
- [x] 更新 DOCK.md、ROADMAP、独立验收卡并执行最低自动检查（2026-08-29）
- [x] git status 核对具名文件并提交 `e4a8cd3`，停在待用户验收（2026-08-29）
- [x] 用户按验收卡完成人工验收（2026-08-31，回复“DOCK-004 通过”）

### DOCK-004 验收反馈：长按后首次拖入 Dock 失效（2026-08-29）

- [x] 核对实际运行 Core/Player/壁纸路径，确认均来自 DOCK-004 worktree，不是未合并 master 导致
- [x] 在 Room 预览复现：进入编辑态后的第二次拖拽可加入 Dock，但长按后继续移动的同一手势不会启动拖拽
- [x] 长按进入编辑态时沿用当前 pointer 手势开始拖拽，不改变 Dock 去重、双写与预览不落盘行为（2026-08-29）
- [x] Room 预览连续手势复验：长按 650ms 后直接拖到 Dock，命中反馈为 true，Dock 内存列表出现 Hermes Studio；预览未写盘（2026-08-29）
- [x] 重跑 JS/Rust/前端最低检查，重新应用当前壁纸并提交修复 `2af99ce`，继续停在待验收（2026-08-29）

### DOCK-004 验收反馈：连续手势导致真实桌面输入不稳定（2026-08-29）

- [x] 用户反馈真实桌面出现普通/可交互光标切换不灵、需要多次点击且无法稳定拖入 Dock
- [x] 撤回 `2af99ce` 的延迟指针捕获方案，恢复 DOCK-003 原有的“长按进入编辑态，松开后再次按住拖动”事件链
- [x] 重跑最低自动检查并重新应用当前壁纸，提交后继续停在待验收（2026-08-29）

### DOCK-004 验收范围调整：真桌面拖入转远期（2026-08-29）

- [x] 记录实机现象：上方/侧面拖向 Dock 被边界卡住；下方向上拖可显示绿色命中但释放后不能稳定加入
- [x] 用户决定跳过真桌面拖入目标，确认配置器 `DockEditor` 可作为 Dock 图标添加/移除的当前正式路径
- [x] 在 ROADMAP 新增远期 `DOCK-UX-001`，后续独立重做真实 Player 输入捕获、跨层命中和边界处理
- [x] 从 DOCK-004 验收门槛移除真桌面拖入回归；DOCK-004 继续仅等待运行态圆点相关人工验收
- [x] 确认 DOCK-004 之后的唯一下一项为 `DXT-001 room.json v1 契约定稿`
- [x] 用户确认通过；解决与最新 Room/idle/持久化实现的合并冲突，Release 构建通过并合并到 master `5dd5fe9`（2026-08-31）
- [x] 清理 DOCK-004 独立分支/worktree；其中未提交的 `wallpapers/dext-room/room.*` 仅为含本机路径的测试运行包，未带入 master（2026-08-31）

## UI-USE-001 配置器使用页设计规格取消（2026-08-31）

- [x] 用户明确取消 UI-USE-001 验收；其早期设计规格已被已完成的 UI-V1-001 实际实现取代（2026-08-31）
- [x] 不合并 `docs/ui-use-001-use-page-spec`，清理对应独立分支与 worktree（2026-08-31）

## UI-V2-001 配置器 v2 端到端闭环（2026-09-02）

> 目标：保留现有配置器设计语言，在一个工作包中一次性交付 Room v2 配置器架构、Scene/WidgetHost、图标避让、受控系统能力、安全分享和 AI 创作导入闭环。
> 范围外：创意工坊云服务、安装器、多显示器、内置外部 AI、Dext 代理联网、任意系统命令与 v1 兼容。
> 人工验收：全部实现完成后只按 `dev_docs/acceptance/UI-V2-001-configurator-v2.md` 做一次整体人工验收，中途不拆包、不合并半成品。

- [x] 用户确认采用单工作包端到端交付，并冻结范围外事项（2026-09-02）
- [x] 建立独立 worktree `ui-v2-001-configurator-v2` 与分支 `feat/ui-v2-001-configurator-v2`（2026-09-02）
- [x] 编写总计划、Luna 执行指令和独立最终验收卡（2026-09-02）
- [x] 使用 CodeGraph 完成配置器、Tauri、渲染器、Core、Schema 和测试的实现审计与删除清单（2026-09-02）
- [x] 建立共享 v2 类型、单一编辑状态、历史事务和纯算法测试基线（2026-09-02）
- [x] 重构配置器壳、空间库、真实画布、属性权限检查器和 Desk 流程视图（2026-09-02）
- [x] 完成 WidgetHost、多实例布局、拖动缩放层级、图标避让和 Dock 安全区（2026-09-02）
- [x] 完成 Scene/Widget 只读能力桥、性能/媒体/音量数据与可信热点动作（2026-09-02）
- [x] 完成 v2 安全分享、权限重询问、AI 模板/SDK/导入报告和隔离预览（2026-09-02）
- [x] 删除 v1/demo/旧入口/死状态，更新接口与创作者文档（2026-09-02）
- [x] 完成自动测试、构建、视觉检查和真实 Core/Player/Tauri 活体验证（会改变桌面的强制铺设留给人工验收）（2026-09-02）
- [x] 具名提交全部实现并进入待验收；用户通过前禁止合并 master（2026-09-02）

### 实施记录

- [x] 提取 Room v2 Content/Desk/Widget/权限共享类型，App 不再把 Widget 保存为 `unknown[]`（2026-09-02）
- [x] 实现 1920×1080 placement、contain 映射和确定性图标避让纯函数，新增 5 项回归（2026-09-02）
- [x] 在真实渲染器接入首版离线 WidgetHost：多实例沙箱、官方 placement/z、实例 source+token+协议+大小校验和卸载失效（2026-09-02）
- [x] 前端 14 项测试、生产构建和渲染器语法检查通过（2026-09-02）
- [x] 配置器默认接入真实桌面画布与独立 Desk 流程切换，显示 Scene、图标、Widget 和 Dock 安全区（2026-09-02）
- [x] 接通 Widget 选择、拖动、缩放、placement 数值编辑、层级、删除、图标避让和统一历史事务（2026-09-02）
- [x] 使用 Playwright 在真实浏览器复验窄窗口，修正顶栏挤压并加入 v2 Widget mock；单击选择不再误写草稿（2026-09-02）
- [x] 完成 Widget 文件夹安全导入与权限审阅 UI：小写 slug、资源白名单、数量/大小限制、拒绝链接与 reparse point、staging 原子回滚、整份草稿同步保存，并从 v2 权限枚举删除未实现的联网/导航等能力（2026-09-02）
- [x] Widget 导入里程碑通过 Rust 27 项、前端 14 项、生产构建、`cargo check`、渲染器语法和差异检查（2026-09-02）
- [x] 扩展 v2 Content/Widget 契约：HTML 能力声明、相对/全局矩形热点和封闭媒体/系统主音量 action；删除未实现的联网、导航、通用存储和通知权限（2026-09-02）
- [x] 打通 Scene/Widget → 官方宿主 → Player → Core 能力链，按实例/token/subject 推送时间、语言、视口、Desk、暂停、CPU/GPU/RAM、网络摘要、频谱、媒体/封面和系统主音量（2026-09-02）
- [x] 实现官方透明热点、真实 `isTrusted` 手势、120ms 限频、Player 白名单解析和 Core 最终 action/参数/本机授权复核（2026-09-02）
- [x] 实现本机授权审阅、批准和撤销；源路径 + `room.json` SHA-256 绑定，内容变化/另存/重导自动失效且授权不进入 Room/zip（2026-09-02）
- [x] 为 Dext Room Player 启用专用离线边界：同一虚拟主机资源外的请求/导航/iframe、下载、弹窗和 Web 权限全部拒绝（2026-09-02）
- [x] 能力桥里程碑通过 Schema fixtures、前端 17 项、Rust 27 项、JS bridge、生产构建、C# Release 四阶段构建和 `scripts/start.ps1` 真 Core/Tauri 启动；Playwright 复验 1366×768 权限/热点检查器（2026-09-02）
- [x] 建立 Creator Pack v1 Schema、版本化 SDK、可运行 Scene/Widget 模板和正反 fixtures；AI 上下文导出会剥离本机路径、启动参数、图标 base64 与运行戳（2026-09-02）
- [x] 实现创作包两阶段事务：临时区静态安全报告、一次性 token、CSP + opaque sandbox 隔离预览、用户确认后原子写入 Room，失败/取消无半成品（2026-09-02）
- [x] 将 AI 创作入口并入 Room 编辑器，并删除无真实服务的空白“创意工坊”一级页面；不接任何外部模型 API（2026-09-02）
- [x] 补齐 Widget Shift/Ctrl 多选、成组拖动、画布/相邻边缘与中心吸附、六向对齐、置顶/置底和批量删除；布局与图标避让仍为单一历史事务（2026-09-02）
- [x] 将 Desk/Scene/Widget/Dock/转场完整编辑快照和撤销/重做栈持久化到 IndexedDB；按 Room 路径和规范化磁盘基线恢复，外部文件变化时自动放弃陈旧草稿（2026-09-02）
- [x] 删除 `DockEditor any[]`，改用共享 `Desk[]` 类型；浏览器 mock 更新为三个不同尺寸 Widget 以覆盖多选布局视觉测试（2026-09-02）
- [x] 提取共享 `SceneCapabilityEditor`，让 background/start/idle/每个方向 switch 的 HTML Scene 都能编辑能力声明、可信热点与本机授权；图片/视频明确无作者代码能力（2026-09-02）
- [x] 在不改变配置器布局与视觉语言的前提下拆分 `App.tsx`：提取顶栏、Room 流程图纯函数、Room v2 清洗/单一写出器、运行时类型和 Room/Scene 预览组件，并新增 6 项纯函数回归（2026-09-02）
- [x] 补齐全局/每 Desk Dock、背景清除、Room 转场和 Desk 图标增删的修改前历史事务；流程视图不再因零连线落入“改造中”死占位（2026-09-02）
- [x] 浏览器复验 1366×768 与 1100×900：Dock 修改可撤回/重做、页面无横向溢出；修复流程视图条件挂载后测量 effect 不重跑导致 SVG 连线为空（2026-09-02）
- [x] 删除 `App.tsx` 靠 `void` 保活的旧无入口状态/函数，并把渲染器页面标题从 Demo 收口为正式 `Dext Room`；保留 Creator Pack 自身版本和旧 Room 拒绝反向测试（2026-09-02）

### UI-V2-001 完成度复审续作（2026-09-02）

- [x] 逐条对照 `CONFIGURATOR_V2_PLAN.md` 与验收卡，确认现有绿测不能证明全部范围完成
- [x] 补齐空间库排序、复制和重命名的真实 UI → Tauri → 文件系统闭环与回归（2026-09-02）
- [x] 补齐 Desk 身份级重排、switch/startDesk 重映射、历史事务和流程 UI（2026-09-02）
- [x] 删除 `DockEditor` 的全局/每桌本地草稿副本，所有 Dock 编辑直接使用 Room 草稿唯一真相源，文本编辑按聚焦合并为一次历史事务（2026-09-02）
- [x] 增加 Room 层级树（Desk/Scene/Icons/Widgets/Dock），层级选择驱动画布/流程/Dock，Desk 上下移入口与历史事务统一（2026-09-02）
- [x] 提取 `RoomEditorHeader` 与 `UsePage`，降低 `App.tsx` 页面装配与编辑器顶栏职责；`npm test` 30/30、`npm run build` 通过（2026-09-02）
- [x] 浏览器复验层级 Widget 选择、Dock 编辑入口、流程节点、层级内 Desk 重排及 1100×900 无横向溢出（2026-09-02）
- [x] 提取 `useDextRuntime` 与 `useGraphGeometry`，将 Core/当前 Room 轮询和流程图 DOM 测量从页面组件移出；同步修正 WidgetHost 旧注释（2026-09-02）
- [x] 提取 `EditorNavigation`，编辑模式一级导航不再由 `App.tsx` 直接渲染；`App.tsx` 降至约 2200 行且保持现有视觉与行为（2026-09-02）
- [x] 提取 `EditorRoomLibrary`，编辑模式 Room 列表、详情、复制/重命名/应用入口与主页面解耦；生产构建通过（2026-09-02）
- [x] 提取 `EditorAppLibrary`，应用库扫描、增删、搜索与 Desk 投放交互从页面组件移出；生产构建通过（2026-09-02）
- [x] 真实启动检查确认当前 worktree Core 身份、PID、pipe、data/log 均正确；清理本次启动留下的孤立配置器进程（2026-09-02）
- [x] 真实 Tauri/Player 活体验证（2026-09-05）：1423 被用户主 worktree 配置器占用（活跃进程，未触碰），
      改以 1425 配置覆盖独立起 ui-v2 的 `tauri dev`——vite 就绪、`dext-configurator.exe`（PID 1900）
      自本 worktree target 启动且窗口正常，验证后即关闭；Core/Watchdog/Player 全部出自本 worktree、
      `verify-runtime-identity.ps1` 全 OK、Player `{"Type":2,"Success":true}`、壁纸铺设无 navigation failed
- [x] `verify-runtime-identity.ps1` 只读核对通过 Core Product/Runtime/PID/pipe/mutex/data/log；Player、Watchdog、Configurator 当前未运行，不能据此宣称最终活体验收完成（2026-09-02）
- [x] 审计配置器壳/单一状态、运行诊断、Scene/Widget 生命周期和 Creator 真链（2026-09-05）：
      App.tsx 2020 行且零 `void` 死代码保活、room-draft 单一草稿态有纯函数测试；`diagnostics_json`
      Rust+SettingsPage 双向接通；渲染器 `disposeRuntime()`+`pagehide` 收口、能力桥暂停冻结/恢复补快照；
      Creator 两阶段事务 + TTL + 资源路径校验有前后端与 fixtures 覆盖——未发现阻断性缺口
- [x] 重跑全量自动检查（2026-09-05）：前端 vitest 32/32、生产构建、Rust 36 passed / 3 ignored（活体）、
      渲染器 main.js + capability-bridge 语法、room-v2 Schema fixtures 全 PASS；
      浏览器视觉与整体人工验收留给用户一次性验收
- [x] 用户指令直接合并（2026-09-05「直接合并吧」，一次性验收由用户自行豁免）：合并到 master
      merge `e8cd700`；主 worktree 重建 Core/Player/Watchdog（含 ERRORS #64 修复）并切换栈，
      `Success:true` 零 navigation failed，用户主 worktree 配置器与 Core 同源连接恢复
- [x] 主 worktree 合并前状态保全：运行时 room.json 存 stash（main-worktree runtime room.json,
      pre UI-V2-001 merge）；rooms/v2、library.json 未跟踪内容原样保留
- [x] 2026-09-11 台账收口：主 worktree `build.ps1` Core step 的偶发 exit 1 只保留为历史观察；当时
      standalone build 稳定成功且未阻塞 UI-V2-001 合并。当前不把未复现猜测写成已确认故障；若再现，
      另立工具链工作包定位并追加 ERRORS

### UI-V2-001 活体验证修复（2026-09-03）

- [x] 复现真实铺设失败：Player 因 `TryParseUserCommandArgs` 将已带 `wallpaper-`/`dext-` 命名空间的 v2 参数重复加前缀而退出（2026-09-03）
- [x] 修正参数命名空间归一化，重跑 `scripts/build.ps1` 完成 Release Player/Watchdog/Core 构建（2026-09-03）
- [x] 重新铺设当前 Room：Core/Watchdog/Player 均启动，Player 保持响应；媒体/音量活体测试通过（2026-09-03）
- [x] 2026-09-05 用户明确授权直接合并并豁免 UI-V2-001 逐项人工验收；本项未单独执行，不倒填为已验证
- [x] 自动检查复跑完成：tauri-ui 30/30、生产构建、Rust 34 passed/3 ignored、渲染器语法与 capability bridge 通过（2026-09-03）
- [x] 修正渲染器切 Desk 后未广播 `desk.read` 的能力桥缺口，并新增 deskChanged 回归（2026-09-03）
- [x] 能力桥暂停时冻结周期性硬件/媒体/音量/频谱/时间推送，恢复时补发完整快照，并新增暂停恢复回归（2026-09-03）
- [x] 增加 Player `pagehide` 统一清理：停止能力轮询、失效实例、卸载 Scene/Widget、取消转场并释放媒体资源（2026-09-03）
- [x] Creator Pack 隔离预览 token 增加 10 分钟 TTL，inspect 时清理过期 staging，confirm/discard 拒绝过期 token，并新增回归（2026-09-03）
- [x] 统一配置器顶部断线错误分类，连接/管道不可用时显示 Core 未运行并保持依赖动作禁用；前端测试与构建通过（2026-09-03）
- [x] 抽取 `isCoreUnavailable` 运行时纯函数，App/AppHeader 共用单一断线分类逻辑并新增 2 项回归（2026-09-03）
- [x] Creator 导入报告补充实际入口路径与可展开资源清单，忙碌期间禁用关闭避免 confirm/ discard 竞态；前端 32/32 与构建通过（2026-09-03）
- [x] 设置页接入 `diagnostics_json` 刷新面板，可直接查看 Core、Player/壁纸列表、活动 Room、Pipe 与目录状态；断线时显示读取错误（2026-09-03）
- [x] Creator 预览资源服务同步执行 TTL 检查，过期 token 删除 staging 并返回 410，避免过期 URL 继续读取隔离内容（2026-09-03）
- [x] Creator 预览资源服务复用安全资源路径规则，拒绝 URL 冒号、控制字符、尾随点/空格和非法文件扩展名（2026-09-03）
- [x] 为 Creator 资源协议增加合法/恶意 URL 回归，验证有效入口返回 200、特殊路径返回 403（Creator 测试 8/8）（2026-09-03）

## DOCK-UX-001 Dock 双向拖拽重做（2026-09-05 开工）

> 用户拍板（2026-09-05）：真桌面编辑模式重做双向拖拽；桌面→Dock 为**移动**语义（图标从桌面移除，
> 非复制）；写入**当前 Desk 的 dock 覆盖**，全局 dock 仅配置器可设；仅编辑模式；autoHide 不动。
> 背景：DOCK-003/004 实机拖拽不稳定（上方/侧面被图标层边界卡住；下方进入有绿色命中但松手不落入），
> 当年转远期本包。#64 修复后桌面已恢复；用户指定沿用 ui-v2-001 worktree/分支作为基线
> （master 尚无 #64 修复，回滚点 9ae48d8）。DOCK-SKIN-001（沙箱皮肤受管格式）随后另立设计稿。

- [x] 2026-09-05 计划冻结 + 验收卡 `dev_docs/acceptance/DOCK-UX-001-dock-drag-rework.md` + ROADMAP 状态同步
- [x] 2026-09-05 渲染器：拖拽幽灵（ghost，document 级 fixed 元素）替代原图标位移，摆脱图标层裁剪/窗口边界影响
- [x] 2026-09-05 渲染器：Dock 吸附带命中（rect 膨胀 48px）+ 结束事件统一（pointerup / pointercancel /
      lostpointercapture 一律用最后已知指针位置提交，<24px 位移视为点击），修复「绿色命中但松手不落入」
- [x] 2026-09-05 桌面→Dock 移动语义：校验 launch.target 与去重 → 移出 desk.icons → 写入 desks[cur].dock.icons
      （新覆盖复制全局列表；重建 icon 对象剥离 x/y 保 v2 dockIcon 形状）→ persistRoom 双写；
      addDockIcon 专用消息停用（Player/Core 链保留兼容）
- [x] 2026-09-05 Dock→桌面：同 ghost/结束事件重构，落格判定保持（占用格拒绝并 toast），persistRoom 已有
- [x] 2026-09-05 编辑模式提示文案按移动语义更新（index.html）；DOCK.md（DOCK-UX-001 契约节 + DOCK-003 历史标注）/ ROADMAP 同步
- [x] 2026-09-05 自测：node --check main.js + capability bridge + CSS 括号平衡 + npm run build 全绿
      （用户 17:04 已自行停止 Dext，重铺验收留给下次启动后的真机检查）
- [x] 已取消(2026-09-05)：实现提交 `638ee0e` 后用户真机复验仍失败，用户决定**放弃真桌面拖入 Dock**
      目标；代码整体回退（revert `de04a33`），配置器 DockEditor 继续作为 Dock 图标管理的唯一正式入口。
      两次实机尝试（DOCK-003 原版、本包 ghost+吸附带+统一结束事件）均不稳定，已记 ERRORS #65；
      失败现场细节未采集，若重启该方向须先做 WebView2 指针/WorkerW 命中的专项研究包

## DOCK-SKIN-001 Dock 沙箱皮肤受管格式 · 设计稿（2026-09-05 开工）

> 用户定调：dock 样式要能像 desk 那样提交代码，机制与 Room v2 同款，官方给接口、恶意代码不可越界。
> 本包只交**设计契约**（dev_docs/DOCK_SKIN.md），实现按 §8 拆分另立工作包；用户拍板 §9 决策点后进入。

- [x] 2026-09-05 建独立 worktree + `docs/dock-skin-001-skin-contract` 分支（基线 f4b672c，含合并后全量）
- [x] 2026-09-05 设计稿 `dev_docs/DOCK_SKIN.md`：数据契约（dock.skin）/ 方案 B 运行模型 /
      命中握手协议 / 能力桥 dock.read / 安全边界 / 降级兜底 / 实施拆分
- [x] 2026-09-05 验收卡 `acceptance/DOCK-SKIN-001-dock-skin-contract.md` + ROADMAP 登记当前项
- [x] 2026-09-05 用户拍板（对话）：D1=全覆盖(B)、D3=皮肤允许每桌覆盖（一个 dock 用一个）、
      D2/D4 按推荐（D4=自包含，已向用户解释语义）；设计稿按拍板更新（提交 ebc3632 后修订）
- [x] 2026-09-05 合并 master + 清理分支/worktree；下一步立 SKIN-001a（契约与宿主实现）

## DOCK-SKIN-001a 契约与宿主实现（2026-09-05 已暂停回退）

> 实现在 `feat/dock-skin-001a-skin-host` 分支（8bc771f 主体 + 74066b0 导航兜底修复 + cc8bd42 玻璃演示皮肤），
> 未合并 master；worktree 已清理（运行时状态存 stash）。契约 DOCK_SKIN.md 已在 master。

- [x] 2026-09-05 实现全绿（schema+fixtures/Rust dock/ 拷贝/能力桥 dock.read/渲染器皮肤宿主/示例房）
- [x] 2026-09-05 真机观察（用户）：皮肤挂载✓、随桌换肤✓（变颜色）、官方 chrome 完全让位✓；
      暴露问题：①皮肤激活后无导航可用（已修：官方导航浮层常驻）②**单击启动命中层失效（未定位，
      回退主因）**③演示皮肤观感差（占位货，非机制问题）
- [x] 已暂停(2026-09-05)：用户决定回退；桌面已恢复主栈+用户房间（Success:true）。皮肤类工作的
      真机交互验收并入 SKIN-001b（配置器窗口内迭代），001a 分支保留待续
- [!] 已暂停；用户恢复该方向时，先定位命中层点击失效（怀疑方向：命中 rect 坐标系/事件被 iframe
      焦点吞掉/isTrusted 链），再进 001b（皮肤选择 UI + custom 命中动作绑定 + 预览）

### TRAY-小改：托盘加「打开配置器」（2026-09-06 追加，用户豁免 worktree 流程直改 master）

> 目标：托盘菜单新增「打开配置器」→ 启动 tauri-ui release 产物 dext-configurator.exe；
> 找不到 exe 时后台拉起 
pm run tauri build 并气泡提示，完成后重试即可。

- [x] 2026-09-11 台账去重：Systray 实现计划已被下方 `292f930` 完成记录覆盖
- [x] 2026-09-11 台账去重：构建与托盘实测计划已被下方 UIA 验证记录覆盖
- [x] 2026-09-11 台账去重：实现已提交；用户明确验收仍按下方 `[?]` 如实保留

- [x] 2026-09-06 Systray.cs：FindConfiguratorExe（从 Core exe 向上找 tauri-ui\src-tauri\target\release\dext-configurator.exe）+ 菜单项 + 构建兜底
- [x] 2026-09-06 停 Core → build.ps1 → 重启 Core；UIA 实测菜单 4 项、点击触发构建兜底（commit 292f930）
- [x] 2026-09-06 构建完成后再次点击，UIA 已验证配置器成功拉起；用户明确验收另见下一项
- [x] 2026-09-06 release 构建完成（15.6MB），UIA 实测点击「打开配置器」成功拉起 dext-configurator.exe
- [?] 2026-09-06 用户验收：未找到明确回复“通过”的记录；实现和 UIA 验证已在 master，作为不阻塞路线的验收债保留

### UI-小改：「放入应用」弹窗改纯应用库管理（2026-09-06 追加）

> 用户定调：编辑模式 desk 属性栏的选应用弹窗只管「库里有哪些应用可加」（浏览/搜索/加库/删库/扫描），
> 单击不得直接写入 desk；上桌入口属 room 编辑后续流程，本步不动。

- [x] 已取消(2026-09-06)：首版 AppLibraryDialog 方案已实现后整体 revert，实际诉求改为选中态绿色高亮
- [x] 已取消(2026-09-06)：移除 AppPickerDialog 的计划随首版方案一起关闭；DockEditor 继续使用该组件
- [x] 已取消(2026-09-06)：原方案无需继续验收，revert 和替代实现提交见下方记录
- [x] 2026-09-06 App.tsx：appPickerDesk → appManagerOpen；按钮改「应用库管理」；新 AppLibraryDialog（搜索+加库+扫描合并+多选删库，无 desk 写入）；AppPickerDialog 保留（DockEditor 仍在用）
- [x] 2026-09-06 npm run build 绿 + tauri build 更新 release 产物并拉起（fe68808）
- [x] 已取消(2026-09-06)：原方案已 revert，不再等待该方案验收
- [x] 已取消(2026-09-06) 「放入应用」弹窗改纯应用库管理——用户表达偏差，已 revert（af2a187）；
      实际诉求=弹窗选中态改绿色高亮（ff35cea）。上桌写入行为保持原样

### UI-小改：侧栏应用库改纯库管理（2026-09-06 追加）

> 用户定调：上桌入口已有（「放入应用」弹窗，绿色选中即写入 desk）；侧栏应用库只管库本身。
> 卡片改只读，勾选仅靠左上角方框（批量删除）。

- [x] 2026-09-11 台账去重：EditorAppLibrary 实现计划已被下方 `f85841e` 完成记录覆盖
- [x] 2026-09-11 台账去重：构建与提交已完成；用户明确验收仍按下方 `[?]` 如实保留
- [x] 2026-09-06 EditorAppLibrary：去 onToggleApp/desk/Desk✓，卡片只读+方框勾选（f85841e）；
      顺手删 App.tsx 失引用的 desk 变量；npm build + tauri build 绿，新配置器已拉起
- [?] 2026-09-06 用户验收：未找到明确回复“通过”的记录；实现已在 master，后续触及应用库时纳入独立回归

### UI-小改：Desk 属性栏去掉全量缩略条（2026-09-06 追加）

> 用户定调：底部属性栏是「当前选中节点」的专属表单，不该横摆全部 Desk 缩略图兼任切换器；
> 1 个 Desk 时定宽容器（w-[52vw]，max-w-3xl）大面积留白。方案 2：删除 DeskBackgroundCanvas，
> Desk 选中时改用 ContentInspector（只显示当前选中 Desk 的背景小缩略图 + 素材/路径，与 start/idle 统一）。
> 切 Desk 入口不变：流程图节点 + Room 层级树。

- [x] 2026-09-06 App.tsx：移除 DeskBackgroundCanvas 用法与导入；Desk/idle 分支改用 ContentInspector
- [x] 2026-09-06 previews.tsx：删除失用的 DeskBackgroundCanvas；npm test（32/32）+ npm run build 自测
- [x] 2026-09-06 tauri build 更新 release 产物并重新拉起配置器（旧进程占用 exe 已先关闭）
- [x] 2026-09-06 验收反馈：ContentInspector 信息列 w-44 → min-w-0 max-w-44（贴内容自适应，长名仍截断）；
      重跑 build + tauri build 并重新拉起
- [x] 2026-09-06 用户验收（2026-09-06，回复“可以 合并”；三轮均直改 master，无独立分支）

### UI-小改：switch 方向 chip 下沉 + 属性栏单方向编辑（2026-09-06 追加，方案 A）

> 用户定调：switch 双方向横排两组编辑器不友好。方案 A：画布上每对 Desk 拆成 ↓/↑ 两个方向 chip
> （错位排在连线两侧），点哪个 chip 属性栏就只显示哪个方向的编辑组；反向内容点另一 chip 即达。
> graphSel 从 pairKey 改为边 id；graphSwitchPosition / 契约 / 历史结构不动。

- [x] 2026-09-06 App.tsx：chip 改按边渲染（方向箭头 + 水平错位），属性栏 switch 分支按边 id 过滤；
      npm test 32/32 + npm run build + tauri build 绿并重新拉起
- [x] 2026-09-06 用户验收（2026-09-06）

### UI-小改：Desk 对画布拆双方向线（2026-09-06 追加，用户拍板）

> 用户反馈：与其一条双向线配两个旁置 chip，不如直接画两条方向线。每对 Desk 两条平行线
> （各带指向箭头 + 骑线 mini chip ⇄↓/⇄↑），选中方向线与 chip 一起青色高亮；start 线不变。
> routeGraphEdge 增加可选 laneOffset（默认 0，不影响既有测试）。

- [x] 2026-09-06 graph.ts：routeGraphEdge 支持 laneOffset；App.tsx：线条按边渲染（方向偏移 + 高亮），chip 骑线紧凑化；
      npm test 32/32 + npm run build + tauri build 绿并重新拉起
- [x] 2026-09-06 用户验收（2026-09-06，回复“可以 合并”）

### UI-小改：删除 Room 层级侧栏（2026-09-06 追加，用户拍板）

> 用户定调：Room 层级树与流程图/画布重复、难用。删除整块侧栏，主工作区占满全宽；
> 唯一独有功能 Desk 上移/下移移到 Desk 流程属性栏（改名旁，复用 moveDesk 含重映射）。
> EditorView 类型移入独立 view.ts，删除 EditorHierarchy.tsx。

- [x] 2026-09-06 新建 view.ts（EditorView）；App/RoomEditorHeader 改导入；删 EditorHierarchy 用法与文件
- [x] 2026-09-06 属性栏 Desk 分支加上移/下移按钮；npm test 32/32 + npm run build + tauri build 绿并重新拉起
- [x] 2026-09-06 用户验收（2026-09-06，回复“验收通过 合并”；直改 master，无独立分支）

### UI-小改：switch chip 去掉方向箭头（2026-09-06 追加）

> 用户反馈：连线本身有方向箭头，chip 内的 ↓/↑ 冗余。chip 只保留 ⇄ 图标（方向由所在线表达，
> 位置偏移仍按方向计算）。

- [x] 2026-09-06 App.tsx：删 chip 内箭头字符；build + tauri build + 拉起完成
- [x] 2026-09-06 用户验收（2026-09-06）

### UI-小改：首尾回绕线出/入端口错开（2026-09-06 追加）

> 用户反馈：首尾两条回绕线的箭头在节点同一锚点重叠。routeGraphEdge 回绕分支把出线/入线 y
> 也按 laneOffset（±20）错开，双车道端口分离；默认 0 不影响旧测试，另补端口分离回归。

- [x] 2026-09-06 graph.ts 端口错开 + graph.test.ts 回归（33/33）；build + tauri build + 拉起完成
- [x] 2026-09-06 用户验收（2026-09-06，回复“验收通过 合并”）

## UI-006 Room 全屏预览（2026-09-06 原路线取消，历史记录）

> 背景：内嵌画布/预览被缩进小框，大小与叠层看不准。用户拍板走全屏预览路线，分三步：
> 006 全屏只读预览（应用内窗口，复用 dext:// 预览通道）→ 007 预览窗口 Widget 拖动
> （placement 回写草稿，与未来真桌面拖动共用手势）→ 008 删除桌面画布 tab。
> 本包范围：只做 006；系统浏览器方案否决（dext.localhost 是 WebView2 私有协议，起本地 HTTP 服务不值得）。
> 范围外：007/008、预览窗口内编辑、真桌面拖动、HTTP 服务。

- [x] 2026-09-06 ROADMAP 登记 UI-006/007/008 三步路线；capabilities 加 core:window:allow-set-fullscreen
- [x] 2026-09-06 App.tsx：预览页加全屏入口；全屏遮罩 iframe 复用 postRoom 注入；Esc/退出按钮；Tauri setFullscreen；
      npm test 33/33 + npm run build + tauri build 绿并重新拉起
- [x] 2026-09-06 用户反馈（2026-09-06「不是啊…」）：要的是真桌面拖动编辑；UI-006 实现保留可随时 revert；
      UI-007 取消，改立 WIDGET-DRAG-001

## WIDGET-DRAG-001 真桌面 Widget 拖动编辑（2026-09-07 已验收，历史记录）

> 用户定调：在使用过程中直接在桌面拖动编辑 Widget（像桌面图标那样），placement 持久化；
> 实机不稳则视情况整体回退（参照 DOCK-UX-001 先例，ERRORS #65 风险已知）。
> 技术要点：编辑模式 Widget 覆盖透明把手层（解决 iframe 吃指针）、复用图标拖动机制、
> placement 吸附/钳制、persistRoom 双写（确认 widget 序列化现状后定）。
> 范围外：图标自动避让（v1 不做，仅记录）、预览窗口编辑、桌面画布 tab 去留。

- [x] 2026-09-06 渲染器：研究图标编辑态拖动 + persistRoom 现状（ROOM 深克隆整体序列化，widget placement 改内存即持久化；不重挂实例避免 iframe 重载）
- [x] 2026-09-06 渲染器：Widget 编辑覆盖层（虚线框+名称+右下角缩放把手）+ 长按进编辑 + 拖动/缩放 + safePlacement 钳制 + persistRoom；
      编辑态 widget 层抬到图标层之上解决 iframe 吞指针；空白区长按也能进编辑（无图标桌面可入）；
      缩放后同步重挂可信热点；node --check + CSS 括号平衡通过
- [x] 2026-09-06 commit + 用户真机验收（2026-09-07“验收通过”，真机稳定未触发回退）

### 示例 Widget：clock-hardware（2026-09-06 追加）

> 用户点单：按 dev_docs 契约写一个「时间 + 硬件参数」Widget 试水（同时给 WIDGET-DRAG-001 提供真机测试对象）。

- [x] 2026-09-06 创作包 `dev_docs/fixtures/creator-packs/clock-hardware/`：creator.json（P1 只读权限：时间/语言/CPU/GPU/内存/网速）+ content（index/style/main + dext-sdk.js）；
      时钟走 time.read/locale.read，硬件走 hardware.*.read 订阅，vw/vh 随拖缩等比缩放，脱离宿主有本地时钟兜底
- [x] 2026-09-06 打包 `clock-hardware.dext-content.zip`（python zipfile，正斜杠条目）；资源清单/未声明文件/slug 校验通过
- [x] 2026-09-06 用户重应用复验发现应用失败（Player 退出码 87）。真因：LivelyInfo.json 早已携带
      `--wallpaper-system-information` 等开关，Core 恒加导致重复参数（RepeatedOptionError）→ 撤回 Core
      改动，记 ERRORS #66；此前硬件无数据疑似旧 Debug 残留栈，待重应用复验
- [x] 2026-09-06 顺手修 start.ps1 配置器步骤必失败：dev 端口 1420/1423 落入 Windows 保留区
      （EACCES，ERRORS #67），迁至 1620/1621（tauri.conf/vite.config/dev:ui/文档/渲染器白名单）；
      vite 1620 绑定实测 HTTP 200；Core 新构建已运行，双配置器清理
- [x] 2026-09-06 用户复验链路确认（诊断日志）：HWMonitor 有真实数据、livelySystemInformation 已被调用、
      页面已解析——真正断点在导入：用户走「导入 Widget」文件夹导入器（硬编码 permissions:[]，不读
      creator.json），widget id 变成 "content" 且无权限声明 → SDK 全丢。已直接修 MSIroom/v2 两个
      Room（id/权限/目录改名 clock-hardware），绕过坏导入
- [x] 2026-09-11 已迁移至 ROADMAP 唯一下一项 UI-008：import_widget 文件夹导入器接入 creator.json（id/权限/热点）；Widget 删除应清理
      Room 内孤儿资源目录（当前删除只改草稿，残留文件会让后续导入/保存撞 undeclared 校验）；
      硬件链临时诊断已由 `ddc0bd0` 移除
- [x] 2026-09-11 台账收口：重开/重新应用后的硬件数据与 Widget 拖动复验，已被下方 2026-09-07 用户验收记录覆盖
- [x] 2026-09-11 台账收口：重复的“用户重应用”待办，已被下方完成记录覆盖
- [x] 2026-09-06 用户复验硬件仍空。真因（ERRORS #68）：Lively 注入负载是 JSON 字符串，能力桥只吃
      对象 → sanitize 全零且被静默吞掉；main.js 注入边界统一 parseLivelyPayload（四个注入函数全过）；
      node --check 通过；提交后用户重应用（渲染器直接从 worktree 路径加载，无需重建）
- [x] 2026-09-06 用户复验硬件仍空（ERRORS #69）：permissions-v1.json 不存在 → 授权全空 → 能力桥丢弃全部 P1；落地 P1 自动允许（declared ∩ (granted ∪ P1 只读集)），P2/P4 仍走 store；node --check 通过
- [x] 2026-09-06 用户重应用 Room 复验硬件数据 + Widget 拖动
- [x] 2026-09-06 验收通过（2026-09-07 用户回复“验收通过”）：硬件数据全通、Widget 拖动/缩放真机正常、
      骨架屏观感与网速求和修复一并确认

## OPS-004 master 状态文档对齐（2026-09-11 开工）

> 目标：以 `master` 提交历史和现有文件为事实源，统一 ROADMAP、TODO 与独立验收记录，让当前状态、最近完成、唯一下一项和历史验收例外互相一致。
> 范围外：不修改产品代码、Room/运行包或用户素材；不清理历史分支、worktree、stash；不替未实际执行的人工验收补写“通过”。
> 人工验收：核对 ROADMAP 当前控制台、近期路线和验收债，再核对 TODO 最后一节及 UI-V2-001、UI-006、WIDGET-DRAG-001 验收卡，确认都与 `master` 历史一致。

- [x] 从 `master` `a8a865e` 建立独立 worktree 和 `docs/ops-004-master-docs-sync` 分支，确认基线干净（2026-09-11）
- [x] 审计 `master` 最近提交、ROADMAP/TODO、现有验收卡、未合并分支和运行态工作区差异（2026-09-11）
- [x] 重整 ROADMAP 当前控制台，修正 UI-V2-001 等前后状态冲突，明确 UI-008 为唯一下一项（2026-09-11）
- [x] 收口 TODO 历史未勾项：只补充后续事实或迁移去向，不伪造用户验收（2026-09-11）
- [x] 更新 UI-V2-001 验收例外，并补齐 UI-006、WIDGET-DRAG-001 的独立历史验收卡（2026-09-11）
- [x] 文档一致性检查通过；仅 7 份具名文档，提交 `5091a36`（2026-09-11）
- [x] 2026-09-11 用户回复“验收通过”；分支快进合并 `master`，合并后 `npm test`（33/33）与 `npm run build` 通过，原分支/worktree 已清理

## DESK-EDIT-001 Desk 安全放置与精简编辑（2026-09-11 开工）

> 目标：配置器向 Desk 添加应用时立即分配未占用坐标；真桌面长按编辑态只保留桌面图标移动。
> 范围外：不删除 `iconSize` 数据兼容，不改变 Widget 移动/缩放，不删除 C# `addDockIcon` 兼容协议，不削弱配置器 DockEditor。
> 人工验收：在稀疏图标、Widget 和 Dock 共存的 Desk 连续添加应用；应用到真桌面后长按检查只可移动，且 Dock 启动/运行态与 DockEditor 管理不回归。

- [x] 从最新 `master` `817d881` 建立独立 worktree 和 `feat/DESK-EDIT-001-safe-placement-edit-mode` 分支；基线 `npm test`（33/33）、`npm run build`、`node --check` 通过（2026-09-11）
- [x] 完成代码链调查与方案冻结：新增应用当前缺失 `x/y`，画布按 `(0,0)` 渲染，保存才用固定索引补位；真桌面同时残留删除、尺寸切换和 Desk↔Dock 拖拽
- [x] 建立实施计划与独立验收卡
- [x] TDD：新增图标空位查找覆盖稀疏坐标、Widget/全局或桌级 Dock 障碍、满网格、不可变输入及 large/medium/small 运行网格；各用例先按预期失败后转绿
- [x] 配置器 `toggleDeskApp` 改走纯函数写入安全 `x/y`；满网格返回 `full`，不写历史、不置 dirty；定向测试先 2 项按预期失败，完成后全量 38/38 与构建通过
- [x] 渲染器删除尺寸、删除和 Desk↔Dock 跨层拖拽，仅保留桌面移动及既有 Widget 编辑；Playwright 旧行为断言先按预期失败，改后控件与双向拖拽行为检查通过
- [x] 更新 README/DOCK/FRONTEND 正式口径：`iconSize` 仅保留数据兼容，DockEditor 为唯一 Dock 管理入口，后端 `addDockIcon` 链仅作旧兼容
- [x] 全量自动检查通过：`npm test` 39/39、`npm run build`、`node --check`、Room Schema、`git diff --check`；16 份具名文件提交 `d8655a9`
- [x] 2026-09-11 用户回复“验收通过”；合并到 master `355bc79`，验收记录已归档

## DESK-LIVE-001 实时应用放置与 Widget 优先避让（2026-09-11 开工）

> 目标：当前使用中的 Room 放入应用后立即热同步到真实桌面；默认最小化配置器并进入目标 Desk 编辑；Widget 拖动/缩放优先占位并让冲突图标自动避让。
> 范围外：不恢复 Desk↔Dock 拖拽、桌面删除或尺寸切换；不把背景/Scene/switch/Dock 等普通草稿改成全量实时协同；不改变 DockEditor 职责。
> 人工验收：按 `dev_docs/acceptance/DESK-LIVE-001-live-layout-sync.md` 检查默认/关闭偏好、当前/非当前 Room、失败处理、智能成组放置、Widget 避让/无解回退、焦点回读和既有能力回归。

- [x] 从 `master` `da01ed7` 建立独立 worktree `D:\use\Orca\DEXT\DEXT_Core-desk-live-001` 和分支 `feat/DESK-LIVE-001-live-layout-sync`；基线 `npm test` 39/39 通过
- [x] 用户确认需求：智能靠近现有图标组；当前 Room 实时热同步；默认新增后最小化并自动进入编辑；Widget 优先、冲突图标松手后让位
- [x] 完成方案比较、错误分册复核、正式设计与独立验收卡
- [x] 2026-09-12 用户复核正式设计并回复“通过”
- [x] 编写 `docs/superpowers/plans/2026-09-12-desk-live-layout-sync.md`，拆为 8 个可独立测试/提交的实施任务
- [x] 按实施计划和 TDD 顺序执行
- [x] Task 1：智能成组图标放置、四周安全边距与 Widget 避让整体回退；定向 Vitest 25/25 通过（2026-09-12）
- [x] Task 2：本地偏好、布局焦点合并与 latest-wins 热同步队列；定向 Vitest 5/5 通过（2026-09-12）
- [x] Task 3：Rust 受控布局写入与 Core RPC 客户端；定向 Rust 3/3 与 cargo check 通过（2026-09-12）
- [x] Task 4：Core → Player `Type=26` 类型化 Room 布局消息；Release build.ps1 通过（2026-09-12）
- [x] Task 5：真实桌面同 Desk 图标热更新、编辑高亮与 Widget 原子避让；Node 纯函数 3/3 和语法检查通过（2026-09-12）
- [x] Task 6：配置器画布 Widget 避让改为整体回退，Dock 保留区四周一致；Vitest 与前端 build 通过（2026-09-12）
- [x] Task 7：配置器实时同步、默认自动前往桌面编辑、关闭偏好连续添加、撤销/重做复用队列与焦点回读合并；补充“新增后立刻撤销不触发过期最小化/高亮”回归，定向 Vitest 7/7 与前端 build 通过（2026-09-12）
- [x] Task 8：全链验证、文档收口并进入待验收
- [x] 全量自动检查通过：Vitest 50/50、前端生产构建、Rust 39/39（3 项改动系统桌面的活体测试按约定忽略）、cargo check、渲染器 Node 3/3 与语法检查、Room Schema、`git diff --check`（2026-09-12）
- [x] 提交实现并转待验收（实现提交 `9867516`）
- [x] 2026-09-19 用户回复“验收通过”；合并到 master `64ab03f`，原分支/worktree 已清理

## DESK-MOTION-001 桌面自动重排动画（2026-09-19 开工）

> 目标：为已有 Desk 自动布局变化提供统一、可中断、稳定节点复用的 FLIP/WAAPI 动画；先在浏览器实验台验收运动质感，再接入真实桌面。
> 范围外：不引入 Muuri、dnd-kit、React Grid Layout 等运行时依赖；不改变 room.json；不实现按名称/频率一键整理；浏览器验收前不修改真实桌面 `main.js` 的交互。
> 人工验收：先运行 `npm run dev:motion`，逐项检查 Widget 单/多图标让位、连续折返、图标路径重排、新增、移除、无解回弹、取消、reduced-motion 与 100 图标压力场景；浏览器阶段明确通过后才进入真桌面集成。

- [x] DESK-LIVE-001 于 2026-09-19 用户验收通过并合入 master `64ab03f`
- [x] 从最新 master 建立独立 worktree `D:\use\Orca\DEXT\DEXT_Core-desk-motion-001` 和分支 `feat/DESK-MOTION-001-layout-motion`
- [x] 固化设计、实施计划、结构决策和独立验收卡
- [x] TDD：稳定身份、路径重排、Widget/Dock 障碍、move/enter/exit diff、revision/cancel/restore/reduced-motion（Node 14/14；Playwright 25/25）
- [x] 实现独立 `DextLayoutMotion`，保持 `apply/cancel/dispose` 固定接口
- [x] 建立浏览器实验台与全部交互场景，实验台直接使用产品动画引擎
- [x] 增加 Playwright、`dev:motion`、`test:renderer:e2e` 与 Windows 运行说明
- [x] 浏览器阶段自动检查通过并完成阶段 A 提交，停在“浏览器视觉验收”硬门槛
- [x] 独立代码审查：修复离开格仍交换、pointercancel 错误提交、旧场景覆盖 Reset；新增真实指针回归 3 项
- [x] 2026-09-19 浏览器验收反馈：确认真实桌面旧长按/jiggle 未被本分支修改；实验台改为外层 FLIP + 内层苹果式抖动，补 500ms 长按与 Done，move/rollback 放缓为 280/300ms，极限折返明确标为压力测试
- [x] 复审修复：运行中启用或系统级 reduced-motion 均立即结束 FLIP、落最终坐标并关闭 jiggle，且预览取消基线不丢失；新增浏览器回归 3 项
- [x] 2026-09-19 用户明确重排语义：图标托起、目标占位、路径图标依次让位、松手保存；Widget 自身可拖但图标排序不得移动 Widget；Dock 禁止放入
- [x] TDD：新增纯 `resolveIconReorder`，覆盖前移/后移、Widget 障碍、Dock 禁区与输入不变
- [x] 将实验台两两交换改为真实 Sortable 拖拽：托起层、占位、连续让位、提交/取消与非法目标
- [x] 补 Widget 可拖且始终优先、Dock 禁止图标/Widget 放入的真实指针回归
- [x] 复核修复：Reset 终止全部 drag/press、timer 与 pointer capture；每个真实手势结清旧预览并建立独立取消基线；4 条浏览器回归覆盖图标/Widget 取消、拖动中 Reset 与长按中 Reset
- [x] 二次复核修复：非 Reset 场景切换也先取消真实拖拽并恢复本手势基线，旧 pointerup 不再覆盖新场景；新增 1 条回归
- [x] 浏览器验收补充：Widget 在编辑模式下轻微抖动，拖动期间暂停、松手/取消后恢复，reduced-motion 下关闭；定向 Playwright 先失败后转绿
- [x] 浏览器验收修正：Widget 边框/背景/文字整体抖动；双击桌面空白退出编辑，双击交互对象不退出；Dock 钳制增加整卡旋转安全余量
- [x] 更新设计、验收、错误记录并完成全量验证与独立复核：Vitest 50/50、Node 14/14、Playwright 25/25、构建、语法、Room Schema、diff check 全绿；最终复核无 Critical/Important
- [x] 2026-09-19 用户确认实验台只用于验证运动规则和默认参数，并明确要求实施真实桌面阶段 B；生产环境不复制实验台外观
- [x] 2026-09-20 导出默认 MotionProfile，新增独立 DextDesktopLayoutController，按稳定身份协调真实图标节点；真实编辑切换与热布局更新均复用图标节点和 Widget iframe
- [x] 真实图标 Sortable：外层 FLIP、内层托起/抖动、80ms 候选稳定、路径让位、单次提交和完整取消（2026-09-20）
- [x] Widget 事务式拖动/缩放：真实整卡抖动、Widget 优先、图标避让、Dock 禁区与原子提交/回滚（2026-09-20）
- [x] 权威更新中断：热布局、Desk 切换、resize、退出编辑统一终止旧手势，旧回调不得覆盖新状态（2026-09-20）
- [x] 真实 renderer Playwright：节点/iframe 复用、热更新、双击空白、reduced-motion、启动/Dock 回归（14/14；2026-09-20）
- [x] 全量自动回归：Vitest 50/50、Node 21/21、Playwright 39/39、build、语法、Schema 与 diff check（2026-09-20）
- [x] `codegraph sync` 按规范尝试；独立 worktree 的 `.codegraph` 仅有 ignore 文件且 `status` 为 Not initialized，未擅自初始化（2026-09-20）
- [x] 阶段 B 实现提交 `64af642`；已停在真实桌面人工验收，禁止合并 master（2026-09-20）

## DESK-ICON-001 桌面图标反馈与命中区优化（2026-09-20 开工）

> 目标：先用未来生产共用的视觉层，在浏览器中验证“图标光晕 / 紧凑内容框 / 纯净无边框”、收缩命中区和名称显示规则。
> 范围外：浏览器验收前不修改真实桌面、设置页、Core、proto、Widget、Dock 或 Room Schema；不先于 DESK-MOTION-001 合并 master。
> 人工验收：按 `dev_docs/acceptance/DESK-ICON-001-icon-feedback.md` 的阶段 A 十步在浏览器确认；明确通过后才进入生产集成。

### 阶段 B：真实桌面与全局偏好集成（2026-09-21 开工）

- [x] 修正拖动抖跳：冻结托起对象外层坐标，以按下点计算位移，关闭 face 跟手过渡，窗口接收移动/松手；扩展全桌面空白双击退出。真实 Room 16 项及新增连续 12 次拖放检查通过；Vitest 52/52、控制器 Node 7/7、build 通过，已重铺（2026-09-21）。

- [x] 用户回复“感觉差不多了，可以尝试合并进去了”，确认阶段 A 可进入真实桌面集成（2026-09-21）
- [x] 裁定：当前分支已建立在 DESK-MOTION-001 之上，可继续完成阶段 B；最终仍严格先合入 Motion、再合入 Icon，不直接修改 master（2026-09-21）
- [x] 真实 `dext-room` 接入共享 visual/face/tooltip 和偏好消息，不替换稳定图标节点或 Widget iframe；Node 19/19、真实 Room 15/15、图标实验台 12/12（2026-09-21）
- [x] Core Settings、Rust patch/投递、设置页五项偏好和 Player 可信宿主启动快照端到端接通；Vitest 52/52、Rust 40/40（3 ignored）、前端 build 与 C# Release 通过（2026-09-21）
- [x] 完整自动检查、全分支审查与文档收口：Vitest 52/52、Rust 40/40（3 ignored）、Node 20/20、renderer 52/52、前端 build、C# Release、Schema、proto 文本一致与 diff check 全绿（2026-09-21）
- [x] 用户关闭旧 Dext 后启动本 worktree；Core PID 65292、Watchdog、Player、配置器及真实壁纸路径均核对来自 `DEXT_Core-desk-icon-001`，强制重铺活体测试 1/1 通过（2026-09-21）
- [x] 真实桌面黑屏修复：确认 WebView2 只映射 `dext-room`，浏览器阶段的兄弟目录共享资源无法加载；边界 Playwright 先 RED 后 GREEN，共享 JS/CSS 收进生产目录，实验台反向引用（2026-09-21）
- [x] 已取消（2026-09-21）：连续长按把同一 pointer 直接交给 draggingIcon；真实复验发现该方案偏离已验收实验台并导致难触发/跳动，改由下一项取代
- [x] 真实桌面排序手势回溯修正：以最早验收的 `2694f0d` 浏览器排序为基线，恢复“长按只进编辑、编辑态按下拖动、外层落目标格/内层跟手补偿、跨格立即占位”，并让捕获阶段的桌面空白双击可靠退出（2026-09-21）
- [x] 真实桌面生产交互回退：连续三轮 Chromium 全绿修正均未恢复 WebView2 真桌面拖动，停止继续叠补丁；生产 Room 的图标 DOM、事件控制器与真实 Room 回归已恢复到 DESK-MOTION 稳定提交 `64af642`，浏览器图标实验台和偏好代码保留供后续重新集成（2026-09-21）
- [x] 已取消（2026-09-21）：`b8b00f0` 虽保留 `attachPress/startDrag` 函数，却在节点协调重构中删除唯一的 `attachPress(el, i)` 调用；新增真实指针回归复现编辑态第二次按下后图标仍完全不动，不能作为旧拖动基线
- [x] 真实桌面回退到最后一个实际绑定旧拖动的提交 `15147f2`：恢复每个图标自己的 `pointerdown/move/up`、按指针实时写 left/top、松手交换/落位和保存；移除生产对桌面布局控制器的依赖，保留浏览器实验台与全局偏好代码（2026-09-21）
- [ ] 按独立验收卡完成真实桌面人工验收；用户明确回复通过前不合并 master

### 阶段 A 补充：直接交互实验（2026-09-20）

- [x] 实验台默认进入“交互”状态，真实响应 hover、pointerdown 和短按选择，同时保留固定状态诊断按钮（2026-09-20）
- [x] 长按图标 500ms 进入苹果式编辑抖动；编辑中图标可托起跟手，松手回到原网格，不排序、不保存（2026-09-20）
- [x] 双击画布空白退出编辑，透明网格边缘保持不命中；两条 Playwright 回归均先 RED 后 GREEN（2026-09-20）
- [x] 更新验收卡、前端说明和问题记录；Vitest 50/50、Node 25/25、图标实验台 11/11、renderer Playwright 50/50、build、语法、Schema、生产边界与 diff check 全部通过，停在浏览器人工验收（2026-09-20）

### 阶段 A 补充：统一布局格与命中框（2026-09-20）

- [x] 将布局定位格与实际命中区收成同一个 footprint，小/标准/大同时控制两者并完全重合（2026-09-20）
- [x] 将紧凑/标准/宽松改为 footprint 之间独立 gap，不再通过第二套 cell 尺寸表达间距（2026-09-20）
- [x] Playwright 先以真实 bounding box 复现两框不重合，再锁定四边重合、三档 gap 与空隙不命中；RED→GREEN（2026-09-20）
- [x] 更新说明、验收卡和错误记录；Vitest 50/50、Node 25/25、图标实验台 11/11、renderer Playwright 50/50、build、语法、Schema、生产边界与 diff check 全部通过，继续停在阶段 A 人工验收（2026-09-20）

### 阶段 A 补充：隐藏名称紧凑框与抖动节奏（2026-09-20）

- [x] 隐藏名称时三档 footprint 收为 64×64 / 72×72 / 80×80，布局与命中继续完全重合，gap 不变（2026-09-20）
- [x] 图标编辑抖动由 ±1.35°/350ms 调整为 ±1.5°/280ms；长按阈值、Widget 和 reduced-motion 不变（2026-09-20）
- [x] 先以真实 bounding box、动态标尺和 CSS 动画关键帧建立 Playwright RED，再修改共享视觉实现（2026-09-20）
- [x] 更新说明与验收卡；Vitest 50/50、Node 25/25、图标实验台 11/11、renderer Playwright 50/50、build、语法、Schema、生产边界与 diff check 全绿，继续停在阶段 A 人工验收（2026-09-20）

### 阶段 A 补充：更快长按与明显抖动（2026-09-20）

- [x] 实验台图标长按由 500ms 改为 300ms；名称浮层仍保持 500ms（2026-09-20）
- [x] 图标编辑抖动由 ±1.5° / 280ms 改为 ±5° / 150ms；Widget、拖动和 reduced-motion 不变（2026-09-20）
- [x] Playwright 以受控页面时钟锁定 299ms/300ms 编辑边界，并读取真实 CSSAnimation 时长与关键帧；RED→GREEN（2026-09-20）
- [x] 更新说明与验收卡；Vitest 50/50、Node 25/25、图标实验台 11/11、renderer Playwright 50/50、build、语法、Schema、生产边界与 diff check 全绿，继续停在阶段 A 人工验收（2026-09-20）

### 阶段 A 补充：抖动幅度收敛到 3°（2026-09-20）

- [x] 图标 jiggle 幅度由 ±5° 收敛为 ±3°；300ms 长按、150ms 周期及其他交互不变（2026-09-20）
- [x] Playwright 读取真实 CSSAnimation 关键帧验证 RED→GREEN（2026-09-20）
- [x] 同步验收口径；Vitest 50/50、Node 25/25、图标实验台 11/11、renderer Playwright 50/50、build、语法、Schema、生产边界与 diff check 全绿，继续停在阶段 A 人工验收（2026-09-20）

### 阶段 A 补充：图标与文字整体抖动（2026-09-20）

- [x] 修复纯旋转使文字基线视觉位移过小的问题；同一 face 增加 ±1.5px 水平位移，图标、文字和命中边框保持刚性整体（2026-09-20）
- [x] Playwright 从真实 CSSAnimation 矩阵同时锁定 ±3° 角度与 ±1.5px 位移；RED→GREEN（2026-09-20）
- [x] 同步验收卡和错误记录；Vitest 50/50、Node 25/25、图标实验台 11/11、renderer Playwright 50/50、build、语法、Schema、生产边界与 diff check 全绿，继续停在阶段 A 人工验收（2026-09-20）
- [x] 已取消（2026-09-20）：用户澄清文字应保持静止，本节由“仅图形抖动、文字静止”取代

### 阶段 A 补充：文字显式抖动（2026-09-20，已取消）

- [x] 已取消（2026-09-20）：用户原意是文字保持静止，不是让文字获得独立 jiggle；本节未修改生产实现

### 阶段 A 补充：仅图形抖动、文字静止（2026-09-20）

- [x] 将编辑 jiggle 从 `.icon-face` 移到 `.icon-visual`；文字和 footprint 保持静止（2026-09-20）
- [x] 保留 300ms 长按、±3° / 150ms；撤销基于误解加入的 ±1.5px 整体平移（2026-09-20）
- [x] Playwright 锁定 visual 关键帧、face/label 无动画、拖动与 reduced-motion；RED→GREEN（2026-09-20）
- [x] 同步验收口径与错误记录；Vitest 50/50、Node 25/25、图标实验台 11/11、renderer Playwright 50/50、build、语法、Schema、生产边界与 diff check 全绿，提交后继续停在阶段 A 人工验收（2026-09-20）

### 阶段 A 补充：独立图标视觉大小（2026-09-20）

- [x] 在共享图标偏好中增加小 48px / 标准 56px / 大 64px 三档视觉大小，默认标准；与 footprint 和 gap 独立（2026-09-20）
- [x] 实验台增加图标大小控制和实时尺寸标尺；切换时不替换图标节点，图形保持水平居中，文字仍静止（2026-09-20）
- [x] Playwright/Node 先锁定默认值、非法回退、三档真实尺寸、节点复用和任意 footprint 组合，再完成 RED→GREEN（2026-09-20）
- [x] 更新验收口径与说明；Vitest 50/50、Node 25/25、图标实验台 12/12、renderer Playwright 51/51、build、语法、Schema、生产边界与 diff check 全绿，提交后继续停在阶段 A 人工验收（2026-09-20）

- [x] 从 DESK-MOTION-001 `5d91bb2` 建立独立 worktree `D:\use\Orca\DEXT\DEXT_Core-desk-icon-001` 和分支 `feat/DESK-ICON-001-icon-feedback`
- [x] 固化设计、实施计划、视觉论点、共享接口和独立验收卡
- [x] TDD：默认偏好、非法回退、dataset 应用、状态判定和节点不替换（Node 3/3；2026-09-20）
- [x] TDD：三种模式、收缩命中区、单行省略、500ms 名称浮层及编辑/拖动抑制（Playwright 5/5；2026-09-20）
- [x] 建立浏览器图标实验台与 `npm run dev:icons`；直接加载共享模块/CSS，不修改生产 `dext-room`（2026-09-20）
- [x] 阶段 A 全量自动检查和独立审查：独立复核无 Critical；两项 Important 均以先失败后转绿的 Playwright 回归修复；全量 Vitest 50/50、Node 18/18、Playwright 45/45、build、语法、Schema 与 diff check 通过（2026-09-20）
- [x] 提交阶段 A，停在浏览器人工验收硬门槛；真实桌面、设置页、Core 与 Room Schema 保持相对基线零差异（2026-09-20）
- [x] 阶段 A 验收修正：把实验台改为固定“正常 / 悬停 / 按下 / 编辑 / 拖动”状态，背景仅负责背景；普通比较不再由鼠标触发位移（2026-09-20）
- [x] 阶段 A 验收修正：新增紧凑 / 标准 / 宽松三档间距预览（88×100 / 100×112 / 120×124），默认标准；本轮不写入生产设置（2026-09-20）
- [x] TDD 验证固定状态不替换节点、切换反馈不移动图标中心、紧凑档命中区不重叠及显式编辑/拖动运动；按下中心偏移回归先失败后转绿（2026-09-20）
- [x] 更新浏览器验收卡、完成全量回归并提交：Vitest 50/50、Node 25/25、Playwright 47/47、build、语法、Schema 与 diff check 通过；继续停在阶段 A 人工验收，真实桌面、设置页和 Core 仍保持零差异（2026-09-20）
- [x] 阶段 A 验收修正：实际命中区不再由名称内容撑开；同档所有图标使用统一固定框并与图标水平中心对齐（2026-09-20）
- [x] 增加独立命中框“小 72×80 / 标准 80×84 / 大 84×88”三档，默认标准；与 88/100/120px 图标间距解耦且任意组合不重叠（2026-09-20）
- [x] TDD 验证三档精确尺寸、四个图标统一、中心对齐、名称显示切换不改变几何、紧凑间距与大命中框仍留 4px 缝；RED→GREEN（2026-09-20）
- [x] 更新实验台与验收卡，浏览器检查标准档与“紧凑间距 + 大命中框”通过；Vitest 50/50、Node 25/25、renderer Playwright 48/48、build、语法、Schema、生产边界与 diff check 通过，继续停在阶段 A 人工验收（2026-09-20）

## DESK-PREFS-001 五项桌面图标偏好真实生效（2026-09-22 设计中）

> 目标：让现有五项图标偏好通过已保存/投递链路在真实桌面和配置器新增应用网格生效，同时保住 `6eca2db` 的旧直接拖动。
> 范围外：重做 Sortable、Widget/Dock 管理、Room Schema、其它 Core 设置；未获人工验收不合并 master。
> 人工验收：详见 `dev_docs/acceptance/DESK-PREFS-001-icon-settings-live.md`；五项逐项观察、重启/切 Desk、密集网格新增、十次真实桌面拖放与 reduced-motion。

- [x] 从 `6eca2db` 创建独立 worktree 和分支，保留主 worktree 与其他待验收分支未提交文件（2026-09-22）
- [x] 读取文档地图/路线/台账/错误和流程；本 worktree CodeGraph 未初始化，不擅自建立索引；核对设置投递链、真实宿主断点和旧拖动绑定（2026-09-22）
- [x] 写书面设计规格、独立验收卡和工作包记录；未改产品代码（2026-09-22）
- [x] 用户确认书面设计规格（2026-09-22，回复“ok”）；计划前核对代码发现 Room `x/y` 是格索引而非像素，已对规格作事实修正并明示
- [x] 按确认的规格写六任务实施计划、接口、先失败后转绿测试与真实宿主门槛（2026-09-22）；文档 `docs/superpowers/plans/2026-09-22-desktop-icon-preferences-live.md`
- [x] 用户回复“实施啊”，按确认的实施计划进入产品代码（2026-09-22）
- [x] Task 1：Node 先红后绿锁定最小搬格、Widget/Dock 矩形和无解整 Room 回滚；TS 54 组合几何与逻辑网格（2026-09-22）
- [x] Task 2：真实 Room 原节点接入共享视觉层、收缩命中区与消息外观切换；保留旧 .icon 指针捕获，Room/边界/实验台 Playwright 17/17（2026-09-22）
- [x] Task 3：偏好消息递增 revision 与 loaded revision 0；可选 requestId 保存回执经 Player/Core 转发，源 Room 写入失败回滚运行包；Rust 定向测试和 Core Release 构建通过（2026-09-22）
- [x] Task 4：生产 Room 搬格事务接通回执与失败回滚；图标/Widget 手势期间延后偏好，热更新中断旧 pointer，Dock/Widget 拒绝落位；定向 Playwright 与 Node 回归通过（2026-09-22）
- [x] Task 5：配置器新增应用读取最新五项设置并投影网格；离线兼容放置明确告知，设置页防并发且文案改“已发送”；Vitest 29/29、前端 build 通过（2026-09-22）
- [x] Task 6 自动部分：Vitest 54/54、renderer Playwright 50/50、Node、Rust、C# Release、Schema 与差异检查；更新文档和验收卡（2026-09-22）
- [ ] Task 6 真实宿主门槛：运行身份仍是 `DEXT_Core-desk-reorder-001`；本分支 `scripts/start.ps1` 被相同 mutex/pipe 正确拒绝。恢复条件：先退出旧 Core/Player/配置器，再从本 worktree 启动与重铺，核对路径并连续做至少十次拖放；旧运行结果不能计本分支通过
- [ ] 测试先行接通生产偏好、旧指针边界和共享几何，完成布局事务及配置器新增应用同网格
- [ ] 自动检查、独立代码复核和真实运行路径核对；提交工作分支进入人工待验收
- [ ] 用户按独立验收卡在真实桌面确认通过；通过之前不合并 master
- [x] Task 6 运行路径恢复（2026-09-22）：旧实例由用户退出；本 worktree `scripts/start.ps1` 启动 Core/配置器，忽略测试 `applies_room_wallpaper` 重铺通过；运行身份脚本核对 Core、Player、配置器及 wallpaper URL 全部来自 `DEXT_Core-desk-prefs-001`。上一条“旧实例占用”仅保留为历史阻塞记录。
- [x] 当前配置器内“显示桌面图标名称”往返切换并恢复原值，两次均反馈保存且已发送当前桌面；这不证明实际渲染已变。
- [ ] Task 6 真实桌面产品门槛：按独立验收卡逐项目视验证五项偏好、密集网格、重载和 reduced-motion；旧直接拖动连续至少十次。未验收前停在工作分支，不合并 master。

### DESK-PREFS-001 真实桌面验收修正（2026-09-22）

> 目标：保留已生效的五项偏好，同时缩窄三档图标间距，并修复“拖动一开始就失去命中”的真实 WebView2 回归。
> 范围外：路径重排、Widget/Dock 新交互、Room Schema 和 master 合并。
> 人工验收：沿用本包验收卡八项，重点核对三档间距与连续十次真实图标拖放。

- [x] 用户实机确认设置确实改变图标，但间距偏宽、图标拖动刚开始即丢命中；本包验收不通过，继续原分支（2026-09-22）。
- [ ] 采集真实 Player 的 pointerdown/move/up/cancel/lostpointercapture 与重绘/resize 事件顺序，定位中断来源；对照旧可拖动绑定和 Widget 手势。
- [ ] 先写失败回归，再分别修复拖动中断与间距档位；保持命中框独立尺寸和偏好跨端一致。
- [ ] 运行渲染器、前端及必要的 Core 回归；重铺当前分支桌面，提交后停在人工待验收。
- [x] 间距三档按真实 footprint 额外空隙收紧为 `2×4 / 8×12 / 20×24px`；配置器、生产 Room、实验台使用同一几何；TS 与 Playwright 断言先红后绿（2026-09-22）。
- [x] 真实 WorkerW 事件探针已临时装入当前 Room 并重铺，右上角保留 pointer 轨迹；待实机截图确定中断事件后移除，不将诊断叠层带入最终验收（2026-09-22）。
- [x] 收紧间距后的 Vitest 55/55、构建、Node 8/8、Playwright 50/50 通过；仍不等于真实 Player 拖动通过（2026-09-22）。
- [x] 实机轨迹确认三次图标按下均获得 pointer capture，约 0.3–0.4 秒后直接收到 `lostpointercapture`，没有记录到 pointermove/up 或重绘；该截图尚不足以判定捕获为何丢失（2026-09-22）。
- [x] 只读核对当前 `rooms/v2/room.json` 两图标位于第 0、2 列；截图中的大间隔主要包含一个空网格列，不是三档额外间距数值未生效（2026-09-22）。
- [ ] 临时补采 `mousemove/mouseup/dragstart/focus` 和指针坐标，区分 WebView2 单独丢 pointer capture、原生 drag 与整个宿主输入离开；取得实机轨迹后移除探针。
