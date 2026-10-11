# 03 实施拆分与检查
状态：做完（2026-10-10）。用户授权连续执行，自测提交后接下一包，人工统一验收；不合并master。

| 顺序 | 工作包 | 交付结果 | 检查 |
|---|---|---|---|
| 唯一下一项 | V3-P8-012 官方任务投影 | 无私人目标的稳定项目/窗口ID，当前上下文解析动作 | 下述计划；尚不接管窗口 |
| 后续 | V3-P8-013 官方HTML任务区与演示 | 私有Player传输、官方DOM区、声明布局、稳定按下、演示样包 | 依赖012；真实Player物理输入，保留WPF默认 |
| 后续 | V3-P8-014 融合宿主生命周期 | 呈现选择、单owner、模式优先级、失败回退、原生预览、配置器状态 | 依赖013；真实退出/恢复及统一验收 |

012通过不表示融合Dock交付；013/014仍必做。

## P8-012 实施计划
执行：executing-plans，独立feat/V3-P8-012-task-projection分支；基线本设计提交。
Spec：02-design.md；C#/.NET9，现有应用Dock控制台测试，不装新依赖。

### 01 投影和稳定身份
创建 lively-core-separation/src/Lively/Lively/Services/ApplicationDock/DockTaskProjection.cs；修改 tests/Dext.ApplicationDock.Tests/Dext.ApplicationDock.Tests.csproj 链接生产文件；创建同测试目录 TaskProjectionChecks.cs，Program调用。
接口：DockTaskProjection.Update(string contextKey, IReadOnlyList<DockGroup> groups, long foreground) -> DockTaskViewSnapshot。
snapshot有ContextId、Sequence、Items；item有Id、Name、Pinned、Active、Windows；window有Id、Title、Active。集合只读，不含Key、Pin、PinScope、Handle、PID、Target。
contextKey由Core调用者构造：宿主epoch/已提交Room+Desk/固定作用域/固定配置修订。普通轮询、标题和前台变化不重置；固定参数变化即使path未变也更换context。
- [ ] 写检查：JSON无路径/句柄/PID/参数；同context重排/标题更新ID稳定；删除再加ID不同；换context全部换ID；输入集合后来改动不能改发布快照；重复组/窗口拒绝且不部分发布。
- [ ] dotnet run --project tests/Dext.ApplicationDock.Tests -c Release：先观察新增检查行为失败；缺类型编译失败不作为行为RED。
- [ ] 实现当前映射、不可变复制、预验证后整体发布；ID用随机GUID N格式；sequence仅成功Update增加。
- [ ] 同命令PASS，原应用33项仍通过。

### 02 当前项目解析与撤销
接口：TryResolve(string contextId,string itemId,string? windowId,out DockGroup? group,out DockTask? window) -> bool；返回当前内部模型，不执行OS动作。无windowId解析组，有windowId必须仍在此组。
- [ ] 先写并跑失败检查：旧context、移除组、移除窗口、窗口跨组、空/未知ID拒绝；标题改变仍成功；配置修订变更拒绝旧菜单；普通刷新仍解析原ID至最新窗口集合。
- [ ] 实现并跑PASS，映射只保存当前集合；Windows.Perform仍做最终OS校验，opaque ID不等于输入证明。

### 03 交接与审查
记录检查输出、一次独立diff；具名提交；更新TODO/ROADMAP/验收。没有启动挂接，不重启候选或打开配置器。下一项013接续。

## 重点风险
1. sequence不得成为点击的强制最新条件，否则500ms刷新重现不灵敏。
2. 固定参数变更必须改变context；后续接线不能只用Desk。
3. 013必须几何扣除与原生互斥路由，同一物理边沿一次动作。
4. 014先确认释放再回退，手动恢复任务栏最高优先。
5. 投影展示字段只给官方页，作者/分享无私人列表。

## 最终统一人工操作
融合栏启动/切前台/再最小化；连续首尾切Desk；按下期间增减窗口；预览选择；每Desk固定/继承与重启；自动隐藏/常驻/全屏返回；恢复任务栏；主题失败回退；分享无固定路径。拖动暂缓。

补充：P8-014必须补主题overlay常显模式，目前Form1.NativeDock只接受autohide/reserve；两应用标志false时不能偷转自动隐藏。该项纳入模式与真实全屏返回检查。

P8-012生命周期接口：增加Clear()立即清空映射/撤销当前context（停止/文档断开无需等待下一Update）；再次Update即使传入相同contextKey也分配新contextId，sequence继续递增。检查Clear后的全部旧ID拒绝，以及重启同key不复活旧ID。模型由Core串行调用，后续接线统一Dispatcher，不在模型内调用外部回调或OS。
