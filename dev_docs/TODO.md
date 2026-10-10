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
- [x] 临时补采 `mousemove/mouseup/dragstart/focus` 和指针坐标，诊断提交 `ee62c49`；`node --check`、`git diff --check` 通过，忽略测试重铺成功，运行身份核对 Core/Player/配置器均为当前 worktree（2026-09-22）。
- [ ] 用户在真实桌面再做一次从左图标向右图标的连续拖动，读取扩展事件轨迹；定位后写失败回归、修复并移除探针。

### DESK-PREFS-001 Core 输入边界修复（2026-09-22）

目标：修正 master 继承的错误鼠标状态转发，以连续可靠的原生输入恢复当前图标拖动。当前生产只绑定旧直接拖动，保留五项偏好，不重做桌面或引入新排序控制器。

- [x] 对比 master 与当前分支：主要增量是实验台、测试、偏好链路；Core InputUtil 从基线起把 WM_MOUSEMOVE 的 wParam 固定为 0x20（X1），UP 仍携带按下位；当前新增 lostpointercapture 回滚使错误立即可见。
- [x] 新增 Windows 消息边界回归，旧代码 expected 0 / actual 0x20 失败；修复后通过。
- [x] 抽出按下到释放的转发会话：正确按钮状态、固定起始接收窗口及坐标原点，释放不受前台变化过滤；处理 RawInput 组合标志与负坐标。
- [x] 移除临时前端日志；Vitest 55/55、Node 24/24、Playwright 50/50、前端 build、Core/Player 全量构建通过；当前 Core PID 30236 / Player PID 8716 路径核对通过。
- [x] 隔离生产 Release WebView2 Player 验证旧值确实产生 buttons=8；正确会话连续十次获得 capture、MOVE=1、UP=0、无提前取消。测试通过原生消息而非 Playwright 注入；物理 RawInput/WorkerW 仍需人工验收。
- [x] 代码、测试和独立验收卡已收尾，进入工作分支提交；用户 Cargo.toml 原有工作区变化保持未暂存。
- [ ] 待实机验收：长按松手后二次拖动十次、跨窗口释放、取消、Widget、五项偏好；验收前不合并。

### DESK-PREFS-001 合并收尾（2026-09-22）

- [x] 用户明确授权当前版本先合并 master；此前未勾选的物理测试保留为历史记录，不代填结果。
- [x] 合并前复跑 Vitest 55/55 与原生 Windows 输入回归，均通过。
- [x] 核对主工作区用户 Room/资源改动与分支源码增量不重叠；仅合并提交，不暂存用户布局。
- [ ] 合并 master 并核对用户数据哈希；运行中的 prefs worktree 及其未提交布局保留，待退出运行并安置数据后清理。
- [ ] 合并后独立编写 DESK-REORDER-002 历史回溯及实施计划；本轮不实现 reorder。

- [x] master 已合并 `4fd2986`；合并后 Vitest 55/55、布局/动画 Node 20/20、语法检查通过，既有用户数据哈希一致。
- [x] DESK-PREFS-001 当前轮归档摘要见 `TODO-archive.md`；上述旧未勾选项仅保留历史，不作为下一工作包任务。
- [ ] 清理延后：prefs 工作区仍运行且有用户未提交 Room 布局。不得强制删除；退出运行、安置数据后再清理。

## CONFIG-EDIT-001 配置器 Room 打开与可恢复修复（2026-09-23）

> 目标：配置器点击“编辑”时原子地完成 Room 检查；对未声明 Widget 孤儿资源给出可见说明和可恢复清理入口，不再静默停留在使用页。
> 范围外：不放宽预览/应用/导出安全校验，不修改 Room Schema，不实现桌面 reorder，不操作正在运行的旧 PREFS worktree。
> 人工验收：见 `dev_docs/acceptance/CONFIG-EDIT-001-room-open-recovery.md`。

- [x] 从 master 创建独立 worktree 与 `fix/CONFIG-EDIT-001-room-open-recovery` 分支；基线 Vitest 55/55（2026-09-23）
- [x] 根因确认：当前 Room 声明 0 个 Widget，但磁盘残留 `widgets/clock-hardware/*`；严格权限检查拒绝，前端又在 await 前写部分状态并吞掉错误，形成“编辑无反应”（2026-09-23）
- [x] 固化设计、实施计划和独立验收卡；DESK-REORDER-002 排到本包验收合并之后同步（2026-09-23）
- [x] TDD：后端拆分“声明资源安全校验”和“孤儿资源审计”，编辑检查返回结构化结果，发布链仍严格（2026-09-23）
- [x] TDD：显式修复把孤儿资源复制到 Dext 恢复目录并从 Room 移除；失败时不声称完成，不永久删除（2026-09-23）
- [x] TDD：前端原子打开、可见错误/警告、修复按钮与预览/应用/保存/导出守卫（2026-09-23）
- [x] 完整自动检查、差异复核、提交工作分支并停在人工待验收：Vitest 57/57、Rust 43 通过/3 个真实环境测试按设计忽略、前端 build 与 diff check 通过（2026-09-23）
- [x] 从本 worktree 启动真实 Core 与配置器并核对路径：Core PID 85864、配置器 PID 79972 均来自 `config-edit-001`；持久化桌面 Player 仍加载旧 PREFS 壁纸，未强制重铺（2026-09-23）
- [x] 用户于 2026-09-23 回复“ok验收通过下一步”，确认 CONFIG-EDIT-001 通过并进入 master 合并；reorder 在合并后同步

### DESK-REORDER-002 稳定输入上的路径重排（2026-09-22，待真实桌面验收）

目标：在 master 已修复输入的旧直接拖动上追加路径排序，不再更换输入入口。范围外：Core 重写、Widget 手势、Room Schema、新偏好。人工步骤见本包独立验收卡七项。

- [x] 从已合并 master 建立独立 worktree / 分支，回溯 15147f2、b8b00f0、9f8d569、cf318ad 与 3c42552。
- [x] 固化输入根因证据及不确定边界，明确动画 excludeKeys 仍写坐标、dispose 删除节点的集成风险。
- [x] 编写 `docs/superpowers/plans/2026-09-22-stable-desktop-reorder.md` 及独立验收卡，自检接口与任务覆盖。
- [x] 用户明确要求“按照上面的计划执行一次”，开始实施 Task 1–5（2026-09-22）。
- [x] Task 1：原生 Windows 消息回归与真实 Room 浏览器旧直接拖动基线通过；Core 输入相对 master 零改动。
- [x] Task 2：纯排序事务、几何与障碍测试先红后绿，Node 11/11。
- [x] Task 3：旧 startDrag 保留 pointer capture 与逐帧跟手，事务预览从手势基线计算；跨格路径插入、无效释放、热更新和一次保存经真实 Room Playwright 验证。
- [x] Task 4：同伴节点 WAAPI 280ms，让拖动节点不归动画层管理；快速折返与 reduced-motion 测试通过。新增位置高亮已移除，名称仍静止。
- [x] Task 5 自动部分：新 worktree Release Player 构建通过；原生消息十轮和真实 Room 原生拖动十轮通过，Vitest 55/55、前端 build、Renderer Playwright、Node、语法与 diff 检查通过。未重铺运行桌面。
- [x] Task 5 真实 WorkerW 人工验收：已从本 worktree 启动、强制重铺并核对绝对路径；用户于 2026-09-23 回复“好样的 合并上去”，明确验收通过。
- [x] 最终复核修复旧 Glyph 图标被补入空 `launch` 的 Schema 风险；Node 27/27、Renderer Playwright 55/55、隔离 Player 十轮 Room 拖动和保存形状检查均通过（2026-09-23）。
- [x] 实施后自动检查完成，提交并停在真实桌面待验收；用户通过后才合并。
- [x] CONFIG-EDIT-001 验收合入 master `436080e` 后，将本分支 rebase 到最新主线；保留配置器原子打开修复与本包 `highlightTarget: null`（2026-09-23）。
- [x] 重放后复跑：Vitest 57/57、Rust 43 通过/3 个真实环境测试忽略、前端 build、Renderer Playwright 55/55、Node 27/27、Room Schema 与 `git diff --check` 全部通过（2026-09-23）。
- [x] 从本 worktree 启动 Core/配置器并强制重铺真实桌面；身份核对通过：Core PID 74152、Player PID 27812、配置器 PID 86844 均来自 `DEXT_Core-desk-reorder-002`，Player URL 指向本 worktree 的真实 `dext-room/index.html`（2026-09-23）。
- [x] 用户按验收卡实测并明确回复通过（2026-09-23）；进入 master 合并与合并后回归。
- [x] 快进合入 master `23aa845`；合并前后用户 Room/背景/Widget 数据哈希一致，合并后 Vitest 57/57、Rust 43/43、Node 27/27、构建、Room Schema 与 Renderer Playwright 55/55 通过（2026-09-23）。
- [x] 当前轮摘要归档到 `TODO-archive.md`；UI-008 提升为唯一下一项。验收 worktree 因仍运行且含未提交桌面数据而保留，不强制清理。

## CORE-006 配置器 Core 启动与退出（2026-09-23）

> 目标：配置器连接状态旁提供“启动 Core / 退出 Core”，从配置器所属的 Dext 构建启动并验证 Core，正常退出后保留配置器。范围外：壁纸暂停按钮、自动重启、安装器重构、Room 和桌面交互改动。人工步骤见 `dev_docs/acceptance/CORE-006-core-runtime-control.md`。

- [x] 用户确认按钮控制 Core 而非壁纸；先于 UI-008 开工；退出旧 `desk-reorder-002` 的配置器及 Tauri/Vite 开发进程，Core/Player/Watchdog 原已停止。
- [x] 从 master `d7286b9` 创建独立 worktree 和 `feat/CORE-006-core-runtime-control` 分支。
- [x] 冻结设计、实现计划和独立验收卡；基线 Vitest 57/57、Rust 43 通过/3 忽略（2026-09-23）。
- [x] 后端测试先红后绿：受信任路径、单次启动、身份/就绪验证、正常退出及失败反馈；真实 Core/Player/Watchdog 两轮退出→启动成功（2026-09-23）。
- [x] 前端测试先红后绿：状态文案、动作可用性、启动/退出期间反馈及轮询刷新；缺失二进制实测发现启动入口被隐藏，调整探测顺序后恢复可重试（2026-09-23）。
- [x] 自动检查与真实进程循环通过：Vitest 62/62、Rust 48 通过/3 忽略、前端 build、cargo check 和 diff check；提交工作分支并停在待验收（2026-09-23）。
- [x] 用户于 2026-09-23 回复“验收通过 合并进去吧”，确认 CORE-006 通过并授权合并。
- [x] 实现 `b2dfc65` 快进合入 master；合并后 Vitest 62/62、Rust 48 通过/3 忽略、前端 build 和 cargo check 通过，用户 Room/壁纸未纳入提交（2026-09-23）。

## V3-CORE-001 Room/Desk 会话内核（2026-09-28）

> 目标：让 Dext Core 持有 v3 Room/Desk 的唯一权威状态，提供版本化快照与切页仲裁，拒绝旧会话/迟到结果，并从经校验的 Room 身份安全恢复。
> 范围外：不重写 WorkerW、v2 Room 运行链、Player/配置器 RPC、作品 Schema、个人绑定/权限、原生 Dock 与游戏宿主。它们在后续独立工作包接入，不由浏览器原型代替 Core。
> 人工验收：见 `dev_docs/acceptance/V3-CORE-001-room-session-kernel.md`；运行内核演示检查双视图、排队、失焦、超时、旧结果和恢复。

- [x] 按协作顺序读取文档及相关后端/Git 坑；用户明确更改目标为直接写内核，上一 P2a 草案 worktree 已归档而未触碰生产代码（2026-09-28）。
- [x] 从 master `e6e4109` 建独立 worktree 与 `feat/V3-CORE-001-room-session-kernel`，登记本包并保存所依据的 V3_PLAN 快照（2026-09-28）。
- [x] 动产品代码前冻结目标、范围外与验收卡；以真实 C# 内核行为做先失败后通过的回归（2026-09-28）。
- [x] 测试先行实现稳定 Room/Desk 身份、会话更换、单一过渡与最后一次等待输入；演示输出的修订号连续，旧会话 ID 被拒绝（2026-09-28）。
- [x] 测试先行实现动画完成、自动超时、失焦/恢复和迟到结果拒绝；两个订阅视图收敛到同一快照，Stop 清除恢复状态（2026-09-28）。
- [x] 仅持久化已提交 Desk 的格式化原子 checkpoint；恢复需匹配 Room/Desk 身份并生成新会话 ID，运行中不允许恢复覆盖现会话（2026-09-28）。
- [x] 新内核以独立单例注册并在真实 Dext Core 启动；启动日志可见 protocol=1；当前 v2 Player 仍按旧恢复路径运行，v3 不自动接管（2026-09-28）。
- [x] 内核 8/8、配置器 Vitest 62/62、完整 `scripts/build.ps1` → `scripts/start.ps1` 通过；身份脚本确认 Core/Player/配置器来自本 worktree，`git diff --check` 通过（2026-09-28）。
- [x] 仅暂存本包 12 个具名文件并提交实现 `5398679`；ROADMAP/验收卡转待验收，用户验收前不合并 master（2026-09-28）。
- [x] 待验收复核发现系统时钟回拨可让一次性超时回调提前触发后永久停在过渡态；新增先失败的回归并重新排程，内核 8/8、完整构建与重启、运行身份核对通过（2026-09-28）。
- [x] 用户于 2026-09-28 明确确认本包验收通过；此前 Dock/切页异常反馈已由用户撤回并确认实际正常，进入 master 合并与清理。
- [x] `a81788a` 快进合入 master；合并后内核回归 8/8、完整 `scripts/build.ps1`、master 运行身份核对通过；旧 worktree 已归档、已合并分支已删除，当前项归档摘要见 `TODO-archive.md`（2026-09-28）。

## V3-CORE-002 版本化会话协议与受控入口（2026-09-28，待用户复核）

> 目标：让 v3 Room 会话只能经版本匹配、来源授权及已安装 Room 身份校验的入口启动、恢复和接受视图命令；模拟桌面与 Dock 客户端可重连并收敛到 Core 快照。
> 范围外：本包不开放真实 Player/配置器 RPC，不定义 v3 作品 Schema 或安装内容签名，也不改变 v2 壁纸运行链；生产准入默认关闭，直到已校验安装链接入。
> 人工验收：见 `dev_docs/acceptance/V3-CORE-002-session-protocol.md`，运行模拟客户端演示验证版本、来源、安装身份、权限和断线恢复。

- [x] 从 master `6203ccb` 建立独立 managed worktree 和 `feat/V3-CORE-002-session-protocol`；用户已明确授权持续推进、不等待逐包人工验收且每大步提交。
- [x] 冻结本包目标、范围外与独立验收卡；设计以 D04/D05/D14、V3-CORE-001 内核和 ROADMAP P2/P3 门槛为依据。
- [x] 测试先行实现协议版本与可信来源/安装身份准入；生产默认拒绝，模拟客户端准入 4/4 通过（2026-09-28）。
- [x] 测试先行实现会话绑定的连接、角色权限、过期连接拒绝和完整快照重连；安装快照更换及绕过入口启动的会话先失败后修复，协议 14/14、内核 8/8（2026-09-28）。
- [x] 将关闭准入的入口注册到真实 Dext Core；协议演示 14/14、内核 8/8，最终 C# 改动后重跑 `scripts/build.ps1` → `scripts/start.ps1`，身份脚本全项 OK：Core PID 106640、Player PID 111488、配置器 PID 111228 均来自本 worktree；日志显示 protocol=1、gateway admission=closed（2026-09-28）。
- [x] 准入基础 `3c3c3da`、会话命令与绑定 `d8b884c` 已各自具名提交；角色缺口先红后绿并纳入最终运行提交，真实 Player/配置器传输与 P3 安装权威仍留后续独立包（2026-09-28）。

## V3-CORE-003 受控会话快照订阅（2026-09-29，待用户复核）

> 目标：让已授权桌面与 Dock 连接收到同一内核会话的完整修订快照，并在关闭、撤销安装或更换会话后停止旧订阅。范围外：真实传输/RPC、P3 安装校验、v2 播放链、启动/待机生命周期。人工步骤见 `dev_docs/acceptance/V3-CORE-003-session-observation.md`。

- [x] 从 V3-CORE-002 的 `f1764c5` 建立独立 managed worktree 和 `feat/V3-CORE-003-session-observation`；前置包仍待用户复核、未合并 master（2026-09-29）。
- [x] 动产品代码前登记目标、范围外、独立验收卡与实现步骤（2026-09-29）。
- [x] 先写失败回归：初始完整快照、按修订推送、错误 peer、关闭连接、撤销安装、更换会话和观察者异常；新增接口前编译失败，锁顺序与初始回调旧修订分别在 19/20、20/21 失败（2026-09-29）。
- [x] 实现绑定连接与安装身份的订阅生命周期；双视图演示修订序列均为 1,2,3，关闭旧桌面后其计数维持 3，Dock 继续到 5，更换会话后旧 Dock 维持 5；协议 21/21、内核 8/8（2026-09-29）。
- [x] 完整 `scripts/build.ps1` → `scripts/start.ps1`，身份脚本全项 OK：Core PID 88456、Player PID 107984、配置器 PID 110820 均来自本 worktree；日志显示 protocol=1 与 gateway admission=closed，v2 Player 继续运行既有 Room（2026-09-29）。
- [x] 计划 `45f97cb` 与订阅行为 `5e59fb1` 已按大步具名提交；自动验收与运行证据单独提交，后续真实传输与安装权威仍按独立包推进（2026-09-29）。

## V3-CORE-004 会话存储故障收敛（2026-09-29，开发中）

> 目标：checkpoint 读、写或清除失败时，v3 协议返回可识别的存储错误，不提交半途会话，也不撤销仍有效的旧视图订阅；存储恢复后可重试。范围外：更换 checkpoint 格式、自动备份/同步、P3 安装内容、真实 RPC 与 v2 播放链。人工步骤见 `dev_docs/acceptance/V3-CORE-004-storage-faults.md`。

- [x] 从 V3-CORE-003 的 `959af6e` 建立独立 managed worktree 与 `feat/V3-CORE-004-storage-faults`；前置包仍待用户复核、未合并 master（2026-09-29）。
- [x] 动产品代码前登记目标、范围外、独立验收卡和实现步骤（2026-09-29）。
- [x] 先写失败回归：Start、Restore、Complete、SetOperable、Stop 的存储故障状态与内核快照/订阅不变性；新增状态前编译失败，故障夹具另验证意外编程错误仍传播（2026-09-29）。
- [x] 预期 checkpoint IO/权限故障映射 `StorageUnavailable`，旧会话与订阅保留、存储恢复后重试成功；真实文件读取区分缺失/损坏与不可读，演示显示故障未提交 Desk、重试后双视图收敛；协议 27/27、内核 10/10（2026-09-29）。
- [x] `scripts/build.ps1` → `scripts/start.ps1` 通过，身份脚本全项 OK：Core PID 109820、Player PID 70460、配置器 PID 86232 均来自本 worktree；日志显示 protocol=1 与 gateway admission=closed，v2 Player 继续运行既有 Room（2026-09-29）。
- [x] 计划 `eba12cf` 和实现 `8c3e9d7` 已按大步具名提交；自动验收与真实运行证据单独提交。生产 v3 准入仍等 P2/P3 的真实宿主与安装校验（2026-09-29）。

## V3-P2A-001 连续场景宿主验证（2026-09-29，待人工验收）

> 目标：在真实桌面 Player 使用的页面里挂载一次持续 HTML 场景，切 Desk 不重建它；官方图标仍可点击/拖动，并用同一画布坐标描述作者占用区。
> 范围外：P3 正式作品格式、生产 v3 会话准入、Core 到 Player 的正式传输、顶层原生 Dock/AppBar。
> 人工验收：见 `dev_docs/acceptance/V3-P2A-001-continuous-scene-host.md`。

- [x] 从 V3-CORE-004 建立独立 managed worktree 与 `feat/V3-P2A-001-continuous-scene-host`；先登记计划和验收卡。
- [x] 实现仅用于 P2a 验证的持续场景挂载和 Desk 阶段通知，保持 iframe 与能力身份不变；该字段不纳入 v2 发布 Schema。
- [x] 用官方图标/作者占用区样例验证输入与坐标边界；图标拖放、偏好重排和 Widget 移动使用同一占用矩形。
- [x] Playwright 2/2、配置器 Vitest 62/62 与 build、Release WebView2 隔离 Player、旧 Room 原生拖动 10/10 通过；`scripts/build.ps1` 通过，Core/Player 运行身份正确。Rust `target` 按用户指示清理后，配置器未重建。
- [x] 真实 WorkerW 临时样包入口已编译，修改桌面仅在人工验收命令运行时发生并在结束时恢复；实现与回归具名提交 `14a612d`。
- [?] 真实 WorkerW 物理鼠标和不同系统 DPI：运行验收卡中的临时包命令，结束自动恢复原壁纸；用户通过前不合并 master。

## V3-CORE-005 Core/Player 会话消息接线（2026-09-29，开发中）

> 目标：在真实 Core 启动的受信 Player 标准输入/输出链上承载 v3 全量快照、Desk 请求和过渡完成消息，并让官方页面只在收到已授权会话快照后转向 Core 仲裁。范围外：P3 正式安装格式、开放生产会话准入、顶层原生 Dock/AppBar。人工步骤见 `dev_docs/acceptance/V3-CORE-005-player-bridge.md`。

- [x] 基于 V3-P2A-001 建立独立 worktree 与 `feat/V3-CORE-005-player-bridge`；P2a 尚未合入 master，用户表示“好像都没问题”，物理鼠标与 DPI 细节未被代填。
- [x] 动产品代码前登记本包目标、范围外和验收卡。
- [x] 增加版本化 Core↔Player 消息；v3 请求与完成消息有明确处理分支，不会落入旧启动应用兜底。
- [x] Gateway Player 适配器以 Core 拥有的进程 PID 构造 peer，订阅全量快照，退出时关闭连接；关闭/撤销/重连回归通过。
- [x] 官方页面收到授权快照后按修订收敛，Desk 操作发请求，过渡完成回告；旧 v2 自主切页测试仍通过。
- [x] 协议 29/29、Release Player 隔离原生 IPC 往返、旧 Room 原生拖动 10/10、`scripts/build.ps1`、JS 语法及 diff 检查通过。原生验证使用测试安装权威，不能冒充生产 P3 安装准入。
- [x] `scripts/start.ps1` 起初准确识别 P2a Core 占用；本轮平滑切换后，本分支 Core/Player/配置器绝对路径与 mutex/pipe 全项 OK（2026-09-30）。
- [x] 产品代码、测试和验收记录已按具名文件准备提交；用户人工验收前不合并 master。

### 2026-09-30 目标修正：真实接入与配置器恢复

> 用户明确要求先把内核真正接入运行链、修复配置器连接异常，由开发侧自行验证；不能以隔离 Player 测试代替真实 Core/Player/配置器联动。本节继续沿用 V3-CORE-005 分支与验收卡。

- [x] 复核现状：P2a Core/Player 仍占 Dext mutex；D 盘构建的配置器只有 24×24 空窗口，当前分支的 `AttachRoomSession` 没有生产调用方；此前 29/29 与隔离 Player 证据不足以证明接入。
- [x] 修复外置 `CARGO_TARGET_DIR` 的 worktree Core 定位与身份脚本；配置器从 24×24 空窗口恢复为正常窗口，界面显示“Dext Core 已连接”，三进程路径/pipe/mutex 全项 OK。
- [x] Core 在官方页面 ready 后校验本地 v3 会话清单和 v2 视觉 Room，绑定实际 Player PID 并 Start/Restore；桌面点击切页经 Player IPC → Gateway → Core 修订 → Player 完成消息。
- [x] 配置器可识别并应用仓库的最小 `v3-core-probe` 样包；临时拷入当前 Room 库的测试副本已在恢复 MSIroom 后移除。正式 v3 创作者格式和通用新建入口仍属于 P3。
- [x] 真实 Player 原生鼠标：`probe-a → probe-b`，修订 `1 → 3`；Core/Player/配置器重启后恢复 `probe-b`；应用 MSIroom 后 v3 状态 inactive、清单已撤销。协议 30/30、Rust 50/50（3 ignored）、完整 Core 构建/前端构建与隔离 Release Player 回归通过。
- [x] 具名提交 `2e2c290`；按用户要求开发侧完成验证，用户决定合入 master 前保持分支隔离。
- [x] 用户于 2026-09-30 回复“验收通过 git合并 名字就叫v3FirstTest”；合并提交 `24ac47c` 已入 master。合并后协议 30/30、完整 Core/Player 构建和三进程主 worktree 运行身份检查通过；重新应用 MSIroom 后 Player 页面指向 master。旧 worktree 已归档、工作分支已删除；详见 `TODO-archive.md`。依赖包的专项人工验收状态仍以各自验收卡为准。

## V3-P3-001 正式作品契约与安装校验（2026-10-02，开发中）

> 目标：原生v3 Room可校验、安装和复核全部内容，Core绑定真实Player。范围外：其他v3包按V3_DELIVERY顺序接入，不把最小样例冒充全链。人工验收见acceptance/V3-P3-001-room-contract.md。用户要求连续推进后集中验收，本包提交后继续依赖包，不中途等待。

- [x] 按顺序读取开发入口、路线、台账、错误；确认master=e67cd03且干净。
- [x] 创建独立worktree/工作分支，冻结16项完整基础版覆盖台账、计划与验收卡。
- [x] 正式version3/apiVersion1清单与稳定身份、资源路径/引用、便携动作/能力校验；独立Rust11/11、Schema两个原生样包及反例、JS语法和diff检查通过。配置必须是对象的回归先失败后通过（2026-10-02）。
- [x] 测试先行实现完整资源摘要、事务安装与篡改复核；Rust18/18通过，含真实Windows junction与锁定旧安装保留。掉电恢复/遗留备份协调留在发布收口，不声称本包已覆盖。
- [ ] Core独立复核并绑定真实Player，Rust接安装链，提交具名文件。
- [x] Core原生校验/安装入口及同分支启动已接，自动43/43与完整构建通过；真实配置器显示已连接。审查后的回归增至Rust25/Core46，通过范围见ledger。
- [x] 独立审查5项Important修正完成：资源读取、暂存写入和最终发布均保留已验证原生句柄；发布/暂存外写两项实际RED→GREEN。最新Rust28/28、Core46/46通过；未再次派发审查。
- [x] 安装基础代码提交并保留工作分支，继续绑定与授权依赖包；原生宿主集成验收仍保持未完成，不把基础代码标成全项就绪。
- [ ] 后续原生v3渲染器就绪后补真实三进程切页/恢复证据；集中验收前不合并master。

## V3-CORE-006 本机绑定与授权（2026-10-02，开发中）

> 目标：按钮/图标以稳定ID共用本机目标，Core核验安装、来源、权限和真实输入；个人路径不进入作品或公开状态。范围外：其他v3功能按完整台账顺序继续。独立人工步骤见acceptance/V3-CORE-006-binding-authority.md，最终集中验收前不合并。

- [x] 从P3已提交3a9e250建独立worktree/分支，动代码前保存计划、验收卡与ledger。
- [x] 有界原子个人存储、复制/删除与授权隔离，原生发布错误6/9→9/9，现有协议46/46通过。
- [x] 原生已验证按钮/消费者目录、版本会话动作权威、一次性输入票据、权限与公开状态；动作23/23、协议46/46、内核10/10。
- [x] 注册真实Core服务；实际Explorer代启参数丢失RED→GREEN，可见Dock暂停回归23/24→24/24。动作24/24、协议46/46、内核10/10及最新完整build→start/identity全项OK（2026-10-03）。
- [x] 一次全分支独立审查：0Critical/1Important/0Minor；授权派发竞态8项实际RED→GREEN，新增过期/观察者锁顺序回归，最终动作35/35、协议46/46、内核10/10、实际Explorer启动通过。修复后完整构建/启动门槛另记；保留未合并分支（2026-10-03）。
- [ ] 后续宿主/界面接入后补真实双入口、脚本拒绝、撤销、恢复和复制验收。

## V3-P5-001 原生持续桌面宿主（2026-10-03，开发中）

> 目标：原生v3直接进入Core/ReleasePlayer，持续实例、同步动画/几何与完整生命周期可独立验收。范围外及人工步骤见acceptance/V3-P5-001-native-runtime.md；用户授权连续推进后最终集中验收。

- [x] 基于CORE-006已审查修复0acaa3d创建独立managed worktree/分支，先写计划、ledger及独立验收卡。
- [x] Task1：共享模型14/14、作者SDK14/14先RED后GREEN；类型/JS/Schema与Rust28/28通过，连续样包已打包SDK，提交具名实现。原生边界仍Task2–4（2026-10-03）。
- [ ] Task2：Core/Player原生上下文/生命周期/资源/真实输入、媒体槽能力声明，跨语言/协议/动作与完整构建门槛。
- [ ] Task3：真实DOM宿主持续实例、同步默认/作者过渡、四类媒体、生产浏览器与ReleasePlayer安全验证。
- [ ] Task4：个人布局、版本化命中与占用、DPI/缩屏恢复、WorkerW真实闭环及一次独立审查。
- [ ] 集中人工确认前保持未合并；全16项按实际完整证据记就绪。

- [x] Task2阶段：Content媒体槽声明在Rust/Core/Schema同步校验，实际RED→GREEN31/31、51/51及Schema通过；完整Core/ReleasePlayer构建通过（2026-10-03）。
- [x] Task2媒体槽声明阶段运行门槛：用户授权退出旧绑定分支后，P5实际启动/identity通过；此前Core67720占用已解除。原生v3生命周期/slot/真实输入仍按Task2待办推进。

- 2026-10-03运行补证：用户明确授权退出；正常关闭绑定分支旧实例后，P5启动成功，Core104084/ReleasePlayer68604/Watchdog116972/配置器102068及mutex/pipe/data/log身份全OK。随后正常退出Core并停止本轮开发监听，进程与1620端口均已释放。此证据为已有v2恢复链，原生v3完整人工门槛仍待执行。
- [x] Task2阶段：同一已验证清单生成不可变RuntimeContext，私有Player连接读取时复核进程/安装/会话；协议63/63、动作35/35、输入探针编译、完整build→start/identity通过。尚未接到Player IPC/DOM。

- [ ] Task2下一步：生命周期及全局revision、安装动画watchdog、stage-aware媒体消费者与196授权配额；把完整上下文/快照接入原生IPC，再接资源与物理输入边界。

- [x] Task2生命周期/快照阶段：内核stage/paused/locked与双revision原子更新，foreground不得绕过锁屏；可信安装给watchdog/checkpoint戳；Core专属状态入口与生产Player快照投影接通。内核17/17、协议65/65、动作35/35；真实ReleasePlayer字段丢失RED→GREEN。

- [x] C#/proto完整build、Rust cargo check、配置器build、start/identity全项OK；真实gRPC确认当前v2为inactive。验证后正常退出，进程与1620端口归零（2026-10-03）。
- [ ] 下一步仍属Task2：Windows前台/暂停/锁屏/闲置真实事件接协调者、启动完成仲裁；stage-aware媒体消费者/196授权配额；RuntimeContext原生IPC、资源清单与物理输入边界。完整v3原生桌面未交付。

