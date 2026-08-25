# 总任务台账（只加不删）

> 标记规则：`[ ]` 计划中 · `[~]` 进行中 · `[x]` 完成(日期) · `[!]` 受阻(原因)
> 新计划一律**追加**；做完立即打标；废弃标 `[x] 已取消(日期)`，不删除。
> 会话被中断时：从这里最后一条未完成项继续。

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

## 当前阶段：共享渲染器 + Schema v1

### Phase 1：房间库最小闭环（2026-08-25 追加，优先执行）

- [x] 2026-08-25 迁移现有房间 → `rooms/my-room/`（background/ 素材分离，路径改写）
- [x] 2026-08-25 新建 `rooms/black-room/` 示例（空背景 → 纯黑兜底）
- [x] 2026-08-25 Rust 命令：list_rooms / read_room / write_room / create_room / apply_room（拷数据进壁纸包+SetWallpaper）
- [x] 2026-08-25 配置器：房间下拉 / 新建 / 另存为 / 库路径可指定(localStorage) / 脏状态切换确认
- [x] 2026-08-25 渲染器空背景守卫（body 已 #000，不造黑色图片文件）
- [x] 2026-08-25 自测：npm run build + cargo check 全绿
- [x] 2026-08-25 用户人工验收：重点三项（A2/C3/C4）已确认通过；全清单固化至 ACCEPTANCE.md，剩余项用户随时抽查

### Phase 2：双模式 + 预览地基（2026-08-25 追加）

- [x] 2026-08-25 使用/编辑双模式骨架：**默认使用模式**（固定，不记忆）；顶栏 tab 切换
- [x] 2026-08-25 使用模式最简版：房间卡片（desk/图标数）+「应用中」标记 + 应用按钮
- [x] 2026-08-25 保存/应用分离：编辑模式「保存」只写盘；「应用」推桌面（dirty 先自动保存）
- [x] 2026-08-25 渲染器注入钩子：main.js 监听 `dext:room` 消息（地基，联动逻辑后议）
- [x] 2026-08-25 文件通道：自定义 `dext://` 协议映射壁纸包目录（asset protocol 相对路径解析有坑，直接走自定义协议）
- [x] 2026-08-25 编辑模式预览开关：应用库区 ↔ 16:9 iframe，编辑实时注入
- [x] 2026-08-25 自测：npm run build + cargo check 全绿
- [ ] 2026-08-25 用户验收：清单见 ACCEPTANCE.md「Phase 2」

### Phase 3：桌面长按编辑（2026-08-25 追加）

决策：拖拽占用格 = **让位**（行优先序列插入重排，非交换）；图标归一化 → 移入「远期」。

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

### Phase 3 修复轮（2026-08-25 追加）

- [x] 2026-08-25 F1 拖动不跟手：CSS 优先级 bug（.dragging transition:none 被 ID 选择器压制）→ 内联开关+加权
- [x] 2026-08-25 F3 交互改版：packed 让位 → 稀疏格子（空位可放/删除留洞）+ 占用格交换（用户拍板）
- [x] 2026-08-25 F2 根因确认：旧配置器进程 apply 无 __source 戳 → 回退；需重启+重应用一次（操作项，非代码）
- [x] 2026-08-25 F2b SaveRoom 落盘路径修复：path 参数实为 index.html 文件，取目录后拼接（ERRORS #11）
- [x] 2026-08-25 F2c 双写目标补全：__source 是目录，写 src/room.json（ERRORS #13）；内层 catch 改为记日志
- [x] 2026-08-25 F4 复验通过（用户 ok）：拖拽/持久化/双写/重应用/切房全通

### Phase 3.5：图标三档尺寸（2026-08-25 追加）

- [x] 2026-08-25 schema：desks[].iconSize = large|medium|small（缺省 medium，宽容读取）
- [x] 2026-08-25 渲染器：三档尺寸映射（图标/格子/字号联动），列数按屏宽动态计算
- [x] 2026-08-25 渲染器：编辑模式 Dock 加 大/中/小 切换按钮（带当前档高亮），切换即持久化
- [x] 2026-08-25 渲染：坐标渲染时按当前档钳制到可视范围（不改动存储值，切回小档不丢位）
- [x] 2026-08-25 自测 + 用户验收全绿（2026-08-25）；追加配置器侧栏尺寸选择器(78d6c5a)

### Phase 4：单 Desk 循环视频背景（2026-08-25 追加）

- [x] 2026-08-25 schema：background 多态——字符串=图片路径（兼容）；`{type:"video",src}`=视频
- [x] 2026-08-25 渲染器：单一 `<video>` 元素（muted/loop/playsinline/cover），
      仅当前 desk 挂载，切桌换 src（过渡遮罩盖住），非视频 desk 释放
- [x] 2026-08-25 配置器：desk 侧栏背景区（当前背景摘要 + 图片/视频/清除三按钮）；
      dialog 插件选文件 → Rust 拷贝进 roomDir/background/（时间戳命名防冲突）→ 写回 background 字段
- [x] 2026-08-25 Rust：tauri-plugin-dialog + import_background 命令 + capabilities 权限
- [x] 2026-08-25 自测：cargo check + npm build 双绿
- [x] 2026-08-25 用户验收全绿（2026-08-25）

### Phase 5：方向感知切桌过渡（2026-08-25 追加）

