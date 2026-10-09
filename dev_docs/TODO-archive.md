# 总任务台账 · 历史归档（只加不删）

> 已完成/已取消阶段的全量记录，从 `TODO.md` 移入此处归档。
> 新工作不再写这里；当前任务看 `TODO.md`。

## 已完成里程碑（历史回填）

- [x] 2026-08-24 Lively core-separation 基线编译跑通（master 分支）
- [x] 2026-08-24 Tauri 配置器脚手架（React+TS+Tailwind4+shadcn）
- [x] 2026-08-24 Rust 自实现 gRPC named-pipe 协议客户端（tonic 不可用，见 ERRORS #2）
- [x] 2026-08-24 demo 前端进 Tauri + SetWallpaper RPC + 桌面实铺验证
- [x] 2026-08-25 Phase A：GetInstalledApps/LaunchApp RPC + 应用选择 UI（真图标）
- [x] 2026-08-25 Phase B：双击图标 → Player → Core IPC 启动链路全通
- [x] 2026-08-25 room.json 加载 + 配置器保存/应用闭环
- [x] 2026-08-25 多 desk 编辑 + 切桌卡死修复
- [x] 2026-08-25 编辑器 UI v1（desk 侧栏/应用搜索/高亮选中）
- [x] 2026-08-25 构建/启动脚本 scripts/{build,start}.ps1
- [x] 2026-08-25 CodeGraph 索引建立（9167 节点）

## Phase 1：房间库最小闭环（2026-08-25）

- [x] 2026-08-25 迁移现有房间 → `rooms/my-room/`（background/ 素材分离，路径改写）
- [x] 2026-08-25 新建 `rooms/black-room/` 示例（空背景 → 纯黑兜底）
- [x] 2026-08-25 Rust 命令：list_rooms / read_room / write_room / create_room / apply_room（拷数据进壁纸包+SetWallpaper）
- [x] 2026-08-25 配置器：房间下拉 / 新建 / 另存为 / 库路径可指定(localStorage) / 脏状态切换确认
- [x] 2026-08-25 渲染器空背景守卫（body 已 #000，不造黑色图片文件）
- [x] 2026-08-25 自测：npm run build + cargo check 全绿
- [x] 2026-08-25 用户人工验收：重点三项（A2/C3/C4）已确认通过；全清单固化至 ACCEPTANCE.md，剩余项用户随时抽查

## Phase 2：双模式 + 预览地基（2026-08-25）

- [x] 2026-08-25 使用/编辑双模式骨架：**默认使用模式**（固定，不记忆）；顶栏 tab 切换
- [x] 2026-08-25 使用模式最简版：房间卡片（desk/图标数）+「应用中」标记 + 应用按钮
- [x] 2026-08-25 保存/应用分离：编辑模式「保存」只写盘；「应用」推桌面（dirty 先自动保存）
- [x] 2026-08-25 渲染器注入钩子：main.js 监听 `dext:room` 消息（地基，联动逻辑后议）
- [x] 2026-08-25 文件通道：自定义 `dext://` 协议映射壁纸包目录（asset protocol 相对路径解析有坑，直接走自定义协议）
- [x] 2026-08-25 编辑模式预览开关：应用库区 ↔ 16:9 iframe，编辑实时注入
- [x] 2026-08-25 自测：npm run build + cargo check 全绿

## Phase 3：桌面长按编辑（2026-08-25）

> 决策：拖拽占用格 = **让位**（行优先序列插入重排，非交换）；图标归一化 → 移入「远期」。

- [x] 2026-08-25 schema：icons[] 加 x,y（行优先 packed 网格 8×N）；无坐标旧数据按序自动补
- [x] 2026-08-25 渲染器：绝对定位网格布局（按 iconLayer 尺寸算格子）
- [x] 2026-08-25 渲染器：长按 500ms 进编辑模式（抖动动画 + × 删除徽章 + Dock 变「完成」）
- [x] 2026-08-25 渲染器：编辑态拖拽（pointer 事件，松手按让位重排，CSS transition 补位动画）
- [x] 2026-08-25 渲染器：删除图标 + 退出编辑自动保存
- [x] 2026-08-25 IPC：Player Form1 转发 saveRoom（postMessage→stdout msg_save_room）
- [x] 2026-08-25 Core：MessageType/LivelyMessageSaveRoomCmd/IpcMessageConverter/WebWebView2 落盘
- [x] 2026-08-25 双写：apply_room 盖 `__source` 戳；Core 保存时包内 + 源房间各写一份
- [x] 2026-08-25 自测 + build.ps1（C# 变更）+ cargo check + npm build
- [x] 2026-08-25 用户验收通过（2026-08-25）

## Phase 3 修复轮（2026-08-25）