- [x] Task2媒体权限阶段：从验证清单建立独立slot消费者；按stage/Desk判断活动，锁屏/暂停/前台拒绝实际消费和激活；Dock桌面暂停例外不跨锁屏；个人196消费者和80字符Desk后缀；阶段/前台/私有等待使旧输入失效。

- [x] 媒体权限实际RED36/44→GREEN44/44；内核17/17、协议65/65、完整build与同分支start/identity成功。验证后Core、Player、Watchdog、配置器和1620监听全部为0（2026-10-03）。
- [ ] Task2继续：Windows完整事实原子接入并在初次Player订阅前同步；启动/闲置控制、上下文IPC、资源边界与物理输入仍待完成。

- [x] Task2 Windows事实：独立记录实际各显示器暂停/锁屏/前台，首个Start/Restore快照即包含完整事实；原子更新避免解锁使用旧前台，失败可重复采样重试。

- [x] Windows事实接口初始缺失CS0246→协议72/72；内核17/17、动作44/44、完整build→start/identity通过。正常退出后Dext进程/1620监听0。真实锁屏/闲置、原生v3页面首帧、物理输入仍按7步最终验收待执行（2026-10-03）。
- [ ] Task2继续：上下文/撤销IPC、实际资源清单读取边界与物理输入；start完成/idle同Player及暂停恢复最后快照仍待完成。

- [x] Task2上下文传输：已验证context先于首个snapshot；显式撤销覆盖Stop/换会话/失效/Detach，按Player递增代次拒绝迟到消息，生产Json.NET到ReleasePlayer实测并重放暂停期间最后状态。

- [x] 上下文传输实际验证：协议80/80、消息19/19、内核17/17、动作44/44；ReleasePlayer五组原生IPC及旧完整快照探针通过。中文stdout乱码、重复异步恢复丢重放、非对象Desk拒绝三项实际失败后修复。
- [x] 完整build→start/identity通过，Core123128/Player71384/Watchdog116472/配置器76656；v3-status=inactive符合恢复原有v2。正常退出后进程/1620监听均0。启动时一次WorkerW层级日志有现有纠正调用，最终物理层级仍留Task4验证。
- [ ] Task2继续：首航前隔离v3资源服务，同句柄验证后提供清单内字节与Range；物理输入、start完成和同Player闲置仍未接通。

- [x] Task2资源服务阶段：独立native首航、官方白名单、代次资源清单、句柄校验与不可变临时缓存；31/31边界检查、真实ReleasePlayer媒体/Range/撤销/重载及策略拒绝启动通过（2026-10-03）。

- [x] 完整build→start/identity通过，Core31152/Player81948/Watchdog89212/配置器2860；现有v2恢复为inactive。Core正常shutdown，开发监听停止，最终Dext进程/1620监听/资源临时缓存均0。
- [ ] 资源阶段限制：WebView2 153在禁RTC策略下重复初始化RTC会触发mDNS binder杀renderer（#150）；官方能力自检按WebView实例一次已避开本次重载路径，作者恶意重复构造的稳定恢复仍属Task4安全门槛。不得把当前证据写成全网络/全恶意内容验收完成。
- [ ] Task2继续：物理输入与当前几何绑定、start完成仲裁、同Player闲置展示；再做Task3生产DOM和Task4个人布局/真实DPI/安全恢复，集中验收前不合并。

- [x] Task2原生输入接线阶段：每attachment的不可变几何、Down-Up/Tab/Enter/Space和一次消费已接实际RawInput与私有动作桥；几何/代次/快照/窗口/DPI改变撤销旧证明，导航通知Core失效。动作62/62、消息25/25、运行消息20/20、协议80/80、内核17/17及隐藏Win32窗口5组通过；隔离ReleasePlayer原生输入IPC4组通过（显式scale1.5、实际DPI120）。最终真实物理/DPI验收未代填。

- [x] 原生输入阶段完整build→start/identity通过：Core69160/Player80360/Watchdog95932/配置器124352，日志20261003_045140.txt；当前v2恢复为inactive。已正常退出Core，停止本轮开发监听，Dext进程及1620/1621监听0。
- [ ] Task2继续：启动完成仲裁和同Player闲置；Task3生产宿主还须落实invalidate→ack→布局→publish→ack的几何协议，随后Task4个人布局/物理输入/DPI/安全故障恢复与包末审查。完整16项准备度仍1/16，最终集中验收前不合并。

- [x] Task2启动仲裁：Core提供当前starting阶段一次性完成和可信新文档重启；保留暂停/锁屏/前台、已提交Desk与最终队列，旧阶段完成不得结束重载后的start。Player私有消息包含当前代次/全局修订/生命周期修订，ready按真实文档去重。之后接同Player闲置及生产DOM的媒体完成/超时。

- [x] 启动仲裁验证：内核21/21、协议83/83、输入消息26/26、动作62/62、运行消息20/20；实际ReleasePlayer五组通过（完成消息、同文档ready去重、重载新ready等）。完整build→start/identity通过：Core102804/Player41456/Watchdog115704/配置器73840，日志20261003_051414.txt；当前v2恢复inactive。正常退出后Dext进程与1620/1621监听0。
- [ ] Task2继续同Player闲置展示与宿主唤醒；Task3实现生产媒体完成/超时与DOM，Task4补物理输入/DPI/安全恢复。16项就绪仍1/16，最终集中验收前不合并。

- [x] Task2同Player闲置：可信宿主仅切stage并保留Windows事实；原Player临时脱离WorkerW展示idle，唤醒还原父窗/样式/坐标且第一次输入不转发。播放策略保留手动暂停/锁屏/电源规则；还原失败隐藏并关闭本Player。先验证实际原生窗口与权限边界，再完整build/start，生产DOM和最终物理验收后补。

- [x] 同Player闲置阶段验证：内核22/22、协议86/86、动作65/65；真实Win32三组通过。实际ReleasePlayer同HWND/PID的child/popup两分支往返、DPI120、原有五组原生输入/启动/导航验证通过。完整build→start/identity全OK：Core72912/Player63172/Watchdog39464/配置器93232，日志20261003_060229.txt；v2恢复inactive。正常退出后Dext进程、1620/1621监听、资源缓存均0。
- [ ] Task2/3继续：原生v3生产DOM、start/idle媒体与完成/超时，消费者级数据/动作、几何失效握手；Task4实际Core原生Room闲置/物理输入/DPI/布局/故障恢复与一次完整审查。7项集中人工验收不变，16项就绪仍1/16。

- [x] Task2/3授权查询接线（2026-10-03）：先写生产权限/原生严格消息失败回归，Core按当前安装、消费者、阶段和个人授权原子返回声明能力状态；宿主不以清单声明当成授权。完整原生DOM与最终7项验收继续保留。

- [x] 消费者能力元数据验证：动作77/77、原生输入消息27/27、内核22/22、协议86/86；完整Core/ReleasePlayer构建通过。实际ReleasePlayer新增能力查询/原生回包和伪声明/旧修订拒绝通过，原有同HWND闲置两分支及五组输入/启动/重载边界保持通过。
- [x] 同分支start/identity全OK：Core123928/Player79032/Watchdog73352/配置器19264，日志20261003_063928.txt；恢复已有v2为inactive。正常退出Core与配置器，开发监听已停；生产DOM/逐次数据授权/几何握手及最终7项仍待继续，16项就绪仍1/16。

- [x] Task3媒体宿主模块：按冻结D11时序测试先行，实现image/GIF/video/HTML槽的持续节点、暂停计时、结束/停滞降级和idle持续；HTML执行委托iframe宿主，完成只通知当前Core阶段。

- [x] Task3媒体模块验证：生产共享模型/SDK/媒体合计40/40（14+14+12）；实际ReleasePlayer加载同一media-host.js，GIF500ms、3sMP4 ended、HTML done一次、同WebM节点暂停后继续前进/静音循环和idle HTML done拒绝通过。原生资源/撤销/重载四组保持通过；完成回调和阶段在该夹具中是模拟Core，生产DOM/iframe/Core联动未据此完成。
- [x] 最新完整build→start/identity通过：Core54504/Player60004/Watchdog89832/配置器98692，日志20261003_070458.txt；已有v2恢复inactive。验证后正常退出Core/配置器并停止开发监听。
- [ ] Task3继续：官方index/main/style/LivelyInfo、逐实例iframe/SDK路由、Core逐次数据/动作、默认/作者过渡与几何握手；原生挂起消息的媒体计时暂停及生产Core启动/闲置仍要实际整体验证。Task4/最终7项和16项全景保持未完成。

- [x] Task3 iframe模块：先分离渲染活动与输入operable（Core正常切页仍允许排队，失焦关闭输入不等于播放暂停）；然后生产frame-host以固定WindowProxy/会话/文档token路由SDK、原子Core能力状态、持续节点/订阅和有界请求。原生逐iframe媒体控制及最终页面/Core联动仍须接上实测。

- [x] iframe模块验证（2026-10-03）：模型15/SDK14/媒体12/iframe13=54/54；真实ReleasePlayer运行生产frame-host与完整SDK，固定WindowProxy、能力状态、读数单独拒绝、单订阅暂停恢复、当前消费者动作路由、沙箱直接原生拒绝、重载新token/旧token拒绝通过。能力/数据/激活回复仍由隔离夹具模拟Core；不计实际物理动作或生产Core完整接线。
- [ ] 原生iframe媒体控制、Player挂起前计时暂停、官方页面/DOM与Core逐次数据/动作、几何握手仍继续；Task4与最终7项人工验收未完成。

- [x] iframe阶段完整build→start/identity成功：Core65052/Player8564/Watchdog50436/配置器59448，日志20261003_080601.txt；实际恢复已有v2，v3-status inactive。用户明确允许退出后核对PID/绝对路径正常关闭Core和配置器，自己的watcher结束；Dext进程、1620/1621监听、资源缓存均0。

- [x] Task3原生暂停计时模块：先建立生产media/frame/playback失败回归，在Player暂停前同步通知官方页，停止媒体期限/订阅；恢复时同步投递最后Core状态后释放播放。保留同文档实例与Core权威，不以夹具代填完整生产页面或物理验收。

- [x] 原生暂停回归：模型15/SDK14/媒体14/iframe14/播放桥5=62/62；原生资源31/31、运行消息20/20。真实ReleasePlayer曾在暂停期间按旧revision完成500ms启动，接入同步播放桥后保持剩余活动计时，恢复先投递最后snapshot revision3，iframe新来源也带revision3。旧暂停缓存/撤销/重载/未知命令五组IPC回归通过；能力/数据/完成回复仍是夹具模拟Core。
- [ ] 剩余生产页面/DOM、逐次Core数据与动作、原生逐iframe音视频政策、几何握手、Task4实际Core原生Room和最终7项验收继续；暂停模块实测不代表完整页面已安装。

- [x] 暂停阶段最终完整build→start/identity通过：Core91052/Player70888/Watchdog83660/配置器78452，日志20261003_082904.txt；真实状态inactive符合已有v2恢复。正常退出Core/配置器、自己的开发watcher结束，Dext进程/1620/1621监听/资源缓存0。最终7项验收仍保留，不合并。

- [x] Task3 Core消费者数据基础桥：真实授权前后双检查，中间采集在所有授权锁外；严格原生data请求固定consumer/capability/当前revision，数据只保留32KiB/深度24的JSON快照与状态，撤权/换修订/阶段/代次后无旧结果。接入time/hardware/media/audio实际来源，SDK订阅逐值重新授权；独立源码测试和真实ReleasePlayer IPC验证后提交，生产页面/Task4和最终7项不缩减。

- [x] Core数据基础桥验证（2026-10-03）：动作/来源98/98、严格原生消息28/28、内核22/22、协议86/86；实际Windows只读采集时间/硬件/音量通过，当前无媒体会话返回missing。真实ReleasePlayer通过SDK→私有data IPC读数与暂停恢复；该隔离夹具Core回复仍模拟。完整build→start/identity通过：Core60236/Player22844/Watchdog64436，配置器74088为本轮共享D缓存构建；日志20261003_091411.txt，v2恢复inactive。按PID/绝对路径正常退出后Dext进程/1620/1621监听/资源缓存0。
- [ ] Task3继续正式index/main/style/LivelyInfo与DOM：生产逐值轮询、授权变化恢复、持续组件/默认与作者过渡、当前几何握手、原生逐iframe媒体。当前数据源基础桥不代表原生Room已安装；Task4、7项集中验收、16项范围保持。

- [x] Task3正式原生通信模块：先建立请求作用域/超时/迟到回包、单来源逐值轮询、暂停/销毁取消、同修订撤权和再授权恢复的失败回归；生产native-host只向固定WebView传输发严格请求，Core每值授权，不凭缓存能力放行。接生产frame/media后再补正式DOM及真实Core闭环，7项/16项范围不缩减。

- [x] 正式原生通信模块验证：新10/10、生产组合72/72、资源31/31；实际ReleasePlayer加载native-host/frame/SDK，持续每值私有data IPC，同revision撤权仅隐藏读数、再授权无需重载恢复，原生暂停剩余500ms与最后revision3仍通过。对象传输实际失败后改JSON字符串；夹具Core回包仍模拟，不计生产Core原生Room通过。完整build→start/identity成功：Core104252/Player80696/Watchdog62484/config22424（本轮共享D缓存），日志20261003_093108.txt；v2恢复inactive，正常退出后全部验证进程/端口/资源缓存0。
- [ ] 下一步正式index/main/style/LivelyInfo及dom-host/input-host：把已验证模块接真正官方页面，持续实例、默认/作者动画与Core提交、每revision几何失效握手；原生逐iframe媒体/布局/Task4和最终7项仍继续。

- [x] Task3正式DOM入口基础：测试先行，建立index/main/style/LivelyInfo与dom-host；只接受当前Core上下文/快照，先invalidate回执再更新DOM、发布当前几何后启用动作；持续frame/media节点不重挂，queue修订重新发布输入但不重播动画，启动/闲置沿用已验证模块。原生逐iframe媒体政策、个人布局/移动中命中与完整真实Core/Task4门槛仍须随后完成。

- [x] 正式入口基础验证（2026-10-03）：DOM12/Main7/既有72，组合91/91；同一正式index/main/style/runtime/dom/native/frame/media/SDK在真实ReleasePlayer通过当前几何回执、持续读数、两个SDK文档保持、Core提交前不改变current、queue不重播、原生暂停/最后revision6、撤销释放。Core能力/数据/状态/提交仍由该隔离夹具模拟，不是实际Core已安装Room或物理输入。
- [x] 正式入口阶段完整build→start/identity成功：Core105132/Player86420/Watchdog24704/config46308（本轮共享D缓存），日志20261003_100228.txt；原v2恢复inactive。按PID/路径正常退出，最终进程/开发端口/资源缓存0；最新有界几何重试后真实整页回归再次通过。最终7项不申请中途验收。
- [ ] 必须继续完整Task3/4：实际Core原生Room安装/恢复、四媒体完整生命周期、原生逐iframe音视频暂停，消费者导航/控制/存储与退出确认适配，个人布局/占用/真实DPI/物理输入与故障恢复。当前默认动画只给静止shared按钮发布命中；移动按钮与旋转/斜切输入、遮挡裁剪、多图标同按钮及受控焦点仍须input-host完善，不能把目前保守拒绝当作已满足D16。16项就绪仍1/16。

- [x] Task3原生逐iframe音视频基础：先验证首航前捕获原始媒体方法、默认暂停、宿主私有secret/文档nonce/单调序列、暂停保留播放意图、旧文档/伪请求拒绝和closed Shadow DOM；再嵌入Player，在实际Frame对象上绑定当前消费者/代次及Core渲染事实，暂停屏障先停止所有子文档，恢复只释放当前活动帧。作者SDK token不代表播放策略权限，网络和数据授权保持独立；实际ReleasePlayer与整页回归后提交。

- [x] 原生音视频基础证据：102/102 JS、严格媒体/输入28/运行20/资源31，实际ReleasePlayer WAV/closed Shadow MP4/嵌套音频、默认暂停/意图保留/作者方法覆盖和伪请求拒绝、phase/私有挂起最新状态/根更名/撤销通过；Core回包仍fixture。修复原生Destroyed COM重入崩溃及异步report修订竞态，完整build→start/identity通过（Core50684/Player57196/Watchdog76868/config122420），原v2 inactive、精确正常退出。
- [ ] 继续完整Task3/4：WebAudio/AudioContext与更完整HTML音频生命周期、实际Core安装原生Room/保存并恢复用户桌面、消费者导航/控制/存储及退出确认、个人布局/移动中精确命中/遮挡/焦点、真实DPI/物理输入/故障恢复。最终7项和全景16项保持，不将本基础提交记为P5完成。

- 最终销毁路径补强：缓存FrameId移除幂等、政策失败先静音再通过UI队列退出原生事件栈、processFailed撤销其余媒体。最新完整build与实际整页媒体回归再通过；最终start/identity Core106108/Player87720/Watchdog75280/config119552（本轮共享D缓存），日志20261003_111305.txt；原v2 inactive，随后按PID/路径正常退出。


- [x] Task4真实Core原生Room闭环起步：现有v3-live只检验旧v2 overlay，不作原生证据。新增生产Rust安装CLI与隔离正式宿主探针，先保存WallpaperLayout/checkpoint与原Room哈希，启动精确分支Core并核验身份；临时原生source→生产install→Core复核→实际WorkerW/SDK/宿主状态，可信官方顶部测试导航只计协议回归，绝不代填物理输入。finally重铺原壁纸、正常退出Core后精确恢复布局/checkpoint并复核；任何恢复失败保留可恢复目录并报告。观察使用临时官方页title，不向生产Core发送saveRoom测试消息；原官方脚本/用户Room不改。全部7项/16项仍保留，完成此阶段后继续完整Task3/4。

- [x] 首次实际Core原生证据：生产Rust安装→真实Core复核→GIF start→实际SDK/几何→可信顶部导航→Core home→focus revision2→4，Player63652与两份场景/共享Widget文档UUID保持，实际父窗WorkerW/Progman；正常重铺原壁纸并退出Core后，布局/设置/checkpoint逐字节与用户Room哈希恢复。该导航是协议回归，不是物理输入；当前证据写native-core-live-evidence。
- [x] 实际宿主诊断修正：Core修订改变取消旧capabilities查询，frame-host旧失败回调却无作用域检查写permissionsUnavailable；先建立旧revision与disposed失败回归，再修当前查询保护，实际Core再验证。

- [x] 实际Core诊断双修复：旧查询/销毁后失败回调先核对当前scope；新快照必须先推进native identity再更新iframe。生产原生桥RED确实返回staleInput，修正后完整JS105/105。真实Core再次验证Player115676、session7d2d80d9、home revision2→focus revision4，两份SDK文档保持、frameError/error均null，MP4实际ready4/time0.576/静音循环播放。生产Rust安装/真实Core复核/WorkerW父窗均通过；该顶部测试导航仍只计协议回归。
- [x] 本阶段完整build→start/identity通过：Core52976/Player90320/Watchdog95676，配置器54796为本轮共享D缓存构建（identity脚本显示OTHER，绝对路径已核对），日志20261003_115323.txt；原v2恢复inactive。真实探针保存并精确恢复布局/设置/checkpoint和用户Room哈希；正常退出Core/配置器及本轮watcher后，Dext进程/1620/1621监听/资源暂存/临时原生Room目录均0。
- [ ] 完整Task3/4继续：WebAudio/AudioContext、四媒体完整生命周期/实际idle与重启、作者导航/控制/存储/退出确认、个人布局/占用/移动与非矩形精确命中/焦点、实际物理输入/DPI/故障恢复。最终7项不申请中途验收，16项开发就绪仍1/16。

- [x] Task4真实Core重启恢复门槛：在c14214f的临时生产安装副本上先由Core提交focus，再正常关闭/重新启动精确Core；不重新安装、不手动请求focus，验证新会话/新Player仍恢复已提交Desk、同安装摘要和两份新SDK文档，GIF start只在新文档播放。finally继续恢复原壁纸和布局/设置/checkpoint。此项只补重启门槛，不代填物理输入/DPI/idle组合或完整P5完成。WebAudio设计需即时输出闸门与异步suspend完成屏障，按实际Runtime验证后实施。

- [x] 同安装副本实际Core正常重启通过：Player83528/session9333ca54先提交focus revision4；正常退出后新Player102184/session540fdca3自动恢复focus revision2，安装stamp不变、测试nav=0，两份SDK文档为新文档。真实GIF starting→desktop观察分别559ms/558ms且各仅一次，MP4恢复ready4/播放time0.253。finally原壁纸、布局/设置/checkpoint与用户Room哈希恢复，临时目录清除。
- [x] 本阶段build→start/identity完成：Core67896/Player69960/Watchdog8564/config115068（本轮共享D缓存，identity显示OTHER并核对精确路径），日志20261003_121155.txt；原v2 inactive。核对PID/路径正常退出及结束本轮watcher后，Dext进程/1620/1621监听/资源暂存/临时原生目录均0。完整P5/最终7项/全景16项仍继续，开发就绪1/16。

- [x] Task3 WebAudio门槛（BASE3c01bd9）：首航前捕获AudioContext构造/原型、AudioNode连线及原生状态；内部Gain输出闸门不向作者泄露，默认/阶段/暂停/销毁即时静音并保留作者resume/suspend意图。异步挂起回执须等上下文真正suspended/closed，原生Player有界轮询后才挂起renderer；迟到resume不能恢复已关闭输出。先行为RED，再真实ReleasePlayer根/嵌套AudioContext、实际currentTime暂停/恢复与方法覆盖/伪token回归，完整build→start/identity和正常退出后具名提交。其他Task3/4、最终7项和16项范围保持。

- [x] WebAudio实际RED→GREEN：生产JS组合116/116（原95+原生媒体21）；AudioContext私有Gain闸门/原生异步suspend回执、作者暂停意图、迟到resume拒绝、根/嵌套文档销毁均接入。额外行为失败复现并修复：外域上下文/硬件destination借用、Array继承索引setter与species泄露私有记录、Object.toJSON拦截/伪造暂停回执（ERRORS #180–#182）。
- [x] 实际ReleasePlayer最新整页回归：两根/嵌套AudioContext真实currentTime运行；挂起1.1s后活动时间0.717s，暂停时间未计入时钟；作者实例方法覆盖、作者suspend意图、阶段/私有暂停/最新状态/根更名/撤销通过。实际Array攻击未获私有记录、Object.toJSON拦截次数0；blank-child借用由实际沙箱SecurityError拒绝，新增原生品牌守卫另由生产JS行为测试验证。该夹具Core回包仍模拟。
- [x] 实际Core WebAudio安装/重启补证：生产安装同副本，Player68788/home→focus revision4后正常Core重启，新Player95068/新session自动恢复focus revision2、安装stamp不变、测试nav=0；两份新SDK文档中AudioContext均running且time>0.05，GIF start各一次554ms/561ms、视频实际解码恢复。首次探针过早读取旧音频观察值失败，改为等待真实作者状态报告后通过（#175追加）；不倒填首次失败为通过。finally原桌面/布局/设置/checkpoint逐字节及用户Room哈希恢复。该实际Core证据早于最后null-prototype回执补强，补强后完整build与实际ReleasePlayer再次通过。
- [x] 最新完整build→start/identity通过：Core113124/Player109424/Watchdog27212/config65792（本轮共享D缓存，identity显示OTHER并核对精确路径），日志20261003_131909.txt；原v2 inactive。用户已授权正常退出，核对PID/绝对路径关闭Core和配置器，本轮watcher结束；Dext进程/1620与1621监听/资源暂存/临时原生目录均0。
- [ ] 完整Task3/4继续：作者导航/控制/存储/退出确认，完整四媒体idle/锁屏组合、独立Player故障重建，个人布局/占用/移动与非矩形精确命中/遮挡/多图标/焦点、实际物理输入/DPI。WebAudio本基础不代填AudioWorklet或完整恶意内容验证；最终7项保持待执行，16项开发就绪仍1/16，不合并master。

- [x] Task3消费者本机存储权威基础（BASEf158bdb）：按Room副本与稳定consumer隔离JSON KV，逐次核验当前连接/安装/session/revision/活动阶段及storage.read/write个人授权；缺键get返回null，每值32KiB/深度24、每消费者128键/64KiB及全局1MiB约束，失败保留原字节。原子准备不等待gateway锁，个人状态发布前不暴露成功；先真实源码RED→GREEN、完整build→start/identity/正常退出后提交。原生IPC/SDK适配随后接通，最终7项不变。导航因原生自动激活与作者请求需合并为同一次受控输入，随input-host完成，未借可信顶部接口放行。

- [x] 消费者存储Core基础验证：生产接口缺失RED→110/110 GREEN（原98+12），读写授权分离、消费者/副本隔离、撤权/旧安装/旧修订/关闭拒绝、暂停/锁屏/前台拒绝、null/持久重读、旧format1兼容、配额和发布失败原字节保留通过。4097项小数组实际Accepted/Denied失败后补递归容器限制（#183）；已关闭私有Player连接不再读写。
- [x] 本基础最新完整build→start/identity：Core73456/Player112196/Watchdog93060/config51788（本轮共享D缓存，identity OTHER并核对精确路径），日志20261003_135827.txt；原v2 inactive。正常精确PID/路径退出Core和配置器、自己的watcher结束，用户个人快照哈希/不存在状态未变。
- [ ] 下一步接storageGet/storageSet严格原生消息、Player→Core适配与正式DOM/SDK，按固定消费者和当前scope传输有界JSON并实际ReleasePlayer验证；Core基础未代填已授权作者KV的实际Core端到端。作者导航/系统控制/退出确认、完整idle/锁屏/Player故障、个人布局与精确输入/物理DPI仍继续，最终7项与16项保持。

- [x] Task3消费者存储原生接线（BASE8d929cb）：新增严格storageGet/storageSet消息，固定consumer/key与有界JSON值；Core私有连接逐次检查当前修订/安装/个人授权，官方DOM仅转发所属消费者，SDKget/set保持JSON/null语义。先原生消息与生产JS行为RED→GREEN，再同一正式页面实际ReleasePlayer及真实Core生产安装/当前授权KV/同副本重启持久读取。实机探针仅给新临时Room测试授权，保存个人快照原字节/不存在状态并finally恢复原桌面与全部备份；授权UI与物理输入/其他Task3/4仍继续。完整build→start/identity、正常退出、具名提交，最终7项和16项不减。

- [x] 存储接线阶段验证：严格storageGet/storageSet与正式DOM/SDK通过，生产JS121/121、原生消息30/30、存储/动作110/110。真实Core初次被用户grid覆盖规则正常暂停；只设桌面前台不足以解除最大化可见窗口的覆盖，临时前台算法并finally恢复原设置后，确实复现缺少Core处理导致的denied，再实现有界异步私有适配。
- [x] 真实生产安装/授权KV端到端：Player46128同文档home→focus revision4，两消费者同key隔离、中文/ISO字符串、实时撤权拒绝/恢复读取、日志不包含KV值通过；正常Core重启后新Player48720/session自动focus revision2，同stamp、新SDK文档读取原值且未覆盖。fixture管理员仅准备新临时Room消费者的测试授权，权限UI未据此完成；所有Core回包/安装复核/Windows事实均真实。
- [x] 实际日志隐私RED→GREEN：原Core通用IPC日志含ValueJson，marker检查失败；原生请求改为只记method/generation/revision，真实Core再次通过（#184）。夹具读取运行中的NLog须FileShare.ReadWrite（#186），首次原始字符串语法错误不计行为RED（#173追加）。finally原桌面、布局/设置/checkpoint/personal逐字节或不存在状态与用户Room哈希恢复。
- [x] 最新完整build→start/identity：Core80748/Player113524/Watchdog111664/config88192（本轮共享D缓存，identity显示OTHER并核对路径），日志20261003_144755.txt；原v2 inactive。按用户授权精确PID/路径正常退出，自己的watcher自然结束；Dext进程/1620与1621监听/资源暂存/临时原生目录0，个人快照哈希/不存在状态未变。
- [ ] Task3/4下一步：将原生输入证明与作者desk.navigate/系统控制合并为同一次受控动作，补退出确认；继续完整四媒体idle/锁屏组合、独立Player故障重建、个人布局/占用/移动与非矩形精确命中/遮挡/多图标/焦点、实际物理输入/DPI。最终7项人工步骤不申请中途验收，完整16项开发就绪仍1/16，不合并master。

- [x] Task3作者导航Core适配（BASEdcb8c3d，已由5896f14接通）：从当前原生完成证明取得所属consumer/button，作者仅请求有界desk.next/previous/go，逐次核对用户覆盖后的实际动作，复用当前授权/一次消费/锁外Core仲裁；请求不能改成另一个动作或覆盖个人绑定。先源码行为RED→GREEN，再接输入宿主统一一次性派发及严格消息/正式SDK/真实Core。默认入口与作者请求竞态未解决前不标整个导航接线完成；系统控制、退出确认与其余Task3/4保持。

- [x] 导航Core适配第一组：缺失NavigateNative的源码RED→125/125；三个导航变体、无输入/错consumer、默认动作不匹配、个人应用覆盖、撤权/过期/几何/代次/关闭/暂停/锁屏/失焦通过。完整build和启动身份核验通过，Core创建时间晚于新DLL写入；原v2 inactive，已正常退出。
- [x] 补无默认动作的动态按钮：已声明入口在真实输入和desk.navigate授权下可由作者选择合法目标；已有默认/个人动作必须匹配。仅TargetId的个人绑定在无作者默认动作时应解析为binding.launch，不能被作者导航越过。先行为失败，再同边界修复；完整原生SDK派发仍后续接通。

- [x] 导航Core适配最终128/128（原110+18）：三个变体、current/target分离、匹配默认或个人动作、无动作入口动态go、TargetId-only个人应用绑定、错consumer/无输入/撤权/过期/几何/代次/关闭/暂停/锁屏/失焦均验证。动态入口三项125/128实际失败后修复；未知Desk拒绝不消费原生证明，默认/个人动作不匹配同样保留正常fallback。
- [x] 最终完整build→start/identity：Core113280/Player67436/Watchdog4976/config25560（本轮共享D缓存，identity显示OTHER并核对路径），日志20261003_152025.txt；原v2 inactive。正常精确PID/路径退出Core/配置器，自己的watcher终止，用户个人快照哈希/不存在状态未变。
- [x] 导航生产者历史接线待办已由5896f14完成：严格原生navigate、默认/SDK统一派发及真实Core作者导航通过。系统控制/退出确认、完整生命周期/个人布局/精确输入和最终7项见本台账后续未完成项；readiness1/16。


- [x] Task3导航/输入统一派发（BASEac4b0d1，2026-10-03）：目标是严格原生navigate路由与同一次Core输入的作者请求/默认回退，保留个人绑定优先。先写真实生产行为失败回归；Core完成序号、消费回执、viewport复核；官方DOM固定consumer、仅状态公开、有限回退和失效取消；128项基础上验证并完整构建/真实Player与Core验证。范围外仍按本包总计划，最终7项不缩减、不提前验收或合并。

