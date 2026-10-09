# 02 悬停与选择接线
状态：做完
要做：延迟悬停、鼠标跨窗不误收起、多窗口分页、点击激活、Dock隐藏/关闭时清理。
完成条件：接入真实ApplicationDockWindow，点击仍复用Core验证；轻量编译通过。
接手：ApplicationDockWindow.cs；运行检查集中在03。

2026-10-09：实现已写入；tests/Dext.DockPreview.Tests链接实际WPF/Dock源文件，小范围Release编译及8项纯几何/分页检查通过。仅完成编码与轻量检查，DWM真实呈现/鼠标行为由第03步验证。