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
- HTML按钮缩放/布局变化重新报告几何，缺数据/渲染失败保持外框；Dock组件只报buttons，固定占用按placement由官方宿主保留（occupied仍只属于roomScene）（Task4）。

### Task1 模板与共享/差异文档
文件：新建tauri-ui/src/features/room-editor/dock-template.ts、dock-template.test.ts；扩展v3-document.ts；新增src-tauri/src/room_v3_dock.rs和tests/room-v3-contract/src/dock_tests.rs；lib.rs注册模板目录/导入/检查命令。
接口：DockTemplateDescriptor{formatVersion:1,id,name,entry,placement,parameters,regions,examples}；list_v3_dock_templates()→descriptor[]；import_v3_dock_template(room_dir,template_id)→{entry,resources,descriptor}；inspect_v3_dock_template(room_dir,component_id)→descriptor。
模型：attachDockTemplate(room,descriptor,imported)→RoomV3；setDockValue(room,path,value,deskId?)→RoomV3；resetDockValue(room,path,deskId)→RoomV3；removeDockRegion(room,regionId)→RoomV3；effectiveDockConfig(room,deskId)→公开JSON；setDockAction(room,regionId,action,deskId?)→RoomV3；setDeskDockReference(room,deskId,enabled)→RoomV3。
- [x] 写共有区域稳定ID、共享CPU/时间/GPU→Desk2左栏倒计时、改共享右栏/删除差异恢复、删除仍引用按钮保护的功能测试，运行真实RED。
- [x] 实现描述/稳定身份/递归差异和删除引用；描述文件只提供配置，不执行元数据代码。
- [x] 写生产Rust完整模板/SDK复制、描述重读和失败原文保持测试，运行RED。
- [x] 实现自包含作者文件操作；原v3保存/安装同一正式契约，必要测试GREEN并具名提交。

### Task2 官方模板与独立编辑UI
文件：creator-kit/v3/dock-templates/{three-panels,navigation-bar}/{template.json,index.html,style.css,main.js}；V3DockEditor.tsx；V3RoomEditor.tsx及浏览器检查。
接口：V3DockEditor(room,deskId,onChange,onImport,canApply)；模板HTML只使用当前Dext.config/data/actions/scene接口，SDK由Task1复制，不新增公开原生接口。
- [x] 模板选择界面与Dock保留区先RED；作者HTML数据状态/实际DOM按钮矩形功能检查通过。
- [x] 实现两模板、自动语义区域、公开参数/作者示例、全部只读源选择、作者默认动作；公开绑定.launch不包含私人路径。
- [x] 实现外观→共享交互→Desk引用/＋差异编辑、逐字段重置、删除区域、撤销重做和保存重开。
- [x] 必要Vitest/模板行为测试与npm build通过，实际浏览器UI区分mock，具名提交。

### Task3 Core当前安装的只读数据授权
文件：lively-core-separation/src/Lively/Lively/Core/Dext/RoomSessionRuntimeCoordinator.ReadGrants.cs、RoomActionAuthority.ReadGrants.cs；WinDesktopCoreServer.cs；Core和Tauri两份wallpaper.proto；grpc.rs/lib.rs；V3DockEditor.tsx；tests/Dext.RoomActions.Tests/RoomReadGrantChecks.cs及测试项目链接；RoomPersonalStore与RoomSessionProtocol增加分开的只读集合和内部Coordinator上下文。
接口：GetRoomReadGrants(roomId,installationStamp)→{status,consumers:[{consumerId,capabilities}]}；SetRoomReadGrant(roomId,installationStamp,consumerId,capabilities,allow)→同一安全状态。IRoomSessionRuntimeCoordinator向RPC提供上述两个操作，内部验证当前原生安装及声明，RoomPersonalStore原子持久化；Tauri分别get_v3_read_grants/set_v3_read_grant。
- [x] 限定Core功能RED0/6→GREEN6/6，含真实time provider及授权/撤销/无关保持/失败原字节。
- [x] 四种只读授权明确编辑/读回、UI失败保持与旧副本刷新；作者接口不变。
- [x] Core6/6、UI/原Dock夹具、npm build/cargo check、四阶段build→start、实际生产授权/撤销/重启/换安装通过；具名阶段提交。