- [x] 严格navigate/私有输入完成序号与消费回执：JS真实RED27/36后36/36；新增同文档修订回执实际RED15/16后修复。最终生产JS132/132（111宿主/SDK+21原生媒体策略）、Core动作132/132、严格原生消息32/32。默认回退100ms，SDK在途时等待，Core仍从实际DOWN计算1500ms期限；旧序号不能消费同按钮的新输入。
- [x] 实际ReleasePlayer输入/窗口/重载五组保持通过。实际Core原生安装/作者SDK/Windows鼠标注入：无输入timer均inputRequired；scene请求next返回accepted；同一Core证明只消费一次，未用顶层导航驱动，共享文档保持。Core正常重启同安装恢复focus/KV和新SDK文档；最终11项PASS。
- [x] 探针纠正：operable不在运行诊断对象里，改读真实Core；System.Type与Protobuf.Type冲突先修编译，不计生产RED。WindowFromPoint实见ChatGPT PID42576覆盖测试像素107,56，第二轮暂停是正确拒绝；临时Shell显示桌面、验证真实桌面落点，finally Undo核对全部原窗口最小化/最大化状态并恢复鼠标。重启初期前台实为GameViewer工具窗，待原生初始化后重新聚焦桌面一次，全门槛通过，不改生产暂停策略。
- [x] 完整build→start/身份：Core22860/Player88968/Watchdog74480/config114160，日志20261003_162208.txt，原v2 inactive。配置器为所属D共享缓存，身份脚本OTHER/exit1，绝对路径独立核对；不写成脚本全OK。按PID/路径正常退出，个人SHA256/原不存在状态不变，watcher终止exit0。
- [ ] Task3继续：可信Dext退出确认（媒体/音量基础已在本台账后续接通）；Task4四媒体生命周期/移动与遮挡的精确输入、个人布局/故障恢复、最后一次完整P5审查。仍按原16项全景与7项人工门槛，readiness1/16，不中途合并。

- 2026-10-03最终清理核对：DextProcesses=0、DevListeners=0、ResourceCacheFiles=0、NativeFixtureDirectories=0；全部工具会话已终止。


- [x] Task3系统控制接线（BASE5896f14，2026-10-03）：一句目标是SDK封闭媒体动作和Windows默认主音量经当前消费者/声明入口的真实一次输入、授权和限频派发。个人默认/绑定存在时拒绝作者替换并保留默认回退；Core准备在私有锁内，Windows执行在锁外并有全局/attachment并发界限、超时和真实消费回执。先生产行为RED，再严格Player消息/官方DOM/真实Core验证并提交。可信Dext退出确认继续下一步骤；本包全Task3/4、16项和最终7项保持，不中途验收或合并。

- [x] 系统控制Core生产者：真实生产源码166/166（132+34），五种媒体/合法音量patch、撤权/旧输入/几何/暂停/锁屏/失焦、个人绑定和默认导航优先、限频与锁外服务失败均通过。严格消息/SDK/Windows实际接线继续，不将生产者测试标为端到端完成。


- [x] 严格Player消息/正式SDK接线：先生产RED，最终JS140/140、消息35/35、Core168/168。mediaControl五意图、audioControl非空有限patch，固定consumer/当前identity/geometry/私有sequence；author仅收status。服务失败消费回执取消默认，未消费的限频/个人绑定拒绝保留默认回退。同文档修订保留在途动作，暂停/换代次/会话/销毁取消。
- [x] Windows派发界限：每attachment1、全Core4个任务，非阻塞admission；4s等待，比私有5s更短，超时槽位直到原任务真正终止才释放。限制可跨Room/Player重建；媒体等锁/解析及音量设备解析后的取消复核已补，实际取消音量请求不改endpoint。错误不包含私有异常/设备身份。
- [x] 最终完整build后的实际Core控制：官方SDK经Windows鼠标注入音量改动→恢复，五媒体命令均到达本轮拥有的静音WinRT publisher（每次派发前真实Core当前媒体title核验）。8次完成各一次消费/8份accepted、无默认重复；动态导航仍同文档切页，正常重启同安装恢复focus/KV/新SDK文档。最终15项PASS，注入不填物理/DPI/听音人工门槛。
- [x] 探针纠正：新ManualClock测试错用Now，先改Advance，不计功能RED；同时无输入请求可被单attachment界限拒绝controlUnavailable，有限重试后再要求inputRequired。多次回执扩大标题使观察丢失，改只报告必要字段与精简KV投影，最终2842字符完整JSON；不是生产控制失败。错误参数--v3-status .先失败，改正确inactive后通过；进程筛选改按真实Lively.Player.WebView2.exe名称，不凭错误别名宣称缺失。
- [x] 最终常规start/identity：Core40928、Player124608、Watchdog99404、config69696，日志20261003_173146.txt；原v2 inactive。配置器仍所属D共享缓存，身份脚本OTHER/exit1，路径独立核验，不宣称全脚本OK。按精确PID/path正常退出Core/配置器，watcher41725终止exit0，个人SHA256/原不存在状态保持。实际Core夹具finally恢复原桌面、数据、窗口最小化/最大化、前台/鼠标与原endpoint音量。
- [ ] 唯一接续：可信Dext退出确认与彻底退出产品；随后按Task4完整四媒体生命周期/Player故障、移动/遮挡精确输入、个人布局/恢复和最后一次完整P5审查推进。本包全16项/readiness1/16与上方7项集中人工验收保持，不中途合并。

- 2026-10-03系统控制最终清理核对：DextProcesses=0、DevListeners=0、ResourceCacheFiles=0、NativeFixtureDirectories=0；Core/配置器正常退出，全部工具会话已终止。

- [x] Task3可信退出确认基础接线（BASE87e2d65，2026-10-03）：一句目标是真实入口触发Dext原生确认，取消保持运行，确认后正常关闭整个产品并恢复普通Windows桌面。Core先一次消费输入并签发仅内存可用的确认许可；原生UI在锁外展示，确认后按当前安装/连接/消费者/按钮/授权/绑定/锁屏复核，旧文档与许可重放拒绝。当前可信确认造成的失焦/播放暂停不得误拒自身用户决定；例外仅用于exit许可，不能扩展普通动作。配置器通过核验的Core身份接收独立产品退出通知，普通退出Core继续保留配置器。先生产源码RED/GREEN，再严格宿主/原生UI/完整产品实机验证、完整build→start/退出及具名提交。全Task4/16项/readiness1/16和最终7项仍保持。

- [x] 可信退出私有生产者179/179，加入Core确认协调器后185/185：许可仅Core内存，两个JSON序列器均剥离；取消/重放/错owner/旧文档/撤权/绑定/安装/关闭/锁屏/阶段均检查。原生UI在锁外，自己的失焦/播放暂停只对该退出确认续体豁免，普通动作保持原门槛。并发确认全Core仅一窗，UI失败/忙取消许可，不执行退出。
- [x] 正式DOM/SDK141/141与Rust生命周期7/7：dext.exit声明接到actions.activate，作者只获requiresConfirmation和安全状态，没有确认方法或私有续体；配置器原生侧读独立产品退出标志并核对产品/数据/pipe、当前worktree和实际PID/executable后正常exit(0)。普通退出Core不发布标志，仍保留配置器。严格原生消息中的伪确认字段专项继续最终回归。
- [x] 原生退出最终整轮实机：最终native-exit-core-live-final 13项PASS；正式Rust安装/实际Core/ReleasePlayer/SDK/OS鼠标中No取消保持Core/Player/configurator，Yes默认否确认后四进程正常退出、壁纸窗口消失。无输入exit timer拒绝；普通Core关闭/同副本重启保留配置器。最终finally原布局/settings/checkpoint/personal字节或缺失状态及用户Room哈希恢复；不代填物理输入/DPI人工验收。
- [x] 最终完整build→常规start/身份/关闭：Core74912/Player27284/Watchdog27548/config32948，日志20261003_182449.txt；原v2 inactive。配置器为本worktree所属D共享缓存，identity脚本OTHER/exit1，路径独立核对，不宣称全脚本OK。普通Core退出保留配置器，随后正常关本配置器窗口，start watcher62965终止exit0；原四文件SHA256/缺失状态保持。最后检查DextProcesses/DevListeners/ResourceCacheFiles/NativeFixtureDirectories全部0。
- [ ] 下一接续为Task4：完整四媒体start/idle/私有暂停/锁屏/wake与独立Player故障重建；再个人布局/占用/移动与精确命中/遮挡/多图标/焦点，最终一次整体P5审查。16项开发就绪仍1/16，7项集中人工步骤保留，当前P5仍开发中，不中途合并。

- [ ] Task4完整媒体生命周期与Player故障恢复（BASEb91b0d2，2026-10-03）：一句目标是image/video/gif/localHTML在start/desktop/idle/私有暂停/锁屏/wake组合中按Core状态运行，独立Player故障后正常重建同安装且保留已提交Desk/KV、新文档/新session拒绝旧输入和完成。先核对生产入口并写行为RED，修复必要缺口，再实际Core/ReleasePlayer/SDK与OS注入验证，finally恢复原文件/窗口/鼠标且保持Dext退出；不把私有锁屏事实注入计为实际Windows锁屏、不锁用户账户。单轮代理只读映射，根集中编辑/提交；全Task4个人布局/移动/精确命中、16项就绪1/16和最终7项人工门槛保持，最终集中验收前不合并。

- [x] Task4首批生产缺口已按RED/GREEN修复：无idle桌面图标保留但官方输入几何仍限desktop；Kernel/Core私有Retire保留checkpoint、清易失会话/转场/队列并撤销旧连接/订阅。内核23/23、协议87/87；新协议夹具先误用coordinator导航/默认无存储Kernel，修正真实view与MemoryCheckpointStore后通过，未放宽生产角色。
- [x] 独立Player故障实机：task4-recovery-exposed整轮通过；OS鼠标→作者SDK提交focus后正常Core重启，再只Kill已核对绝对路径的本轮ReleasePlayer；同Core自动新PID/session/SDK文档恢复focus/stamp/原KV及start/video/audio。主动CloseAll不重生。finally原四文件字节/不存在状态、用户Room及临时showdesktop窗口旗标/前台/鼠标恢复、Core正常退出。前两份未暴露真实桌面的夹具停在重启KV前台拒绝，失败证据保留，不计故障重建RED。
- [x] 四媒体生命周期首轮image实机通过：task4-lifecycle-image-final；实际Core预暂停start不消耗900ms非活动墙钟、正常启动/同安装Core重启，然后同Player native idle→私有暂停/恢复→OS鼠标wake及再次idle→Core stop，Desk/会话/文档/实例/start次数及原父窗/边界保持。锁屏仅行为测试，不锁账户、不代填真实Windows锁屏人工门槛；GIF动画冻结仍待视觉人工证据。

- [x] Task4补证发现真实GIF问题：task4-lifecycle-gif-visual中owned全屏Player中心OS像素暂停期间仍变化，状态/解码门槛不能代表视觉冻结；finally原数据/桌面恢复。具体修复方案：原生Player暂停先完成媒体/宿主屏障，再只抓当前WebView内存帧、显示原生静帧并隐藏WebView，使用官方TrySuspendAsync；resume先恢复WebView执行并投递最新Core事实/媒体策略，最后才显示原WebView并释放图像。保持同文档/实例，异步步骤核对playbackRevision、渲染操作串行，另补真实GIF像素与HTML/视频时钟/已有原生媒体策略实机。

- [x] Task4四媒体最新实机：task4-lifecycle-image/video/html-suspend与gif-barrier整轮通过，预暂停start/恢复/同副本Core重启/两轮同文档idle/私有暂停/OS唤醒或Core stop/原父窗边界恢复；GIF实际owned Player十次像素变化/固定/变化，视频与HTML AudioContext排除暂停墙钟后继续。同文档/实例/start次数保留，不填实际锁屏/物理DPI。
- [x] Native Player暂停修复：当前WebView内存静帧、隐藏后官方TrySuspendAsync、恢复先最新事实与媒体策略再显示；串行操作/代次检查/各三秒边界/失败关闭当前Player，图像不落盘。生产JS143/143、Kernel23/23、Protocol87/87、Actions185/185；task4-verified-build成功，实际ReleasePlayer媒体wire通过（Core仍fixture），最新实际Core退出十三PASS。四媒体/故障恢复探针均finally恢复原文件/用户Room/窗口/前台/鼠标，Core退出。
- [ ] 接续Task4个人布局：先私有Core个人覆盖模型与原子保存，固定官方宿主get/save、编辑拖动/占用非法落点回原位、视口临时移位缩小不写盘；之后移动/精确命中/遮挡/多图标/受控焦点。动代码前补当前分支计划与独立验收卡；最终一次整体P5审查、七项集中人工/十六项范围不减，开发就绪1/16，不中途合并。

- 2026-10-03 Task4常规启动复核：Core121280/Player68580/Watchdog114424/config99916，日志20261003_192301.txt；原v2会话inactive。identity脚本将所属D共享缓存配置器记OTHER/exit1，实际绝对路径已独立核对，没有宣称全脚本OK。按精确PID/path正常退出Core和配置器、watcher95129结束exit0，原四文件SHA256/缺失状态保持；最终DextProcesses/DevListeners/NativeFixtureDirectories均0，保持Dext退出。

## Task4个人布局原子保存与官方接线计划（BASE58cd855，2026-10-03）
一句目标：Core按Room副本持有普通图标/共享Widget的位置覆盖，官方桌面保存后重启读回；非法落点或保存失败回原位，缩屏产生的临时布局不写盘。
范围：独立layoutRevision与图标Desk/icon稳定ID、全局widget component ID，固定1920×1080坐标；仅当前安装/DesktopPlayer/session/revision私有read/save，写入限当前可操作desktop且无转场；只读布局可在暂停/starting保留，不返回其他个人数据，不加入iframe/SDK作者能力。Dock/scene/作者固定按钮不走桌面拖动；另存继续只复制按钮/皮肤，不复制布局/KV/授权。占用由视图当前有效报告计算。
先生产行为RED：重开/独立revision、不认识ID/非widget/非法坐标/旧revision/旧连接及暂停锁屏转场拒绝、阻塞发布保留旧字节；随后严格Player/native-host和私有Core接线，再DOM长按编辑/拖动、占用回滚及响应式临时调整、实际Core保存重启/故障恢复。每小段更新TODO并具名commit，保持Dext退出，最终一次整体P5审查后集中人工验收。
人工步骤沿独立验收卡第5/6项：长按普通图标/Widget进入桌面编辑并拖动，落占用区回原位；有效落点保存、重启恢复；缩屏临时移位再缩小，恢复尺寸回保存位置；作品/安装摘要不变，故障保存回原位，物理DPI和旧命中继续专项。此计划不代填任何人工通过，完整16项/就绪1/16、七项最终门槛保持。

- [x] Task4个人布局Core/schema/私有接线：新layout字段读取真实RED（185/186），补Core布局及独立revision后通过；身份/数值/当前Desk与Widget限定/CAS/只读脱离/并发单胜者/写故障保留两revision/旧连接与角色及paused/locked/starting/transition门槛，首轮200/200。严格Player新方法36/38实际RED，JS私有入口3项实际RED，再接只读布局+闭合单item保存后38/38与native-host23/23。私有read在暂停可读取安全布局，save/作者数据/动作仍拒绝；未向frame/SDK增加能力。已补桥关闭/旧格式兼容与实际Player wire验证，继续构建/真实链条。
- [ ] 个人布局尚未接DOM，当前不能宣称拖动/占用/响应式/实际Core重启保存通过。下一段官方DOM长按编辑/拖动回滚及视口临时布局，作者geometry使用有效Widget位置和实际同实例，不写room.json或安装快照。当前最终七项和16项/就绪1/16保持。

- [x] Task4官方视图纯布局计算计划（2026-10-03）：独立layout-model.js将Core保存值与当前CSS视口有效值分开；图标及role=widget稳定ID投影、全局/当前Desk占用过滤，先保留合法原尺寸位置，再移动冲突项，实在放不下才等比缩小。纯函数不发保存、不断言人工完成；拖动候选按同一占用/其他对象规则判断，局部按钮矩形按逻辑尺寸映射有效位置。先几何/不可变/恢复尺寸行为RED→GREEN，再接DOM，保持作者iframe逻辑尺寸及同实例。
- [x] 个人布局Core/私有IPC基础最终验证：202/202、38/38、JS/SDK/媒体策略146/146，完整build成功；layout-private-wire-green实际ReleasePlayer接线（Core回包fixture）与layout-native-pause-gif-verified真实Core GIF整轮通过。原生controller显式可见性修复、活动回执和附着后DPI测试门槛见ERRORS #198/#199。
- [x] 本阶段常规build后start：Core110068/Player31972/Watchdog24180/config109340，20261003_205127.txt；原v2 active=False。所属共享配置器路径独立核对，identity OTHER未冒称全脚本OK。正常精确PID/path关闭、watcher81581 exit0、原四文件hash/缺失状态保持，OwnedProcesses/DevListeners/NativeFixtures/ResourceCacheFiles全0。DOM保存与占用/缩屏/实际布局重启仍待接入。

- [x] Task4纯有效布局模块：模块缺失RED、损坏覆盖20/21行为RED后21/21。CSS视口原尺寸保留/移位优先/必要等比缩小/当前Desk占用/不可变/恢复位置/局部按钮映射及仿射逆变换通过，完全无空位placeable=false，不写个人快照。
- [x] Task4官方DOM读入/呈现基础：新增七项行为RED后35/35，scope/Desk/读取token拒绝迟到、不阻塞新Desk、共享iframe保持逻辑尺寸及父节点、按钮按有效placement重算、resize不保存、占用保留到显式报告、失败保留已确认呈现/拒绝保存准备状态。生产全JS174/174。layout-model.js加入固定官方服务文件及三个实机夹具，最新完整layout-dom-build成功；layout-dom-frame-media-wire实际ReleasePlayer整页/原生媒体/作者策略回归通过（Core回包仍fixture）。
- [ ] 官方桌面尚无长按编辑/拖动Save入口；正在补实际Core安全布局读取/正常重启验证，随后接长按、官方Widget把手/编辑覆盖层、指针UP原子Save、无效落点/失败回滚。空动作geometry仍保留鼠标转发，Core不会为编辑指针产生动作完成证明；不新增作者动作权限。
- [x] 官方DOM实际Core读取补证：layout-dom-core-live在实际切页前后/正常Core重启后私有layout0均ready且无错误；原文档/新文档按生命周期保持，focus/KV/GIF/视频恢复，finally原四文件/用户Room恢复。本轮不执行layoutSave、不冒称非空覆盖实际保存通过。
- [x] 本阶段完整build→常规start Core92228/Player118936/Watchdog70784/config8336、日志20261003_211317.txt，原v2 Player路径核对。identity所属共享配置器OTHER并核对绝对路径；精确正常退出Core/配置器、watcher19473 CtrlC结束exit1、原四文件hash/缺失状态不变；OwnedProcesses/DevListeners/NativeFixtures/ResourceCacheFiles全0。

2026-10-03用户调整：桌面拖动先略过，保留待恢复；当前继续P5精确输入/遮挡/多图标与受控焦点。每次推进报告完整16项开发就绪比例，目前1/16=6.25%（对话约6%），此为交付覆盖率，不能将阶段测试数当百分比。Dext实机探针结束后保持关闭。

- [ ] P5精确输入纯几何计划（BASE88a04ba，2026-10-03）：先为旋转/斜切矩形建立凸多边形、画布裁剪和前层遮挡差集，结果为多块真实可见区域；测试包围框角落不命中、负行列式、完全/部分/多遮挡、边界及不可变。纯geometry.js不调用native、不产生输入证明、不逐帧跨IPC。后续严格私有几何同步、同按钮多图标稳定区域与键盘受控焦点再接Core；移动动画方案先核对真实输入配对，不能靠降低权限或取消动画输入要求。拖动按用户暂缓。当前16项交付就绪1/16≈6%，此基础不独自增加完成比例。

- [ ] P5精确区域/受控焦点接线计划（2026-10-03）：在纯几何基础上，固定官方DOM按实际矩阵生成凸区域，裁剪画布并扣除前层可见wrapper；Core私有entryId（consumer内唯一）区分同按钮多个呈现实例，polygons并集精确命中而包围框只作快速排除。旧矩形协议保持，新增严格有限/凸性/自交/包围框/64片×32点及总65536点预算和全层深复制，不向作者增加字段/票据。Core DOWN/UP仍同呈现实例、当前HWND/DPI/前台/期限/一次消费；Core原生焦点事件映射已ack区域SVG轮廓，失效/暂停清除。先DOM/native-host及Core生产行为RED，再构建和实际Player/Core验证；移动采样/可信作者派发另续，不冒称静止几何已覆盖移动，拖动暂缓。最终人工卡第4/5项仍待用户集中执行，完整16项交付就绪1/16≈6%。

- [x] P5纯几何基础：geometry.js实际模块行为RED0/18，首实现16/18暴露裁剪交点舍入，修正后18/18并补斜向差集/多遮挡具体风险20/20。输入不变、真实凸差集、矩阵反射/旋转/斜切/画布边界已验证，无native或输入证明。
- [x] P5官方静止精确区域/私有schema/焦点视图：新增8项DOM及3项native行为先RED后GREEN，全部生产JS/SDK/媒体策略205/205。真实z及DOM顺序前层wrapper裁剪、透明层关闭指针拦截、同动作两图标独立entry、ack前/失败/旧scope拒绝焦点及SVG显式hidden已接入。默认移动前层可能遮挡的区域不采用冻结几何签动作，移动取样仍待接线，不删完整要求。
- [x] P5 Core精确区域与私有消息基础：生产authority扩展实际RED206/237、parser正确夹具65/69，再237/237与69/69。三角形外的bbox点拒绝、多片空隙、同动作不同呈现DOWN/UP/Tab、CW/CCW及strict凸/简单/预算/包围框、深复制和无几何数组公开元数据已验证。完整precise-core-build通过；实际Player/Core与常规启动退出继续。全16项交付就绪1/16≈6%。

- [x] P5实际ReleasePlayer正式页面补证：precise-official-host-wire成功，严格私有DTO的双icon独立凸区域、模拟Core焦点命中第二个SVG且失效清除；同SDK文档/只由Core提交/队列/暂停/最新事实/撤销回归保持，Core回包仍fixture。
- [ ] P5本阶段实际Core原生动作补证受外部凭据窗影响：前两轮operable/前台不成立，后两轮空白像素安全检查拒绝；最终owned像素诊断Credential Dialog Xaml Host/System CredentialUIBroker.exe。四轮finally原数据/Room/桌面与窗口旗标恢复，未点击凭据窗口、未改生产门槛；恢复条件是用户关闭该窗口。等待时继续派发守卫/运动取样，实现范围保持，整体就绪1/16≈6%。
- [x] P5本阶段常规build→start/身份核对→正常退出：Core113804/Player46424/Watchdog125196/config80780，20261003_222129.txt；identity共享配置器OTHER/exit1并核对路径。精确PID/path正常关闭、watcher74869 exit0，四原文件hash/缺失不变，OwnedProcesses/本轮DevListeners/NativeFixtures/ResourceCacheFiles全0。

## P5 原生同步作者输入守卫基础计划（2026-10-03，BASE 1d1a6ff）
一句话目标：在作者脚本之前建立可信事件同步调用边界，固定原始 requestId/method/params 与原生文档；定时器、microtask、合成事件及缓存事件重调不能生成见证。
范围：独立私有 guardian 模块、受保护的 listener/property/inline 派发包装、关闭/暂停/文档撤销、捕获原语和私有传输；与原生媒体 bootstrap 共用闭合 shadow 发现。先行为 RED 再实现，包含真实 Chromium 事件测试，禁止将模拟 Event.isTrusted 当实机证据。另建 bounded native 请求汇合基础，禁止它自行选最近完成证明或授予动作。
后续接线：Player 实际 frame/document 注册、Core 物理 gesture/正数序号、运动 DOWN/UP 视觉取样与 source 手势权限必须闭合后，才能切换生产 SDK/动作强制门槛；本基础阶段不宣称上述接线已完成。桌面拖动按用户暂缓，Core 实机补证等待系统凭据窗清除，Dext 保持关闭。
人工验收：最终验收卡第4项，真实鼠标/Enter/Space可请求受控动作，timer/Promise continuation/伪造 click/缓存真实事件重调均拒绝；第5项验证移动、遮挡、多呈现入口和DPI。只在全包交付时集中执行，7项不打勾。整体交付就绪仍 1/16=6.25%，推进对话报约6%。

- [x] 原生输入bootstrap真实行为RED：组合脚本缺少guardian时报错（guardian-embedded-red.log），补嵌入资源/私有builder后GREEN；固定actual realm、Guid文档nonce、正safe gesture/structural bounds，不经作者globalThis/window别名。
- [x] bounded原生请求汇合基础：source-link行为RED43/83，正式撤销边界RED83/84后GREEN84/84；完整SDK typed参数、当前native scope、两路乱序/错配/重放、64pending/196frames与固定1500ms半包期限。此期限不替代Core从真实DOWN起的物理期限，不授予动作。
- [x] 同步guardian本阶段验证：实际Chromium40检查、guardian24/24、完整JS229/229；补原生Window裸调用兼容、onerror五参数、跨文档收养后currentTarget/receiver核对及未知foreign callback getter拒绝。实际ReleasePlayer guardian默认关闭/私有hooks与媒体策略共存通过；Core正数手势和SDK强制接线仍待完成。

- [x] 本阶段完整guardian-core-build-final四阶段成功；正式guardian私有builder/witness闭合消息、native join84/84及native media消息回归通过。guardian-frame-media-wire-green实际ReleasePlayer两个作者文档初始化、输入hooks默认关闭、根/closed-shadow/nested音视频与WebAudio暂停/恢复/最新修订/撤销通过；该wire的Core回包仍fixture，不签发物理gesture。
- [x] 常规start Core7084/Player121916/Watchdog122856/config100832；identity Core/Player/Watchdog/mutex/pipe/data/log OK，所属D共享缓存配置器OTHER/exit1且绝对路径独立核对。按精确PID/path正常退出Core和配置器，start watcher9524 exit0，原四文件SHA256/缺失状态保持，头部浏览器已关闭、Dext进程0。
- [ ] 接续本地功能：Player真实frame/document与原始SDK requestId两路汇合、Core正数物理gesture与同UI操作转发，再接运动DOWN/UP即时视觉样本和source动作。尚未替换生产author inputSequence=0路径，不宣称timer/最新完成输入漏洞在整条动作链已修好。实际Core补证仍待凭据窗解除；桌面拖动暂缓。
- 2026-10-04用户推进偏好：以本地功能接通为主，不继续扩展网络安全测试；当前已有改动只做必要回归。每次推进报告完整16项开发就绪百分比，当前仍1/16=6.25%（约6%），全包最终集中验收与单次P5整体审查保持。

- 最终清理补记：常规日志20261004_003713.txt，本轮1420/1421/1621监听0。git staged check发现新guardian末尾空行，仅修正EOF格式后继续提交，不重跑已充分验证的行为。

## P5 本地原生按下手势关联计划（2026-10-04，BASE eb59348）
一句话目标：Core在真实RawInput DOWN冻结正数手势序号、文档scope、实际HWND/viewport/DPI和按下时间，UP完成沿用该序号，为移动DOWN/UP视觉样本及Player串行arm/转发准备同一关联。
本段范围：Core UI适配已调用的native authority按下/松开状态、鼠标/Enter/Space重复、拖动容差、前台/窗口/结构修订撤销与从DOWN起1500ms期限；空静止几何仍可记录实际视口内按下事实但不产生动作证明。静止几何默认动作和受控Tab保持；不新增网络能力/网络安全测试，不把半包/UP时间当新期限。
先针对生产Core状态写行为RED，再接冻结模型，运行对应动作回归和完整build→start/身份/正常退出，具名提交。Player nativeframe/SDK汇合与同UI转发仍另续，当前author零序号动作路径不在本段宣称修好，桌面拖动暂缓。
最终人工沿验收卡第4项鼠标/Enter/Space一次消费、长按超时/AltTab取消、第5项移动/遮挡/多图标/DPI；全包集中执行，不新增中途验收。完整16项就绪仍1/16=6.25%（约6%），Dext探针后退出。

- [x] Core真实DOWN正数关联：stub行为RED238/254（16失败）后254/254；真实视口/OS点/DPI/键/时间与scope冻结，UP原序号，空区域不授予动作、重复不续期、容差/结构/窗口/跨键鼠取消和1500ms半开期限。当前RawInput适配自然进入新Core类，Player/SDK关联仍待接线。
- [x] 本阶段完整build→常规start/身份→正常退出：Core73828/Player123844/Watchdog113464/config24756、日志20261004_010606.txt；共享配置器OTHER/exit1且路径独立核对。原四文件hash/缺失不变、watcher33543 exit0，DextProcesses/1420/1421/1621监听均0。
- [ ] 下一段本地功能：私有gesture消息和Player同UI arm/Win32输入转发，实际nativeframe witness与原始SDK请求汇合；随后移动按下/松开视觉样本。真实Core输入补证仍待凭据窗解除；网络测试不扩展，桌面拖动暂缓，全16项就绪1/16≈6%。

## P5 Player原生鼠标与作者请求接线计划（2026-10-04，BASE 47319c9）
一句话目标：Core冻结的DOWN序号经私有IPC进入Player，先对实际直接作者frame arm，再在同UI串行操作转发Win32 DOWN/UP；原始SDK请求与该frame见证汇合后只用同一正数证明执行动作。
范围：私有指针包、原生UI有界队列（连续move合并）、实际窗口/视口核验、frame/document注册与生命周期撤销、完整requestId/method/params保留、两路汇合与释放后派发，静止作者鼠标入口先贯通。不会把旧Win32与独立arm通道当作有序，也不允许用零序号找最近完成。官方键盘默认动作保留；作者Enter/Space的真实派发、移动视觉样本及source级动作随后接续，全部原要求保留，拖动暂缓。
先针对队列顺序/释放/期限与SDK原始请求/正式宿主路由写本地行为RED，再实现Core/Player/SDK，实际ReleasePlayer自己的窗口验证trusted鼠标回调及一次原生请求，Core回复夹具与实际Core物理证据分开。只做必要本地功能回归，网络安全专项不扩展。改C#后完整build→start/身份/正常退出，原四文件保持、Dext退出、具名提交。
人工步骤沿最终卡第4项真实鼠标/Enter/Space一次动作、长按/AltTab取消、异步请求拒绝，第5项移动/遮挡/多入口/DPI；完整全包集中验收，不新增中途验收。当前完整16项就绪1/16≈6%，P5继续开发，不合并master。

