# DESK-SYNC-004 回收站删除

状态：待做

DesktopShellActions.DeleteToRecycleBinAsync(paths,owner,cancellation)使用IFileOperation回收标志并检查支持回收语义，不能回收的目标提示/拒绝，不降级永久删除。Delete仅针对当前选中项；Shift+Delete不提供永久删除入口。逐项取消/失败保持源与选择信息，成功由目录监听移除图标。定向临时文件验证回收站项目可恢复；禁止清空用户回收站。

- [ ] 失败用例与实现
- [ ] 实际接线及必要检查
- [ ] 记录证据并提交
