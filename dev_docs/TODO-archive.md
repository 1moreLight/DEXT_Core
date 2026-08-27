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