- [x] Player原生鼠标队列与实际frame arm：私有Core指针DTO沿冻结DOWN scope/序号/HWND/viewport/DPI/QPC进入同UI有界队列；DOWN等待实际直接作者文档arm完成，连续MOVE合并，UP不越过DOWN，取消先revoke再释放原生按住。队列真实RED2/9→9/9；取消最新点回归RED9/10→10/10，严格消息69/69、Core动作254/254、生产JS229/229。
- [x] 实际ReleasePlayer本地鼠标：pointer-native-wire-final收到trusted DOWN/UP并同步进入私有request hook；长按超时先撤销再UP。Core指针包为夹具，没有推定实际Core动作已通过。实际媒体回归发现嵌套媒体文档不需要输入guardian描述，修为仅直接作者root描述/注册后pointer-frame-media-wire-final通过，音视频/WebAudio原生暂停恢复/最新修订/撤销保持（ERRORS #209）。
- [x] 完整pointer-core-build-final四阶段通过；常规start Core76880/Player79976/Watchdog53304/config31928，日志20261004_022256.txt；identity共享配置器OTHER/exit1且精确绝对路径独立核对。正常关闭、watcher90633 exit0，原四文件hash/缺失不变，Dext进程与1420/1421/1621监听0。
- [ ] 当前仍待SDK原始requestId/private witness两路汇合及正数动作派发，生产author零序号路径未替换；作者真实键盘、移动即时样本/source动作随后接续。无新增网络专项，拖动暂缓，整体16项就绪仍1/16≈6%，最终集中验收保持。
## P5 SDK原始请求与原生鼠标完成关联（2026-10-04，BASE c73eb83）
一句话目标：实际作者SDK同步提交完整requestJson，正式宿主保留原始rN与固定instance/consumer，经Player实际root文档双路汇合，只在同一原生UP转发后使用正数gesture执行Core动作。
范围：SDK四类受控请求、FrameHost原文保留、官方authorInput私有路由、nativeframe两路匹配/释放/撤销与严格正数映射；无需增加网络安全专项。先本地SDK/宿主/汇合行为RED，随后实际ReleasePlayer自己的HWND+正式SDK验证按下请求等待UP、一次对应动作消息，Core回包仍夹具。真实作者键盘、移动取样/source手势后续继续，拖动暂缓。
完成后仅保存到P5工作分支，完整构建/启动/正常退出；最终人工第4/5项集中执行，不增中途验收。整体16项就绪1/16≈6%。
- [x] SDK与正式作者路由：四类受控请求在同步调用中将完整SDK envelope提交给原生guardian，再走parent；FrameHost保留rN/requestJson与固定instance，DOM改为authorInput，不再选择completion或inputSequence=0。SDK/FrameHost行为RED31/34（2失败、1等待拒绝超时）→34/34；DOM/native route RED65/70→70/70；完整生产JS232/232。公开回复仅status，正数关联只在Player/Core私有链。
- [x] 原生关联到UP后的动作：生产delivery真实RED0/6→6/6，两路任意先后、DOWN不执行、同UP释放、下一DOWN清待办但保留文档rN水位、1500ms物理期限、文档撤销和三类typed意图映射；旧join84/84，私有parser RED69/70→70/70。实际native registry按当前direct root/document/instance关联，导航/销毁/暂停/重置撤销；deadline timer只在有本次手势时运行。
- [x] author-input-native-wire-final实际ReleasePlayer+正式SDK通过：trusted DOWN内actions.activate('open')等待同次UP，原始r1只生成一次Core n1/gesture7/geometry1/scene/open，SDK收到accepted。Core包/回执和该小official route仍fixture，生产DOM路由另由行为回归验证；不冒称实际Core桌面物理证明。首轮功能通过但WebView profile退出后2s仍占用、清理失败；确认仅自建GUID目录后清理、重试预算10s，最终整轮exit0且临时目录0（ERRORS #210）。
- [x] author-input-core-build-final完整四阶段与实际author-input-frame-media-final回归通过；常规start Core121280/Player81856/Watchdog92464/config54740，日志20261004_025000.txt，identity共享配置器OTHER/exit1且精确路径核验。正常关闭、watcher58787 exit0，原四文件SHA256/缺失状态不变、Dext进程/开发监听/native author fixtures全部0。
- [ ] 接续本地功能：作者Enter/Space真实派发/受控焦点，再接移动DOWN/UP即时可见区样本与source动作。生产作者鼠标已改为原始请求汇合后的正数关联，但Core内部旧零值查询兼容仍保留待全输入链收口；整体准确性/实际Core物理补证未全交付。拖动暂缓、网络专项不扩展，整体16项就绪仍1/16≈6%，最终集中7项验收与单次P5整体审查不提前勾选。
## P5 作者Enter/Space与受控frame键盘接线（2026-10-04，BASE dddff64）
一句话目标：Core受控Tab焦点选定当前consumer/button，真实Enter/Space DOWN的冻结正数关联经Player同UI arm、原生frame焦点路由和Win32键转发，作者SDK请求等待同次UP后执行一次对应动作。
范围：复用私有有界输入队列，扩展键/scan/extended/固定焦点consumer/button/entry关联；仅选中直接作者root arm并用预先捕获的Window.focus路由，不新增公开作者焦点或输入票据，也不改作者DOM节点的focus/tab顺序。官方图标仍由Core默认激活，legacy opt-in键盘转发保留；作者鼠标链与暂停媒体回归保持。重复按住、过期/切窗/修订取消只做必要本地回归，不扩展网络专项。拖动暂缓，移动即时样本/source随后接续，原范围不减。
先原生输入DTO/队列及guardian焦点路由行为RED再实现；实际ReleasePlayer自己的HWND与正式SDK验证真实trusted Enter/Space及一次正数动作（Core包/回执仍fixture），随后完整build→start/身份→正常退出和具名commit。最终人工沿卡第4项鼠标/Enter/Space一次消费、长按/AltTab取消及第5项移动/遮挡/DPI集中执行，整体16项就绪仍1/16≈6%。
- [x] 私有键盘DTO/有界队列：Key/ScanCode/extended/固定consumer/button/entry冻结；取消先撤销再释放同键，鼠标UP不能释放键盘配对。真实行为RED10/13→13/13；guardian只路由当前文档Window，作者覆写focus不生效，RED24/25→25/25，生产JS233/233。
- [x] Core真实RawInput受控Tab焦点选定后，Enter/Space DOWN冻结正数关联；UP沿用原键/scan/焦点元数据。Player仅选中consumer的直接root arm，NativeViewController.MoveFocus(Programmatic)后捕获Window.focus路由，再转发Win32键；不操作作者DOM节点/Tab顺序，官方入口保持Core默认动作。原生动作delivery8/8（含仅选中consumer）、Core动作254/254。
- [x] 实际ReleasePlayer+正式SDK：keyboard-enter-controller-focus-wire / keyboard-space-native-wire-final / keyboard-mouse-native-wire-final均exit0，trusted DOWN等待同UP，原r1只生成一次Core n1/gesture7；前台HWND保持不变。Core输入包/回执与小official route仍fixture，不能代填实际Core物理证据。仅Window.focus或WinForms.Focus两轮无keydown，改原生controller后通过（ERRORS #211）；失败日志保留。
- [x] keyboard-controller-focus-build完整四阶段、实际keyboard-frame-media-wire-final回归通过。常规start Core56016/Player54552/Watchdog106276/config96456，日志20261004_032947.txt；产品/插件/mutex/pipe/data/log正常，D共享配置器OTHER/exit1且绝对路径独立核验。精确正常关闭、watcher91523 exit0，原四文件hash/缺失保持、Dext进程/开发监听/native author fixtures全部0。
- [ ] 接续本地功能：移动DOWN/UP即时可见区样本与source动作；Core旧零值查询兼容待全输入链收口，实际Core物理输入补证仍待系统凭据窗解除。最终卡第4项真实鼠标/Enter/Space一次动作、长按/AltTab取消，第5项移动/遮挡/多入口/DPI集中执行；拖动暂缓，无新网络专项、中途验收或master合并。完整16项交付就绪仍1/16=6.25%（约6%）。

## P5 移动视觉的原生事件取样（2026-10-04，BASE 3cdbd72）
一句话目标：默认/作者变换保持运动，原生DOWN与UP读取当时实际可见凸区域，在Core同一冻结物理手势中配对同entry后再允许动作；不通过逐帧IPC补坐标。
范围：Core两次采样配对、官方DOM按已绘制组矩阵即时裁剪/遮挡、私有Player采样与派发时视觉保持/释放、真实原生窗口/视口/前台/期限检查，后续source手势级授权保持原范围；旧静止路径只在生产接线完成前兼容。先实现必要Core/DOM行为RED和生产基础，再接私有事件屏障与实际Player/Core证据；不能拿基础测试冒称已经可点移动元素。
不扩展网络专项；桌面拖动按用户暂缓。最终人工仍第4项鼠标/Enter/Space一次动作、长按/AltTab取消和第5项移动/遮挡/多入口/DPI，集中验收，不新增中途确认。每阶段具名commit、改C#后build→start/正常退出、Dext保持关闭，完整16项就绪1/16≈6%。

- [x] Core移动取样配对基础：PublishGeometry增加内部sampleMouse模式，原生DOWN/UP仍独立冻结同一序号、原始QPC和两次OS点；SampleMouse不创建物理输入，只用严格不可变可见区域命中原始点。DOWN/UP任一半不能完成，两半同consumer/button/entry方可完成；重复半包不替换，期限/拖动/视口/DPI/前台/修订变化仍取消。新检查缺少API编译RED后实现，原动作回归加18项本地行为合计272/272。
- [x] DOM按已绘制visualGroups即时读取readInputSample，当前geometry ack/scope成立才返回独立副本；采样可计算moving元素及moving前层遮挡的真实多边形，无逐帧或采样读取IPC。行为RED43/46（缺API）→45/46（测试归一化宽度精确相等失败）→46/46，改机器误差断言，生产未加命中padding（ERRORS #212）。
- [x] event-sample-core-build四阶段通过；常规start Core55712/Player82324/Watchdog93260/config65212，日志20261004_034829.txt，Core DLL写入03:48:23早于Core启动03:48:29。identity共享D配置器OTHER/exit1且精确路径独立核验，随后正常关闭、watcher82155 exit0，原四文件SHA256/缺失状态保持，Dext进程/开发监听/author fixtures0。
- [ ] 这段是移动取样生产基础，Player尚未调用readInputSample、Core生产PublishNativeGeometry尚未启用sampleMouse；原静止路径仍兼容，不能宣称移动点击已接通。接续实现仅Core/Player私有采样消息、原生派发期间视觉保持/释放和两个edge的实际Player/Core证据，再接source手势级授权；全范围保持。拖动暂缓，最终第4/5项集中人工、网络专项不扩展、不合并master，整体16项就绪1/16≈6%。

## P5 Player原生采样与派发屏障（2026-10-04，BASE 8a738f1）
一句话目标：同一Player UI队列在DOWN/UP派发前读取并保持当前官方可见几何，收到实际文档可信派发回执后释放视觉并通过独立私有IPC交Core；Core样本在作者动作释放前处理，同原始物理边沿配对。
范围：可取消且有界的采样/派发屏障、直接作者root与官方top真实回执、默认动画在短屏障后按原活动时钟继续、私有样本严格同scope/HWND/viewport/DPI及声明按钮校验，正式geometry启用鼠标采样模式。无逐帧IPC、无公开作者样本入口、不会用固定延时冒充原生回执；键盘与原有静止行为回归保持。source手势级授权随后接，不能削减原范围。
先本地队列顺序/DOM保持/私有消息行为RED，接线后实际ReleasePlayer+正式宿主验证两个采样与一次SDK动作；Core包/回执fixture与真实Core OS证据分开。完整build→start→正常关闭，Dext保持关闭；只必要本地回归，不新增网络专项。最终第4/5项集中人工、拖动暂缓、不合并master；整体16项就绪1/16≈6%。

- [x] 同UI采样屏障：DOWN arm后prepare、可信dispatch后交样本，UP完成后才释放作者动作；拒绝prepare不转发，异步DOWN receipt阻止后续UP。真实行为RED缺prepare构造参数→15/15；DOM已绘制矩阵begin/end保持当前visualGroups，RAF停止后按原活动时钟继续，失效/暂停/销毁释放hold；RED46/48→48/48。标准geometry现在eventSamples:true，生产Player/Core采样模式已启用，前节“尚未接线”仅为8a738f1历史状态。
- [x] Core私有msg_room_native_sample只沿拥有的Player stdout进入；同原始scope/HWND/视口/DPI与安装/consumer/button声明重核，再同Core原始DOWN/UP点配对。必要消息71/71、Core动作273/273；缺一半无动作，两半同entry后一次消费，旧原始QPC不刷新。
- [x] 实际ReleasePlayer+正式SDK event-barrier-sample-native-wire exit0：直接作者root可信DOWN/UP两份私有样本先于一次r1→n1/gesture7动作。小official几何/路由与Core包/回执为fixture。event-barrier-official-top-wire首轮实际正式DOM失败，顶层对象receipt被既有TryGetWebMessageAsString拒绝；补实质RED26/27并改为字符串，GREEN27/27，再完整构建后event-barrier-official-top-wire-final exit0：正式index/main/dom/native/frame/media/SDK的精确图标两边采样、一条官方动作、前台不变，切页/同文档/暂停/最新修订/撤销保持通过。Core包/回执仍fixture，动态几何是生产DOM行为证据48/48，本次实际wire图标静止，不冒称移动/Core OS/DPI全链通过（ERRORS #170补充）。
- [x] event-barrier-enter-native-wire-final与event-barrier-space-native-wire-final均exit0：新bootstrap/队列下原真实trusted Enter/Space、同UP正数一次作者动作保持。
- [x] event-barrier-frame-media-wire-final必要回归exit0；event-barrier-core-build-final完整四阶段后常规start Core25536/Player57252/Watchdog30248/config120196，日志20261004_043025.txt。identity共享D配置器OTHER/exit1且精确绝对路径独立核验；正常关闭Core/配置器与watcher73666 exit0，原四文件hash/缺失保持，Dext进程/开发监听/author及official临时目录0。具名阶段提交后继续source与移动补证。
- [ ] 接续source手势级准入与移动正式宿主/真实Core OS补证、Core零序号兼容收口；系统凭据窗未解除时不代填Core物理输入。拖动按用户暂缓，本地功能优先，不扩展网络专项、不中途验收/合并master；完整16项就绪1/16≈6%，最终卡第4/5项和全包7项/单次P5审查保持待执行。
## P5 转场源入口的手势准入（2026-10-04，BASE e56ad2c）
一句话目标：源Desk仍可见时，正式DOM的原生事件样本包含其按钮；Core只让同一真实sampled mouse完成证明通过源consumer/button scope，继续执行一次已配置应用/导航/控制/可信退出。
范围：当前source/target声明几何、Core原生proof专用scope、只读按钮/动作能力元数据投影、既有权限/个人动作/一次消费与退出确认重查；来源扩展不授予data/storage或无输入动作。官方源图标和直接作者root仍走实际可信dispatch屏障，无逐帧IPC，后续真正移动/实际Core OS/DPI证据保持完整要求。桌面拖动暂缓，本地功能优先，无新网络专项。
先Core源应用/导航/控制/退出行为与DOM源可见样本RED再实现，必要回归及正式Player移动图标证据；改C#后完整build→start/身份→正常退出、原四文件保持、具名阶段commit。最终卡第4/5项集中验收，不中途确认或合并master；完整16项就绪1/16≈6%。
- [x] Core私有sampled mouse完成证明专用source scope已接应用/导航/媒体控制与原生退出确认；导航仍从已有target排最后意图。只读按钮与保护动作能力可投影source，data/storage继续target活动规则，普通无proof票据不能借source。纠正媒体夹具启动阶段与bridge连接后，对已提交生产基线重跑实质RED272/281（8新增+1旧元数据期望），当前GREEN281/281；不降低1500ms/修订/原生一次消费或授权。
- [x] source声明矩形可进入可见几何，只有物理event sample包含可见source icon/widget；边界发布仍target范围，commit后source卸下。DOM RED48/50→与model合计65/65；source-moving-official-wire实际ReleasePlayer/生产正式宿主：4500ms动画进行中两个边沿多边形X不同、仍包含同一实际点，trusted dispatch后原gesture8只生成一次动作，原前台不变、切页/共享文档/暂停/撤销保持；Core输入包/回执仍fixture。
- [x] source-action-core-build四阶段通过；实际source-action-native-core-live仍在空桌面点击前命中Credential Dialog Xaml Host而停止，finally原壁纸/四文件/Room哈希/窗口旗标恢复，不计OS输入通过。常规start Core43772/Player72276/Watchdog120536/config119928、日志20261004_050155.txt；identity共享D配置器OTHER/exit1且路径独立核验。正常关闭、watcher2576 exit0，原四文件hash/缺失保持，Dext进程/开发监听/author、official、Core原生GUID目录0。保存具名阶段提交后继续。

- [ ] 下一段：动态键盘焦点当前可见取样与Core零序号兼容收口、实际Core OS/物理DPI/锁屏/还原补证。系统窗仍覆盖真实命中，不能因应用列表漏报重试；拖动暂缓，整体16项就绪1/16≈6%，最终第4/5项和全包集中验收保持。

## P5 受控焦点的 Enter/Space 可见采样（2026-10-04，BASE 59206c1）
一句话目标：已有 Core 受控焦点在转场/移动时，Enter/Space 的原始 DOWN/UP 各读取当前可见区域，同一入口两边均可见后才执行一次动作。
范围：复用 Player 同 UI 视觉保持队列、私有键盘采样标记和 Core 冻结键/焦点/QPC；作者等待真实 trusted key 回执，官方默认入口由 Core 原始物理键提供输入并只取样，不伪造 DOM 键事件。移动源入口采用完成的视觉键盘 proof；消失/遮挡/另入口取消。已有 Tab 顺序暂沿边界表，转场中重新 Tab 遍历动态可见入口后续补齐，不宣称已交付。拖动暂缓，无新增网络专项。
先必要 Core/DTO 与可信键回执 RED，再实际 ReleasePlayer Enter/Space 和正式移动官方入口验证。Core 包/回复 fixture 不替代实际 Core OS；系统凭据宿主阻挡时不重试桌面点击。改 C# 后完整 build→start/身份→正常关闭，原四文件保持，具名提交；整体16项就绪1/16≈6%，最终验收卡第4/5项集中执行，不中途确认或合并。
- [x] Core 原始 Enter/Space DOWN/UP 冻结键与焦点，采样模式下原始UP不直接完成；两边均含同入口后形成SampledVisual，再允许源动作一次消费。新API编译RED后必要Core功能288/288，作者可信键回执实质RED27/28→28/28，私有DTO/队列16/16；完整build与实际Player继续。
- [x] Player SampleKeyboard私有标记冻结键/scan/entry；作者trusted键回执后交样本，同UP释放一次SDK原请求。keyboard-visible-enter-wire与space-wire整轮exit0；keyboard-visible-moving-official-wire正式移动源图标两份不同X样本在一次默认动作前、旧鼠标/切页/暂停/撤销保持通过。官方不合成DOM键，Core包/物理键/回复fixture；实际Core OS仍待系统凭据宿主解除。
- [x] keyboard-visible-core-build完整四阶段通过；常规start Core48472/Player53308/Watchdog97636/config116124，日志20261004_052345.txt。identity共享D配置器OTHER/exit1且精确路径独立核验。正常关闭、watcher58656 exit0，原四文件SHA256/缺失保持，Dext进程/1420/1421/1621监听/author及official GUID目录0；以下改动随本阶段具名提交保存。

- [ ] 下一段：转场动态入口的原生Tab取样和移动焦点显示、Core零序号兼容收口；实际Core OS/物理DPI/锁屏/还原保持待补，系统凭据宿主未解除时不重试桌面点击。拖动暂缓、本地功能优先、无新增网络专项；整体16项就绪仍1/16≈6%，最终第4/5项和七项/单次P5审查集中执行。

## P5 原生Tab当前可见选择与移动焦点（2026-10-04，BASE 34190c5）
一句话目标：真实Tab/ShiftTab选择按当时可见区域重新计算，官方焦点轮廓随同入口移动/裁剪，隐藏时收起且不丢逻辑焦点，后续Enter/Space沿既有可见配对执行。
范围：Core单次Tab原始DOWN冻结正数关联/方向/QPC，Player同UI读取并保持当前已绘制source/target区域后回Core选择；Tab不激活动作、不转发作者DOM键、不修改作者DOM焦点。已有键盘/鼠标、暂停与修订规则复用，无逐帧IPC；焦点仅本地RAF更新。拖动暂缓、无新增网络专项，实际Core OS/物理DPI/锁屏/还原保持待补。
先Core当前顺序/同动作多entry/空表与队列单次采样功能RED、DOM轮廓运动/隐藏RED；正式ReleasePlayer移动源Tab取样/焦点跟随验证，Core包与回复fixture单列。完整build→start/身份→正常关闭、原四文件不变、具名提交。人工最终仍卡第4项Tab与Enter/Space一次动作、长按/切窗取消，第5项移动/遮挡/多入口/DPI集中执行；整体16项就绪仍1/16≈6%，不中途确认或合并。
- [x] Core raw Tab/ShiftTab冻结原QPC/方向/正数关联，单次SampleFocus只在当时可见表按稳定entry选择，不创建动作proof；原生focus队列先撤销旧作者对、只prepare/complete不arm/转发/释放动作。API编译RED后Core291/291，必要队列17/17。
- [x] DOM焦点轮廓每个默认动画绘制帧按当前可见多边形刷新，出画布隐藏且保留逻辑entry，commit/失效仍清空；实质RED50/52→52/52，无逐帧IPC。tab-visible-moving-official-wire实际ReleasePlayer/正式宿主整轮exit0：一次私有Tab样本、source同动作第二入口、轮廓真实移动/出画布隐藏、geometry计数/版本与动作计数不增加、前台不变；原鼠标/键盘/切页/暂停/撤销通过，CoreTab/选择包与回复fixture。
- [x] tab-visible-core-build完整四阶段通过；常规start Core96444/Player49548/Watchdog78756/config31380，日志20261004_054313.txt。identity共享D配置器OTHER/exit1且精确路径核验；正常关闭、watcher25867 exit0，原四文件hash/缺失保持，Dext进程/开发监听/author及official GUID目录0。以下改动随具名阶段提交保存。

- [ ] 接续本地功能：连续Tab及Tab取样尚未返回时立即Enter/Space的Core顺序仲裁；当前单次焦点请求只保留最新gesture，不能把本段宣称为快速键盘全链完成。随后Core零序号兼容收口与持续作者动画/最终组合门槛；实际Core OS/DPI/锁屏/还原仍待系统凭据宿主解除。拖动暂缓、无新增网络专项，完整16项就绪1/16≈6%，最终7项/单次P5审查保持待执行。

## P5 连续Tab与取样待回时激活顺序（2026-10-04，BASE 910b964）
一句话目标：连续真实Tab/ShiftTab每次意图按原顺序处理，紧接的Enter/Space即使UP先到也等待此前Tab的最终焦点，再沿原始QPC/键/序号发送一对并取样完成。
范围：Core有界未回Tab队列与焦点屏障、可测试私有键派发协调器及真实WebWebView2接线；两个键边沿保持实际时间，不因等待重新签输入。新鼠标/几何/会话撤销仍取消待办，焦点样本不生成动作；原单个激活手势覆盖语义不扩展为多动作队列。拖动暂缓，无新网络专项。
先连续Tab/早到UP/屏障截止的生产Core功能RED，再真实ReleasePlayer与生产Core类组合验证；Core原始OS事实/完整Core窗口/动作回复fixture单列，系统凭据宿主未解除时不重复桌面点击。改C#后完整build→start/身份→正常退出、原四文件保持、具名提交；最终卡第4/5项集中，完整16项就绪1/16≈6%，不中途确认或合并。
- [x] Core有界FIFO保留每次未回Tab，Enter/Space等待此前最终焦点；私有派发协调器在早到UP时发送原QPC/键/序号的一对。API编译RED后实质行为RED291/295→GREEN295/295，过期Tab取消等待键，不续签期限。
- [x] keys-ordered-moving-official-wire实际ReleasePlayer/正式宿主加生产Core authority/key delivery整轮exit0：两个未回ShiftTab逐一选second→first，早到Enter UP等最终focus再只发原QPC/序号的一对，两份实际可见样本形成生产proof后仅一次动作；前台保持。raw OS边沿/完整Core窗口/动作回复仍fixture，原鼠标/移动键/焦点/切页/暂停/撤销回归通过。
- [x] Core295/295与实际生产Core类/ReleasePlayer组合通过；keys-ordered-core-build四阶段，常规启动四路径/产品身份核对及正常关闭、watcher51624 exit0，原四文件保持、进程/监听/原生GUID夹具0；本节随具名阶段提交保存。

- [ ] 接续Core零序号兼容收口与持续作者动画组合；实际Core OS/DPI/锁屏/故障还原及最终7项/单次P5审查保持。拖动暂缓，系统凭据窗未解除不重复桌面点击，本地功能优先、无新增网络专项，完整16项就绪1/16≈6%。

## P5 持续作者动画的本地组矩阵（2026-10-04，BASE 471367d）
一句话目标：作者持续发布source/target/shared矩阵时，官方图标、Widget与焦点同步移动，原生事件样本读取实际已绘制位置，纯视觉帧不反复清焦点或向Core重发几何。
范围：沿既有scene.publishGeometry API区分视觉组矩阵与按钮/占用/视口结构变化；视觉更新只在Player绘制，结构变化仍撤销并重新确认原生几何。原生sample hold期间保留已绘制位置，新的视觉帧只保留最新值，匹配end后应用；快照/结构/暂停/销毁取消旧保持。共享文档与iframe尺寸持续，不扩大作者公开API或动作权限。Core零序号兼容接续；拖动暂缓，无新增网络专项。
先新增持续视觉与hold功能RED，再实现并跑必要模型/DOM/SDK回归和实际ReleasePlayer连续仪表盘；原始Core OS边沿/完整Core窗口/动作回复fixture继续单列。只改前端按项目start.ps1启停，原四文件保持，具名阶段提交；最终人工第2项仪表盘跨页实例不变，第4/5项当前焦点/移动命中集中，完整16项就绪1/16≈6%，不中途确认或合并master。
- [x] 模型区分applyVisualGroups与按钮/占用结构改变，纯视觉仅本地绘制Widget/图标/焦点并保留原生inputVersion；持有样本时只排最后矩阵。实质DOM/模型RED67/70，旧边界断言改读当前事件样本、生命周期失效夹具修正后含SDK必要回归86/86。
- [x] author-visual-continuous-wire-final实际ReleasePlayer/生产SDK整轮exit0：1920×1080基准同一Widget文档/1600×280内部视口bottom→full→bottom、普通图标/焦点与仪表盘运动、两次作者完成回告、Core fixture提交、实际可见样本，纯帧Core geometry/动作0、前台保持。正式样包Schema/资源通过，已同步原陈旧SDK；Core包/回复/raw OS键仍fixture。补普通图标source组实质RED后必要回归87/87。
- [x] 必要模型/DOM/SDK87/87、样包Schema/资源/当前SDK一致与两个实际Player整轮通过；完整四阶段构建、常规start身份/四路径核对、正常关闭watcher3287 exit0、原四文件/进程/监听/原生GUID夹具保持；以下随具名阶段提交保存。
本段实机发现与接续范围：640×480/scale1.5会触发既定CSS像素尺寸保留和临时移位，固定基准面板矩阵不能据此断言满页。样包先采用1920×1080设计基准验证，物理DPI/多尺寸最终门槛保持；普通图标属于current Desk，稳定态也应使用source组，shared只控制共享呈现，避免仪表盘矩阵把普通图标移出画面。新增此组归属的功能回归后实现，样包普通图标保留。

- [ ] 接续Core零序号兼容与作者矩阵/小窗口有效布局组合；系统凭据宿主未解除时不重复桌面点击，实际Core OS/DPI/锁屏/还原与最终七项/单次P5审查待补。拖动暂缓，完整16项就绪1/16≈6%。


## P5 作者矩阵与小窗口有效布局（2026-10-04，BASE 490fcbb）
一句话目标：持续Scene读取官方当前有效组件矩形，仪表盘在小窗口也能从底部展开为整页，并在实际缩小/恢复中保持同一作者文档与逻辑视口。
范围：SDK session/geometry增加只读placements；Scene只读当前可见组件的组矩阵前矩形，其他消费者只读自身组件矩形，不含保存布局或私人绑定。同版本有效矩形变化按频道序号发布，完全相同不通知，视觉帧不通知。样包矩阵从有效矩形推导，异步publish中收到resize/geometry仍保留待绘制信号。桌面拖动暂缓，Core零序号/实际Core OS/物理DPI/锁屏/还原不在本段完成，无新增网络专项。
先SDK/Frame/DOM功能RED，再实际ReleasePlayer640×480 scale1.5底部→整页→底部、放大→缩回验证；Core包/回复/raw OS键保持fixture。改C#探针后完整build→start/身份→正常关闭，原四文件保持并具名提交。最终人工卡第2项切页及缩放确认仪表盘不重建，第5项物理DPI集中；16项就绪仍1/16≈6%，不中途确认或合并。
- [x] SDK/Frame/DOM增加当前有效矩形投影与同版本有效变化；三个实际功能RED后必要模型/DOM/Frame/SDK108/108。纯视觉不发geometry，收缩/恢复保留文档，SDK类型与样包接续。
- [x] 样包按有效矩形推导矩阵、flight期间保留dirty待绘制；actual effective-layout-author-wire-final整轮exit0：640×480/scale1.5底部→整页→底部、1920×1080放大→缩回，文档/1600×540逻辑视口不变、有效布局恢复；Core包/回复/raw OS键仍fixture。
- [x] 必要模型/DOM/Frame/SDK108/108、类型/语法、Schema/资源/SDK一致、原正式Player输入整轮回归通过；完整四阶段build、常规start/身份与正常关闭、watcher96341 exit0、原四文件不变及进程/监听/原生GUID目录0；本节随具名阶段提交保存。

- [ ] 接续Core零序号兼容与最终组合；实际Core OS/物理DPI/锁屏/故障还原及最终七项/单次P5审查保持。最终卡第2项新增切页后缩小/恢复，确认仪表盘实例与逻辑尺寸不变、满宽/底部恢复；拖动暂缓，本地功能优先，完整16项就绪1/16≈6%。


## P5 原生动作只关联原始正数输入（2026-10-04，BASE 239a16b）
一句话目标：取消Core“零序号取最近完成”的旧回退，所有原生启动、导航和系统控制必须明确匹配原始DOWN的正数序号，迟到请求不能借后来输入。
范围：Core proof/bridge签名要求显式序号；私有Player parser消费动作只接受正数。作者公开SDK仍不提交序号，由已有native frame见证/原始request匹配通道补齐。无输入失败回复可保留0，不能用回复0请求消费；不扩大网络专项，桌面拖动暂缓。
先必要关联功能RED和现有Core/消息夹具迁移，再生产类+实际正式Player正数鼠标/键/焦点组合回归。改C#后完整build→start/身份→正常关闭、原四文件保持、具名提交。实际Core OS/物理DPI/锁屏/还原仍待系统凭据宿主解除，不重复桌面点击；最终卡第4项连续键与一次动作集中执行，16项就绪仍1/16≈6%，不中途验收或合并。
- [x] proof与三类bridge消费方法必须显式传序号，零不能查询最近完成。实质Core RED295/299→299/299，旧夹具改传实际构造的完成序号；正数但错消费者/几何明确StaleInput。
- [x] 四类消费消息只接受1..JS安全整数上限。实质消息RED71/72→72/72，作者公开request仍无序号；构建后positive-input-official-wire-final实际正式Player整轮通过，原始OS/完整Core窗口与回复fixture单列。
- [x] 完整四阶段positive-input-core-build，正常start Core73636/Player39996/Watchdog40208/config96192、日志20261004_071614.txt；共享D配置器identity OTHER/exit1但四精确路径独立核验。正常关闭、watcher94664 exit0、原四文件保持及进程/开发监听/原生GUID目录0；本节随具名阶段提交保存。

- [ ] 接续独立V3-P6-001原生Room创建与节点保存；本分支保留P5实际Core OS/物理DPI/锁屏/故障还原及最终七项/单次审查补证，不将fixture当实机通过。桌面拖动暂缓，完整16项开发就绪1/16≈6%，不中途验收/master合并。

