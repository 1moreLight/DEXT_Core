# V3-P6-003 统一按钮与个人呈现编辑设计
日期2026-10-04；基线6c32e66，独立feat/V3-P6-003-personal-editor / v3-personal-editor。沿用户连续开发授权，不中途合并/验收；整体16项目前1/16≈6%。

## 一句话目标
在原生Room编辑器发现全部稳定按钮，为背景/Dock/普通图标配置本机动作、目标与图标皮肤，普通图标呈现可增删而不误删应用目标。

## 范围和归属
- 作者清单已有按钮/作用域、默认动作与普通图标；名称/排序/历史不更换身份。按钮列表按Room/Desk搜索，未绑定和当前未呈现的按钮也能发现。
- Core个人Targets为全局UUID目标（application/file/url）；Buttons为Room副本/buttonId覆盖。选择已有应用或手工路径/网址只进入Core；不把TargetId/路径/参数/皮肤写进作者Room。
- 动作覆盖继承作者/显式通用动作；绑定目标时显式binding.launch。保存当前选择仅为拥有该按钮且声明所需能力的消费者增加该项许可，从当前有效grants派生，不提升旧安装其他权限；readGrants/私人KV/布局保持。
- 皮肤沿既有Buttons.Skin，作用于同按钮的官方普通图标呈现；首组稳定皮肤classic/glass/outline，默认null继承官方默认。作者HTML自身外观仍由作品控制；可同时添加官方普通图标引用同按钮。皮肤框不改变按钮身份或逻辑尺寸。
- 新普通图标写作者公开icons，引用现有buttonId/新iconId；删呈现只删这个icon，不删按钮/全局目标/其他引用。私人绑定仍在Core。Desk作用域按钮不能放另一Desk。
- Core当前安装Coordinator可编辑；不以桌面前台/物理手势限制配置器保存。实际动作继续真实输入/当前授权规则。版本变化清旧状态，失败保旧文件和确认值。
- 定位只给当前正式宿主短时视觉提示，核对当前安装/按钮/可见范围；不产生动作或输入证明，不增加作者SDK通道。

范围外：AppBar/顶层Dock、游戏宿主、分享包、试验台全页、拖动（后置）、新增网络/攻击矩阵。完整V3计划范围保留，物理Core OS/DPI等与一次最终审查集中。

## 接口
Core GetRoomPersonalEditor(roomId,installationStamp)与EditRoomPersonal(roomId,installationStamp,editJson)；只由当前本机Coordinator进入原子个人存储边界。
编辑操作setButton/resetButton/upsertTarget/removeTarget/locateButton，闭合JSON；upsertTarget由配置器先生成并保留UUID，传输失败重试用同ID。get返回status/roomId/installationStamp及个人revision、当前所有声明按钮（作者默认/个人覆盖/有效动作）、全局目标/引用次数和支持的皮肤。
两份proto用请求/响应携带上述本机JSON；Tauri get_v3_personal_editor/edit_v3_personal验证当前Core身份。作者SDK/ReadButtons公开投影仍不含目标路径。
当前全局目标删除需产品确认，移除目标并清全部个人TargetId引用，保留按钮动作/皮肤；不删程序/文件。resetButton只删除当前按钮覆盖，保留全局目标。
官方普通图标从Core专用投影获得支持皮肤；不让作者消费者得到个人选择。UI定位走独立私有宿主视觉通道，具体线型按生产接线落定。

## 交付拆分
Task1 Core当前私人编辑服务、限定功能RED/GREEN、proto/Tauri接线及构建。
Task2 统一按钮搜索/作用域、动作/应用与自定义目标/重置、普通图标引用模型与编辑UI。
Task3 正式Player普通图标皮肤、当前位置定位与无重建更新；必要渲染功能检查。
Task4 真实Tauri/Core/Player闭环、普通重启/身份保持、原状态精确恢复/正常退出，最终集中人工与单次审查。

定位落定：Core保存3秒单调时钟内存请求，不递增个人revision；官方投影仅请求ID/按钮ID。DOM绘制当前可见多边形2.5秒清除；非当前Desk/切换中返回notOperable。视觉读取与动作准入分开，配置器前台仍可提示，真实动作规则保持。
