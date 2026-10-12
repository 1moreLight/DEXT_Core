# V3-CUSTOM-001：Room / Desk / Dock 自定义能力审计

日期：2026-10-12；基线master b883b16。状态：做完（源码审计3/3=100%），报告待用户确认。

## 结论

**已有可编程的自定义底座，但还不是各部分都能方便地高度自定义的完整产品。**

作者能用本地HTML/CSS/JS制作持续Room场景、Desk背景、Widget及主题Dock；运行端能按Desk继承配置。但无代码编辑器只覆盖其中一部分，系统任务区与普通图标的外观也仍有明显硬编码。不能把“契约有字段”“样包能运行”“用户随手能配置”算成同一种完成。

本轮为源码审计，没有重启Core、改变Room、改鼠标/触控或重新跑已通过的测试。下表“已接通”表示源码有入口和消费链；最新版本完整人工创作/分享链仍按原集中验收记录，不补填通过。审计完成度100%不等于产品自定义完成度100%，暂不编造产品总百分比。

## 能力矩阵

| 维度 | 现有能力 | 限制与判断 | 源码依据 |
|---|---|---|---|
| Room整体画面 | roomScene支持持续本地HTML及公开config，SDK提供场景几何、数据与存储；启动/待机支持四种媒体 | 作者可编程；v3编辑器没有roomScene导入/替换及通用config编辑入口，需手改作品 | [编辑器](../../tauri-ui/src/features/room-editor/V3RoomEditor.tsx)、[运行模型](../../wallpapers/dext-room-v3/runtime-model.js)、[SDK](../../creator-kit/v3/sdk/dext-sdk.v1.js) |
| Desk组织 | 新建/删除/改名/前后移动/起点/独立背景；稳定ID关联 | 基础无代码编辑已接；路线图当前是顺序卡片＋相邻箭头，不是自由连线编辑器 | [编辑器](../../tauri-ui/src/features/room-editor/V3RoomEditor.tsx)、[文档模型](../../tauri-ui/src/features/room-editor/v3-document.ts) |
| 切页效果 | slide/fade/none及0..10000ms；作者scene可自绘转场 | UI只有全Room默认；已有author模式下选择框禁用，没有切换为author的创作入口。不能称任意页面边都可视化配置 | [编辑器](../../tauri-ui/src/features/room-editor/V3RoomEditor.tsx)、[运行模型](../../wallpapers/dext-room-v3/runtime-model.js) |
| Widget | 契约可定义多组件，Desk按ID引用，公开config按字段继承；运行端创建对应HTML实例 | 当前v3主编辑器无通用“添加Widget/选择入口/管理Desk引用/编辑config”闭环；试验台仅调整已有组件默认矩形 | [试验台编辑](../../tauri-ui/src/features/room-editor/V3WorkbenchAuthoring.tsx)、[运行模型](../../wallpapers/dext-room-v3/runtime-model.js) |
| 主题Dock | 可选本地HTML，官方两模板可调高度/圆角/配色、数据源/路径/显示方式及按钮动作；有Desk差异与恢复继承 | 可编程性较强；无代码参数依赖模板描述，不能自动理解任意HTML结构；不是任意Dock导入后立即能配数据按钮 | [Dock编辑器](../../tauri-ui/src/features/room-editor/V3DockEditor.tsx)、[模板操作](../../tauri-ui/src/features/room-editor/dock-template.ts) |
| 模板扩展 | 自带three-panels/navigation-bar完整资源 | Rust目录固定为两个内嵌模板，无通用第三方模板包注册/导入入口；不应称开放模板库 | [模板目录](../../tauri-ui/src-tauri/src/room_v3_dock.rs) |
| 真正任务栏的应用区 | 官方任务区消费当前Dock有效config；矩形、图标24..64、间距0..24、圆角0..32、底色/强调色可声明 | 开放5个样式参数；横排、运行圆点、激活短条、字体、按钮圆角等在官方CSS固定；未找到配置器dextTaskArea编辑入口。作者不能自行替换官方任务项DOM | [任务区模型](../../wallpapers/dext-room-v3/task-area-model.js)、[控制器](../../wallpapers/dext-room-v3/task-area-controller.js)、[样式](../../wallpapers/dext-room-v3/task-area.css) |
| 应用Dock的Desk差异 | 全局固定项；本Desk独立列表；恢复继承 | **偏离总计划：实际是覆盖，不是全局＋本Desk追加。** 有Desk列表时EffectivePins返回deskPins，否则全局。不能用主题Dock的字段继承来掩盖应用列表语义差异 | [应用Dock服务](../../lively-core-separation/src/Lively/Lively/Services/ApplicationDock/ApplicationDockService.cs)、[总计划](../V3_PLAN.md) |
| 按钮/普通图标 | 可声明按钮并在多位置呈现；本机选择应用/动作/目标/皮肤；已有长按编辑与保存链 | 本机皮肤目录仅classic/glass/outline三种。任意作者自绘按钮与官方普通图标是两条呈现路线，前者自由不能证明后者可任意换皮肤 | [个人编辑UI](../../tauri-ui/src/features/room-editor/V3PersonalEditor.tsx)、[Core皮肤目录](../../lively-core-separation/src/Lively/Lively/Core/Dext/RoomActionAuthority.PersonalEditor.cs) |
| 保存/应用/分享 | 草稿序列化保存，Rust校验资源，正式安装后应用；分享打包作者清单及资源，个人数据独立 | 代码闭环存在；分享不携带私人应用目标是既定设计，不能误算丢配置；本轮未重新实测文件对话框/导入导出链 | [后端入口](../../tauri-ui/src-tauri/src/lib.rs)、[保存](../../tauri-ui/src-tauri/src/room_v3_authoring.rs)、[分享](../../tauri-ui/src-tauri/src/room_v3_sharing.rs) |
| 试验台 | 正式宿主预览、任意尺寸、阶段/数据模拟、按钮与占用诊断、已有组件位置尺寸 | ResourceSourceViewer只读，不能直接写HTML/CSS/JS；模拟JSON不保存到Room，不是作者配置表单 | [试验台](../../tauri-ui/src/features/room-editor/V3Workbench.tsx)、[源码查看器](../../tauri-ui/src/features/room-editor/V3WorkbenchAuthoring.tsx) |