- [x] 2026-08-25 接口：TRANSITIONS 注册表 { dur, run(stage, dir, done), cleanup }；room.transition 字符串字段（缺省 slide）
- [x] 2026-08-25 内置动画：slide（左右镜像）/ fade / zoom / none / text（旧黑屏文案，兼容）
- [x] 2026-08-25 结构：#desk-viewport > #desk-main + #desk-staging（双页渲染，Dock 不随动画动）；
      renderDesk 拆分 mountBackground/renderIcons 供主层与 staging 复用
- [x] 2026-08-25 方向：switchDesk(delta) 的 delta 即 dir，来回动画镜像
- [x] 2026-08-25 自测 node --check 通过
- [ ] 2026-08-25 用户验收（ACCEPTANCE.md「Phase 5」T1-T6）（ACCEPTANCE.md「Phase 5」）

### Phase 5.5：视频转场（2026-08-25 追加）

- [x] 2026-08-25 schema：transition 字段多态——字符串=预设名；`{type:"video",src:"transition/x.mp4"}`=视频转场
- [x] 2026-08-25 渲染器：stinger 流程——全屏视频盖住 → 播到一半换桌 → 播完揭晓；加载/播放失败回退 slide
- [x] 2026-08-25 Rust：import_background 支持 kind=transition（拷进 roomDir/transition/）；apply_room 增拷 transition/ 文件夹
- [x] 2026-08-25 配置器：编辑模式顶栏转场下拉（滑动/淡入/缩放/无/视频），选视频弹文件框写回字段
- [x] 2026-08-25 自测 cargo check + npm build 双绿 + renderer node --check
- [x] 2026-08-25 用户验收通过（2026-08-25）

### Phase 6：前端外观迭代基建（2026-08-25 追加）

- [x] 2026-08-25 实时预览：vite 监听壁纸目录（npm run dev:room / scripts/room-preview.ps1，端口 5174，无需 Lively）
- [x] 2026-08-25 主题变量地基：style.css :root 收敛 --dext-* 令牌（8 处引用替换）
- [x] 2026-08-25 开发文档：dev_docs/FRONTEND.md（独立会话可用的外观迭代手册，含任务池）
- [ ] 2026-08-25 用户验收：预览窗口可用（ACCEPTANCE.md「Phase 6」）

### 外观任务池（在独立会话按 dev_docs/FRONTEND.md 第六节逐项领取）

（任务清单见 FRONTEND.md 第六节，完成后在此追加记录）

### Phase 6：前端外观迭代基建（2026-08-25 追加）

- [x] 2026-08-25 实时预览：vite 监听壁纸目录（npm run dev:room / scripts/room-preview.ps1，端口 5174，无需 Lively）
- [x] 2026-08-25 主题变量地基：style.css :root 收敛 --dext-* 令牌（8 处引用替换）
- [x] 2026-08-25 开发文档：dev_docs/FRONTEND.md（独立会话可用的外观迭代手册，含任务池）
- [ ] 2026-08-25 用户验收：预览窗口可用（ACCEPTANCE.md「Phase 6」）

### 外观任务池

（任务清单见 FRONTEND.md 第六节；独立会话逐项领取，完成在此追加记录）

### Phase 6.5：应用库可管理化（2026-08-25 追加，替代原"多选批量操作"）

> 用户定调（MyDockFinder 模式）：手动添加 .lnk 为主，一键扫描合并为省事选项；库可删除卸载残留。

- [x] 2026-08-25 库持久化：rooms/library.json（load_library/save_library）；无库文件时回退在线枚举（兼容）
- [x] 2026-08-25 新 RPC ResolveApp(path)：C# AppCatalogService.ResolveOne（.lnk 复用 ResolveShortcut；.exe 直取）→ proto → Rust grpc
- [x] 2026-08-25 前端：库来源徽标/添加/扫描合并/多选模式（添加到Desk、从库删除）
- [x] 2026-08-25 自测：build.ps1 + cargo check + npm build 全绿
- [ ] 2026-08-25 用户验收（ACCEPTANCE.md「Phase 6.5」L1-L7）

### Phase 6.5：应用库多选批量操作（2026-08-25 追加）

- [ ] 2026-08-25 应用库加「多选」模式：点选累积选择集（不立即增删），操作条批量 添加到当前 Desk / 从当前 Desk 移除 / 清除 / 退出
- [ ] 2026-08-25 批量添加跳过已存在；批量移除按 target 过滤；切 Desk 清空选择
- [ ] 2026-08-25 自测 npm build + 用户验收（ACCEPTANCE.md「Phase 6.5」）

### Phase 3+：渲染器与 Schema（排队中）

- [ ] 从 `wallpapers/dext-room/main.js` 抽出渲染器模块：
      renderRoom(room, mount) 纯函数化，壁纸运行时与配置器预览共用同一份
- [ ] room.json schema v1 定稿 + JSON Schema 校验文件：
      icons[] 加 x/y 坐标；background 多态（路径 | 内嵌小图 | 视频）；
      宽容读取原则（缺字段一律给默认值，见 ERRORS #4 教训）
- [ ] 渲染器支持坐标格子布局（网格默认尺寸待定，横屏 ~8×4 起步）
- [ ] 渲染器支持视频背景：<video> 懒挂载，切桌遮罩盖住换源，
      同一时刻只保留当前 desk 的视频（防多路解码爆内存）
- [ ] Room 文件夹化落地：{ room.json + background/ }，配置器管房间库
      （打开/另存/切换/导出 zip）；素材导入自动压缩（≤1920w JPEG）
- [ ] 配置器双模式编辑：背景模式（素材管理）/ 布局模式（拖拽图标进格子）
- [ ] 配置器内嵌实时预览（iframe 加载共享渲染器）
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