- [x] 2026-08-25 F1 拖动不跟手：CSS 优先级 bug（.dragging transition:none 被 ID 选择器压制）→ 内联开关+加权
- [x] 2026-08-25 F3 交互改版：packed 让位 → 稀疏格子（空位可放/删除留洞）+ 占用格交换（用户拍板）
- [x] 2026-08-25 F2 根因确认：旧配置器进程 apply 无 __source 戳 → 回退；需重启+重应用一次（操作项，非代码）
- [x] 2026-08-25 F2b SaveRoom 落盘路径修复：path 参数实为 index.html 文件，取目录后拼接（ERRORS #11）
- [x] 2026-08-25 F2c 双写目标补全：__source 是目录，写 src/room.json（ERRORS #13）；内层 catch 改为记日志
- [x] 2026-08-25 F4 复验通过（用户 ok）：拖拽/持久化/双写/重应用/切房全通

## Phase 3.5：图标三档尺寸（2026-08-25）

- [x] 2026-08-25 schema：desks[].iconSize = large|medium|small（缺省 medium，宽容读取）
- [x] 2026-08-25 渲染器：三档尺寸映射（图标/格子/字号联动），列数按屏宽动态计算
- [x] 2026-08-25 渲染器：编辑模式 Dock 加 大/中/小 切换按钮（带当前档高亮），切换即持久化
- [x] 2026-08-25 渲染：坐标渲染时按当前档钳制到可视范围（不改动存储值，切回小档不丢位）
- [x] 2026-08-25 自测 + 用户验收全绿（2026-08-25）；追加配置器侧栏尺寸选择器(78d6c5a)

## Phase 4：单 Desk 循环视频背景（2026-08-25）

- [x] 2026-08-25 schema：background 多态——字符串=图片路径（兼容）；`{type:"video",src}`=视频
- [x] 2026-08-25 渲染器：单一 `<video>` 元素（muted/loop/playsinline/cover），
      仅当前 desk 挂载，切桌换 src（过渡遮罩盖住），非视频 desk 释放
- [x] 2026-08-25 配置器：desk 侧栏背景区（当前背景摘要 + 图片/视频/清除三按钮）；
      dialog 插件选文件 → Rust 拷贝进 roomDir/background/（时间戳命名防冲突）→ 写回 background 字段
- [x] 2026-08-25 Rust：tauri-plugin-dialog + import_background 命令 + capabilities 权限
- [x] 2026-08-25 自测：cargo check + npm build 双绿
- [x] 2026-08-25 用户验收全绿（2026-08-25）

## Phase 5：方向感知切桌过渡（2026-08-25）

- [x] 2026-08-25 接口：TRANSITIONS 注册表 { dur, run(stage, dir, done), cleanup }；room.transition 字符串字段（缺省 slide）
- [x] 2026-08-25 内置动画：slide（左右镜像）/ fade / zoom / none / text（旧黑屏文案，兼容）
- [x] 2026-08-25 结构：#desk-viewport > #desk-main + #desk-staging（双页渲染，Dock 不随动画动）；
      renderDesk 拆分 mountBackground/renderIcons 供主层与 staging 复用
- [x] 2026-08-25 方向：switchDesk(delta) 的 delta 即 dir，来回动画镜像
- [x] 2026-08-25 自测 node --check 通过

## Phase 5.5：视频转场（2026-08-25）

- [x] 2026-08-25 schema：transition 字段多态——字符串=预设名；`{type:"video",src:"transition/x.mp4"}`=视频转场
- [x] 2026-08-25 渲染器：stinger 流程——全屏视频盖住 → 播到一半换桌 → 播完揭晓；加载/播放失败回退 slide
- [x] 2026-08-25 Rust：import_background 支持 kind=transition（拷进 roomDir/transition/）；apply_room 增拷 transition/ 文件夹
- [x] 2026-08-25 配置器：编辑模式顶栏转场下拉（滑动/淡入/缩放/无/视频），选视频弹文件框写回字段
- [x] 2026-08-25 自测 cargo check + npm build 双绿 + renderer node --check
- [x] 2026-08-25 用户验收通过（2026-08-25）

## Phase 6：前端外观迭代基建（2026-08-25）

- [x] 2026-08-25 实时预览：vite 监听壁纸目录（npm run dev:room / scripts/room-preview.ps1，端口 5174，无需 Lively）
- [x] 2026-08-25 主题变量地基：style.css :root 收敛 --dext-* 令牌（8 处引用替换）
- [x] 2026-08-25 开发文档：dev_docs/FRONTEND.md（独立会话可用的外观迭代手册，含任务池）
- [x] 2026-08-25 配置器 UI 设计模式：npm run dev:ui（浏览器 1421，IS_TAURI 检测 + mock 数据，预览按钮自动隐藏）

## Phase 6.5：应用库可管理化（2026-08-25）

> 用户定调（MyDockFinder 模式）：手动添加 .lnk 为主，一键扫描合并为省事选项；库可删除卸载残留。