## 最值得先补的三项

### 1. 自定义HTML导入后的声明与配置闭环（优先）

证据：V3RoomEditor.pick导入Dock时直接创建`capabilities:[]`，没有buttonIds/config描述；room_v3_authoring.import_content只返回type/src/resources。V3ReadGrantPanel仅显示已经声明的受支持能力，无法替作者补声明。因此“导入HTML后没有可授权项目”可能就是缺声明，不是授权按钮故障。

建议先做一个独立小包：导入Dock入口时可选择/编辑其公开声明（能力、按钮、config），保存/重开/应用后仍完整；授权仍由用户在应用后单独授予。不要默认给所有HTML全部能力，不要只复制配套JS就声称完成接入。后续将同一入口复用给Room场景与Widget，再补通用组件管理。

最小验收：导入一个含时钟和上一页按钮的本地Dock，配置time.read及按钮声明；保存重开仍在，应用后可授权读数并能切页。

### 2. 融合任务区的外观编辑

先为已经实现的任务区矩形、5个样式参数提供UI和Desk差异/恢复继承，确保编辑后真正在系统Dock生效。进一步开放字体、活动指示器与排列方式另拆包，保留现有输入与窗口管理。任意HTML主题不等于官方任务项已可任意自绘。

最小验收：只在一页改变任务区底色和图标尺寸，另页保持共享值；保存重启仍一致，恢复继承可撤销差异。

### 3. 全局应用＋Desk追加语义

当前整组覆盖真实存在，不能直接把旧列表重新解释为追加。建议旧数据保留override，新显式模式支持全局顺序＋Desk不同目标；移除全局项与本页隐藏分开。具体迁移方案沿[夜间建议](DESKTOP_NEXT_STEPS_2026-10-12.md)，实施时单列兼容验收。

最小验收：全局A、Desk专属B显示A+B；旧覆盖记录仍保持原样；切页与重启一致。

## 属于既定平台边界的限制

本地打包资源、受控API、1920×1080设计画布和主屏单一原生Dock是当前产品约束；高度自定义不必意味着任意系统调用或任意多个顶层窗口。重点是把已允许的画面、配置、按钮、数据与布局真正开放给创作者。多屏、在线网站、游戏覆盖不作为本次补齐的前置条件。

## 执行与验收

1. 做完：契约及编辑入口核对。
2. 做完：运行消费、保存/安装/分享路径核对；区分主题Dock和应用任务区。
3. 做完：形成矩阵和优先级，记录下一小包建议。

用户只需阅读结论及前三项缺口，确认方向；不要求重测桌面。报告确认前不把建议当已实现功能。本轮无生产修改，原已验收运行版本保持。
