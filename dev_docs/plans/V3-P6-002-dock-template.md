# V3-P6-002 Dock模板与交互编辑实施计划

> 执行：superpowers:executing-plans。用户已授权Native连续开发与最终集中验收；不创建子代理。
**目标：** 原生配置器能选择自包含Dock模板、配置共享数据/默认按钮，Desk仅保存字段差异，并在实际v3宿主验证呈现和数据。
**架构：** 复用组件config/componentOverrides及现有SDK；新增模板描述/作者文件导入和独立Dock编辑组件；Core提供当前安装的只读数据授权状态/编辑。
**技术：** React/TypeScript、Tauri Rust、自带Core/ReleasePlayer与作者SDK v1。
**规格：** plans/V3-P6-002-dock-template-design.md、V3_PLAN §5/§6.2条目8、ROOM_V3/ROOM_V3_RUNTIME_API。
**基线：** 6d15d1b（未合并P6-001依赖）；feat/V3-P6-002-dock-template；独立v3-dock-template worktree。

## 全局约束
version3/apiVersion1、稳定Room/Desk/组件/按钮ID、完整资源清单；公开作者数据与Core个人配置分开。字段继承与SDK一致：对象递归/null显式/数组替换。展示槽允许全部已开放只读数据源，不按造型限制类型。外框与读数分离。桌面拖动暂缓，本地功能优先，无新增网络专项，不中途合并/验收。

## 审查关注
- 替换模板共有语义区域保留按钮身份；删除后新建不得串入旧绑定（Task1功能测试）。
- 只覆盖一个槽的Desk仍接收其他共享值变化，重置删除差异而非写死当前值（Task1）。
- 删除区域不能删除其他图标/内容仍引用的按钮，未用资源清单仍完整（Task1）。
- 授权失效/撤销必须停止数据，保存作者文件不带Core授权（Task3）。
- HTML按钮缩放/布局变化重新报告几何，缺数据/渲染失败保持外框（Task4）。

### Task1 模板与共享/差异文档
文件：新建tauri-ui/src/features/room-editor/dock-template.ts、dock-template.test.ts；扩展v3-document.ts；新增src-tauri/src/room_v3_dock.rs和tests/room-v3-contract/src/dock_tests.rs；lib.rs注册模板目录/导入/检查命令。
接口：DockTemplateDescriptor{formatVersion:1,id,name,entry,parameters,regions,examples}；list_v3_dock_templates()→descriptor[]；import_v3_dock_template(room_dir,template_id)→{entry,resources,descriptor}；inspect_v3_dock_template(room_dir,component_id)→descriptor。
模型：attachDockTemplate(room,descriptor,imported)→RoomV3；setDockValue(room,path,value,deskId?)→RoomV3；resetDockValue(room,path,deskId)→RoomV3；removeDockRegion(room,regionId)→RoomV3；effectiveDockConfig(room,deskId)→公开JSON。
- [ ] 写共有区域稳定ID、共享CPU/时间/GPU→Desk2左栏倒计时、改共享右栏/删除差异恢复、删除仍引用按钮保护的功能测试，运行真实RED。
- [ ] 实现描述/稳定身份/递归差异和删除引用；描述文件只提供配置，不执行元数据代码。
- [ ] 写生产Rust完整模板/SDK复制、描述重读和失败原文保持测试，运行RED。
- [ ] 实现自包含作者文件操作；原v3保存/安装同一正式契约，必要测试GREEN并具名提交。

### Task2 官方模板与独立编辑UI
文件：creator-kit/v3/dock-templates/{three-panels,navigation-bar}/{template.json,index.html,style.css,main.js}；V3DockEditor.tsx；V3RoomEditor.tsx及浏览器检查。
接口：V3DockEditor(room,deskId,onChange,onImport,canApply)；模板HTML只使用当前Dext.config/data/actions/scene接口，SDK由Task1复制，不新增公开原生接口。
- [ ] 先写模板配置/数据状态/按钮几何功能RED。
- [ ] 实现两模板、自动语义区域、公开参数/作者示例、全部只读源选择、作者默认动作；公开绑定.launch不包含私人路径。
- [ ] 实现外观→共享交互→Desk引用/＋差异编辑、逐字段重置、删除区域、撤销重做和保存重开。
- [ ] 必要Vitest/模板行为测试与npm build通过，实际浏览器UI区分mock，具名提交。

### Task3 Core当前安装的只读数据授权
文件：Core/Core/Dext/RoomSessionRuntimeCoordinator.ReadGrants.cs、RoomActionAuthority.ReadGrants.cs；WinDesktopCoreServer.cs；Core和Tauri两份wallpaper.proto；grpc.rs/lib.rs；V3DockEditor.tsx；tests/Dext.Core.Tests/ReadGrantChecks.cs及测试项目链接。
接口：GetRoomReadGrants(roomId,installationStamp)→{status,consumers:[{consumerId,capabilities}]}；SetRoomReadGrant(roomId,installationStamp,consumerId,capabilities,allow)→同一安全状态。IRoomSessionRuntimeCoordinator向RPC提供上述两个操作，内部验证当前原生安装及声明，RoomPersonalStore原子持久化；Tauri分别get_v3_read_grants/set_v3_read_grant。
- [ ] 先测试允许所选已声明只读能力后provider可用、撤销/旧安装不可用、保留无关授权、保存失败原状态保持，运行RED。
- [ ] 实现仅四种已开放只读能力的显式UI允许/撤销及状态读回，不向作者增加授权修改或私人目标读取。
- [ ] 必要Core/Rust测试与四阶段build.ps1→start.ps1，具名提交。

### Task4 实际配置器/Core/Player集成
文件：独立验收卡、TODO/ROADMAP/V3_DELIVERY/ERRORS，必要自有实际探针。
- [ ] 实际Tauri创建两Desk→选择模板/数据/动作/差异→保存重开；共用/继承/删除/历史身份核对。
- [ ] 自有实际Room当前只读授权后Core/ReleasePlayer时间/硬件呈现，撤销/缺数据保外框，HTML/SDK生产协议；模板按钮/占用随实际尺寸发布，不由fixture替代核心物理输入。
- [ ] 普通重启、原用户文件/localStorage精确恢复、自有资源清理/正常关闭；必要回归与具名提交。
- [ ] 集中本包人工卡及P5物理门槛/一次整体审查，最终用户确认前不合并；网络专项不扩展。