- [x] 2026-08-25 库持久化：rooms/library.json（load_library/save_library）；无库文件时回退在线枚举（兼容）
- [x] 2026-08-25 新 RPC ResolveApp(path)：C# AppCatalogService.ResolveOne（.lnk 复用 ResolveShortcut；.exe 直取）→ proto → Rust grpc
- [x] 2026-08-25 前端：库来源徽标/添加/扫描合并/多选模式（添加到Desk、从库删除）
- [x] 2026-08-25 自测：build.ps1 + cargo check + npm build 全绿

## Phase 6.5-旧：应用库多选批量操作（2026-08-25 已取消）

> 被「应用库可管理化」取代（用户澄清需求为管理库而非批量上桌）。

- [x] 已取消(2026-08-25) 应用库加「多选」模式：点选累积选择集，操作条批量增删
- [x] 已取消(2026-08-25) 批量添加跳过已存在；批量移除按 target 过滤；切 Desk 清空选择
- [x] 已取消(2026-08-25) 自测 npm build + 用户验收

## Phase 7：Room↔Desk 概念模型梳理（2026-08-25）

> 目标：实体关系 / 字段归属规则 / 不变量成文，作为 schema v1 定稿输入。

- [x] 2026-08-25 盘点三端现状（渲染器 main.js / 配置器 App.tsx / Rust lib.rs）
- [x] 2026-08-25 用户拍板争议点：转场=有向边模型(transitions["from>to"] 覆盖 room 默认)；transitionText 废弃但 text 类型保留；theme 不做(YAGNI)
- [x] 2026-08-25 模型结论写入 dev_docs/MODEL.md + 决策记录同步

## Phase 8：房间可编程性（2026-08-25）

> 用户场景：极客/AI 做高达驾驶舱式桌面——切桌触发自定义 HTML 动作。
> 拍板：两层路线（声明式 action 语法糖 + room.js/room.css 房间脚本）。

- [x] 2026-08-25 设计定稿写入 MODEL.md 第六节（dext 事件契约草案 / 加载与隔离 / 风险模型）
- [x] 2026-08-25 渲染器：window.dext 事件集 + room.js/room.css 加载（隔离）+ 边级转场查找 + action 类型广播 + ?room= 预览参数 + transitionText 清理
- [x] 2026-08-25 Rust：apply_room 增拷 room.js/room.css
- [x] 2026-08-25 实验房 rooms/cockpit-room/：canvas 驾驶舱 HUD（待机/巡航/战斗三模式，边级 action 转场）
- [x] 2026-08-25 自测三绿（node --check ×2 + cargo check + npm build）
- [x] 2026-08-25 用户验收全绿（2026-08-25，含真机回切）；仅剩配置器兼容项随下轮顺带覆盖

## Phase 9：统一演出槽 + 启动/关闭页（2026-08-25）

> 用户定调：视频与 HTML 统一为一种「演出槽」格式——视频=渲染器代管 <video> 的糖（本地包内路径），
> HTML=房间自带页面自管结束。boot/shutdown/transition/background 同形。

- [x] 2026-08-25 渲染器：playSlot 统一播放器（video/html/action 三态，超时兜底）+ boot 覆盖层流程 + dext:shutdown 监听与 ack
- [x] 2026-08-25 C# Player：Form1 cmd_close 分支改「postMessage dext:shutdown → 等 ack 或 5s 超时 → 退出」（无槽零延迟）
- [x] 2026-08-25 Rust：apply_room 泛化拷贝子目录（background/transition/boot/shutdown）
- [x] 2026-08-25 cockpit-room：boot/index.html HUD 启动自检动画（html 槽示范，自 ack）+ room.json 接线
- [x] 2026-08-25 文档：MODEL.md slot 章节 + README 接口表 + PROJECT 决策记录
- [x] 2026-08-25 自测：node --check + cargo check + build.ps1 全绿（构建前需停 Lively，DLL 锁）

## Phase 9.1：三幕命名定稿（2026-08-25）

> 用户拍板：start（启动）/ switch（切换）/ end（结束），废弃 boot/transition/shutdown。

- [x] 2026-08-25 全链改名：room.json 字段（start/end/switch/switches）、事件（dext:switch/dext:end/dext:endDone）、素材目录（start//end/，transition/ 兼容保留）、配置器写 switch 双读兼容
- [x] 2026-08-25 cockpit-room boot/ → start/；MODEL/README/PROJECT 文档同步
- [x] 2026-08-25 自测全绿（node --check + npm build + cargo check + build.ps1）

## 研究专项：Lively API 全景调研（2026-08-25）

> 目标：摸清上游 Lively 生态全部对外接口形态 + 本 fork 现状对照，评估 Dext 可用性。产出 `dev_docs/LIVELY_API.md`。

