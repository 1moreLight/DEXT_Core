# V3-P8-003 / 03 配置器与 RPC
状态：做完
目标：通过正式配置器启用/关闭、固定/取消固定本机应用。
## 计划
- Core RPC 返回真实状态，只在保存成功后确认变更。
- 配置器支持已安装应用列表及本机程序选择。
- 防止旧状态请求覆盖较新的保存结果。
- 复用现有 DeskBox 来源的 AppCatalogService，保留出处说明。
## 修改与验证
两份 wallpaper.proto、WinDesktopCoreServer、Tauri grpc/lib、ApplicationDockSettings。
第一轮完整 Tauri Release 构建通过；状态请求顺序修正后待最终重构建。
剩余：候选版配置器端到端检查。
## 人工验收
独立验收卡第 1、3 步。

2026-10-09 更新：实现及定向验证完成。最终 Release 构建通过；候选 Core RPC 固定/启用/取消固定通过，正常退出重启后 enabled=True 恢复。上述鼠标/配置器端到端人工项统一由第04步收口，尚未宣称通过。