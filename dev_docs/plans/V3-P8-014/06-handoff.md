# V3-P8-014 构建复核与统一验收交接

状态：做完（实施交接；待统一人工验收）

实现：必要单元/后台DOM、完整Release与限定实际生命周期冒烟；沿verify-v3-release-candidate检查全新候选来源，记录未验收项，具名提交。

- [x] 写清并核对涉及入口和调用者。
- [x] 为具体行为增加必要失败检查，然后实现。
- [x] 执行相关检查并记录命令/结果；不外推范围。
- [x] 更新本步骤状态、TODO并提交。

完成证据：配置器保持一份；单owner/工作区/退出恢复实测；物理点击与触屏统一人工验收，未通过不合master。

## 2026-10-11 交接
- 源码基线：14f40b1，分支feat/V3-P8-014-fusion-lifecycle，未合master。
- 全新正式候选：D:/use/Orca/DEXT/DEXT_Core/.build/v3-fusion-lifecycle-clean-20261011。
- build-v3-release.ps1完整Release退出0；verify-v3-release-candidate.ps1退出0，654项文件尺寸/SHA256、16项正式宿主资源与源码一致，无已知探针标记。日志.build/fusion-lifecycle-clean-release.log及fusion-lifecycle-clean-verify.log。
- 新候选未启动/应用。用户原版Core49448、配置器19704，均来自v3-core-exit-20261010；没有新增配置器。
- 聚焦diff复核：唯一owner交接、失败attempt锁存、停止不新建、保留主题独立偏好、预览点击前当前上下文复核、过期保持自动释放、手动恢复任务栏优先，未发现新的阻断问题。
- 已有实际证据：02 Core39792宿主往返/故障回退/显式重试；03 Core50820三模式工作区与显隐；04 Core45248原生预览/悬停保持/选第二窗口和关闭。各次隔离夹具与用户设置已恢复。各轮原旧版Core强制清理不计新功能退出验收通过。
- 本包实施6/6=100%，转待统一验收；下包DESK-SYNC-001，必须另worktree/分支。

## 人工验收仍缺
沿独立验收卡全部五项：配置器实际选择和状态；最大化/各模式全屏/锁屏及手动任务栏恢复；缺Dock/缺区域及最终版本Core退出；缩略图观感与关闭窗口/跨Desk/隐藏/全屏/退出清理；物理触屏/鼠标/私人配置重启保持。新候选编译和哈希通过不证明这些项目通过，未验收不得合master。

复核候选命令：`./scripts/verify-v3-release-candidate.ps1 -CandidateDirectory D:/use/Orca/DEXT/DEXT_Core/.build/v3-fusion-lifecycle-clean-20261011`。