- [x] 2026-08-25 壁纸侧 JS API：fork Player 注入点盘点 + 上游完整清单（6 函数 + Arguments→--wallpaper-* 透传机制）
- [x] 2026-08-25 外部控制面：结论——无 HTTP API（维护者 discussion 明确）；命令行全套 fork 完整保留（AutomationCommand gRPC 转发）
- [x] 2026-08-25 C# 嵌入库速览（结论：官方无 NuGet 库，GitHub/NuGet 双 404 验证）
- [x] 2026-08-25 本仓库现状对照：房间零改造可用音频频谱/歌曲信息/硬件监控（room.js 定义全局函数 + LivelyInfo.json 加 Arguments）；4 条待验证风险已记录
- [x] 2026-08-25 成文 dev_docs/LIVELY_API.md + 登记文档索引（README.md）

## Phase 8（配置器主页改版轮）：R1-R9 迭代（2026-08-25~26）

> 用户定调：Hero 焦点式布局；封面 = 多背景拼贴网格（1 张满幅 / 2 张对分 / 3+ 田字）；深浅主题可切换。
> 事故重做（ERRORS #18：并行会话 git 冲掉未提交改动，用户拍板逐轮提交+暂停另一会话）。

- [x] 2026-08-25 Rust：list_rooms 的 RoomInfo 增 covers 字段（逐 desk 解析 background：图片=相对路径、视频=标记），宽容解析坏 json
- [x] 2026-08-25 Rust：新 `lib://` 自定义协议映射房间库目录（list_rooms 时同步库目录到托管状态；防路径穿越；mime 表复用）
- [x] 2026-08-25 前端：CoverCollage 封面拼贴组件（image=img 直载 / video=暗底胶片角标 / 空=渐变兜底；分格逻辑按张数）
- [x] 2026-08-25 前端：使用模式改 Hero 焦点式——左侧大封面卡（房间名+统计+应用中徽标+应用钮），右侧紧凑列表（小拼贴缩略图，点击换 hero，行内快捷应用）；空态保留
- [x] 2026-08-25 前端：顶栏深浅主题切换按钮（documentElement .dark 类 + localStorage 记忆，两模式均可见）
- [x] 2026-08-25 mock 设计模式同步：MOCK_ROOMS 给渐变假封面数据，与真后端同构
- [x] 2026-08-25 顺手修：设计模式下 refreshRooms useEffect 未跳过浏览器环境，invoke 报错刷状态栏（ERRORS #15）
- [x] 2026-08-25 自测：cargo check + npm run build 全绿；设计模式截图确认布局生效
- [x] 2026-08-25 迭代轮（多轮协作工作流，见 FRONTEND_WORK.md）：使用页改卡片网格+右半 hero、搜索栏过滤、顶栏加创意工坊/设置占位 tab
- [x] 2026-08-25 R1 页数栏（分页+第一页/上一页/下一页图标钮+7 mock 房间）(cd071d1)
- [x] 2026-08-25 R2 顶栏窄窗折行修复 (82a934d)
- [x] 2026-08-25 R3 编辑页侧栏骨架（应用库/Room 可折叠导航）(f49c4d3)
- [x] 2026-08-25 R4 顶栏清理（房间下拉/新建/另存为/库路径/转场/保存/应用 移出 UI，函数保留）(385390e)
- [x] 2026-08-25 R5 Room 两级流程（房间列表→desk 编辑+返回钮）(1d955d7)
- [x] 2026-08-25 R6 Room 详情侧栏（WE 风格：自动播放大图+名字+编辑/应用钮）(7f01a59)
- [x] 2026-08-26 R7 命名定稿（左=sidebar 侧边栏 / 右=预览栏）+ CoverStack 堆叠小图改按比例缩放 + sidebar 新增 Dock 项（占位视图）
- [x] 2026-08-26 R8 预览栏底部加横线+「新增 Room」（mock 追加并默认选中）；进入 Room 编辑改上下分区：上层思维导图（启动画面主节点→desk 矩形、switch 一来一回连线带箭头）、下层属性栏（改名 / 导入图片·网页代码·视频占位钮 / switch 去程回程转场下拉）
- [x] 2026-08-26 R9 导图修正轮：删旧 desk 侧栏（函数 void 保留）；修「不明物体」（polyline 不支持 % 坐标→改 line % 三段折线+箭头，线条加深）；拓扑纠正：启动画面→主 Desk 直连无 switch，switch 只在相邻 desk 间一来一回，主 Desk=desks[0]；导图节点改由 desks 状态派生；上下分区可拖动调高；导图上方右侧工具栏：撤回/重做（快照历史）/保存（mock 提示）/应用/分享；switch 转场类别加 代码/视频（选中出占位选择钮）
## DOCK-002 从应用库选择常驻图标（2026-08-29）

> 目标：在具体 Room 的 DockEditor 中搜索现有应用库，把真实应用加入全局或当前 Desk Dock，并通过现有 Room 保存链保留图标和启动信息。
> 专属验收文档：`dev_docs/acceptance/DOCK-002-app-library-icons.md`（完整清单永久保留）。