## V3-P6-001 原生Room创建与节点保存（2026-10-04，BASE 99dd8fe）
一句话目标：配置器创建原生v3 Room，两个Desk与四类本地内容、默认切换/Dock引用可保存重开、撤销重做并实际应用。
分支feat/V3-P6-001-configurator-create，独立worktree v3-configurator-create；承接未合并P5依赖，最终集中验收前不合并。范围外：Dock模板差异/私人绑定UI/系统AppBar/分享、桌面拖动和新增网络专项。详见plans/V3-P6-001-configurator-create.md。
- [x] Task1：稳定ID/历史功能RED3/3失败→GREEN；生产Rust创建、四类导入/HTML依赖、原子保存重开、失败原文保持及正式安装RED0/3→GREEN3/3；含原契约必要回归34/34。
- [x] Task2编辑基础：配置器v3新建/打开入口、独立节点编辑、四类素材/启动待机选择、过渡、Dock引用和默认图标，保存后调用正式apply_room；私人物料不进作者文档。Vitest66/66、npm build和cargo check通过；实际浏览器创建/名称/顺序/起点/图标/撤销重做/草稿重开及深浅绘制通过。浏览器文件/Core仍mock，真实Tauri应用保留Task3。
- [ ] Task3：真实Tauri/原生安装/Core/Player集成及正常退出，证据和一次最终整体审查。
- [ ] 用户最终集中验收（与本包独立验收卡一致）；P5真实Core OS/物理DPI/锁屏/还原继续补证，桌面拖动暂缓。完整16项就绪1/16≈6%。

P6本段证据：p6-document-red/policy-red/delete-reference-red、p6-authoring-red/final（34/34）、p6-vitest-full（66/66）、p6-ui-build-final、p6-tauri-check、p6-ui-browser-final及p6-ui-dark/light。工具首次UTF-8/JS插值和首轮主题探针定位失败未算通过。旧v3-continuous重复icon ID修正为detail-view，正式样包检查恢复。
接续Task3注意：active_room仍仅识别v2安装路径，v3应用状态需接正式Core身份/宿主元数据；v3房间库改名等尚复用v2校验，需在真实入口核对并明确支持边界。四类测试中的视频/GIF仅验证作者文件复制/安装，不声称该字节可实际解码。真实Tauri创建保存重开/应用、真实四媒体播放/切页/重启、用户数据精确保护和最终审查尚未执行。Dext本段未启动，隔离临时文件由测试所有权清理，浏览器Vite停止后提交。完整16项就绪1/16≈6%。

### P6 Task3 接线（2026-10-04，BASE2ba11e5）
本段目标：真实配置器创建/导入/保存/重开，正式安装应用后由实际Core/Player状态识别当前v3副本；库改名保持身份和资源。先补原生应用来源映射与改名功能RED，再真实Tauri/四媒体实际解码/切页恢复，原用户状态精确保护并正常退出。本地功能优先；凭据宿主遮挡时不重复Core OS点击，输入/DPI最终门槛保持。
- [x] host私有来源记录匹配当前安装快照，active_room同时识别v3路径；原生库改名保留UUID和资源。两个实际功能RED后生产作者/契约36/36；实际配置器UTF-8改名、立即重开、应用来源匹配通过。
- [ ] 真实Tauri文件/应用、实际Core/ReleasePlayer四媒体呈现、切页与重启证据；有fixture明确单列。
- [x] 必要回归/构建与用户文件恢复、正常退出；本节随具名阶段提交保存。最终集中验收/一次整体审查继续。

- [x] 真实Tauri创建/四类导入与HTML目录依赖/Dock、保存重开稳定ID、实际Core/ReleasePlayer应用与运行来源匹配。由配置器设起点→重应用观察四媒体加载/呈现、HTML CSS/JS及Dock运行；prompt/选择文件为输入夹具，其余生产链真实。
- [x] UTF-8改名后立即打开正确Room，身份/四Desk/Dock/资源与应用来源保持；实际撤销/重做；缺资源保存明确失败，原清单字节不变，未保存状态可见。重复同安装应用等新session/Player，不能拿旧会话或RPC排队回执报告成功。
- [x] 同安装副本普通Core退出→启动：同Room/Desk/安装戳/来源，新session/Player，HTML/Dock重新运行；Desk恰为配置起点，不冒称非起点checkpoint已由本探针证明。
- [x] Vitest66/66、生产Rust36/36、两个具名v2库改名/Windows路径回归、npm build和cargo check；此前完整build.ps1四阶段通过。最终start watcher78843/75916 exit0，配置器先正常关再普通Core退出；原四文件字节/缺失和原localStorage恢复，Dext进程/1620/1621/9226/9227监听及自有GUID/安装/观察器0。
- [ ] 真实桌面默认导航/动画同步及非起点重启、系统选择框操作、一次最终整体审查与集中确认保留。P6本地闭环已贯通，按连续授权接续独立P6-002；完整16项仍1/16≈6%，不合并master。

证据在本线程evidence目录：p6-native-config-live-2初次应用失败、p6-canonical-live、p6-media-native-live/actual-media、p6-save-failure-live、p6-restart-live/actual-restart、p6-final-product-live/native-final-evidence、p6-final-restore。工具选择器/误选房间/作用域/日志失败与产品失败分开记录；最后真实功能和精确恢复单独通过。见ERRORS225–227。拖动暂缓，无新增网络专项，最终本卡五项/P5七项保持。

## V3-P6-002 Dock模板与交互编辑（2026-10-04，BASE6d15d1b）
一句话目标：配置器选择原生Dock模板后自动识别区域，共享数据/按钮配置与Desk逐字段差异可保存重开，实际Core/Player呈现。
独立feat/V3-P6-002-dock-template / v3-dock-template；承接未合并P6-001依赖。范围外：AppBar/顶层Dock、私人目标/皮肤、分享；拖动暂缓，无新增网络专项。Native执行与最终集中验收沿用户连续授权；设计/计划在plans，本包人工六项见独立验收卡。
- [x] 已读当前计划/契约/工作流，创建独立worktree/分支，写设计、实施计划与验收；CodeGraph未初始化，使用rg兜底，不擅自索引。
- [x] Task1 模板描述/稳定ID/共享差异/删除引用，生产作者文件完整导入与功能RED→GREEN；原生目录/导入/检查命令及Tauri编译通过。
- [x] Task2 两款官方HTML模板、独立编辑UI/作者公开数据与默认操作；实际浏览器草稿重开/历史/字段继承/删除通过，原生Tauri保存重开随Task4。
- [x] Task3 当前Core只读授权状态/允许/撤销已贯通配置器/Tauri/生产RPC；限定功能6/6、UI夹具及真实允许/撤销/新安装/重启、完整build→start通过。实际桌面读数仍随Task4。
- [ ] Task4 真实Tauri/Core/Player/数据/几何/重启证据，原状态保护与正常退出、必要回归及具名提交。
- [ ] 最终集中本包六项/P5物理门槛和一次整体审查；不合并master，完整16项仍1/16≈6%。

- [x] Task1 模型七项功能RED→GREEN：模板共区组件/按钮稳定身份、只改叶子/共享继承、null与数组、删除引用与新ID、Desk默认动作与引用清理。原生模板目录与完整HTML/CSS/JS/SDK资源导入已接；继续正式保存/安装与构建核对。

- [x] Task2 Dock保留区RED→GREEN；普通图标/Widget避让已引用Dock固定placement，不引用的Desk还原作者位置。原精确遮挡检查改为真实作者shared矩阵移动Dock覆盖图标，继续验证当前可见多片区域，未删除旧门槛。DOM57/57，模型/文档10/10，生产作者5/5+Dock3/3，作者HTML夹具1/1和编辑UI夹具、npm build/cargo check通过。
- [ ] 接续Task3当前Core只读能力允许/撤销及状态读回，再Task4真实Tauri/Core/Player生产集成。浏览器数据/动作是明确夹具，未冒称活体；本轮不启动Dext、不改用户数据。完整16项仍1/16≈6%。

- [x] 修正复用node_modules junction的Vite本地字体403：只加入依赖真实目录，浏览器资源检查与字体就绪补证；不扩大网络专项。

- [x] Task3开工及接线完成：Core个人只读授权独立集合+当前Coordinator编辑/读回→两份proto与Tauri→配置器四项明确允许/撤销。先跑限定--read-grants功能RED，接完整build.ps1→start.ps1；实际数据/原状态恢复依Task4，不增加网络专项。

### P6-002 Task3授权接线与生产模板集成（2026-10-04，BASE27e9f2a）
- [x] Core个人readGrants独立保存四种只读授权，当前安装记录优先、旧grants兼容，无关目标/按钮/布局/KV/控制授权保持；当前Coordinator读回/原子编辑，暂停可编辑、实际数据仍遵循桌面规则。限定--read-grants功能0/6→6/6，含真实时间provider、撤销、旧安装不提升、保存失败原字节与无变化不发布。
- [x] 两份proto/Core RPC/Tauri命令和独立本机授权面板已接；四项逐项允许/撤销不改作者草稿/清单，副本失效清旧状态，失败保留已确认值。UI运输夹具实际RED缺复选框→GREEN，原Dock编辑夹具通过；npm build/cargo check和完整build.ps1四阶段通过。
- [x] 实际Tauri创建两Desk/模板导入/完整资源/共享与稀疏差异/保存重开；Core应用、当前授权读回/独立允许/撤销和作者字节/已保存状态保持。原生ReleasePlayer/正式SDK三栏六个区域可见、按钮几何accepted；当前Core operable=false，三个读数denied并隐藏，不能计真实读数成功。
- [x] 真实普通Core退出→启动，同Room/Desk/安装戳/授权，新session/Player，模板与几何重新初始化；替换导航模板保留组件/共有按钮ID和旧资源，新安装授权全false，再允许time不带入hardware。两款生产模板运行已核对。
- [x] 当前代码完整build→start；配置器JS close/minimize默认权限未开放，不为探针扩权。原localStorage精确恢复后按核对PID/路径正常OS关窗，再普通Core shutdown；start watcher39064 exit0。原四文件字节/缺失精确恢复、自有Temp及安装/前代/source记录清理，Dext/开发与调试监听0；最终只读恢复核对exit0。本节随具名阶段提交保存。
- [ ] Task4余项：实际桌面可读时的真实值/撤销可见更新、物理默认导航/同实例切页/缩放等集中；凭据宿主未解除不重复Core OS输入。一次最终整体审查和本包六项/P5七项仍保留；接续P6-003本地编辑，完整16项就绪1/16≈6%，不合并master。

本段证据：p6-read-grants-core-final（6/6）、read-grants-ui、dock-ui-with-grants、read-grants-build/tauri-check、dock-native-live、dock-grants-native/native-evidence、dock-before/after-restart、dock-new-install、dock-runtime-start/restored；实际配置器/Player截图在本线程evidence目录。首轮check即时断言、按URL定位不透明沙箱帧、默认window权限和末行日志重定向均为探针问题，按ERRORS #230/#227接续；没有把工具失败算产品RED或扩大网络专项。

## V3-P6-003 统一按钮与个人呈现编辑（2026-10-04，BASE6c32e66）
一句话目标：发现当前原生Room所有按钮，配置本机动作/目标/皮肤和独立普通图标呈现，不改分享作品的私人边界。
独立feat/V3-P6-003-personal-editor / v3-personal-editor。范围外：顶层Dock、游戏、分享、完整试验台；拖动后置，无新增网络专项。manual六项见独立验收卡，连续开发/最终集中，完整16项1/16≈6%。
- [x] 顺序核对README/ROADMAP/TODO/ERRORS及V3_PLAN/D05/本轮Core模型；创建依赖6c32e66的独立worktree/分支，计划和验收先写；CodeGraph目录存在但未初始化，rg兜底，不擅自索引。现有依赖junction复用。
- [x] Task1：Core个人编辑读回/覆盖/目标管理、限定--personal-editor本地功能RED/GREEN，proto/Tauri接线/完整构建。
- [ ] Task2：统一按钮搜索与目标/动作/皮肤、普通呈现增删/历史模型和编辑UI；源Room与私人覆盖分开。
- [ ] Task3：正式Player普通图标皮肤与短时定位；必要模型/渲染/实际Player证据。
- [ ] Task4：真实Tauri/Core/Player/普通重启与原状态精确恢复/正常退出，具名提交；最终集中本卡/P5物理门槛/单次审查。

- [x] Task1 Core七项本地功能实际RED0/7→GREEN7/7；所有声明/未绑定发现、同目标启动调度、覆盖/皮肤重读重置、全局删除跨Room引用保持、只启用所选动作、失败原字节及无变化不发布。已接Coordinator/proto/Tauri，继续实际构建与配置器UI；不增加网络专项。

### P6-003 本机编辑与正式皮肤集成（2026-10-04）
- [x] Core个人编辑七项0/7→7/7，官方皮肤/临时定位两项7/9→9/9；Coordinator泛型包装、双proto、RPC/Tauri接线完成，仅旧只读授权必要6/6回归。无新增网络专项。
- [x] 当前全按钮/未绑定/其他Desk搜索与来源，动作、application/file/url目标库、应用库选择、删改确认/恢复默认和皮肤UI接线。实际配置器创建目标/绑定/皮肤保存，作者原文无目标ID/路径/参数/skin；其余删改/重置UI实际证据继续。
- [x] 现有按钮独立普通呈现模型3项RED→GREEN，连原文档6/6；实际第二图标、撤销重做和保存应用，新iconId同buttonId，作者入口仍在。删除呈现保留按钮/目标/其他引用；拖动后置。
- [x] 官方presentationRead→ReleasePlayer→DOM私人皮肤；真实两图标glass→outline，同作者iframe保持、SDK几何accepted。DOM59/59；实际operable=false时定位最初visible=false，ERRORS #232修复视觉读取，针对RED→GREEN2/2且动作采样仍为空。修复后实际定位待继续。
- [x] npm build、cargo check、Core完整四阶段build→start通过。ActiveRoom来源camelCase错误修正，重新打开实际面板可用（ERRORS #231）。最后纯前端字段/视觉定位收尾待下一轮打包及普通重启核对。
- [x] 用户将全屏游戏，立即正常关配置器77036、Core100348；watcher30520 exit0。原localStorage/四文件字节和缺失精确恢复，自有Temp/安装/前代/source记录清理，Dext/1620/1621/9226/9227监听0。
- [ ] 游戏期间不启动Dext/配置器、不编译、不做桌面输入；轻量修复与记录随本轮具名提交。结束游戏后接实际定位/普通重启、Desk改名排序保持、目标删改重置和呈现删除UI；最终本卡六项/P5门槛及一次整体审查，完整16项仍1/16≈6%，不合并master。
证据：本线程evidence的p6-personal-editor-red/core（9/9）、presentation-red、read-grants-regression、model-red/model（6/6）、ui-build/tauri-check/core-build、dom（59/59）、locator-red/green（2/2）、native首轮（来源字段失败）/native-resume（真实目标/呈现/皮肤）、native-evidence及截图、runtime-start/restored。定位旧visible=false、物理动作未完成单列。

### P6-003 游戏期间轻量选择保持（2026-10-04，BASE e495615）
一句话目标：目标库保存/删除和视觉定位不丢用户尚未保存的按钮动作/Desk/皮肤选择；显式按钮保存失败仍显示原确认值。范围外：实际Player重启/窗口/构建，继续保持Dext停止。
- [x] 把当前任何RPC回执都重置按钮表单的问题提取为生产选择更新函数；以几个真实操作序列用Node原生TypeScript执行验证RED→GREEN，不调用TS/Vite编译器或浏览器。
- [x] 接入UI成功/失败回执，记录坑与验收第5项选择保持步骤；具名提交。实际界面、定位修复和普通重启保留游戏结束后集中。

- [x] 统一按钮列表按Core当前有效动作显示绑定状态；将启动改为导航不再误报未绑定，改为缺目标启动必须显示未绑定。仅同组三个检查加一项本地状态序列。

本轮轻量功能证据：生产TS直接由本机Node执行，选择保持实际0/3→3/3，状态标签3/4→4/4；一轮最终进程约0.25秒，未运行编译器/浏览器/应用，也未触及用户数据。目标元数据保存/定位成功与失败保留待保存动作/Desk/目标/皮肤；明确删除仅清对应目标；显式按钮保存失败回到原确认值，重置失败保待保存选择。列表以Core有效动作标识本机导航和缺目标启动（ERRORS #233）。最后完整打包/实际UI/修复定位/普通重启仍等结束游戏；本轮具名提交，不合并，整体1/16≈6%。

### P6-003 游戏期间目标删除表单收尾（2026-10-04，BASE 2a28dd2）
一句话目标：明确删除目标成功后关闭该目标的旧编辑表单，避免随后保存无意重建；保存或删除失败保留填写内容。范围外：构建、窗口、实际Player及桌面输入，保持游戏期间低占用。
- [x] 用生产TS直接Node验证删除/保存后的目标表单状态序列；不启动编译器或应用。
- [x] 接入成功回执，补验收第5项和错误记录，随本轮具名提交；实际UI留待游戏结束。

轻量证据：旧删除流程提取到生产函数实际5/6→6/6，Node最终约0.14秒。当前表单只有同ID目标保存/删除被Core确认才关闭；失败保留名称/路径/参数/稳定重试ID，无关按钮定位不关闭。真实UI与打包未运行。整体16项1/16≈6%，游戏约束保持；ERRORS #234。

### P6-003 游戏期间普通呈现数量收尾（2026-10-04，BASE cd8b9aa）
一句话目标：新增普通图标遵守每Desk512图标/Room1024按钮的现有契约，满额时有明确反馈且原作品不被写成无法保存的状态；复用现有按钮不消耗按钮额度。范围外：窗口、构建、真实Core输入，继续游戏期间轻量。
- [x] 生产TS直接Node限定功能验证数量满额和现有按钮复用，失败前后原文保持。
- [x] 将同一数量判断接模型和两处新增入口，补验收第3项/错误记录并随本轮具名提交；实际UI待游戏结束。

轻量功能实际6/8→8/8约0.16秒：512图标拒绝两个新增路径且原文不变，511可加最后一项；1024按钮拒绝新声明但可增加现有按钮呈现、不改按钮ID。两UI入口共同采用数量判断，禁用与可见提示。未构建/启动，实际UI及普通重启继续游戏后；完整16项1/16≈6%，ERRORS #235。

## V3-P7-001 试验台与作者诊断（2026-10-04，BASE99c6ea7）
独立feat/V3-P7-001-workbench / v3-workbench；用户要求少验证优先功能，沿V3_PLAN全范围顺序推进。
一句话目标：在配置器中用正式宿主/SDK预览当前草稿，多尺寸/Desk/缺数据和权限模拟、按钮及占用区域诊断可定位至资源与ID。
范围外：真实系统动作/个人数据写入、桌面拖动、顶层Dock/Game/分享；游戏期间不构建/窗口/桌面输入。人工六项见独立卡。
- [x] Task1 编码：只读草稿预览资源会话/撤销，复用资源校验与正式宿主源码，不改用户磁盘；运行证据待Task4。
- [x] Task2 编码：独立模拟Core适配器、Desk过渡/生命周期/授权/示例数据及正式渲染/SDK；运行证据待Task4。
- [x] Task3 编码：编辑器入口、多尺寸、自适应预览、按钮/占用/资源/错误诊断；不混同桌面已应用状态，实际UI待Task4。
- [ ] Task4 必要构建和一次功能冒烟/实际Tauri资源与SDK闭环，最终集中验收；游戏期间明确待做。
开工时进度0/4=0%（历史起点）；当前进度见末尾。完整16交付就绪1/16≈6%，未合并master。

P7首轮代码：只读资源会话/协议支持媒体Range，准备/释放命令接线；Vite raw直接打包正式geometry/layout/runtime/frame/media/dom/style，不复制渲染算法。独立iframe/模拟快照、Desk过渡/作者导航、生命周期、内存KV、只读数据状态与系统动作拒绝；多尺寸调整保持iframe身份，实际动态按钮采样/占用/组件覆盖层、资源和SDK/布局错误UI。源接口核对修正SDK params.action/公开buttons.action字符串、区域随当前采样与数据控制不误切Desk（ERRORS #236）。仅node --check与diff --check通过，没有编译/浏览器/应用/攻击矩阵；TS/Rust类型和真实资源/SDK尚未运行验证。编码3/4=75%，完整交付就绪1/16≈6%。随本轮具名提交，不合并。

### P7 创作操作收尾（BASE ec72be7）
目标：试验台可调整共享组件的公开默认placement、查看实际资源源码、给已开放数据源输入任意JSON示例；预览覆盖层/模拟不写私人状态，布局明确应用到草稿并沿编辑器保存/历史。
- [x] 同一正式1920×1080placement约束、稳定ID/引用保持，组件布局显式应用到作者草稿；实际保存/历史待Task4。
- [x] 有界资源源码读取与取消，按钮/消费者可定位对应文件；自定义JSON示例/重置示例接正式SDK模拟通道，实际运行待Task4。
- [x] 本轮具名提交，实际构建和一次冒烟留Task4/游戏后，不加测试矩阵。

本轮创作代码：共享Dock/Widget placement表单→现有作者history，明确应用草稿后再返回保存；ID/引用不换。消费者资源链接→HTML/CSS/JS/JSON只读源码，Range最多256KiB、长文件标截断、切换/退出取消；空资源416回退空文件GET。任意合法JSON示例可独立保存到模拟设置，解析失败保旧值，恢复默认不改其他数据源；缺失/拒绝状态仍优先。只有JS语法与diff核对，没有编译/浏览器/应用或新测试矩阵。Task1-3编码完成、Task4待，当前仍3/4=75%；完整就绪1/16≈6%。审批超时未执行后一次原参数重试成功，ERRORS #237。

## V3-P2B-001 顶层 Dock 与 AppBar 原型（2026-10-04，BASE7a1f31b）
独立feat/V3-P2B-001-top-dock / v3-top-dock。目标：普通软件前的HTML Dock、正常原生输入与焦点、触边和AppBar工作区可复现，给P8复用。范围外：正式Core/动作/任务栏替代恢复/游戏覆盖/拖动。
Ruling：用户少验证优先进度，沿P7依赖继续功能；P7编码3/4=75%/运行待，不称完成。游戏期间不编译/启动/桌面输入。
- [x] Task1 编码独立原生窗口、底部/DPI高度和正常输入/焦点；实际行为待Task4。
- [x] Task2 编码AppBar模式/恢复与全屏抑制；实际Windows门槛待Task4。
- [x] Task3 编码本地交互诊断样包和手动启动脚本；未运行。
- [ ] Task4 游戏后必要build→start及一次原生功能冒烟，六项人工验收见独立卡；最终集中不合并master。
开工编码0/4=0%；完整16项仍1/16≈6%。CodeGraph未初始化，rg兜底；不追加网络专项。

P2b首轮代码：ReleasePlayer显式--dext-dock-probe分支，不接Core/WorkerW输入；可复用native HWND宿主、主屏底部/48..240 DIP与20%上限、非激活鼠标及明确键盘/Escape恢复、AppBar两步协商/最终矩形/注销、自动隐藏、全屏及Explorer/DPI重新定位。固定HTML真实事件计数和当前原生前台/窗口/工作区诊断；独立Mutex、临时profile/events日志、30..900秒自动退出（默认180），手动脚本只用当前worktree部署的ReleasePlayer。代码核对修正DPI默认处理改变实际矩形后不能只比较旧缓存、初次跨DPI需再布局、即时工作区用GetMonitorInfo，不计运行通过。node --check与PowerShell仅ParseFile通过，未运行脚本/编译器/应用；C#编译/原生输入/透明/焦点/DPI/AppBar/异常退出均未验证。编码3/4=75%，Task4待；整体16项就绪仍1/16≈6%，本轮具名提交不合并。
源码收尾：原型先隐藏已Shown的HWND再布局，防止autohide/初始全屏的逻辑false遗漏真实窗口；加入DWM扩展框/黑色client及明确透明空隙诊断，仅记录HRESULT、真实透出仍必须实机验证；注销后即时工作区读取异常不阻止剩余关闭。ERRORS #238。

## V3-P8-001 顶层 Dock 自动隐藏（2026-10-04，BASE2afcfd5）
独立feat/V3-P8-001-dock-autohide / v3-dock-runtime；目标和五步见plans/V3-P8-001-dock-autohide.md，六项人工步骤见独立卡。范围外：常驻占位产品模式/游戏覆盖/拖动/分享。
Ruling：沿用户少验证优先功能与集中验收授权推进；游戏期间不编译/启动/桌面输入；P2b原生证据继续保留，不等于产品已就绪。
- [x] Task1 编码：全局Dock偏好独立原子保存/当前Room可用性与宿主尚未连接状态、proto/Tauri/设置页；编译与实际运行待Task5。
- [x] Task2 编码：Core单实例Dock Player与绑定/共享会话/关闭重建，真实运行未证。
- [x] Task3 编码：正式Dock视图/SDK/几何/实际OS输入路由/受控键盘及可见数据已接线，编译与Windows运行未证。
- [x] Task4 编码：主任务栏替代/原状态恢复、独立看护/落盘记录/进程与心跳失效/Explorer恢复已接线；Windows运行未证。
- [ ] Task5 游戏后必要build→start/一次原生冒烟、最终集中验收与整体审查。
开工0/5=0%，完整16项就绪1/16≈6%；CodeGraph未初始化，rg兜底，不扩网络专项。

P8 Task1代码：v3/dock-preferences.json全局独立保存，默认关闭/自动隐藏/128 DIP，48..240校验；读不建文件或重置，具名稀疏patch/重复未知字段拒绝、同值不写、临时文件原子替换和失败已确认值保持。Core查询经过当前安装身份并按正式dockComponentId与当前/目标Desk引用判断原生Dock，尚无宿主明确hostPending/PID0/不可运行，常驻明确unsupportedMode；没把enabled偏好当运行。双proto/RPC→当前Core身份核验Rust调用→Tauri→设置独立卡完整接线，断开/重连拒迟到回执、忙碌序列化、显式保存/刷新不丢待保存草稿，保存失败保已确认行。源码核对修正公共接口类型可见性和不能把任意桌面Dock组件当原生Dock。没有编译/运行/新测试矩阵；Task1编码1/5=20%，Task2-4继续，完整16项就绪仍1/16≈6%；游戏约束不变。本轮具名提交不合并。
Task1轻量核对：双proto源码逐字一致、具名接线位置和diff核对通过；没有运行编译器、测试矩阵、窗口或桌面输入。

### P8 Task2 Core 独立 Dock Player 接线（2026-10-04）
- [x] 编码：单个Core所有的Dock Player，正式dock-process PID与当前主Player/安装摘要绑定；角色独立，共用既有gateway/kernel快照，不进WorkerW壁纸集合。
- [x] 编码：主Player页面就绪、快照/Desk变化与偏好保存排队协调；安装/Room/高度变化、无Dock、禁用和退出先关闭旧Player，旧进程未确认退出不创建替代。启动有界等待，独立退出5..30秒退避重建，关机取消排队并关闭自有进程。
- [x] 编码：runtime携带desktop/dock视图身份，正式上下文/订阅/重放允许已绑定Dock角色；桌面启动和过渡完成权限保持。Dock窗口目前隐藏等待Task3，不将进程/偏好冒报可运行。
- [ ] Task3 正式Dock视图、SDK、几何/真实输入与独立可见性接通；Task4任务栏恢复看护、Task5必要构建/实际运行继续游戏后集中。
当前工作包编码2/5=40%（步骤计数，非工时或已验收功能）。本轮仅源码和差异核对，不编译、不启动应用/窗口、不做桌面输入或新测试矩阵；不合并master。
源码接线收尾：隐藏窗口不能使用只找可见HWND的旧枚举，改用已知WebView HWND的顶层祖先并核对实际Player PID；协议上下文/订阅/重放原来只许DesktopPlayer，按已绑定Dock角色补齐，Complete/CompleteStartup仍只许桌面。见ERRORS #240。最后构建/Windows与六项人工验收均未执行。

### P8 Task3 视图与窗口部分（2026-10-05）
- [x] 编码：正式runtime携带Dock视图身份，仅呈现当前Desk引用的dockComponentId，复用作者SDK/按钮发现与绑定；保留作者逻辑画布，通过有效呈现映射到独立Dock窗口，48 DIP高度与官方键盘控件遮挡进入几何。
- [x] 编码：Core/Player私有窗口状态与策略按generation/session/revision校验；原生宿主与可见性、媒体暂停和只读数据接线。窗口可用须等待实际输入通道及可见性同步，当前显示awaitingInput并保持隐藏。
- [ ] Task3剩余：接Core真实OS鼠标/受控键盘路由、一次动作与桌面暂停时Dock导航；未把视图/进程存在当作完整可用。
- [ ] Task4任务栏替代/恢复与Task5必要构建、实际Windows六项验收继续。
当前包编码约50%（Task1/2完成，Task3部分完成；估算不是整体V3交付比例）。仅五份JS语法、Player csproj XML与具名差异检查通过，未编译C#/Rust/TS、未启动应用或触碰桌面；用户全屏游戏约束保持。不合并master。源码发现及处理见ERRORS #241。

### P8 Task3 真实输入与暂停切页接线（2026-10-05）
- [x] 编码：WinDesktopCore现有RawInput消息先路由Core自有Dock，按实际HWND命中/窗口可见/全屏与锁屏准入；普通软件前鼠标不要求桌面前台，明确键盘模式才接受Tab/Enter/Space，Esc离开并恢复原前台。
- [x] 编码：Dock专用预装输入门控，私有样本准备后只接纳一次对应自然/转发边沿与一次click，旧桌面模式保持；作者仍用正式SDK和同一Core物理proof。外围按键不清空闲Dock几何，触边刷新避开尚未完成的动作。
- [x] 编码：可信Dock导航在桌面暂停/非前台时由同一kernel先保存、直接更新当前Desk，不等暂停视图完成动画；保持真实播放/前台事实，旧过渡完成失效。普通协议请求规则保持。
- [ ] Task4 原任务栏替代/正常退出与独立故障恢复；Task5游戏后build→start/一次真实原生冒烟及六项集中验收。
当前包编码3/5=60%（仅编码步骤；整体V3交付不按这个百分比计算）。本轮只有guardian JS语法及diff检查，C#编译、Windows鼠标/键盘/DPI/透明和暂停切页均未运行验证；无应用窗口、无桌面输入或新测试矩阵。保持开发中并提交，不合并。ERRORS #242；上一节“物理输入待接”为此提交前的历史状态。

### P8 Task4 原任务栏替代与独立恢复（2026-10-05）
- [x] 编码：复用已部署Watchdog的独立Dock模式，与壁纸ADD/CLR名单分开；绑定Core/Dock PID与启动时刻、独立lease及mutex，Core窗口真正就绪才请求隐藏主任务栏。
- [x] 编码：先原子落盘原自动隐藏/可见状态及Explorer窗口身份，再变更Shell状态并核验；Explorer重建保留原基线，退出恢复，未确认恢复保留记录。全屏恢复只还原Shell策略，不强制把任务栏显示到游戏上。
- [x] 编码：独立父进程/Player存活与Core心跳看护，断开时关闭精确自有Dock并恢复；Core看护监督/恢复兜底，Player UI心跳过期先恢复任务栏，给恢复唤醒留宽限后才关闭。正常禁用/无Dock/Room变化/退出先恢复、再关闭Dock；故障退避。
- [x] 编码：配置器区分Dock窗口可用与任务栏实际替代确认；健康心跳不重复核验安装或读取Room文件。
- [ ] Task5 游戏后必要build.ps1→start.ps1、一次原生功能冒烟、六项人工集中验收与整体审查。尤其保留原自动隐藏、最大化/工作区、DPI/Explorer、全屏退出、Core/Player/看护异常与原用户数据恢复证据。
当前包编码4/5=80%，不是全V3已验收比例。本轮仅Watchdog csproj XML/源文件包含及diff检查，无C#/TS构建、应用启动、桌面输入、系统任务栏改动或新测试矩阵；不合并master。恢复逻辑是源代码，不冒称已在Windows通过；ERRORS #243/#244。

