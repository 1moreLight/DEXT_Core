# V3-P6-001 原生Room创建与节点保存实施计划

> 执行：superpowers:executing-plans；用户已授权连续开发，设计及验收集中到最终交付。
**目标：** 配置器能创建原生v3 Room，编辑两个Desk、四类本地内容、默认过渡及Dock引用，保存重开、撤销重做并走正式应用链。
**架构：** 单独的v3文档/历史模型与编辑组件保留全部作者字段，旧v2入口不承担v3序列化。Rust作者文件操作复用room_v3契约、资源读取和原子写入；应用沿已有v3安装/Core入口。
**技术：** React/TypeScript、Tauri Rust、现有原生v3 Core/ReleasePlayer。
**规格：** dev_docs/V3_PLAN.md §5/§6.2条目7及dev_docs/ROOM_V3.md。
**全局约束：** version=3/apiVersion=1；Room UUID与稳定Desk/组件/按钮ID；资源全清单；私人目标不进作品；桌面拖动暂缓；本地功能优先，无新增网络专项；最终验收前不合并master。
**审查关注：** 排序/改名不换ID；删起点/引用有确定结果；撤销不丢已导入文件清单；HTML相对依赖一起复制；失败保存保留磁盘原文。分别由以下功能回归覆盖。

### Task 1: 作者文档与本地文件闭环
文件：新增tauri-ui/src/features/room-editor/v3-document.ts及测试；新增src-tauri/src/room_v3_authoring.rs；tests/room-v3-contract引入该生产模块与功能测试；lib.rs接create_room_v3/write_room/import_v3_content。
接口：createRoomV3(name):RoomV3；editDesk/removeDesk/moveDesk/addIcon；history(record/undo/redo)；Rust create(dir,name,json)/save(dir,json)/import_content(dir,source,type)。
- [x] 写稳定ID/历史/删除和四类资源创建保存重开失败保留的功能测试，跑出RED。
- [x] 实现纯文档/历史与生产Rust文件操作，资源与未知作者配置保留；HTML以选定入口所在目录为内容包复制，UI清楚说明。
- [x] 必要Vitest与独立生产Rust测试GREEN，提交阶段改动。

### Task 2: 配置器入口与节点编辑
文件：新增V3RoomEditor.tsx；App.tsx接打开/新建/回库；room-contract.ts允许已实现v3操作，未实现另存/zip/旧预览保持禁用。
接口：V3RoomEditor(room,path,onBack,onSaved,onApply,canApply)；应用先保存再调用已有apply_room。
- [x] v3操作矩阵RED；实现两Desk节点/起点/排序/名称/四类内容/默认过渡/Dock引用及默认导航图标；撤销重做和保存状态可见。
- [x] 构建及本地浏览器编辑流程，区别UI mock与真实文件/运行证据；提交阶段改动。

### Task 3: 真实集成与记录
文件：本卡、TODO/ROADMAP/V3_DELIVERY及必要实际探针。
- [ ] 真实Tauri创建/保存/重开与v3安装→Core/Player应用；保护用户原文件，正常退出Dext。
- [ ] 记录实际证据及未完成门槛，最终集中执行本卡、P5七项及一次整体审查。

## 执行记录
- Task1和Task2基础完成；功能RED均实际运行。必要回归Vitest66/66、实际生产Rust34/34、tsc/Vite构建及Tauri cargo check通过。独立浏览器整轮节点/图标/历史/重开/深浅界面通过，磁盘/Core仍mock。真实Tauri/Core/四类实际播放仍Task3。
- 本段修正继承样包重复icon id；新增删除Desk后清理共享组件等已删除按钮引用的RED→GREEN。运行态来源识别和v3库改名支持边界待Task3接通；一次最终审查留至完整包，未提前合并。

- Task3本地闭环实际创建/保存/重开/历史/库改名/失败保存、原生应用与四媒体呈现/同安装普通重启/来源状态通过；36/36、66/66、构建/两个旧库回归和用户数据恢复，最后正常关闭。真实导航/非起点恢复/系统选择框及一次最终整体审查保持；按连续授权接续独立P6-002。