- [x] 建立独立 worktree 和分支 `feat/dock-002-app-library-icons`
- [x] DockEditor 增加应用搜索、全局/当前 Desk 作用域和真实应用增删
- [x] 保留 `label/icon_png/action` 与 `launch.target/args/workdir`，复用现有 Room 保存链
- [x] `npm run build`、UI 设计模式浅色/深色和作用域交互检查通过
- [x] 用户于 2026-08-29 明确回复“验收通过”
- [x] 合并到 master：`e070e79`
- [x] 专属验收文档及人工验收清单保留，未删除

## DOCK-003 桌面图标拖入 Dock（2026-08-29）

- [x] 渲染器编辑模式支持桌面图标拖入 Dock：drop 反馈、启动目标去重、完整图标/启动字段保留
- [x] 新增 `addDockIcon` 消息并接通 MessageType、Lively.Models.Message、IpcMessageConverter、Player、Core
- [x] Core 写入包内 room.json，并在存在 `__source` 时同步源房间；预览模式不写盘
- [x] 编辑模式支持 Dock 图标拖回桌面；继承全局 Dock 时仅建立当前 Desk 覆盖
- [x] 自动检查通过：node --check、cargo test（Core 运行中）、cargo check、npm run build、build.ps1、git diff --check
- [x] 用户验收通过（2026-08-29），已合并 master

## UI-003 导图几何布局接线（2026-08-29）

- [x] 使用真实 DOM 几何与 ResizeObserver 重做导图布局和贴边路由，修复长名称溢出
- [x] 增加醒目的“新增 Desk”、可选启动目标、唯一启动线及撤回/重做快照
- [x] Desk 拓扑定为环形：相邻上下连接，3 个以上首尾从侧边环回；1/2 Desk 不重复造边
- [x] 每对 Desk 视觉收敛为一条两端带箭头的双向线，switch 面板仍分别编辑两个方向
- [x] 2/3/4 Desk、启动目标、撤回/重做、深浅主题及宽窄窗口验收通过
- [x] Room Scene 产品方向作为 DXT-001/SCENE-001 输入写入文档，不扩大 UI-003 代码范围
- [x] 用户于 2026-08-29 回复“ok合并提交”，最终验收通过
- [x] 合并到 master：`e51cb0a`；实现提交 `76b0d7b`、`0788884`、`4fefacc`、`6c1f13e`

## DXT-001 room.json v1 契约与统一场景渲染（2026-08-30）

> 目标：在一个工作包内定稿 room.json v1，并原地改造现有渲染、配置器预览、Rust 应用和 Player/Core 回写链，使 image/video/html 场景、安全隔离与持久化边界真正生效。
> 范围外：end 的完整编辑入口、Desk 排序、成组 HTML 依赖导入、Room zip 导入导出、旧 Room 迁移、Dock 拖拽重做、运行态字段和无关 Player/Core 重构。用户验收反馈后，现有 Desk/start/switch 属性栏按钮的真实导入已纳入本包。
> 人工验收：按 `acceptance/DXT-001-room-json-v1-contract.md` 使用 v1 验收 Room，依次检查启动、双向切换、三类内容、预览不落盘、Dock 继承和 `__source` 边界。

- [x] 核对 master、ROADMAP、UI-003、DOCK-004 和全部 worktree；确认只在 `feat/dxt-001-room-json-v1-contract` 开发
- [x] 完整阅读入口、模型、流程、Dock、前端、IPC、持久化及错误分册
- [x] 使用 CodeGraph 盘点现有场景渲染、预览和持久化链，确认原地改造
- [x] 创建封闭的 `room.schema.json`、有效/无效夹具和可重复 Schema 检查
- [x] 官方宿主支持 background/start/switch/end 的 image/video/html、固定图片时序、视频完整播放、HTML sandbox/实例消息/超时/清理
- [x] 修正 `startDesk`、有向相邻 switch、缺失方向安全回退、Dock 继承和运行态不落盘
- [x] 配置器打开/保存/预览保留完整 v1；真实 Desk/start/switch 素材按钮接通固定目录复制和内存草稿
- [x] Rust 新建/保存/另存/应用链写出干净 v1；Player/Core 回写只信任运行包 `__source`
- [x] Schema、JS、Rust、TypeScript、Release C# 构建及真实预览/桌面回归通过
- [x] 用户验收发现属性栏按钮只有外观后，在同一分支修复；10 项 Rust 测试及前端构建通过
- [x] 用户于 2026-08-30 回复“ok啊验收通过，感觉可以合并了”，最终验收通过
- [x] 增加 `ROOM_AUTHORING.md`，固化配置器、手工制作和 vibe coding 的准确协议
- [x] 合并到 master：`8f39fbb`；实现基线 `ed13a33`、入口收口 `86ad139`、素材按钮修复 `945d0ed`、创作者协议 `152e45e`
- [x] 删除已合并分支并移除 Git worktree 注册；真实验收运行包变化以 stash 消息 `dxt-001 live acceptance runtime package 2026-08-30` 保存，未混入源码

