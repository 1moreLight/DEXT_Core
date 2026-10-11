# 02 主题 Dock 官方应用区设计
状态：做完（2026-10-10）。以下新增名称均为计划接口，尚未接入产品。

## 结果与方案选择
同一个主题Player主Dock HWND同时呈现作者导航/外观和官方应用任务区；固定应用、运行点、启动、激活/最小化、窗口选择、固定菜单均在官方区域完成。预览允许附属窗口，不能再出现第二条主Dock或第二份AppBar。

选用：现有WebView2主题宿主中的官方DOM任务区，复用Core应用枚举/动作。WPF作为无主题/故障回退及验收前默认呈现。
未选：让作者HTML直接调用应用枚举（会混入私人状态且破坏官方动作边界）；把两条独立Dock并排（不满足同宿主）；立即删除WPF（丢失已确认点击基线）。

## 1. Core任务模型和投影
先拆独立纯模型 DockTaskProjection，不依赖Dispatcher、窗口或WebView；暂不改变现有WPF服务。之后ApplicationDockService仍负责唯一枚举/私人数据，向两种呈现提供同一份不可变组快照。

私有官方协议 proposed protocolVersion=1：
- Core内部上下文（这些字段不进入网页；网页只收contextId）：hostEpoch（新宿主/文档实例随机ID）、sessionId、roomId、committedDeskId、pinScope；全局无Room由WPF继续呈现。
- 每次投影带单调sequence；items包含opaque itemId、name、pinned、windowCount、active；可选窗口列表为opaque windowId、title。图标后续按itemId取有界PNG缓存，不能以本机路径/文件URL做src。
- **不得序列化DockGroup/DockTask本体或复用Status返回值**：Key、Target、Arguments、WorkingDirectory、Handle、ProcessId、PinScope原文只留Core。网页上下文只传独立不透明contextId。
- 同一上下文、同一组仍存在时itemId稳定。删除组后立即撤销其映射；再次出现发新ID。宿主/已提交Desk/固定作用域或固定配置修订改变整体换contextId，所有旧窗口选择/菜单请求作废。
- windowId绑定当前组内完整身份（句柄、进程及目标），新枚举丢失就撤销；最后仍由DockWindows.Perform重查实际窗口。仅轮询sequence增加不撤销正常按下动作；不能要求click必须等于最新sequence，否则500ms刷新会再次使点击不灵敏。
- 映射只保存当前组和窗口，不积累历史。Update复制输入集合，调用者后续改数组不得改已发布快照。

## 2. 官方动作与输入
proposed action包含contextId/itemId及可选windowId，动作只允许activate、chooseWindow、togglePin；导航仍调用现有官方NavigateApplicationDock。网页不能提交启动路径或任意命令。
Player核验固定官方文档、当前generation/session、实际Dock可见/未锁屏及本次物理输入完成；关联沿既有原生输入事实，作者不能提供或复用。isTrusted只是顶层DOM过滤之一，不能单独当Core动作凭证。
按下时冻结itemId/contextId/操作；抬起同元素且仍有效才执行一次。枚举更新只更新状态点/文字，按下/菜单/预览期间不移除命中节点；待释放后应用最后一份结构快照。组确实消失、上下文改变、隐藏或失焦取消，不把旧点击重指向新项目。
官方任务矩形需从作者visiblePolygons与原生作者命中一起扣除；同一物理边沿只归属一个入口。普通鼠标直接顶层输入，不新增桌面全局hook。触摸/键盘走同等当前上下文检查，实机验证后才替换默认呈现。

## 3. 布局与作者约定
只在已验证且当前Desk引用的dockComponentId组件config中识别可选dextTaskArea对象，version=1：
- rect：x/y/width/height，单位为该Dock组件原始placement的逻辑像素，有限值、正尺寸且完全位于组件内部；宿主沿当前recordPlacement变换至官方画布。
- style：iconSizeDip 24..64、gapDip 0..24、radiusDip 0..32、surface/accent为#RRGGBB或#RRGGBBAA。拒绝CSS文本、URL与任意选择器。
- 只提供区域与样式，不提供应用清单、目标、窗口句柄、授权或启用开关。componentOverrides可按现有公开config覆盖同一约定。

缺少/无效约定的旧API1作品保持原呈现，配置器显示“此主题尚未提供应用区域”；显式选择融合但无区域时退回WPF并说明原因。未知version不猜测。API1清单/schema/SDK保持现有语义，新增的是宿主公开config约定；六套冻结样包字节不变，单独添加融合演示样包。旧版本可忽略此config，不能宣称旧宿主也支持融合。

区域为官方顶层的裁剪容器，盖在作者iframe之上并参与命中遮挡；作者用自己的背景/留白配合。横向溢出必须滚动，不能缩小到难点击；区域太小无法容纳一个图标及操作控件时拒绝融合并回退，不能显示空栏却接管任务栏。缩放/动画时可见矩形和命中矩形同步，不重载作者iframe。

## 4. 宿主选择、偏好和恢复
本机新增呈现选择native/theme（默认native），属于应用Dock偏好而非Room。应用功能Enabled与宿主选择分开；DockHostOwnership仍只有一个确认owner，融合使用Theme owner，Core枚举继续运行但WPF窗口不Show。
明确模式优先级：选择融合时，应用Dock的AutoHide/ReserveSpace决定该唯一主栏模式；主题HeightDip决定高度；原主题独立模式设置保留，禁用应用功能后恢复原主题设置。当前主题Player只接受autohide/reserve。P8-014须新增本机overlay常显模式：两应用标志均false时使用overlay，不注册AppBar、不做离开自动隐藏，保留全屏/锁屏隐藏；两侧偏好/启动参数/消息验证一起支持，不能把默认常显变成autohide。手动“恢复任务栏”仍优先，不因主题切换覆盖用户手动模式。
切换：冻结动作→隐藏旧菜单/预览→释放任务栏租约及AppBar→确认旧窗口退出/隐藏达到既有所有权约定→新宿主初始化→确认官方区域、输入及占位就绪→取得任务栏替代。保存偏好不算就绪。
主题退出/缺失区域/无Room/加载失败：先完成Theme释放，再由WPF接管；保留期望theme，显示实际native与原因，避免重试循环反复抢占。新Room或用户重试才再尝试theme。Core整体退出禁止回退新宿主。不会同时启动两个主栏。

## 5. 预览与菜单
复用现有窗口选择语义；第一版用官方DOM窗口标题列表即可验证动作，但**不能算多窗口缩略图功能完成**。随后将当前原生预览呈现拆成附属服务，锚点由Player原生客户区/DPI换算，Core持有实际窗口对象。预览所有者是当前主题Player主窗口；跨宿主/全屏/锁屏/退出一起释放，菜单固定作用域冻结contextId。作者iframe不收到标题、图标或预览数据。

## 6. 完成标准
一条主栏、一份AppBar、同样顺畅的物理点击；固定/运行/导航/预览共存；全屏/触边/退出与开发恢复可用；每Desk固定列表、另存/分享边界保持。纯模型或DOM检查不替代物理输入。用户已授权持续开发，默认切换门槛留统一验收，不阻断后台推进。



投影生命周期补充：提供Clear()供停止/文档失效立即撤销当前映射；重新挂接相同contextKey也不能复活旧ID。纯模型由Core串行调用，后续适配统一Dispatcher，不在模型内执行OS动作。每次TryResolve仅回答当前映射有效性，实际派发仍须核验物理完成、可见性和所有权。

