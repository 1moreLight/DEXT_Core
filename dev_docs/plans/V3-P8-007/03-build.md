# 03 构建验证
状态：做完
定向 Core/WPF 测试及原首尾动画检查；Release build 后 start，核对身份。自动验证不冒称物理点击通过。


检查记录：Core 10/10、WPF 18/18、首尾方向 1/1。独立审查 #276 溢出问题已 RED→GREEN；补鼠标按下后换会话不能误切页。完整初版 Release 成功，修正 Core 正在重建。

修正 Core Release/start 通过，Core PID35724、配置器18192，候选 .build/v3-dock-navigation-20261010。真实临时 Room 导航会话/名称/三 Desk/生命周期一致；当前 starting+paused 时禁用正确；关闭后清空导航、原空壁纸/checkpoint/个人数据已恢复。后台操作模型已通过，物理点击保留人工。