## OPS-003 开发优先级与 dev_docs 记录指南（2026-08-30）

- [x] 将 DXT-002 记录为待验收但暂缓，未误写为已完成或合并
- [x] 将 CORE-002 Dext Core 运行身份隔离设为唯一下一项
- [x] 在 README 增加 dev_docs 日常记录路由、固定流程和可复用开工提示词
- [x] 在 PROJECT 记录 Dext 自有 Core 与原版 Lively 必须隔离的结构性决定
- [x] 用户于 2026-08-30 回复“合并”，验收通过
- [x] 合并到 master：`eb5e9ff`；独立验收文件永久保留

## CORE-002 Dext Core 运行身份隔离（2026-08-30）

> 目标：让仓库自带的 Dext Core、Player、配置器和启动脚本使用独立运行身份，不能与用户另装的原版 Lively 串实例、管道、数据或启动判断。
> 范围外：不修改或停止 DXT-002、DOCK-004 和用户 rooms；不开发 idle、Room zip、Dock、素材导入或 Player/Core 架构重构；不重命名内部 namespace、proto 包、源码目录和 Core/Player 可执行文件；不迁移旧 Lively 数据；安装器/MSIX/AppUserModelId/屏保注册另立 PACKAGING-001。
> 人工验收：按 `dev_docs/acceptance/CORE-002-dext-runtime-identity.md` 的九步清单执行，并在对话中确认结果。

- [x] 确认 OPS-003 已由用户验收并合并 master；核对 master、现有 worktree、待验收分支和用户 rooms 状态（2026-08-30）
- [x] 从 `master@2130935` 建立独立 worktree `D:\use\Orca\DEXT_Core\core-002-dext-runtime-identity` 和分支 `feat/core-002-dext-runtime-identity`（2026-08-30）
- [x] 建立独立验收卡并将 ROADMAP 标为开发中，冻结目标、范围外和九步人工验收（2026-08-30）
- [x] 使用 CodeGraph 完整审计 Core、Player、配置器、脚本、存储、日志、包装和上游归属身份，形成必须改/建议改/保留/后续清单；新 worktree 的 `.codegraph` 未初始化，修改后复核按规范先检查 `codegraph status`，未擅自初始化并以只读搜索兜底（2026-08-30）
- [x] 建立 C#、Rust、PowerShell 共同使用的 Dext 运行身份源，并隔离 mutex、named pipe、本地数据、日志、缓存和启动项（2026-08-30）
- [x] 扩展 RPC 身份证明，配置器拒绝错误产品/身份/Debug 路径并展示 Dext Core PID、路径、管道和数据目录（2026-08-30）
- [x] 修正启动/构建/预览脚本，按当前 worktree 的规范化绝对路径识别和验证进程；新增只读运行身份检查脚本（2026-08-30）
- [x] 将用户可见核心身份 Dext 化，禁用旧 WinUI/Gallery/上游更新入口，保留合法上游归属与高风险内部名称（2026-08-30）
- [x] 同步 README、ROADMAP、PROJECT、LIVELY_API、AGENTS、验收卡；解决构建脚本吞失败的新坑并追加 ERRORS #37（2026-08-30）
- [x] 运行 C#、proto、Rust、React、脚本与真实进程验证，复查全部 `Lively` 字样并执行 `git diff --check`（2026-08-30）
- [x] 只提交 CORE-002 具名文件（实施提交 `039d468`），将 ROADMAP/验收卡标为待验收；用户明确回复“通过”前不合并 master（2026-08-30）
- [x] 用户验收反馈：托盘退出 Core 后配置器仍错误显示“已连接”，且含 DXT-002 `idle` 字段的现有 Room 被严格校验阻断；已在同一分支提交 `a6be4c5`，修复实时断线状态、应用按钮保护和 `idle` 只读兼容/写回保留，不实现 idle、不修改用户 Room，转待复验（2026-08-30）
- [x] 用户回复“ok啊都行了”，确认 CORE-002 复验通过并授权合并 master（2026-08-30）
- [x] 合并到 master（merge `3835be1`），更新 ROADMAP/验收卡最终状态并归档 TODO；删除已合并分支和独立 worktree，用户 rooms 未触碰（2026-08-30）

## CORE-003 Dext 一键启动防旧构建（2026-08-30）

> 目标：确保从 `scripts` 启动 Dext 时不会运行当前 worktree 中残留的上游 Lively 旧二进制；入口应自动重建无效 Core、验证 Dext 身份，并在启动验证失败时清理本次错误进程。
> 范围外：不重命名 `Lively.exe` 或内部程序集/namespace；不修改 UI 页面、Room、Dock、idle、安装器或用户 rooms；不删除仍有独立用途的现有 scripts。

