# DESK-SYNC-004 双击打开与F2改名

状态：待做

RoomNativeInputAuthority/Player保留原按下抬起证明，对official.desktop接系统双击时间/矩形及输入类型；相同文件、同scope、相邻有效输入才打开，作者按钮立即单击。Enter打开选中文件；F2仅单选显示改名输入，Esc取消。新增Services/DesktopSync/DesktopShellActions.cs提供RenameAsync(source,newName,owner,cancellation)并复用IFileOperation STA及逐项实际完成回执。Core只接受当前扫描ID，重新解析路径；名字不能含路径分隔符，冲突交由Shell，不覆盖性重试。检查快速同项/不同项、失焦、扩展名、中文、重名取消与真实临时文件改名。

- [ ] 失败用例与实现
- [ ] 实际接线及必要检查
- [ ] 记录证据并提交
