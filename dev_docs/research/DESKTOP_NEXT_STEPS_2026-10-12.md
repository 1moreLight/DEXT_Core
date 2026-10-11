# 桌面后续设计建议（2026-10-12）

状态：开做（建议文档）；下面功能均不计已交付。当前唯一下一项仍由ROADMAP指定，005待人工验收。

## 先收口正常操作

1. 背景菜单：已有文件Shell菜单、背景扩展和Dext粘贴；再考虑刷新与新建完成后的选中/F2。不要将Explorer的查看/排序直接转发给隐藏的原桌面，用户看见的是Dext布局。
2. 保持长按编辑、抖动、实时让位、双击空白退出；后续菜单功能不替换这一套输入控制器。
3. 背景菜单是否可粘贴可后续改成只查CF_HDROP可用性，避免为显示菜单提前解包剪贴板；真正粘贴时再读文件和效果。当前代码有界重试打开剪贴板，但延迟渲染源仍可能慢，这里仅列性能建议，未测成实际用户故障。

## 应用Dock：需要对齐的既有要求

- 总设计V3_PLAN第2节写“全局应用＋当前Desk应用”，方向为Desk项追加全局；并要求不能无说明沿用整组替换。
- 当前ApplicationDockService.EffectivePins实际返回deskPins ?? preferences.Pins；P8-010实现计划明确“首次增删复制有效列表、覆盖、恢复继承”。这是覆盖语义。
- 因此不能把原始“追加”要求记为完成。现有覆盖功能保留，下一包先用数据迁移例子说明两种模式，再决定正式呈现；不自动把用户本机列表当增量重写。
- 推荐兼容设计：无本机mode字段的旧记录保留override；显式选择additive后，以全局顺序为底，再追加本Desk的不同启动目标。相同目标的参数/工作目录不同应视为不同入口；去重沿现有应用身份模型实现，不能只比显示名称。
- 若采用additive，移除全局项与“仅在本Desk隐藏”必须分开：前者改全局，后者保存本Desk排除项。两者都需清楚标签，避免用户以为只改一页却删了全部页。
- 本条为待做建议，不改当前存储格式、不作为用户新确认。

## 查看/排序

- 排序是本机Dext布局命令，不写作品room.json，也不移动实际文件。
- 当前同时有Slots和个人Icons坐标；只改Slots可能被已保存坐标盖住。应一次事务计算/提交全组结果，并保留撤销前快照。
- 首包只做按名称的一次整理，保留小组件与作者占用区域。名称/类型/日期的持续自动排序后续单列，避免与长按自由重排互相打架。
- 文件名变更、监听新增、视口缩放不要自动触发整组重排，除非用户明确选择持续自动排序模式。

## 后续小包建议顺序（不是新的执行派发）

| 次序 | 建议结果 | 状态 | 最小人工检查 |
|---|---|---|---|
| A | 当前005空白菜单/粘贴 | 待验收 | 两项见005验收卡 |
| B | 对齐Dock全局＋Desk语义 | 待做 | 新页显示全局＋本页项，旧覆盖列表原样保留 |
| C | 一次按名称整理 | 待做 | 排序后重启保留，可撤回原布局 |
| D | 新建文件夹后的就地命名 | 待做 | 创建后直接命名，取消不丢已有文件 |

## 参考依据

- 当前生产实现：ApplicationDockService.EffectivePins、DesktopSyncCatalog.Publish、RoomActionAuthority.Layout、DesktopShellContextMenu。
- [IShellFolder::CreateViewObject](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-ishellfolder-createviewobject)：提供文件夹对象的可选接口；不保证Explorer全部UI行为自动复用到Dext。
- [IContextMenu实现说明](https://learn.microsoft.com/en-us/windows/win32/shell/how-to-implement-the-icontextmenu-interface)：命令ID范围/偏移及InvokeCommand职责；Dext自有项必须与Shell范围区分。
- DeskBox/BentoDesk/Racks已有固定源码调查见DESKTOP_DROP_REFERENCES_2026-10-11.md；GlassDesk公开材料仅发布记录，不能当源码实现证据。本次没有移植或运行第三方程序。