- [x] 复现 master 旧输出 ProductName/FileDescription 为 Lively，且 Dext mutex/pipe 均未创建
- [x] 启动前验证二进制身份；缺失或非 Dext 时执行 `build.ps1 -Rebuild`，构建后再次验证
- [x] 缺少配置器依赖时执行 `npm ci`，npm/Tauri 失败返回非零
- [x] 新增只转调 `start.ps1` 的 `start-dext.cmd`；失败验证只清理本次启动 PID
- [x] 从真实旧 Lively 输出完成强制重建；Core/Watchdog/Player/配置器路径和 Dext 身份验证通过
- [x] 删除无引用且硬编码改写旧 Room 的 `dock-demo-inject.mjs`；其他有效脚本保留
- [x] 实现提交 `7d1b10e`，用户于 2026-08-30 回复“通过”
- [x] 合并到 master（merge `8c7c89a`），测试运行包变化保存为可恢复 stash；用户 rooms 未触碰

## UI-V1-001 配置器核心页面全栈闭环（2026-08-31）

- [x] 完成 Room 安全新增/删除/导入/导出、真实应用/停止状态和旧版 Room 安全删除边界
- [x] 完成使用页、编辑页、设置页、诊断/关于与创意工坊空状态的前后端闭环
- [x] 根据六轮反馈完成双击应用、纯背景预览、Desk/Dock 共用原地应用选择、Desk 背景画布及明显 Room 选择态
- [x] 普通 Rust 测试与真实桌面副作用隔离；前端、Rust、真 Tauri、深浅色和常用窗口验收通过
- [x] 用户于 2026-08-31 回复“都合并，我已经停止我的 Dext 进程了，可以了”，确认十七项验收通过
- [x] 合并到 master：`61ea4c8`；运行包变化保存为可恢复 stash，用户 Room 状态不混入源码提交

## DXT-002 Room 待机画面接入（2026-08-31）

- [x] 用户确认 Room 正式采用 `idle`、废弃 `end`，并以此作为 Room v2 生命周期基线
- [x] 将旧实现刷新到最新 master，保留 UI-V1 Room 管理与配置器重构结果
- [x] Schema、Rust、React、渲染器、C# Release 构建、Dext 身份启动和浏览器态视觉检查通过
- [x] 用户回复“通过 合并”，确认真机屏保显示、唤醒与普通关闭行为通过
- [x] 合并到 master：`6544e52`；DXT-003 提升为唯一下一项，用户 Room 改动未进入提交

## DXT-003 Room v2 Widget 后端与系统接口（2026-09-02）

- [x] 项目收口为唯一原生 Room v2；删除 v1 Schema、fixtures、迁移、降级与兼容重建路径
- [x] 新建、编辑、保存、另存、预览、应用与 zip 全链只接受/产生 v2，并无损保留每 Desk `widgets` 与声明资源
- [x] Core→Rust/Tauri 提供封闭的系统媒体读/控与 Windows 默认输出主音量接口，非法动作和越界参数在最终边界拒绝
- [x] 交付 WidgetHost/Scene 分工、可信热点、图标避让、系统安全与 AI 创作提示词文档
- [x] Schema、Rust、前端、渲染器、C# Release、真实启动及媒体/音量活体检查通过；实现提交 `695e3e7`
- [x] 用户于 2026-09-02 回复“通过 合并”，确认验收通过；主 worktree 用户 `rooms/` 改动未进入本工作包
- [x] 合并到 master：`56dc602`；下一工作包等待配置器 UI 完善与设计讨论后确定

## DESK-EDIT-001 Desk 安全放置与精简编辑（2026-09-11）

- [x] 配置器向 Desk 添加应用时立即分配安全空位，避开旧图标、Widget 和有效 Dock 保留区；满网格不写历史或脏状态
- [x] 真桌面长按编辑移除桌面/Dock 删除、图标尺寸切换与 Desk↔Dock 拖拽，只保留桌面图标移动；Widget 编辑能力不变
- [x] 自动检查通过：`npm test` 39/39、`npm run build`、`node --check`、Room Schema、`git diff --check`，并完成真实页面交互检查
- [x] 用户于 2026-09-11 回复“验收通过”
- [x] 合并到 master：`355bc79`；实现提交 `d8655a9`

## DESK-PREFS-001（2026-09-22 合并归档摘要）

五项图标偏好真实投递/消费、共享紧凑几何与原生鼠标会话修复已由用户明确授权合入 master `4fd2986`（核心输入修复 `3c42552`）。历史逐项物理验收未补填；详细记录见 `acceptance/DESK-PREFS-001-icon-settings-live.md`。合并前原生 Windows 回归通过，合并后 Vitest 55/55、布局/动画 Node 20/20、JS 语法检查通过，用户 Room/资源哈希未变。原工作区仍运行且含未提交布局，清理延后。TODO 旧条目追加保留，当前计划以 ROADMAP 为准。