### Task4 实际配置器/Core/Player集成
文件：独立验收卡、TODO/ROADMAP/V3_DELIVERY/ERRORS，必要自有实际探针。
- [x] 实际Tauri两Desk、三栏/导航模板、共享/稀疏差异、完整导入/保存重开/替换稳定ID和资源已核对；删除/历史仍有浏览器/模型证据，物理导航集中。
- [ ] 自有实际Room当前只读授权后Core/ReleasePlayer时间/硬件呈现，撤销/缺数据保外框，HTML/SDK生产协议；模板按钮/占用随实际尺寸发布，不由fixture替代核心物理输入。
- [x] 实际普通重启授权保持、新session/Player/模板几何；原四文件/localStorage保持、精确所有权清理/正常关闭，必要回归与阶段提交。
- [ ] 集中本包人工卡及P5物理门槛/一次整体审查，最终用户确认前不合并；网络专项不扩展。

## Task1/2阶段证据（2026-10-04）
功能RED：模型7失败、原生目录/导入2失败、浏览器缺模板选择1失败、Dock与图标/Widget重叠1失败；实现后对应检查通过。模型/原文档10/10，生产Rust作者5/5+Dock3/3，两款作者HTML浏览器夹具1/1、编辑浏览器夹具通过，DOM宿主57/57；npm build及生产Tauri cargo check通过（原有Manifest未使用字段警告）。模板文件由生产Rust嵌入并完整复制，复制/保存/重读/安装真实本地文件；UI和作者HTML数据/动作使用明确夹具，不冒称实际Core授权/输入/真实Tauri保存。Task3只读授权及Task4生产活体继续。
当前接口补充：template.placement为作者给定逻辑组件框；config.template/appearance/enabledRegions/slots/buttonSlots，Desk只存componentOverrides中差异，动作相同可恢复共享按钮。共有语义区域保留ID，已删区域重建新ID，旧资源池保留。只有roomScene能发布occupied；官方宿主按当前Desk引用的Dock placement给普通图标/Widget避让，不新增作者接口。
日志：p6-dock-frontend.log、p6-dock-native-files.log、p6-dock-browser-host.log、p6-dock-tauri-check.log；截图p6-dock-ui/p6-dock-ui-dark/author-three-panels/author-navigation-bar，均在本线程evidence目录。未新增网络专项；Dext仍未启动；字体资源零失败与浅色/深色预览补证见browser-final及对应截图。

### Task3具体实现约束（2026-10-04）
Core个人formatVersion1增加可缺省为空的Room.readGrants集合，复用安装戳/能力数组，但只允许四个只读能力。只读权限优先当前戳readGrants；没有当前记录时兼容原grants当前戳中已明确授予的只读能力。设置时从当前有效只读集合派生，仅变更明确选择的能力；空数组也是当前安装明确撤销状态。原grants、目标、按钮、布局/KV全部原样保留，因此新安装允许time不会把旧binding/controls提升到新戳。
RPC仅由当前原生Coordinator准入，在个人快照锁内按既有非阻塞gateway模式复核当前会话/安装/声明。编辑不要求桌面前台或物理手势；作者数据读取继续原可用性/权限边界。读回仅当前声明的只读授权旗标；不返回私人目标、存储或其他权限。
必要功能路由新增--read-grants（不用每次跑全套输入/安全检查），覆盖允许后实际time provider、撤销、旧安装不继承、无关数据保持、配置器可编辑暂停时授权、发布失败保持旧文件及相同编辑不重复发布。

## Task3与Task4生产阶段证据（2026-10-04）
Core --read-grants仅跑6个必要本地功能检查；使用真实生产authority/store/gateway及时间provider，不追加完整网络/输入攻击矩阵。UI运输夹具核对显式允许/撤销、失败保持、旧安装清空/重读和暂停可编辑。两份proto、Rust named-pipe调用和React面板接实际Core；完整四阶段build.ps1、start.ps1通过。
实际Room 748940f7-db74-436f-ab08-27c050954200：Tauri创建/模板资源复制/字段差异/保存重开、Core应用与私人授权读回/撤销贯通；允许操作不改变作者清单字节或编辑器已保存状态。当前Core operable=false时，实际SDK三栏数据denied、读数隐藏而六区外框正常，几何accepted；不声称真实读数成功。普通Core重启授权/Room/Desk/安装戳保持，新session/Player、模板几何恢复。替换导航模板保留共有按钮/组件身份及旧资源，新安装四个读权限全false；明确允许time仍不允许hardware。
原localStorage精确恢复；JS window.close/minimize缺默认权限，采用核对owned PID/路径的正常OS关窗，不修改产品权限；随后Core app --shutdown true普通退出，watcher39064 exit0。原四文件字节/缺失恢复、自建Temp和同Room安装/前代/source记录删除，监听/进程0；最终只读恢复核对通过。实际默认导航、持续同实例切页/缩放和可用桌面真实数据仍属最终Task4，完整16项1/16≈6%，集中审查/人工步骤保持。