### P8 高度反馈与原生样包（2026-10-05）
目标：显示实际DIP/DPI及高度受限状态；正式dockComponentId样包覆盖共享、Desk差异、无Dock返回。范围外：构建/窗口/游戏输入/常驻占位，六项人工步骤保持。
- [x] 编码：有效输入窗口测量决定可用状态/任务栏替代资格，UI显示实际高度/DPI/约束，不改保存偏好；Windows运行待Task5。
- [x] 准备：正式三栏模板/当前SDK完整样包，三个Desk共享、稀疏覆盖、无Dock且保留返回入口；JSON/资源/快照核对通过，实际安装/Windows待Task5。
当前包编码4/5=80%；具名提交，不合并。无构建/应用窗口/桌面输入或新增网络专项。前一工具调用的JavaScript模板字符串含PowerShell换行转义，解析阶段即失败、未执行命令；改为Environment.NewLine后执行，本次不重放任何已执行文件操作。
提交收尾：新样包受fixtures -text规则影响，初次暂存检查发现复制文件CRLF尾部空白；仅规范新样包UTF8/LF，并核对去CR后与原模板/SDK相同。既有安装摘要夹具未改，最终检查暂存内容，ERRORS #246。
## V3-P8-002 顶层Dock常驻占位（2026-10-05，BASE9cf1664）
独立feat/V3-P8-002-dock-reserve / v3-dock-reserve；一句话目标、范围外及六项人工步骤见独立计划/验收卡。
P8-001编码4/5=80%保留待集成；按连续授权接下一工作包，游戏期间只后台代码，不构建/窗口/桌面输入。
- [x] Task1 编码：reserve偏好→Core需求/模式切换→正式Player模式参数。
- [x] Task2 编码：实际AppBar工作区/DPI/Explorer、不可呈现及退出注销；全屏隐藏保持。
- [x] Task3 编码：私有运行状态与配置器占位反馈。
- [ ] Task4 游戏后build→start/一次原生冒烟、六项集中验收及整体审查。
开工0/4=0%；源码阶段不代填Windows证据，CodeGraph未初始化，rg兜底。
P8-002首轮代码：模式进入DockDemand身份比较及正式启动参数，切模式/高度按既有流程先恢复任务栏并关闭旧Player，再创建单个新宿主；共享SDK/绑定/输入沿用。正式reserve在可呈现时注册AppBar，锁屏/撤销文档等不可呈现时注销，恢复重协商；全屏隐藏保留原注册策略。原型已有DPI/Explorer/ABM回调复用，失去实际工作区排除时重新协商。Player读取真实窗口/主屏工作区后报告AppBarReady，Core再以有效输入窗口和GetMonitorInfo复核，未确认不替代任务栏。设置页可直接选择常驻，不以“已在常驻运行”当选择前提，分别显示偏好、窗口与占位确认。
当前编码3/4=75%；仅具名调用点/源包含、项目XML和暂存差异检查，无C#/Rust/TS构建、应用/桌面输入/任务栏改动或新网络专项。Task4Windows最大化/工作区/DPI/Explorer/模式切换/故障恢复与六项人工验收完整保留；不合并master。
## V3-P10-001 原生Room另存与分享（2026-10-05，BASEb0b3be6）
独立feat/V3-P10-001-room-sharing / v3-room-sharing；目标/范围外见计划，六项人工步骤见独立卡。
P8-002编码3/4=75%留待集成；按用户连续授权推进，不构建/窗口/桌面输入或扩网络测试。
- [x] Task1 编码：完整声明资源暂存复制/新Room身份、原生zip导出导入；实际构建/运行待Task4。
- [x] Task2 编码：Core个人绑定/皮肤复制、Room个人数据删除，保留全局目标；运行待Task4。
- [x] Task3 编码：Tauri/UI当前草稿另存/库复制、确认后发布、删除与恢复记录；运行待Task4。
- [ ] Task4 游戏后必要构建/一次全链冒烟、六项集中验收/审查。
开工0/4=0%，CodeGraph未初始化，rg兜底；另存不复制授权/KV/个人布局，分享只含作者内容。
Task1源代码：完整作者资源按正式v3读取句柄流式复制，源草稿身份校验、新UUID和稳定节点关联；副本留暂存直到Task2/3私人复制确认。zip仅room.json及声明资源，原生导入全部暂存/清单对照后换新UUID发布，冲突或失败不覆盖已有目标。导出临时zip/noclobber，不递归打包Core私人文件/运行来源；资源上限沿v3每文件1GiB、总资源2GiB。现有v2链保留，其更大清单不被v3探测器1MiB限制误拒。v3分享按钮已开放，另存保持关闭直到Core覆盖复制接线。政策现有测试期望随功能更新，但游戏期间未运行。
当前包编码1/4=25%，源码/具名差异核对；C#/Rust/TS构建和真实导入导出仍待Task4。无窗口/编译/桌面输入或新增网络测试。
### P10 Task2/3 编码收尾（2026-10-05）
当前包编码3/4=75%。Core双proto/RPC新增个人复制和删除，沿用正式个人存储规则：仅复制绑定/皮肤，不复制授权/KV/个人布局，删除保留全局目标；活动Room需先停用。Tauri另存使用编辑器当前草稿，完整声明资源在暂存区生成新UUID，Core复制确认后发布；库复制、原生导出导入沿既有入口接线。
复制RPC结果不明或发布回滚未确认时保留明确恢复记录；Core串行生命周期与删除标记阻止迟到复制重新生成已清理数据。删除先确认Core可清理，再记录意图并移入回收站；记录租约避免恢复清理抢先执行。中断记录留在库根、不进入作者包；配置器连接Core后重试，源Room已恢复时取消清理，清理未确认有明确提示。
本轮仅源代码接线与git差异检查，现有政策测试期望更新但未运行；没有C#/Rust/TS编译、窗口、桌面输入或新网络专项。Task4完整构建、一次全链本地冒烟和本卡六项人工步骤/整体审查仍未完成，不合并master。断电/跨进程时序与实际回收站行为保留最终门槛，不声称Windows已验证。
## V3-P10-002 首发样包与兼容门槛（2026-10-05，BASEd66bf99）
独立feat/V3-P10-002-release-samples / v3-release-samples；计划和六项人工步骤见独立文件。
P10-001源码3/4=75%已提交d66bf99，构建与实机集中；继续完整路线，不合并master。
- [x] Task1 编码：冻结契约/API/能力与四媒体/持续场景/Dock样包，运行待Task4。
- [x] Task2 编码：正式Rust/Core兼容提示和原件保留，构建/运行待Task4。
- [x] Task3 编码：库列表兼容反馈与原始清单只读入口，实际UI待Task4。
- [ ] Task4 游戏后构建/一次全链冒烟、六项集中人工验收与整体审查。
开工0/4=0%；CodeGraph未初始化，rg兜底；不新增网络专项。
P10-002编码3/4=75%（2026-10-05）：API1基线冻结既有格式/API/协议/安装与个人版本、能力/动作/媒体/转场/组件词汇；六套完整作者目录及原zip、catalog摘要保留。小视频/GIF以单线程生成约11KiB，样包本轮只准备，不冒称通过Player。
正式Rust校验前区分版本/能力等要求，未来zip分派在发布前拒绝；共用版本函数阻止未来作品进入v2写入/应用。Core独立拒绝未知格式/能力等。库列表携带兼容原因并禁用编辑/应用/复制/分享，原始清单只读对话框不进入规范化草稿；已运行Room仍可停止。清单改动后打开再次核对，不依赖旧卡片结果。
只读冻结摘要六套通过，git差异核对；仅增一个政策回归用例、未执行。C#/Rust/TS构建及一次真实全链/六项人工升级验收仍待游戏后，不合并master。没有新增网络矩阵。下一项恢复与发布收口。
## V3-P10-003 恢复与发布收口（2026-10-05，BASE40165cd）
独立feat/V3-P10-003-release-closure / v3-release-closure；目标/范围外/五步见计划，六项人工步骤见独立卡。
P10-002源码3/4=75%留待集成，继续完整路线且不合并。
- [x] Task1 编码：受保护安装恢复/残留清理；Windows执行待Task5。
- [x] Task2 编码：设置页维护与Core退出条件；实际UI待Task5。
- [x] Task3 编码：v3专用Release与已安装产品路径/资产；实际构建待Task5。
- [x] Task4 编码：实际性能采样/导出，未采数据/未确定阈值，实测待Task5。
- [ ] Task5 游戏后构建/一次全链、六项集中验收/审查。
开工0/5=0%；不构建/启动/桌面输入，CodeGraph未初始化，rg兜底。
P10-003编码4/5=80%（2026-10-05，源码）：新暂存记录Windows目录身份和预期摘要，维护页有界分页/只读元数据。退出Core后选择完整旧代恢复，当前原件保留quarantine；逐句柄清理核对所有剩余字节后才删除，中断有身份记录重试。未认证/不匹配保持；孤立记录可清理，不做路径递归删除或自动重铺。
v3-release Cargo/MSBuild配置限定官方原生宿主/WebView2，旧入口从发布工厂分派移除、旧Plugin/Bundle内容不发布；Core错误有真实RPC拒绝。原生宿主/活动识别/许可文档路径按产品目录解析，v3配置器要求匹配Dext v3元数据。build-v3-release脚本新目录部署自包含Core、ReleasePlayer/看护和配置器，按精确资产清单/许可/实际文件摘要收口，不覆盖旧包、不启动应用。
实际成功操作的64项有界计时进入既有诊断，Core切页采用单调钟并在gateway回调锁外异步写日志；资源脚本只读产品路径所属进程的CPU/内存/逐GPU引擎和本轮内核事件。首样本/缺事件/不支持计数均缺失，不填0或假定阈值；会话确认与内核到达不冒充屏幕首帧，渲染帧/普通重启checkpoint恢复及数值仍在Task5。
本轮仅脚本AST、项目XML和具名差异核对；没有C#/Rust/TS构建、应用/窗口/桌面输入、系统改变、性能采样或新网络矩阵。Win32接口查微软原文核对ABI，不是网络测试。Task5完整Release/一次四媒体与Dock全链/兼容样包/性能数据和六项集中验收/整体审查未完成，不合并或发布；完整16项仍以实际证据为准。
## V3-INTEGRATION-001 集中集成验收（2026-10-05，BASE0bc4330）
独立feat/V3-INTEGRATION-001-integration / v3-integration；四步和范围见计划，六项人工步骤见独立卡。
- [x] Task1 编码：另存先记录恢复意图并持有租约；已有Core连接同样核对v3发布身份。
- [x] Task2 必要Release构建/同候选身份，Core与配置器实际启动/连接通过。
- [ ] Task3 一次集中本地全链/恢复/兼容/性能。
- [ ] Task4 完整16项证据/整体审查和原数据恢复。
当前实施1/4=25%；游戏是否结束已异步询问，未答复前只源码，不构建/启动/桌面输入。构建与Windows全链仍未验证，后续三步保留。
Task1源代码收尾：Core私人复制可能先持久化，原先仅RPC失败/发布失败才写清理记录；改为RPC前落盘并全程持有记录租约。恢复重试重新获取并读取租约内容，不能用枚举旧快照抢删另一配置器正在复制的数据。发布成功或回滚确认后移除记录，结果未知保留重试。v3-release复用已有Core和正式RPC同样核对实际PID/路径及Dext v3产品元数据，原纯响应字段校验保持可独立测试。现有元数据用例随编译配置修正期望，未执行。
本轮只源码调用点与差异核对，无编译/应用窗口/桌面输入/性能采样或网络专项。实施1/4=25%不代表整个v3验收完成，待用户结束游戏后统一构建和本卡六项实际验收。ERRORS #252。

Task1补充：恢复清理按稳定Room UUID检查库内已发布作品，目录改名或原名被其他Room复用后仍保留原作品个人绑定。只读扫描直接子目录的清单，不递归进入暂存内容；无法确认缺失时保留恢复记录。实施仍1/4=25%，不因增加修复抬高比例。真实另存→目录改名→重连恢复归入原人工步骤5，游戏结束后一次集中验证，不新增测试矩阵。

阻塞记录（2026-10-05）：连续三轮核对仍未收到用户结束全屏游戏的答复；当前工作区干净，最后代码af705cd。Task1源码修正已保存，剩余Task2必要Release构建、Task3实机全链/性能、Task4完整证据与审查依赖构建和桌面验收。未启动任何编译/窗口，亦无活构建句柄可等待。恢复条件：用户确认游戏已结束、可以构建和启动验收；随后直接继续Task2，不重做已完成源码或新增测试矩阵。完整V3范围保留，未完成、未合并。

恢复（2026-10-05）：用户明确回复“游戏结束 继续构建”，开始Task2必要Release候选构建；不重做已保存源码或扩测试矩阵。node_modules复用主目录，package-lock哈希一致；Rust缓存和候选输出使用D盘。

Task2完成（2026-10-05）：build-v3-release.ps1完整退出0；Release WebView2 Player/Watchdog/Core及features v3-release的TS/Vite/Rust配置器、六套冻结摘要、精确发布资产/许可/实际inventory全部成功。修正Player C#8双弃置参数、看护finally越作用域变量、工厂#else与switch同一行、Windows FileDescription沿AssemblyTitle而非Description的问题。字体经JS入口加载，重建打包五个woff2，无跨盘残留字体警告。未升级上游依赖或扩网络测试。
start.ps1增加显式ReleaseDirectory，候选不进入Debug自动构建/开发Player部署。实际启动Core PID55780、配置器PID10280，路径均属于同一候选；Dext v3 Core元数据、Dext mutex/pipe通过。computer-use只读实际配置器tree显示“Dext Core 已连接”；旧v2原件只读/暂不可用，不自动迁移。仅启动未应用样包，无Player呈现、Dock任务栏更改或全链验收证据。Task3/4保留，不合并或发布。
当前实施2/4=50%，完整v3仍未验收完成。ERRORS #254。

2026-10-06验收修复：用户报告重启后配置器打不开、桌面Dock点击无效和每次应用壁纸慢。保持INTEGRATION同一分支；先恢复同候选启动，复现v3test动作与一次应用耗时，再按具体原因修复并必要build→start。人工验收卡原步骤1/2/3/4涵盖三项，未修复前实施仍2/4=50%，不合并。

2026-10-06修复推进（仍属INTEGRATION Task3，实施2/4=50%）：
- [x] 恢复同候选Core/配置器并用真实配置器应用用户v3test。诊断：21,142,032字节资源安装267ms，完整应用2232ms；旧Debug日志含旧Player UnknownOptionError，不以当前Release之外的混用构建判定性能。
- [x] 焦点丢失误清空已发布按钮几何，无新快照时永不恢复：保留同视口几何，只取消输入/焦点/完成回执；视口变化仍失效。针对DesktopPlayer/Dock和普通/事件采样4项回归先失败“fresh desktop DOWN missing after focus return”，修复后4/4通过。
- [x] v3托盘配置器改查同目录exe，缺件只提示重新解压完整产品；候选携带start-dext.cmd和scripts/start.ps1，显式Release启动。
- [x] 修复回归项目遗漏共享RoomPersonalLifecycleReply类型：独立源文件并链接，不复制类型到测试。
- [x] Release Core编译成功；前端node_modules已缺失导致tauri命令不存在，npm ci --offline --no-audit --no-fund从本机缓存恢复471包，未升级锁文件。
- [ ] 完整新候选构建、同候选启动和用户桌面两类按钮/切焦点/托盘重开/应用耗时人工复验。源Room和个人绑定备份保留，不合并。

- [x] 新候选完整build-v3-release退出0（日志.build/v3-inputfix-build-r2.log）；发布目录.build/v3-candidate-20261006-inputfix-r2，280,202,910字节（约267MiB），含双击入口。先精确路径退出旧Core/配置器，再build→start新候选。
- [x] 实际Core PID27096、配置器14176、Player34660、Watchdog11456均同候选；真实配置器“Dext Core 已连接”“已应用 v3test”，WallpaperLayout保存新候选路径，原已开启Windows Dext启动项由Core更新为新候选。
- [ ] 切换发布目录时旧WallpaperLayout指向旧宿主，被新发布Factory拒绝且RestoreWallpaper枚举遇集合变更；本轮重新应用用户v3test已恢复布局到新路径，原件及恢复备份保留。路径升级恢复仍列Task3待修，不把同候选普通重启与目录升级混为一项。
- [ ] 用户复验两类Dock按钮、切焦点后重复点击、托盘重开配置器和等待时间。当前2/4=50%，代码轮提交后待验收，不合并。

2026-10-06二次验收失败：真实日志已有activate请求，本机v3/personal无personal.json。目标：应用Room时通过已有Coordinator编辑入口启用当前有效导航按钮，仅授予所属消费者desk.navigate；应用目标仍需用户选择，缺绑定明确提示。增加动作结果日志，针对无个人数据的首次应用验证，再build→start。仍INTEGRATION Task3、50%，人工步骤沿用切页/应用/焦点往返。

- [x] 2026-10-06 二次修复：应用后以当前安装戳启用有效导航；缺绑定反馈与动作结果日志已接入。personal-editor 定向10/10、缺绑定提示定向1/1、完整Release构建通过。
- [x] 新候选 v3-candidate-20261006-navigation 启动 Core26984/配置器29268，真实配置器应用v3test成功；本机导航grant落盘。用户指定ChatGPT经Coordinator EditRoomPersonal保存目标及按钮绑定，两次accepted，采用explorer.exe + 已发现的ChatGPT AppsFolder ID。
- [ ] 桌面真实切页/ChatGPT启动/焦点往返结果待用户；尚无本轮activate日志，不以配置成功代替点击验收。本工作包仍2/4=50%，不合并。
2026-10-06用户要求局部回退：本轮三类真实activate均StaleInput，授权和目标补齐后仍不可用。目标：静止按钮恢复已发布几何的原生DOWN/UP命中；只有动态可见几何与静态出版不同的场景保留事件采样，保留正数关联和当前会话检查。范围外：不回退整个v3或作品格式、不扩安全矩阵。先定向静止/运动路径检查，再Release重建并应用原v3test；人工：上一页/下一页/ChatGPT，焦点往返，再应用耗时。加激活前后输入状态诊断核对剩余失效。仍INTEGRATION Task3，2/4=50%。
- [x] 局部回退源码：当前静态按钮多边形与实时采样一致时，geometry.eventSamples=false，恢复原生已发布区域DOWN/UP；两者不同仍使用事件采样。静止/转场定向1/1、焦点返回4/4通过；激活准入日志记录前后台/测量视口/检查前后完成序号。
- [x] 完整Release构建退出0，候选.build/v3-candidate-20261006-input-rollback；旧Core经ShutDown正常退出，新Core39596/配置器12268已连接，真实配置器“已应用v3test”；原ChatGPT目标ID/按钮绑定经正式编辑入口复用并确认accepted。
- [ ] 回退版真实桌面三类按钮及焦点往返待用户。之前候选实际三类activate全部StaleInput，不能把导航授权补齐认定为全部原因。本工作包仍50%。
- [x] 已取消(2026-10-06)：本轮静态输入回退与临时Trace诊断未解决实际点击。用户要求“停止测试 准备回退”，停止全部测试/构建，正常关闭Core。五个具名源码文件撤销回dbe018c，本轮临时变更不交付。
- [x] 回退准备：当前Settings/WallpaperLayout/Room会话/个人绑定和v3test原件备份于主目录.build/v3-rollback-backup-20261006；已验收基线tag v3FirstTest确认，合并24ac47c。
- [ ] 确定回退范围：v3FirstTest为旧临时session.v3契约，不能直接把现在的原生Room v3当作该版作品；完整运行版回退与保留当前v3格式的输入适配回退需明确区分。未切换master、未清理旧候选。当前INTEGRATION50%。
2026-10-06 旧版点击兼容修复（仍INTEGRATION Task3，2/4=50%）：
目标：沿用旧版3c42552的持续交互对象原则，保留当前v3内核，修正同一作者文档在焦点/生命周期/布局更新后按钮登记丢失。
范围外：不整库退回v3FirstTest，不更改作品格式、不扩测试矩阵、不恢复反复人工日志采集。
- [x] 回退范围已由用户明确：以v3之前修好的桌面点击逻辑适配当前版本；旧版原生鼠标手势保留逻辑已在当前代码。
- [ ] 作者按钮声明随文档保留，配置改变/文档销毁清除；当前可见区域仍重新投影。
- [ ] 仅必要本地定向回归；准备与当前源码一致的Release宿主资产并启动，记录未验收限制。
- [ ] 人工验收留待用户：上一页/下一页、我的应用打开ChatGPT、切其他窗口再回桌面重复点击。未通过不合并。

2026-10-06 本轮交付记录（仍2/4=50%，待实际验收）：
- [x] 同文档按钮声明在焦点、生命周期、切页和视口更新后保留；配置改变仅清除该消费者声明，换会话/销毁仍清空。每次原生输入作废和可见几何重新投影保持。
- [x] runtime-model本地定向回归18/18通过（约0.11秒）；旧“缩放清空声明”断言按新生命周期修正。没有继续人工点击采集、没有扩展安全测试。
- [x] 复用已验证dbe018c导航候选的650项基线inventory，撤掉失败试改的Core/Player/配置器二进制，覆盖全部当前宿主资产；继续使用input-rollback原路径，保持当前恢复布局有效，重生成inventory。未编译Rust/C#。
- [x] start.ps1完成启动：Core45348，配置器36652；日志已有WebView原生请求，自动恢复启动。旧配置器占用exe，精确路径结束该进程并等待释放后复制成功；非宿主基线文件摘要全部一致。
- [ ] 人工验收：桌面上一页/下一页实际切换；我的应用打开ChatGPT；切其他窗口后返回桌面重复。此次未代用户点击，不能声称实机故障已解决。保留Task3/4，未合并。

2026-10-07 点击手感试改（INTEGRATION Task3，50%）
用户确认能够触发但不灵敏，明确要求先取消异步试试。目标：关闭鼠标按下/松开的事件时几何采样，改走Core已发布几何的原生命中路径。仅改变采样开关，保留作者请求关联、位移阈值及其它行为，以便比较；不扩安全测试。
- [ ] 关闭geometry.eventSamples，定向核对已发布按钮仍可用。
- [ ] 更新当前Release宿主、退出误启动的旧Debug Core，以同目录Release启动。
- [ ] 人工：快速单击上一页/下一页、我的应用；切其他窗口后回来再点，比较漏点和等待。转场中的移动按钮不作为本轮验收目标；未通过不合并。

2026-10-07 本轮结果：
- [x] geometry.eventSamples=false；Player的PrepareNativeSampleAsync/CompleteNativeSampleAsync对普通鼠标直接跳过，Core按已发布区域完成DOWN/UP。作者请求关联仍在，不宣称进程间通信全部同步化。
- [x] 仅定向按钮发布检查1/1通过，diff --check通过；未改C#/Rust，无需重编译。
- [x] 已经由正式ShutDown退出误启动的旧Debug Core；同目录候选宿主更新、inventory重生成；start.ps1启动Release Core32488/配置器9548。
- [ ] 用户比较快速单击切页/我的应用、焦点往返后的漏点与等待；原移动取消阈值未调整。50%，待验收、未合并。
2026-10-07 启动补记：旧Debug运行失败后WallpaperLayout为空；正式退出Core后恢复20261006备份中同一发布路径的布局，重新start.ps1（Core12516/配置器32676）。实际点击仍待用户验收。

2026-10-07 重复高亮与切页等待（仍Task3，50%）
用户报告圆角内高亮抖动、实际点击又出现矩形框，且常需两次点击才切页。代码确认矩形为宿主SVG焦点层（pointer-events:none），Dock自带hover/focus-visible；当前日志仍有StaleInput，故不能把矩形外观当作全部漏点原因。
目标：作者Dock使用自身焦点样式；已有明确desk动作的Dock按钮在Core完成事件到达时立即走默认动作，取消该类按钮的100ms作者等待。保留正在执行的作者请求协调、一次消费与其它按钮行为。450ms作品转场时长不改。
人工：单击上一页/下一页，比较是否立即开始切页；悬停/点击Dock无额外矩形框；我的应用与焦点往返。未验收不合并。

2026-10-07 本轮交付：
- [x] 作者Dock不再绘制宿主SVG矩形焦点层，内部焦点记录及其它消费者保持；Dock沿用自有hover/focus-visible。
- [x] 作者Dock已配置desk.next/previous/go的原生完成事件立即执行默认动作，取消100ms等待；已有作者请求仍等待消费回执，防止重复执行。作品450ms滑动时长保留。
- [x] 三项定向检查通过：Dock立即分发/去重/焦点样式、其它作者导航协调、先到作者请求协调；diff --check通过。更新同路径宿主和inventory，start.ps1已启动Core25044/配置器8128。
- [ ] 真实验收：悬停/点击是否仍抖动、单击切页是否立即开始、我的应用及焦点往返。尚未证明全部StaleInput消失，仍Task3/4、50%，未合并。

2026-10-08 用户纠正高亮与再次失效（Task3，50%）
目标：保留宿主矩形焦点，移除作者Dock圆角hover/focus高亮；撤回ce3d908的立即执行试改，回到80ea518调度。保留关闭异步采样与按钮声明修复。
范围：模板CSS及用户v3test同源CSS（修改前备份）；正式配置器重新应用以更新安装，不直接改已安装资源。日志仍有StaleInput及后续WebView UtilityProcessExited，重启恢复不等于完整根因修复。
人工：上一页/下一页单击、我的应用、窗口往返；仅矩形高亮，实际点击结果由用户确认。未通过不合并。

2026-10-08 本轮结果（50%，待验收）：
- [x] 已取消(2026-10-08)：ce3d908作者Dock隐藏矩形焦点/立即切页试改；宿主和回归文件恢复80ea518。保留关闭事件采样与按钮声明修复。
- [x] 两套Dock模板及用户v3test导航Dock CSS取消hover边框变色与focus圆角outline，保留外形圆角和宿主矩形焦点；用户CSS原件备份.build/v3-dock-style-before-20261008.css。
- [x] 焦点/动作协调定向8/8通过；Core49348/配置器34920启动，真实配置器重新应用v3test显示“已应用 v3test”；ChatGPT原目标经正式绑定入口恢复，两次accepted。
- [ ] 人工：上一页/下一页、我的应用、切窗口返回；只保留矩形高亮。重启与回退尚不证明全部点击故障已修复；旧日志StaleInput和WebView崩溃保留追踪，不合并。

2026-10-08 循环方向/应用入口/经典Dock（Task3，50%）
目标：修复三页循环next/previous在首尾反向；在v3编辑器顶部恢复添加应用入口，明确后续本机绑定；导航Dock试用旧版底部胶囊栏样式，保留矩形焦点及当前点击链路以对比漏点。范围外：不将外观更换认定为输入根因修复，不改三面板Dock。
人工：连续下一页绕回首页、连续上一页绕回末页；编辑器添加应用图标并在本机设置绑定；经典Dock单击切页及窗口往返。未验收不合并。

- [x] 首尾相邻Desk的循环方向修正，三页next/previous及普通相邻切页定向1/1通过。
- [x] 编辑器顶部“添加应用”及原图标区同名入口已补齐，沿用现有本机绑定流程；经典导航Dock胶囊外观已写入模板和用户v3test，原样式备份.build/v3-dock-before-classic-20261008.css。
- [ ] 配置器Release构建/更新候选/正式重新应用进行中，实际手感待验收。

2026-10-08 交付：循环方向定向1/1通过；tsc/Vite及配置器v3-release构建成功。宿主/配置器/inventory已更新，Core28588/配置器46356启动。真实配置器显示“已应用 v3test”，顶部“添加应用”和右侧“+ 添加应用”均可见；原本机绑定仍在，未覆盖已有编辑草稿。
人工：连续下一页绕回首Desk、上一页绕回末Desk；选Desk添加应用后保存并应用，再在按钮与本机设置选择程序；经典Dock单击切页/我的应用与窗口往返比较漏点。仅换外观不宣称漏点修复，仍2/4=50%，未合并。

2026-10-08 点击性能修复（Task3，50%）
目标：生产Bind时完整校验原生安装并保留其目录/资源只读句柄，运行时准入复用验证结果，Unbind/重新Bind/Dispose释放；消除每次点击多次重算整套资源摘要。仍实时检查会话、原生输入和本机授权。仅单项复用/解绑回归及必要Release build→start。
人工：单击上一页/下一页和我的应用，比较响应；切窗口回来重复；重新应用后仍可点击。待用户验收，不合并。

2026-10-08 [x] 缓存生命周期定向1/1通过：小样包200次准入579.49ms→20.93ms，绑定资源保持只读，Unbind/Dispose释放，替换Player可绑定。补安装文档专用读取，InvalidDataException失败路径释放已打开句柄；未扩安全矩阵。下一步必要Core/Player Release构建并启动。

2026-10-08 缓存接入补充计划：当前安装发布在旧Player退出之前替换content目录，与运行资源只读句柄冲突。apply先按当前宿主库路径关闭并等待旧Player解绑，再原子安装；安装失败尝试重新打开保留的旧宿主。仅必要Rust Release增量构建及真实重新应用复验。

2026-10-08 [x] 点击性能修复交付：缓存生命周期定向1/1通过，小样包200次准入579.49ms→20.93ms。Core/WebView2 Player/Watchdog Release及TS/Vite/Rust v3-release配置器构建退出0；保留既有Vite体积与Rust未读字段警告。候选沿用.build/v3-candidate-20261006-input-rollback，Core42060/配置器27488；真实编辑房间库“重新应用”成功，旧Player33168退出、新Player50584绑定，界面“已应用v3test”，未保存作者草稿。默认450ms转场保持，实际点击延迟未测量，不宣称漏点消除。
人工验收：①桌面单击上一页、下一页及我的应用，比较响应和漏点；②切到其他窗口再回桌面重复；③编辑→返回房间库→重新应用v3test后重复单击。对应Task3；Task3/4仍未完整验收，工作包2/4=50%，待用户确认，未合并。
剩余证据：启动/重铺日志仍有Unexpected WorkerW Z-order，启动首条geometry为StaleInput后下一条Accepted；本轮没有新增点击失败样本，不将这些日志当作已解决。需结合上述桌面验收判断。

2026-10-08 用户确认“可以了”：b73c1ae点击响应修复局部验收通过；不据此勾完Task3/4或整包合并。
Task3实验样包计划（仍2/4=50%）：沿已确认V3路线制作rooms/v3-orbit-lab离线HTML Room，以持续Scene、三Desk作者转场、共享Widget与配置差异、统一应用入口/多呈现、真实数据拒绝/读数、可选消费者KV、HTML start/idle支持集中验收。使用既有SDK，不改内核/配置器接口，不做拖动或额外网络安全矩阵；不更换当前v3test壁纸。
步骤：[ ] 作者样包与简明验收指南；[ ] JS语法/正式安装检查及可视预览；[ ] zip交付与提交。
人工：导入样包并应用，连续切页观察同一文档/计数/配置差异；为Widget允许读权限核对真实数据/撤销；应用按钮绑定本机目标；试验台预览/暂停与重启/待机、另存分享与Dock模式按指南分组验收。

