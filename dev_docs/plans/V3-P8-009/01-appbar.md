# 01 原生占位适配
状态：做完
ABM_NEW/QUERYPOS/SETPOS/REMOVE；回调/DPI/Explorer变化重新定位；实际主屏work-area达到批准区域才ready。几何与Windows调用分层，可注入适配覆盖拒绝/释放/重注册。


官方来源：Microsoft Learn ABM_SETPOS https://learn.microsoft.com/en-us/windows/win32/shell/abm-setpos 与 ABM_REMOVE https://learn.microsoft.com/en-us/windows/win32/shell/abm-remove；接口恒返回TRUE，实际工作区另核对。