## CONFIG-EDIT-001（2026-09-23 验收归档摘要）

配置器 Room 打开改为异步审计完成后原子提交状态；未声明 Widget 文件以受限编辑和可恢复隔离处理，缺失声明资源与保存/预览/应用/导出仍保持严格。Vitest 57/57、Rust 43 项通过（3 个真实环境测试按设计忽略）、前端构建与真实运行身份核对通过。用户于 2026-09-23 回复“ok验收通过下一步”；详细步骤与结果见 `acceptance/CONFIG-EDIT-001-room-open-recovery.md`。

## DESK-REORDER-002（2026-09-23 验收归档摘要）

在已修复的旧直接拖动输入上增加路径插入和同伴 FLIP，让拖起图标继续原生跟手、沿途图标实时让位、无效区域整体回滚，并保留 Widget/Dock 障碍、五项图标偏好与 reduced-motion。用户在真实 WorkerW 验收后回复“好样的 合并上去”；实现与验收记录快进合入 master `23aa845`。合并后 Vitest 57/57、Rust 43/43、Node 27/27、前端构建、Room Schema 与 Renderer Playwright 55/55 通过，用户 Room/背景/Widget 数据哈希未变。详细步骤见 `acceptance/DESK-REORDER-002-stable-sortable.md`。

## CORE-006（2026-09-23 验收归档摘要）

配置器连接状态旁加入“启动 Core / 退出 Core”；后端限定当前配置器所属 Dext 可执行文件，验证产品身份和进程路径，等待桌面就绪并正常退出 Core，配置器继续可用。真实桌面完成两轮退出→启动；缺失 Core 文件时保留重试入口，恢复文件后可重新启动。用户回复“验收通过 合并进去吧”；实现 `b2dfc65` 快进合入 master。合并后 Vitest 62/62、Rust 48 通过/3 忽略、前端构建及 cargo check 通过。详细步骤见 `acceptance/CORE-006-core-runtime-control.md`；UI-008 仍为唯一下一项。

## V3-CORE-001（2026-09-28 验收归档摘要）

在 Dext Core 中新增 Room/Desk 权威会话内核，提供版本化快照、切页排队和超时/失焦提交、旧会话结果拒绝与经 Room/Desk 身份校验的 checkpoint 恢复。待验收复核修复时钟回拨导致一次性计时器不再触发的问题。用户于 2026-09-28 明确验收通过；`a81788a` 快进合入 master。合并后内核回归 8/8、完整构建与 master Core/Player/配置器运行身份核对通过。旧 worktree 已归档、已合并分支已删除；详细记录见 `acceptance/V3-CORE-001-room-session-kernel.md`。v3 Player/配置器协议接线仍属后续独立工作包。

## V3-CORE-005（2026-09-30 验收归档摘要）

最小 v3 Room 由配置器应用后，Core 校验已安装样包及真实 Player PID，向 Player 下发权威快照；真实桌面切页、重启恢复和回退 v2 均由开发侧验证。用户回复“验收通过 git合并 名字就叫v3FirstTest”；合并提交 `24ac47c`，旧工作分支和 worktree 已清理。合并后协议 30/30、完整 Core/Player 构建及 master 三进程身份核对通过，MSIroom 重新应用后 Player 页面指向 master。V3-CORE-002/003/004 与 V3-P2A-001 的代码因堆叠历史随本次合并入库；尚未完成的独立人工项目仍保留在各自验收卡，不补填为已通过。详细记录见 `acceptance/V3-CORE-005-player-bridge.md`。

## 2026-10-09 halfV3阶段合入记录
用户明确回复“合并到主线吧 名字叫halfV3”，授权当前集成成果及其堆叠依赖合入master；合并提交与本地标记均命名halfV3。本次不补填尚未执行的完整人工步骤：Task3/4和完整16项保持未完成，进度2/4=50%。最近代码f395e67，五项只读数据回归通过、Release构建和实际重新应用通过；没有把媒体源可用当成具体B站标题验收。后续按ROADMAP集中验收续项恢复。

halfV3合并收尾（2026-10-09）：master无冲突命名合并，合并提交由本地halfV3标记定位。合并后只跑必要本地冒烟：runtime-model18/18、visible-data5/5；未重复桌面操作或全部网络/安全矩阵。当前运行候选保持。
主线原21项Room文件删除和导入的v3-orbit-lab/v3test已完整保留；备份.build/halfV3-local-room-state-20261009与stash e08778387809a44a491a4e72fd6ebdb8517e5ee2均保留。恢复后导入Room仍按原本机清单/字节存在，源目录与提交作者样包的差异属于未提交本机状态，未混入合并。
本轮v3-integration worktree已通过应用归档为可恢复快照，feat/V3-INTEGRATION-001-integration已安全删除。旧堆叠依赖分支不在本轮清理范围。阶段合并完成，整体集成仍2/4=50%，下一项继续Task3/4集中验收。