2026-10-08 [x] 实验样包13项作者资源及清单已生成：持续Canvas/作者转场、共享Widget读数与状态计数、6个统一按钮/三页Dock、HTML start/idle。指南V3_ORBIT_LAB.md按四组列人工步骤，明确KV授权入口仍待收口及本包不覆盖四媒体/OS全门槛。样包1/3≈33%，集成仍50%。
2026-10-08 [x] 样包检查：四份JS node --check退出0；生产install_v3正式验证清单和全部13项资源成功；Playwright 1920×1080独立HTML截图可见连续场景、Widget和三页Dock。首次安装检查缺少目标父目录，建目录后成功；浏览器预览只计外观，不替代Core/Player验收。样包2/3≈67%，集成仍50%。

2026-10-08 星轨实验HTML样包交付（Task3，集成仍50%）：
- [x] 作者样包与简明验收指南：rooms/v3-orbit-lab及V3_ORBIT_LAB.md已完成。
- [x] 四份JS语法、正式install_v3清单/13资源验证、1920×1080独立预览通过；转场完成的非accepted回执允许后续重试。
- [x] zip根目录14文件与manifest清单一致，19884字节，SHA256=05a2cce60925f31984cd8b26305caeaa58d380db5ac8af61913cb394e6a49806；本轮具名文件随工作分支提交。
交付：主项目.build/v3-orbit-lab.zip、.build/v3-orbit-lab/index.html独立预览、.build/v3-orbit-lab-preview.png；源样包与指南纳入版本控制。样包制作3/3=100%，作品桌面验收仍待，集成2/4=50%；当前v3test及运行产品未更换。
人工步骤（与V3_ORBIT_LAB四组一致）：①导入zip并应用，往返三Desk，检查INSTANCE/运行时长/Widget计数保持，标题01/02/03改变，绑定应用与同按钮多图标；②允许和撤销四项数据读取，对照真实时钟/任务管理器/音量/媒体，本机KV待授权入口收口；③首次启动/暂停恢复/待机唤醒及非首Desk正常退出重启恢复；④试验台尺寸/暂停、Dock自动隐藏/常驻及全屏退出恢复、另存导出再导入。拖动略过。四媒体/OS完整门槛另按原验收卡，未合并。

2026-10-09 Widget数据授权入口修复（V3-INTEGRATION-001 Task3，仍50%）
目标：将只挂Dock的本机数据授权移到Room编辑器，按实际运行副本列出全部声明只读数据的来源，允许选择Widget/场景/背景/Dock并逐项保存。根因：V3DockEditor只传component.navigation，正式GetReadGrants已包含component.observatory，UI遗漏其他消费者且提示固定写Dock。
范围外：本轮不增加KV/系统控制授权，不改作者作品或内核校验，不扩网络安全测试。
步骤：[x] 根因核对；[ ] 界面修复与配置器Release构建；[ ] 更新运行配置器、核对观测台四项授权、具名提交。
人工：打开已应用星轨实验室，Room编辑器找到“本机数据授权”，来源“Widget · 轨道观测台”有时间/硬件/媒体/音量四项；自行允许后回桌面对照读数，撤销一项检查读数消失。授权不修改作者草稿。
2026-10-09 [x] UI修复已写：独立Room授权区从实际Core GetReadGrants全部只读来源中选择；Widget/背景/生命周期/持续场景显示对应名称，旧Dock挂载及固定Dock错误提示移除；继续使用同一installationStamp校验和逐项本机保存。下一步必要配置器Release构建。

2026-10-09 [x] Widget授权入口修复交付：TS/Vite和配置器v3-release编译退出0；保留既有Vite体积/Rust未读字段及linker提示。精确路径正常关闭旧配置器27488，备份v3-configurator-before-widget-grants-20261009.exe，新配置器58628启动；start.ps1确认原Core42060已运行并复用，未重铺壁纸。
真实UI修复前：当前星轨实验室已保存，但授权区只查component.navigation，无可选项。修复后打开同一作品，正式Core回复驱动“数据授权来源=Widget · 轨道观测台”，控件树可见允许时间/硬件/媒体/音量四个复选框，仍显示作者“已保存”。没有代用户勾选权限，未将控件出现记作实际允许/撤销及桌面读数通过。
修复3/3=100%，INTEGRATION仍2/4=50%，未合并。人工：Room编辑页在Dock外观下面的独立“本机数据授权”选择Widget · 轨道观测台，勾选需要的四项；回桌面核对真实读数，撤销一项后对应读数消失。选择保存于本机，不改作者草稿；KV仍待后续入口。
辅助UI滚动返回ok=false，未作成功断言；随后新get-app-state正常，控件树含完整四项。截图受到前台其它窗口遮挡，不作配置器视觉证据，临时截图已清理；未继续抢前台或进行多轮测试。

2026-10-09 星轨媒体字段与小窗口只读数据修复（V3-INTEGRATION-001 Task3，50%）
目标：修正样包media.available误读hasSession、audio误读volume字段；只读数据与硬件采样按实际生命周期暂停/锁屏控制，小窗口导致桌面失焦但未暂停时继续读数。动作和KV保留当前前台规则。
范围：只读能力元数据、实际data采集两端复核、硬件采样开关、样包字段与相关状态说明；仅定向功能回归/必要Release构建，媒体来源只读查询，不播放或控制用户媒体，不扩网络安全矩阵。
人工：保持B站视频播放且桌面可见，观测台媒体标题应来自实际系统会话，音量显示当前系统值；出现小窗口但未触发播放暂停时，时间/硬件继续更新；手动暂停/恢复与撤销读权限按既有规则。壁纸源文件更新后重新应用并重新允许当前安装的四项只读权限。
步骤：[x] 根因核对；[ ] 定向回归和修复；[ ] Release更新/实际应用/提交待验收。
2026-10-09 [x] 定向visible-data先RED 2/5：小窗口读数NotOperable及硬件missing；拆分CanReadData后GREEN 5/5。暂停/锁屏无采集、非前台撤权仍拒绝，动作/KV元数据仍NotOperable；不扩安全矩阵。硬件来源只跟随真实播放暂停/锁屏，准备修样包字段和Release更新。
- [x] 2026-10-09：样包媒体按available/title/artist、音量按level/muted；授权区按真实playback_paused/locked提示。官方形状Widget检查与JS语法通过，配置器Release构建退出0；Core Release仍在构建。只读规则决策/API及#264已记录。
- [x] 2026-10-09：Core/WebView2 Player/Watchdog Release build.ps1与配置器TS/Vite/Rust v3-release成功；五项visible-data最终5/5，官方JSON投影与JS语法通过。实际Windows只读源采样media=available，未控制播放/音量；既有NuGet审计源不可达/Vite体积/Rust未读字段警告保留。
- [x] 2026-10-09：配置器确认作者已保存后正式退出Core，正常关闭配置器；备份旧二进制/Widget/zip于主项目.build/v3-before-data-fix-20261009。沿用候选路径部署并start.ps1，Core22840/配置器43816启动；仅替换导入样包widget/main.js，保留用户清单。实际“重新应用”成功，当前Player40624，UI已应用且安装Widget摘要与源一致。
- [x] 2026-10-09：样包zip更新，根目录14文件与清单一致，SHA256=cefebe40a02f419c7fd534361f9f461d2be13aed3b49f0a02e0f8b63d54568b1；预览源与指南同步。未代用户允许新安装权限，未进行桌面点击/媒体播放操作；实现3/3=100%，Task3仍待人工、整包2/4=50%，未合并。

## 2026-10-09 halfV3阶段合入
- [x] 用户明确授权当前阶段合入master，名称halfV3；范围为当前feat/V3-INTEGRATION-001-integration及已有堆叠依赖。
- [x] 状态与验收/归档已记录，整体仍2/4=50%；未完成Task3/4留给下一轮独立续项。
- [x] 主线本机Room状态已备份/暂存并按摘要恢复；halfV3命名合并成功；合并后runtime-model18/18与visible-data5/5通过；已归档本轮worktree并删除已合并分支。

halfV3合并收尾（2026-10-09）：master无冲突命名合并，合并提交由本地halfV3标记定位。合并后只跑必要本地冒烟：runtime-model18/18、visible-data5/5；未重复桌面操作或全部网络/安全矩阵。当前运行候选保持。
主线原21项Room文件删除和导入的v3-orbit-lab/v3test已完整保留；备份.build/halfV3-local-room-state-20261009与stash e08778387809a44a491a4e72fd6ebdb8517e5ee2均保留。恢复后导入Room仍按原本机清单/字节存在，源目录与提交作者样包的差异属于未提交本机状态，未混入合并。
本轮v3-integration worktree已通过应用归档为可恢复快照，feat/V3-INTEGRATION-001-integration已安全删除。旧堆叠依赖分支不在本轮清理范围。阶段合并完成，整体集成仍2/4=50%，下一项继续Task3/4集中验收。

## V3-P8-003 系统应用Dock（2026-10-09）
目标：固定应用、真实运行窗口和点击启动/切换/最小化，完成配置器入口与重启恢复。范围/人工步骤见plans/V3-P8-003-app-taskbar.md及对应验收卡。
- [x] Task1 做完：模型/本机偏好与窗口枚举/动作，定向验证。
- [x] Task2 做完：原生Dock呈现与Core生命周期；物理交互验收见Task4。
- [x] Task3 做完：配置器/RPC/来源与Release；界面人工操作见Task4。
- [ ] Task4 开做：实际验证、提交待验收。
进度0/4=0%；原集成包50%。

### 2026-10-09 用户新增规划格式
之后先规划再开工；步骤统一标记“待做 / 开做 / 做完”，每步独立文件，工作包计划提供索引。
本包已补齐 plans/V3-P8-003/01–04；Task1 做完（14项定向检查通过）；Task2/3 开做；Task4 待做。
已完成步骤1/4=25%；之前约50%为工程估计，今后统一用完成步骤比例。

### V3-P8-003 本轮交付
Task1/2/3 做完；Task4 开做，3/4=75%。四步文件记录细节，索引 plans/V3-P8-003-app-taskbar.md。
14项定向检查、Core/Player/Watchdog/Tauri Release、实际Core RPC固定/启用/取消固定及启用偏好重启恢复通过。
候选版 .build/v3-app-taskbar-ready-20261009 已启动；设置 → 系统应用Dock。
人工点击/多窗口/配置器选择/全屏与关闭配置器存活待用户验收；工具初始化受阻详见第04步。未合并。

### 交接记录口径澄清（2026-10-09）
用户要求上述规划/三态记录用于交接，无需交给用户审核；执行者自行维护并继续已授权事项。
当前代码提交a6c7701，工作区C:\Users\JAN\.codex\worktrees\v3-app-taskbar\DEXT_Core，分支feat/V3-P8-003-app-taskbar。
步骤状态仍为做完/做完/做完/开做（75%），本次仅明确文档维护规则，不新增功能完成证据。
接手先读plans/V3-P8-003/04-integration-delivery.md；下一动作是补齐尚缺的实际鼠标/配置器交互证据，具体缺项及工具阻碍已记录。

### V3-P8-003 固定项运行时恢复补证
受控固定项在实际Core正常退出/重启后保持完整列表顺序及启用状态；测试项已移除，原状态恢复。RuntimeProbe新增显式restart-probe模式，默认不执行重启。
代码/运行证据有实质新增；总体仍3/4=75%，实际交互缺项不变。

### 桌面操作通道已恢复（2026-10-09）
启动Orca后computer capabilities及窗口列表成功；旧runtime_unavailable已解除。当前检测到游戏全屏尺寸窗口，已询问测试时机，未切换桌面。后续按第04步文件继续真实交互，进度75%。

### V3-P8-003 用户实测补证（2026-10-09）
用户确认Dock可以点击、可以显示打开状态。已写入第04步与验收卡；其余窗口交互/生命周期项不推断为通过。整体75%，不再重复要求验证这两项已确认行为。

## V3-P8-004 窗口预览（2026-10-09）
用户要求先继续别的功能，P8-003剩余交互证据挂起不阻塞本包编码。
三步独立记录见plans/V3-P8-004-window-preview.md：01开做，02/03待做，0%。
游戏期间仅代码和轻量无窗口检查；运行候选保持P8-003。

### V3-P8-004 本轮编码交付
01缩略图/布局做完；02悬停选择接线做完；03完整构建/桌面验证待做，2/3=67%。
新增DockThumbnail/DockPreviewGeometry/DockPreviewWindow及ApplicationDockWindow.Preview接线。
悬停300ms展开、离开250ms收起；最多6张一页、分页可到全部窗口；实时DWM内容不落盘；标题替代、点击复用原身份核验。
链接实际WPF源码的轻量Release编译、8项几何/分页检查及diff检查通过。未做正式Core构建/启动，当前桌面候选仍为P8-003。
接手下一步：游戏结束后scripts/build.ps1（Release）再scripts/start.ps1，在独立候选验证预览及清理；步骤03文件是唯一续作入口。

### V3-P8-004 预览位置补充
已展开预览会跟随Dock当前锚点并限制到工作区，避免屏幕工作区变化后停在旧位置；不重置分页或重建DWM句柄。轻量编译通过，运行版本未更换，进度67%。

### V3-P8-004 夜间续项（2026-10-09 23:55）
- [x] 完整Core/Player/Watchdog Release构建并以独立候选启动；原P8-003产物保留回退。
- [x] 实际Core状态和原生Dock可见检查；工具窗口未进入Orca应用列表，不能冒称交互通过。
- [ ] 开做：代码diff审查，重点保持点击与资源释放；结果记独立步骤文件。
- [ ] 待做：补齐预览四项实机交互证据。步骤03仍开做，总进度67%。
- 用户明确要求继续自主推进、不提问；若需人工则做diff/设计文档；2026-10-10 00:59北京时间停止并暂停目标。

### P8-004 diff审查修复
- [x] 旧快照图标点击问题先复现后局部修复；8项几何+3项WPF事件检查通过，旧桌面输入链无修改。
- [x] 空列表设置入口提示改正；补充设计建议做完。
- [ ] 完整Release重建新候选并核对身份；实际预览四项仍待验收，包进度67%。

### 2026-10-10 夜间收口记录
- [x] 修复版1137ec5完整Release/start.ps1/实际Core状态通过，当前候选v3-dock-preview-reviewed-20261010。
- [x] 独立diff复核及设计建议/回退交接已完成。
- [x] 受控宿主确定Orca工具窗口过滤边界；测试进程结束，正式Dock已恢复启用，无测试固定项残留。
- [ ] 正式预览四项实机验收，保持67%；不合并master。
- 当前停止时点仍为00:59；本条不是用户验收或目标完成记录。

### 2026-10-10 继续核对总路线
- [x] 对照V3_PLAN第35行识别同屏单Dock与当前两个独立宿主之间的整合缺口。
- [x] 第07步设计记录已完成：源码职责映射、唯一宿主移交、官方应用区整合、任务栏恢复及六项后续验收；未改变当前开关或输入实现。
- 包进度仍2/3=67%；设计文档不计作实机验收；ROADMAP唯一下一项不变。

### 2026-10-10 00:59 用户指定停止
本轮已停止；交接见plans/V3-P8-004/06-release-handoff.md末尾。分支feat/V3-P8-004-window-preview，进度67%，实机预览待验收，未合并。下一轮须由用户恢复推进。

## V3-P8-005 任务栏隐藏/恢复（2026-10-10）
用户授权持续推进ROADMAP并统一验收；先实现明确新增的隐藏任务栏与开发恢复按钮。P8-004保留67%待补验收。
计划：01统一控制开做；02 UI待做；03构建待做；04交接待做。每步独立文件见plans/V3-P8-005-taskbar-controls.md；进度0/4。

P8-005：01 Core/02配置器做完；03 Release开做，进度2/4=50%。12项控制检查及前端构建通过；第一轮CoreRelease通过后追加恢复错误处理，须重建最终版。用户统一验收，不因UI工具受限暂停后续路线。

### P8-005 最终候选与交接
01/02/03做完，04开做；3/4=75%。13项控制检查、前后端Release及最终候选真实任务栏隐藏/退出恢复/重启模式保持/恢复保持10秒通过。运行v3-taskbar-controls-ready-20261010，旧候选保留。未改原桌面触控路由；五项人工留统一验收，不合并。下一项继续ROADMAP集中验收续项的可自动完成部分。

## V3-INTEGRATION-001 续项（2026-10-10）
用户明确不要阶段交付后停下。独立v3-integration-resume从22ed4e9继续，先补本机KV授权；四步见plans/V3-INTEGRATION-001-resume.md，0/4，原集成50%。

续项01做完：Core授权9/9；02开做，续项25%。保留现有私人格式和原ReadData四项语义。

续项02做完：UI夹具/TS构建通过，授权指南更新；03开做，续项50%。

续项03做完、04开做，75%；真实Core隔离样包授权/撤销/重启保持通过，恢复原空壁纸与checkpoint。独立审查尾次保存缺陷已RED→GREEN修复，提供新zip但不覆盖用户作品。接续P8-006单Dock协调。

## V3-P8-006（2026-10-10）
承接419a16d开工，同屏唯一独立宿主；先应用优先，保留既有点击。四步文件plans/V3-P8-006-dock-owner.md，01开做，其余待做，0%。

P8-006步骤01做完，6/6；步骤02开做，25%。主题仅在真实进程退出后释放，应用先隐藏菜单/预览再释放；原点击代码保持。

P8-006步骤02做完，原预览11项/前端构建通过，50%；03完整Release与临时宿主切换开做。

P8-006步骤03做完，实际临时Dock切换/释放完成；04开做，75%。审查恢复顺序缺陷已修复并重建，原状态恢复。接续P8-007官方应用Dock导航，不在此停下等验收。

## V3-P8-007（2026-10-10）
从 cb5bab3 独立分支继续；01 开做、02/03/04 待做，0/4。计划 plans/V3-P8-007-dock-navigation.md。统一验收，不阶段停工。
P8-007：01 做完，10/10；02 开做，25%。
P8-007：02 做完，原预览/应用11项和新增导航5项通过；03 开做，50%。
P8-007：03 做完，04 开做，75%。真实探针与恢复通过，代码提交后接 P8-008 自动隐藏；不停止等待验收。

## V3-P8-008（2026-10-10）
独立分支从53bdbc7继续；四步计划见 plans/V3-P8-008-app-dock-autohide.md。01开做，0/4。
P8-008：01/02做完、03开做，50%。应用策略/偏好22项、任务栏19项、WPF18项通过；一次diff审查与Release进行中。
P8-008：03做完，04开做，75%；修正版构建启动，实际全屏隐藏/偏好通过，物理可见及自动交接待统一验收。继续P8-009常驻占位。

## V3-P8-009（2026-10-10）
从9506c71独立分支继续，计划与四步文件已建；01开做，0/4。前台全屏时仅编码构建，不改用户工作区。
P8-009：01/02做完，03开做，50%；占位控制10/应用偏好33/WPF18通过，完整构建及独立diff进行中。
P8-009：03做完、04开做，75%；最终Core Release和精确身份启动通过，PID42912。占位12项（含审查发现的失败就绪失效与恢复）、应用33项、WPF18项。当前全屏，不切用户占位设置；实际工作区留统一验收。接续INTEGRATION-002。

## V3-INTEGRATION-002（2026-10-10）
从224dce5继续；计划与三步文件已建，01开做，0/3。用户持续推进，无阶段停工；当前全屏仅做后台文件/代码工作。
INTEGRATION-002三步文档与核对做完，实施3/3=100%；统一功能验收保留。650文件及六样包通过；下一项P7-002继续试验台运行闭环。

## OPS-005（2026-10-10 用户指出配置器重复）
先修启动流程再继续P7-002；计划三步，01做完、02开做，33%。8进程已清到1，Core仍42912。
OPS-005三步做完，实施100%；六项脚本检查和真实CoreOnly/重复启动都保持唯一配置器30336，Core42912不重启。清理8→1，无用户作者文件变更。继续P7-002。

## V3-P7-002（2026-10-10）
从69ae82c继续；当前具体缺口是四只读示例与正式字段漂移。四步独立文件已建，01开做0%。只后台构建，不增加配置器窗口。
P7-002：01/02做完，03开做，50%；四正式字段样本共用、两项RED→GREEN通过。后台浏览器检查与Release继续。
P7-002：03做完、04开做，75%；正式DOM/SDK四组与Release通过、独立diff无重要发现。当前唯一配置器40096，Core42912保持。冷启动首次超时未解释，不能称已修复。继续P10-004本地另存分享。

## V3-P10-004（2026-10-10）
承接4487285开工，四步已建，01开做0%；临时文件夹具和生产模块本地闭环，不改用户作品或桌面。

P10-004：01/02/03做完，04开做，75%。Rust四项（六样包）与Core私人复制两项通过，未发现需要修改运行逻辑的缺陷；继续独立diff和交接。

P10-004独立复核结束：补导入/另存名称断言后4/4重跑通过。保持75%待人工，提交后继续P8-010；运行仍Core42912/唯一配置器40096。

## V3-P8-010（2026-10-10）
承接683c8fa，四步计划与独立验收已建；01开做0%。采用本机Room个人数据保存Desk覆盖，避免Room删除遗留目标；不修改现有鼠标派发。

P8-010：01做完25%，02开做。私人存储3项通过，Core有效列表与上下文保护接线进行中。

P8-010：02做完50%，03开做。旧文件缺DockPins按继承；未使用覆盖时不写新字段。完整Release与独立diff进行中。

P8-010：03做完、04开做，75%。私人3/导航13/应用33/UI2/WPF最终21通过；Release及实际Core41528状态正常，唯一配置器38444。独立审查的跨页旧右键菜单作用域已修复并重建；原WPF输入不改。
升级过程：旧UI正常关闭，旧Core42912收到RPC退出后已清理Dock/看护与恢复日志但进程残留、RPC超时；精确路径核对后结束该残留，再启动新候选。不是正常退出通过，下一项OPS-006单独排查。

## OPS-006（2026-10-10）
从cf28008继续，四步计划/验收已建；01开做0%。当前候选Core41528、唯一配置器38444；先确定退出阻塞位置。

OPS-006：01/02做完50%，03开做。真实App.xaml的WPF最后窗口实验确定Dispatcher提前退出，明确OnExplicitShutdown后通过；完整Release及实机退出验证继续。

OPS-006：03做完、04开做75%。配置器关闭/打开两次真实RPC退出均结束Core且恢复journal无残留，重启Core39560/唯一UI19704；进入独立审查与提交。

## V3-P8-011（2026-10-10）
从c3e168c建独立设计分支；三步文件与验收已建，01开做0%。用户授权直接规划接续实施，无审批停点；维持当前唯一配置器，不改运行桌面。

P8-011：01/02做完，设计2/3=67%；已把同宿主布局、稳定动作ID、按下冻结与旧模式回退落到接口设计。03开做，拆分下一代码包与复核。

P8-011：03做完，设计3/3=100%。下一项012生产任务投影，随后013区域与014融合生命周期；当前候选不改。独立复核进行中。
P8-011独立复核无阻断项，内部上下文文案已澄清。十个源码锚点核对与diff检查通过，设计3/3=100%，接续P8-012。

## V3-P8-012（2026-10-10）
基线cc5609a；三步计划与验收已建。01开做0%。输入未挂接；本包生产模型为013接线准备。
P8-012：01做完33%，02开做。七项新增RED→GREEN，原33项通过；暂无运行接线。
P8-012：02做完，2/3=67%。13新增与33原检查通过；独立复核无阻断，Core/Release Player构建进行中。
P8-012：03做完，实施3/3=100%。46检查与完整Core/Release Player/Watchdog构建通过，独立diff无阻断。启动仅CoreOnly复核旧候选，未部署未挂接模型；仍Core39560/唯一UI19704。下一项013接线，人工门槛不填通过。

## V3-P8-013（2026-10-10）
基线71966f1，四步计划与验收已建；01开做0%。当前Core39560/唯一配置器19704候选保留。Player完整接线和演示仍是本包必做项。
P8-013：01做完25%，02开做；八项Node检查通过。网页模型不授权OS动作，原生接线仍未做。
P8-013：02做完，2/4=50%，03开做。实际headless Edge四组DOM交互与71项Node通过；setTaskAreaOcclusion默认不生效，仅后续官方私有适配调用。未挂接正式页面/Player，未调用OS动作，图标仍首字占位待03。
P8-013阶段复核：修复新菜单返回按钮重建导致的点击丢失，真实DOM RED→GREEN，最终五组通过；保留50%开发中，03完整接线继续。
P8-013步骤03增量：Core展示/图标与Player私有消息入口、DOM真实PNG已实现，完整Release构建与72项Node/六组DOM通过；main控制器与原生动作仍未连接，保持2/4=50%。用户窗口避让调查已落research/DOCK_WORKAREA_2026-10-10.md：本机常驻占位未启用，已有AppBar实现待统一实机确认。
2026-10-10用户补充DeskMakeover调查：固定源码版本核对图标分析/缓存/Explorer扫描与布局，结论落research/DESKMAKEOVER_ICONS_2026-10-10.md；借鉴项挂已有远期CORE-004，未改当前下一项，P8-013仍50%。未移植外部代码、未动桌面输入。
P8-013步骤03页面接线增量：正式index/main及资源白名单接入官方任务区，Core→Player→主页面展示贯通；几何确认与隐藏生命周期检查通过。ActionsEnabled仍false，原生操作和融合演示待做；86项Node/七组后台DOM与Release通过，50%保持。
P8-013页面接线复核收敛：普通窗口前台不应隐藏Dock、浮点贴边遮挡确认两处问题均RED→GREEN修复；最终89项Node/七组DOM，Release通过。原生任务动作/演示继续，50%。
P8-013步骤03继续：开做原生任务取样及物理按下/抬起关联，复用现有投递回执，独立于作者按钮目录；键盘/触摸和真实Player演示仍必做，50%。
P8-013步骤03原生增量：任务区实际目标取样→Player私有回执→Core物理边沿关联→原应用操作回调已接，ActionsEnabled仍false。16任务/17原输入/90Node/七旧DOM+四新DOM通过，Release通过；键盘触摸与实机演示继续，2/4=50%。
P8-013原生增量最终复核：排队旧点击跨几何撤销问题已RED→GREEN修复（ERRORS #292），任务20项及最终Release通过；其余17输入/90Node/11DOM证据保留。原生键盘与触摸仍待接，03开做，50%。
P8-013步骤03键盘开做：先提供独立原生任务焦点取样/映射及官方菜单操作，再接既有RawInput/KeyDelivery；保持ActionsEnabled=false，50%。
P8-013键盘增量：Tab/Enter/Space与官方菜单/Esc已接；16键盘/20任务/17输入/90Node/15DOM及Release通过。独立review发现窄栏重新进入跳项，已RED→GREEN修复（#293）。仍50%，真实Player/触控/融合样包待做，ActionsEnabled=false；保留Core39560，无新增配置器。
P8-013步骤03独立融合样包开做：三个Desk覆盖正常任务区/窄区/无Dock，API1新目录；触屏尚无独立原生入口，保持未完成，不以后台tap代替。
P8-013独立融合样包做完：API1三Desk新样包、开发复现文档、后台四种布局与无Dock隐藏通过，生产安装校验通过。03整体仍开做50%；实际Player与触屏待做，未替换候选。
P8-013真实Player任务链开做：正式宿主+融合样包，隔离临时Player验证任务快照及输入取样；不把模拟Core消息记为实际应用操作。
P8-013真实Player增量：私有快照到达正式宿主页已验证，全屏下任务区不可用已验证；当前微信无边框全屏，因此可见鼠标/键盘分支SKIP，不能标通过。探针及清理已补，触屏仍待做，50%。
2026-10-11需求补记：DeskBox桌面文件同步方向已写方案与四个独立待做步骤，挂ROADMAP的DESK-SYNC-001至004；当前P8-013/014顺序保持。无文件迁移、没有改用户桌面或点击链。

2026-10-11最新补证（替代前面仅全屏SKIP的当前口径）：前台全屏结束后，隔离实际Release Player任务区显示、Tab/Enter私有取样及完成打开窗口菜单均通过；Core消息仍为夹具，不算实际RawInput或OS操作。恢复render覆盖遮挡确认的缺陷已三项RED→GREEN修复，独立review无具体回归；最终93项Node、17项原输入及完整Release通过。鼠标阶段仍失败：Native input dispatch not observed，尚未定位，不记通过。曾用OS鼠标边沿辅助诊断，仍失败，已移除该诊断注入；临时guardian日志也已撤回并重建。探针仍可复现未解决的鼠标门槛。触屏未接、真实应用动作未启用；03继续开做，工作包2/4=50%。CoreOnly复核保留Core39560，没有启动配置器，也未更换用户运行候选。
2026-10-11原生鼠标继续开做：临时记录guardian收到的边沿与arm状态，区分窗口投递丢失、门控拒绝或回执接收失败；诊断代码不进正式提交。50%。

2026-10-11鼠标回执问题已定向修复（#296）：外层Dock与WebView anchor可见，但Chromium实际input HWND隐藏；页面DOM取样成功不能证明真实显示/点击。同步controller.IsVisible后，最终无临时guardian日志的Release构建、隔离实际Player鼠标DOWN/UP同目标回执、Tab/Enter及官方菜单、隐藏/再次显示、无抢前台通过。恢复时探针补发新Core任务快照，保持暂停撤销操作许可的规则。证据：.build/task-visibility-red.log、task-visibility-final-build.log、task-visibility-final.log。旧“鼠标回执未定位”条目为历史，本次解决该故障。实际Core RawInput/OS动作及触屏仍待做，ActionsEnabled生产仍false，03开做、2/4=50%。CoreOnly复核旧候选39560，未更换用户运行版、未新增配置器。
2026-10-11步骤03操作许可开做：复用NativeDockAvailable给真实Core快照设置ActionsEnabled，仅当前输入路由已连接、窗口就绪可见且未锁屏/全屏时启用；完成动作继续经过现有物理手势和投影校验。先做Release构建与原输入/任务/键盘回归，实际Core应用操作另补证；50%。
2026-10-11步骤03操作许可增量做完：SendNativeDockTasks现按NativeDockAvailable设置ActionsEnabled；现有500ms刷新会在恢复就绪后补发快照，完成仍检查物理手势/当前窗口/投影。完整Core/Release Player/Watchdog构建通过，20任务、16键盘、17原指针检查通过（.build/task-actions-build.log、task-actions-regression.log）。这三组检查覆盖现有输入关联，不是新增许可门控的真实Core验收。CoreOnly核对仍为旧候选PID39560，没有启动配置器；新代码尚未部署。实际Core启动/激活/最小化和触屏待验证，03仍开做，2/4=50%。
2026-10-11真实Core融合验证开做：准备独立开发副本，正式资源+融合样包；先检查当前会话为空才临时应用，探针恢复偏好/壁纸/checkpoint。直接读取该Player的诊断标题验证实际Core任务快照与可操作状态；真实OS动作仍单独补证。
2026-10-11真实Core补证完成一段：独立self-contained副本v3-task-live-20261011，真实Core47728→Player47868收到11应用任务，displayReady、ActionsEnabled=true且未抢前台。证据.build/task-fusion-live.log；夹具49c12d19-9221-4ed5-ae13-4fdabc0bfa01的Room/personal/checkpoint/偏好/鼠标已恢复。仍未验证应用OS动作或触屏，03继续50%。发现并修复发布资源漏4项（#297），新检查RED→GREEN、实际发布目录校验通过。退出RPC两版本均残留进程（#298待修），按精确路径清理后恢复原候选29792，状态/空Room复核通过，无新增配置器。
2026-10-11 #298退出卡点开做：临时在QuitApp的服务释放、RPC释放与Dispatcher关闭边界记录阶段；只在独立开发副本复现，定位后移除临时日志。当前50%。

