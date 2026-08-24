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

- [ ] AI skill：schema 文档 + 示例房间 ×3 + 提示词模板
- [ ] 多显示器支持
- [ ] 创意工坊分发形态调研（上传格式、预览图、订阅机制）