2026-10-11 #298定位更新：临时在QuitApp记录services start/done、grpc start/done、dispatcher start/done；一次启动立即退出正常，融合探针后既有正常退出也有残留。最后一轮第1次正常、第2次进程超过5秒仍存活且全部6个阶段均完成。因此证据不支持“服务Dispose或RPC Dispose同步卡住”，Application.Shutdown调用也已返回。不能据此替换为异步退出并声称修复。dotnet-stack尝试失败，.build/exit-hang-stack.log为Pipe is broken工具错误，不是成功的目标线程栈；下一定位范围是Shutdown排队后的WPF/CLR/原生退出尾段。尚未确定根因，#298仍待修。
临时日志源码已从备份精确恢复，git diff App.xaml.cs为空；无诊断版完整Release重建/发布通过（.build/exit-trace-clean-build.log）。每次复现finally清理测试进程并恢复原候选；最终原路径Core4648、enabled=true、11组、error空、Room inactive；未新增配置器。一次缺finally的诊断命令被自动审批拒绝，已改成有恢复保障的流程执行，未绕过拒绝。P8-013继续50%。
2026-10-11 #298根因与修复开做：原生/SOS栈确认Finalizer→SystemEvents.Shutdown→Join，同时SystemEvents→WindowsFormsSynchronizationContext.Send→Control.Invoke等已退出UI；对应dotnet/winforms#9721。在App构造最早建立WPF DispatcherSynchronizationContext，阻止托盘WinForms抢先安装同步上下文；构建后做真实融合开关与退出复测。
2026-10-11 #298退出修复做完：原生+SOS栈定位SystemEvents→WinForms Control.Invoke等待已停止UI，App启动前建立WPF同步上下文；完整Release与真实融合生命周期/退出3轮通过，无强杀新Core。原候选5924已恢复且RPC/空Room复核正常。实际OS应用操作及触屏未验收，03仍开做、2/4=50%；详见errors/backend #298和.build/exit-context-live.log。
2026-10-11步骤03真实OS动作开做：隔离测试进程创建不抢前台的专用窗口；正式Core枚举后仅点击其官方任务按钮，验证激活/最小化/再次恢复。按钮坐标来自开发副本观察器，点击前核对当前命中属于Dock；不对用户应用发动作，结束关闭测试窗并恢复前台/光标/偏好。
2026-10-11真实OS任务动作增量：专用窗口探针已建立并实际运行，暴露旧原点与eventSamples关闭；Player平移刷新和仅官方任务区启用取样已改，68项宿主回归、完整Release通过。实际激活仍未通过，不标完成；后续追踪取样/完成回调。临时诊断已撤回，原候选14912恢复正常。#299详述证据，03继续开做、2/4=50%。
2026-10-11 #299继续：在最新eventSamples开启版本临时记录原始手势、Player任务取样和CompleteTask入口；继续用同一专用窗口失败用例，定位后撤回诊断。50%。
2026-10-11真实Core任务鼠标三步做完：定位到重复合成DOM边沿回执超时；官方任务改用私有视觉取样与Core原始物理pair，不重复转发。完整Release、53输入回归、实际Core专用窗口激活/最小化/恢复通过，.build/task-direct-actions-passed.log。临时日志已撤，原候选15620恢复，未部署用户运行版。首次应用启动、触屏/其他统一门槛仍待做，03继续开做2/4=50%。
2026-10-11首次启动验证开做：增加专用子进程模式，临时固定探针程序；通过正式Dock实际鼠标点击启动，核对新PID/路径/窗口，finally关闭子进程并移除临时固定项。范围仅P8-013步骤03，统一人工四步保持，工作包50%。
2026-10-11首次启动探针增量：新增fusion-launch-live及45秒自动退出专用子程序，构建通过。真实Core固定/未运行任务可见，点击后8秒与30秒均未确认新窗口；随后观察到Explorer启动子程序，尚不能归因或记通过。清理RPC也发生超时，已补finally嵌套恢复且人工核对恢复原候选49468、enabled=true、pins=0、groups=11、error空，测试子程序已清理；Room夹具/原checkpoint恢复。证据.build/fusion-launch-first-failure.log、fusion-launch-second-failure.log、fusion-launch-live.log。下一步定位AppCatalogService/ExplorerShellLaunchService同步启动与延迟关系，避免继续重复输入测试。03仍开做，2/4=50%。
2026-10-11 #300根因修复开做：真实失败期间dotnet-stack确认Core UI停在Microsoft.CSharp COM EnsureScanDefinedMethods→ExplorerShellLaunchService.TryOpen→CompleteTask；改为InvokeMember直接IDispatch调用并保留FindWindowSW引用参数。修复后同一实际启动用例复测，不移动点击链。
2026-10-11 #300增量修复：失败现场dotnet-stack证明UI线程停于Microsoft.CSharp ComMethodDesc/EnsureScanDefinedMethods→ExplorerShellLaunchService.TryOpen→CompleteTask；以Type.InvokeMember/ParameterModifier调用所需IDispatch成员，避免dynamic枚举类型信息。受控应用参数/工作目录检查通过（Explorer path=true，411ms），完整Release通过。相同真实Core47028/Player43644的Dock首次启动专用程序45860通过，临时固定项/偏好/夹具/checkpoint均自动恢复，RPC未再超时。注意探针12313ms包含准备点击时间，不能称为纯启动耗时或响应速度通过；后续拆分时间定位。证据.build/fusion-launch-stack.log、shell-dispatch-launch.log、shell-dispatch-build.log、shell-dispatch-live-passed.log。03仍开做，工作包2/4=50%，触屏/完整统一验收继续；未更换用户运行候选。
2026-10-11启动耗时拆分开做：在探针记录实际DOWN/UP、子进程创建及窗口确认时刻，区分点击准备、Shell启动和窗口枚举延迟；不改生产点击链，03仍50%。
2026-10-11启动耗时拆分增量：探针新增实际DOWN/UP UTC及子进程创建时刻，纠正旧click-to-window包含准备时间的标签。一次实机成功：UP497ms，进程创建13827ms、窗口确认15933ms（.build/launch-timing-live.log）；另一次无抓栈的实机失败，UP293ms，30秒未创建进程，Core日志无Application launch begin（.build/launch-boundary-live-failure.log及20261011_015440.txt）。不能宣称首次启动稳定。Core Click现记录启动调用进入/返回耗时，不含用户路径。完整Release与探针构建通过。下一步追踪HandleNativeSample到CompleteTask的完成/拒绝，暂不继续假设剩余延迟在Shell内部。原运行候选恢复、enabled=true pins=0 groups=11 error空、无测试子程序，03仍开做2/4=50%。
2026-10-11输入完成诊断开做：在官方任务取样及队列执行边界记录手势编号、几何校验/完成状态和拒绝类别；不改授权、点击或触控条件。先同一首次启动用例抓对应证据，再决定修复点。
2026-10-11启动线程修复开做：实机抬起后8ms即完成输入配对并进入Launch，但同步Launch返回耗时11386ms。仅将已确认的应用启动放入后台Task，Click保留UI异常回报/刷新；激活/最小化和输入判定保持同步。以同一实机用例确认启动及RPC响应，不通过放宽1.5秒物理凭据时限掩盖问题。
2026-10-11输入完成链证据与启动线程修复：取样DOWN/UP配对成功，UP后约8ms进入Launch；同步Launch实际耗时11386ms，见.build/task-completion-before-worker-core.log。仅将已确认的启动请求放至Task.Run，Click以async void保留UI异常处理和刷新，激活/最小化不走后台。完整Release与探针构建通过；真实Core6272/Player38696启动49568通过，UP到窗口5266ms、进程创建在准备起点4097ms、UP后状态RPC2ms（不代表整个启动期间持续采样）。偏好/固定项/夹具/原checkpoint自动恢复，原候选复核正常，无测试子程序。证据.build/task-launch-worker-live.log、task-launch-worker-build.log。间歇丢点击尚未抓到拒绝原因，剩余启动耗时仍在，不能把本轮单次成功称稳定完成；03继续开做、2/4=50%。
2026-10-11丢点击复现：最新首次启动失败未收到任何Task sample日志，改追踪RawInput路由→手势→投递边界；任务投影代码保留，不按猜测更改刷新行为。
2026-10-11原始边沿及Player阶段诊断增量：首次复现失败没有任何Task sample（.build/task-no-sample-failure.log），任务投影刷新不是已证实根因。补Core原始边沿/手势/投递日志和Player arm/prepare阶段日志；未改现有判定条件。完整Release通过，最新实际Core/Player串联日志覆盖down→arm=True→ready→up→配对→动作接受，首次启动成功，UP至窗口4895ms；清理/恢复通过。证据.build/task-player-stage-build.log、task-player-stage-live.log、task-player-stage-core.log。间歇失败的具体Player阶段仍未抓到，不能称修复；下次沿这些日志复现，勿继续重复审查投影ID。03开做，工作包2/4=50%，原候选恢复，无新增配置器。
2026-10-11触控入口开做：现有官方任务依赖RawInput鼠标；先在专用无激活WinForms窗口用Windows InjectTouchInput观测WM_POINTER/WM_MOUSE/WM_INPUT，验证能否沿原通道接入。只操作自有窗口，finally释放触点/注销本进程注册并恢复焦点光标，不使用全局触控重定向；测试不等于实机物理触屏验收。
2026-10-11触控路径探针做完一段：新增touch-path和fusion-touch-live。普通自有窗口的Windows注入触摸产生真实pointer消息及兼容鼠标/RawInput各一对；实际WebView2官方任务激活失败且未记录到Dock raw鼠标边沿，触控功能仍未接通。证据/接入约束/下一步见plans/V3-P8-013/03-touch-path.md。探针编译通过，原候选/偏好/Room/checkpoint恢复；不新增全局重定向、不改生产点击链，03继续开做2/4=50%。鼠标间歇失败保留未解决，不继续反复跑同一成功样本。
2026-10-11触控/丢边沿注册差异修复开做：Core鼠标使用EXINPUTSINK（当前台注册RawInput时不接收），独立触控探针使用INPUTSINK。先将鼠标注册改INPUTSINK保留现有命中/屏保/所有权门控，以同一fusion-touch-live失败用例核验；键盘本轮不改，不新增hook或全局触摸重定向。
2026-10-11工作区反馈排查开做：原运行Core45396已恢复，上次raw-owner探针失败终止。失败日志显示真实DOWN/UP已送达，Player ready后WindowReady=false并失效几何；源码表明Bounds变化会撤销WindowReady，而自动任务栏隐藏依赖该值。增加同步失效时的前后Bounds/宿主工作区日志验证循环；尚未认定根因，不放宽点击凭据期限。03仍2/4=50%。
2026-10-11反馈循环实证：Release构建通过；fusion-raw-owner-live中前台窗口注册RawInput后第一次Dock点击成功最小化，随后激活失败。Core日志20261011_022919.txt显示实际Bounds在Y1260/1320反复变化，workArea高度1380/1440反复变化；失败UP时inside=False、available=False。确认自动任务栏隐藏与几何刷新撤销WindowReady形成反馈，下一步分离替代宿主就绪和输入几何就绪，保留几何变化取消旧手势。INPUTSINK仅鼠标注册，键盘不变；触控仍未通过。探针已结束并恢复原候选；03继续开做，2/4=50%。
2026-10-11反馈循环修复开做：增加私有GeometryUpdating状态，仅已同步宿主的位置刷新可进入，最多保留2秒任务栏替代资格；可见性/连接/文档变化立即清除。输入仍要求WindowReady，不接受刷新期间旧坐标；用已失败raw-owner实机序列验证。
2026-10-11几何/任务栏反馈循环修复：新增私有GeometryUpdating，仅已同步窗口的纯位置刷新可短暂维持任务栏替代资格，2秒截止；输入仍要求WindowReady，位置变化继续取消旧手势。可见性、连接、文档变化清除刷新状态；Core保持PID/会话/心跳/工作区验证。Release构建通过（.build/task-geometry-lease-build.log）。同一raw-owner实机序列Core49284/Player21764通过前台RawInput占用下点击、激活、最小化、恢复；20261011_023219.txt只有1260→1320一次正常位置调整，8个鼠标边沿，无往返。触控Core47640/Player48584仍失败，20261011_023315.txt同样无往返但RawInput边沿0，转查WebView2触控入口；不称触控通过。原候选Core37820恢复，无新增配置器。03仍开做，2/4=50%，待统一人工验收。
2026-10-11触点窗口归属核查开做：仅在已有Tap探针注入前记录命中HWND及父链的class/PID/TID，确认触控接收窗口归属；不挂跨进程钩子、不改变触摸投递，不改生产输入。
2026-10-11触点归属与观测边界：探针记录实际命中Chrome_RenderWidgetHostHWND属于Chromium PID46936/TID49504，其父Chrome_WidgetWin_0及Form属于Player25508/TID1316。候选专用main.js记录DOM touchEvents，最新为空且inputEnabled=false；代码复核installOfficial在预注入capture gate对无expected事件preventDefault/stopImmediatePropagation，故后置监听为空不能证明浏览器未收到触摸。下一步在守卫入口添加只读诊断，保留配对判定，不直接放行DOM、不据此重写CompositionController。探针构建通过；fusion-touch-live仍失败并完成清理，证据.build/touch-target-build.log、.build/fusion-touch-live.log、Core日志20261011_023904.txt。生产代码本轮未改，03仍2/4=50%。
2026-10-11守卫入口诊断开做：定向测试先验证未配对touch计数，生产只加私有只读查询和Player心跳差异日志；不新增动作入口、不改gate判定。
2026-10-11守卫入口诊断结果：新增私有diagnostics计数查询与Player差异日志，实机Core49620/Player49636记录touchDown=1、touchUp=1、touchBlocked=3（含兼容click），官方页也记录trusted touchstart/end。因此浏览器确已收到真实触摸；Core依赖鼠标RawInput未建立对应手势，守卫按当前规则拦截。无需据后置监听为空直接换CompositionController。下一步设计并接入守卫可信触摸→Player→Core的专用配对通道，仍须保留真实顶层文档/会话/坐标/按下抬起/取消检查，不能直接DOM onAction放行。当前触控激活仍失败。最终Release构建与29项现有守卫测试通过；证据.build/touch-gate-build.log、touch-gate-tests.log、fusion-touch-live.log和20261011_024500.txt。原候选Core25612恢复，无新增配置器；03仍开做2/4=50%。
2026-10-11触摸观察器增量：observeOfficialTouch捕获原生Event/PointerEvent/MouseEvent getter，默认关闭，私有touchEnable/touchDisable启停；真实单指DOWN/UP递增序列，6 CSS像素外移动、多指、pointercancel、lostpointercapture、pagehide、尺寸变化取消。消息仅含触点/视口/序列和私有文档标识，不直接调用动作。新增7项行为检查，与已有29项守卫检查合计36通过；最终7项复核及Release通过，证据.build/touch-observer-tests.log、touch-observer-final-tests.log、touch-observer-build.log。尚未启用：Player接收验证和Core触摸所有权/配对仍待接，不能称实际触控已通；旧Core25612保留，03仍开做2/4=50%。
2026-10-11触摸接线开做：将私有enable握手绑定generation/session/revision/documentNonce；Player验证后发独立触摸IPC，Core持有单指/序列/坐标并沿现有原生采样配对完成任务动作。以已失败fusion-touch-live作端到端回归；鼠标不改为异步，触摸不取当前鼠标游标。
2026-10-11触摸端到端接通：私有握手绑定当前generation/session/revision/documentNonce，Player解析并过滤旧序列，独立IPC去掉私有token后进入Core。Core按实时HWND/视口换算触点坐标，独立持有触摸联系并复用现有DOWN/UP采样、任务投影及动作完成；隐藏/未就绪/断连/会话变化/过期清除。首轮探针因等待就绪后仍用旧窗口origin而未注入，修正为注入前重测，归属检查保留。最终Release及探针构建通过；实际Core40296/Player45652的Windows注入触摸：拖动取消、激活、最小化、恢复、随后第一下鼠标点击均通过。证据.build/touch-bridge-build.log、touch-bridge-probe-build.log、touch-bridge-observer-tests.log、fusion-touch-live.log。物理触屏、多指/隐藏/切Desk实机取消、鼠标游标远离时触控及作者区域仍待验收；不能把Windows注入成功称为物理触屏通过，03仍开做、工作包2/4=50%。原运行候选/偏好/夹具已恢复，无新增配置器。
2026-10-11触摸边界验收开做：增加两指接触取消、鼠标游标离开Dock后的单指激活；继续使用真实Windows注入和自有目标窗口，所有已按下触点在finally释放，不改生产代码。
2026-10-11返回菜单修复开做：两指已确认打开官方任务菜单；实际鼠标Back DOWN/UP均到Core，但samplePointer排除dismissMenu，故无法配对。将Back纳入既有任务采样，并在Core当前投影验证完成后通过已有私有activate事件回送本地菜单动作；键盘已有回送不重复。
2026-10-11触摸边界与菜单返回增量：新增双触点注入（finally释放全部触点）及注入前SetCursorPos(80,80)移开鼠标的单指激活场景。双指没有启动应用，但Windows触发官方contextmenu并隐藏图标列表；只读menuBack观测确认，不误删正常菜单行为。发现实际Back鼠标DOWN/UP到Core而taskHit=false：samplePointer排除了dismissMenu，且鼠标/触摸菜单完成缺私有activate回送。已纳入Back采样，当前投影通过后Core回送openWindows/dismissMenu，键盘原有回送不重复。最终Release通过；实际Core12916/Player36856通过拖动取消、双指不激活、Back返回、游标预先移开后的触摸激活/最小化/恢复、第一下鼠标交接。证据.build/task-menu-back-failure.log、task-menu-back-build.log、fusion-touch-live.log、touch-boundary-probe-build.log。未证明物理触屏、隐藏/切Desk取消或Windows注入期间不改变系统游标位置；不外推。03仍开做2/4=50%，原候选/偏好/夹具恢复，无新增配置器。

2026-10-11关闭Dock期间触摸取消：探针以真实OS触点DOWN后通过SetRoomDockPreference(enabled=false)关闭官方Dock，保持16ms触点UPDATE，在窗口已隐藏后UP。实际Core13252/Player45184，关闭耗时928ms，目标保持最小化且前台不变；此前拖动/双指取消、菜单Back、触摸激活/最小化/恢复、随后鼠标点击通过。证据.build/touch-disable-probe-build.log、fusion-touch-live.log；原运行候选、偏好、夹具恢复。首次长按无UPDATE导致InjectTouchInput UP超时1460，修正探针后通过；不视为产品点击故障。该项覆盖显式关闭Dock，不等于自动隐藏或切Desk取消；物理触屏仍待验收。03开做，整包仍2/4=50%。

2026-10-11切Desk取消复核：正式导航来自原生按钮，NavigateApplicationDock明确无RPC且只接受Application所有权，不能拿该入口伪造主题Dock的OS操作。生产RoomNativeInputAuthority.ObserveSnapshot在修订增加时ClearGeometry，DockTouchAvailable同时核对旧触点revision。新增5项行为回归：按住后切页清手势、旧UP无动作、回原Desk不复活、回页后新点击可用、已排队完成跨往返切页失效；task-input全部25项通过（.build/task-desk-cancel-tests.log）。这是生产权威/任务完成逻辑证据，未覆盖真实Player在按住期间收到切页事件的全链路，不标实机通过。未更换运行版。下一步以融合样包真实导航/键盘入口验证，不添加测试专用生产RPC。03仍开做，整包2/4=50%。

2026-10-11真实键盘多应用修复：新增fusion-keyboard-live，实际点击官方⌨入口，真实SendInput Tab/Enter，仅激活探针自有窗口。首轮Core收到focus取样但反复拒绝geometry；根因私有entryId只有context/action/window，多个应用activate共享ID，DextNativeGeometry按consumer/entryId拒绝重复。统一改为context/item/action/window，Core完成时再次核对item与proof.Button一致；鼠标/触摸本地菜单回送同格式。新增双应用映射→生产几何回归先失败后通过，键盘18项及DOM8组通过；修正上一轮遗留的Back不可命中旧断言。完整Release build→start CoreOnly成功。最终实际Core29584/Player50408，12应用显示，Tab进入官方应用区，Enter激活自有窗口通过；原候选/偏好/夹具恢复，无新增配置器。证据.build/task-keyboard-first-failure.log、task-keyboard-identity-red.log、task-keyboard-identity-green.log、task-keyboard-identity-dom.log、task-keyboard-identity-build.log、fusion-keyboard-live.log。物理触屏、按住期间真实切Desk与完整菜单/滚动仍待统一验收，03继续开做、2/4=50%。

2026-10-11多窗口菜单增量：新增fusion-menu-live，两个同进程自有窗口形成同一官方任务；实际点击列表选第二窗口成功。复现菜单残留：鼠标/触摸chooseWindow和togglePin缺官方私有activate回送，仅openWindows/dismissMenu有；现统一CompleteNativeDockTaskPresentation，在当前宿主/手势/投影校验后回送，键盘保持原路径不重复。DOM窗口选择完成收起菜单检查及完整Release通过，按流程start CoreOnly保留原版。实际Core47400/Player14584已通过选第二窗，菜单恢复图标；后续探针错误假设剩余窗口一定非前台，已改按点击前状态验证激活或最小化。最终重跑Core47564/Player46572在首次点击出现间歇down taskHit=false/up=true，未产生完成，故整个多窗口流程仍未通过，不能标03做完。日志20261011_0338时段及.build/task-menu-choice-first-click-failure.log；下一步检查displayReady到按下取样之间的可用状态变化。证据.build/task-menu-choice-red.log、task-menu-choice-toggle-observation.log、task-menu-choice-dom.log、task-menu-choice-build.log。原候选/偏好/夹具恢复，无新增配置器；工作包仍2/4=50%。

2026-10-11多窗口实测完成、启动状态问题定位：此前仅依赖页面displayReady会在任务栏接管前启动点击。保存日志证明工作区由1380到1440改变后Dock移动，按下命中而抬起取样被撤销；另一次原生状态已不可用但标题观察仍旧。探针改为正式runtime.phase=running、taskbarReplacementReady=true及同一原生窗口边界稳定750ms后才进入菜单测试，条件用于隔离自动任务栏场景，不代表手动显示任务栏模式不可用。关闭同进程第二窗会异步改变前台，恢复检查先在自有Form明确最小化。最终Core30552/Player48996，真实鼠标打开双窗口列表、选择准确第二窗、菜单收起、关闭第二窗投影缩为1、点击恢复剩余最小化窗口全部通过；进程退出0并恢复原候选/偏好/夹具。证据.build/fusion-menu-live.log、task-menu-probe-build.log、menu-toggle-*.txt、stable-click-*.txt。启动可见图标提前可点与任务栏接管状态尚需产品收口，未改生产门控、未宣称首次点击问题已修；下一步明确初始化呈现/输入就绪策略，避免用固定延时掩盖。03仍开做，2/4=50%。

2026-10-11 开做：03启动任务区输入门控。按任务栏实际模式判断就绪：auto须当前主题Player租约确认、hidden须Core手动租约确认、visible须恢复完成；与原生几何可用共同控制官方任务按钮及最终动作，避免先可点后移位。范围仅融合任务区，不重写作者点击或全局输入；验证三模式和隔离首次点击，记录失败回退待014。

2026-10-11启动官方任务区门控修复：新增TaskbarController.DockActionsReady，auto须当前Player租约确认、hidden须Core手动租约确认、visible须租约释放与恢复完成；官方快照ActionsEnabled与最终动作均核对它。另在WebWebView2检查实际原生窗口匹配当前工作区底边/宽度；reserve沿用AppBar确认，防止任务栏隐藏已确认但Dock尚未移位的短暂误启用。不改RawInput/触控配对及超时。24项任务栏行为检查通过（含5项新增三模式/待恢复检查）；测试项目缺obj资产首次no-restore失败，正常还原后通过。完整Release build→start CoreOnly成功。新增fusion-startup-live跳过探针额外taskbarReplacementReady和750ms等待，直接在产品第一次ActionsEnabled时沿既有点击准备路径操作；实际Core50628/Player37064，打开双窗口列表、选择第二窗、关闭后恢复剩余最小化窗全部通过，退出0。证据.build/task-startup-gate-tests.log、task-startup-gate-build.log、task-startup-probe-build.log、fusion-startup-live.log。一次实际通过支持本次根因修复，不代表所有启动/显示器/手动模式均实测；任务栏看护失败的呈现回退仍由014收口。原运行版/偏好/夹具恢复，无配置器新增，03仍开做，2/4=50%。

2026-10-11手动恢复任务栏实测：fusion-restored-live先等主题Dock实际接管，再通过EditApplicationDock(taskbar,visible)恢复，核对Shell_TrayWnd实际可见、看护hidden=false、主题Dock重新可操作；随后真实选第二窗、关闭第二窗、恢复剩余最小化窗通过，任务操作没有重新隐藏Windows任务栏。首次探针把恢复后的自动隐藏误判为禁用：工作区缩小时鼠标停在旧底边，改为按当前原生Dock位置唤出再判定。实际Core33260/Player28800退出0；.build/task-restored-probe-build.log、fusion-restored-live.log为证据。finally恢复原taskbar模式/两种Dock偏好/前台/光标，外层按字节备份taskbar-mode.json；原运行版恢复，无新增配置器。仅增加探针，无生产改动。03继续开做，整包2/4=50%；物理触屏/作者区域及完整统一验收不外推。

2026-10-11交接核查做完：核对实际日志后建立03-remaining五项接续清单，04开始证据复核，更新V3_CURRENT/融合样包说明的陈旧禁用描述。正式包仍2/4=50%；下一实际操作为自有程序右键固定/取消固定，保留同栏作者导航、窄栏、取消和统一验收全部范围。不增加网络测试、不更换运行版、不宣称整包通过。

2026-10-11实际固定菜单开做：新增独立fusion-pin-live及实际右键/固定/取消固定探针，构建通过。Core49636/Player2352实机失败证据确认右键DOWN到正确按钮时可用，61ms后UP/contextmenu同按钮disabled=true，随后恢复；未到固定操作，未宣称通过。记录03-remaining，下一步定位租约/原生可用/工作区门控撤销。原Core28588及偏好恢复，未启动配置器；生产代码未改，2/4=50%。

2026-10-11开做：固定菜单瞬间禁用的Core边界诊断。仅在租约/原生可用/工作区就绪组合变化时记录，不改变判定；构建后同一独立右键场景取证。

2026-10-11固定菜单做完：Core三门控始终true，根因是页面相同visible通知仍suspend/refresh，DOWN后本地短暂disabled。main.js增加实际paused变化判断，保留作用域校验/真正隐藏取消。新增回归先红后绿，入口与controller18项通过；完整诊断Release构建通过，Core47612/Player22924实机右键固定/取消固定及菜单收起全部通过，退出0并恢复原运行版/偏好。03-remaining第1项做完，下一项作者导航/窄区；整包2/4=50%。

2026-10-11开做：03剩余第2项同栏导航/窄区。仅使用隔离融合样包和自有测试窗口，实际下一页进入focus、上一页返回home，读取正式几何定位；窄区滚动和应用操作随后接续，不能将直接RPC切页当导航通过。

2026-10-11同栏导航增量：fusion-navigation-live构建通过，夹具补齐正式enableNavigation后Core45792/Player37084实际下一页进入focus一次、窄区溢出且不误激活应用。上一页DOWN/UP均到Core，但Player未回传可见取样，仍失败。记录03-remaining及20261011_041518.txt，滚动/应用点击未执行，原运行版恢复，2/4=50%。

2026-10-11开做：跨Desk返回失败补充派发边界诊断，日志已确认WaitInputDispatchAsync超时并退出Player；检查转发目标归属、派发等待和释放，不更改输入授权或重试策略。

2026-10-11跨Desk派发诊断增量：完整Release通过；Core40724/Player45408同场景再次确认下一页成功、上一页失败。第二次DOWN已arm/ready且forward-owned，等待作者帧派发回执1.5秒超时；取样尚未释放/回传。保留现有输入语义，下一步定位帧回执生成/接收，记录03-remaining及20261011_041900.txt；恢复原运行版/偏好，整包50%。

2026-10-11开做：作者帧只读派发计数，记录门控前事件/通过事件/已发回执及native接收计数，超时时读取以定位回执失踪，不改变输入判定。

2026-10-11双向导航修复：实机事件顺序确认未授权鼠标pointerdown的preventDefault抑制后续兼容mousedown，使转发回执超时。仅鼠标pointerdown保留stop但不prevent；鼠标默认操作仍由mousedown门控，触摸不变。Core30708/Player48244真实下一页/上一页、窄区溢出和无应用误触全部通过，30项检查/最终Release通过。移除临时计数，原运行版恢复；下一步窄区滚动/应用点击，第2项未全完，整包50%。

2026-10-11开做：实际横向滚轮移动窄任务区，再点击仍可见的自有应用验证激活/最小化/恢复，检查仍停在focus；最后上一页返回，保留原前台/鼠标/偏好恢复。

2026-10-11窄栏组做完：Core45764/Player44088原生横向滚轮、滚动后自有应用激活/最小化/恢复、双向作者导航全部通过且不双触发，退出0并恢复原版/偏好。探针首次因切页工作区变化停在旧位置，现按当前Dock位置唤出；产品跨Desk租约波动仍需收口，不宣称修复。03-remaining第2项做完，整包2/4=50%。

2026-10-11开做：同宿主跨Desk的任务栏稳定性。RoomDockWindowState严格匹配revision，在Core先更新而Player尚未回报新revision时返回null，任务栏请求被撤销；先在实际双向导航期间观察任务栏可见/原生Dock位置作为回归，再分离任务栏宿主健康与交互revision检查。

2026-10-11跨Desk任务栏稳定性修复做完：新增真实25ms任务栏/位置观察先红；分离任务栏同宿主健康与输入revision校验，保持心跳/会话/退出/生命周期条件。Core46800/Player52720双向导航、滚动和应用三动作及任务栏保持隐藏/Dock位置稳定均通过，完整Release通过，原运行版恢复。下一项按住期间切Desk/窗口关闭取消及无Dock退出恢复，整包50%。

2026-10-11开做：03剩余第3项窗口关闭取消。真实鼠标DOWN后关闭自有非前台窗口，1秒内抬起，确认原前台不变且投影移除该任务；finally保证UP与原配置恢复。

2026-10-11关闭取消实测做完：Core25504/Player51580鼠标DOWN后121ms关闭自有目标，UP后投影移除、前台不变、未重开目标；原运行版与偏好恢复。旧投影activate进入完成队列后由窗口有效性拒绝，未启动程序，不虚称配对提前取消。第3项仍缺按住跨Desk真实链路，整包50%。
