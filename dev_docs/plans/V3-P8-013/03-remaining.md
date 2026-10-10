# 03 剩余操作清单

状态：开做。2026-10-11核查；对应ROADMAP唯一当前包V3-P8-013，步骤03尚未做完，工作包2/4=50%。证据索引见[04交接](04-handoff.md)。

## 接续顺序

1. **做完：实际固定菜单**。使用自有测试程序，右键打开官方菜单，固定后关闭菜单，重新打开取消固定；读实际投影确认，保留原固定项与作用域。不要用直接Edit RPC成功冒充菜单点击成功。
2. **开做：同栏作者导航与窄任务区**。使用融合样包，通过真实上一页/下一页进入窄区，任务可滚动且可点击；作者按钮和官方任务不双触发。当前有DOM/生产输入逻辑证据，完整实际操作尚缺。
3. **待做：按住期间状态变化**。已做关闭Dock取消；切Desk/目标窗口关闭的原生全链路仍需收口。物理触屏操作记入用户统一验收，不代填。
4. **待做：隐藏/全屏/退出统一交接**。复用已有生命周期证据，核对本次改动引入的具体风险；无需重复宽泛矩阵。全屏测试只用自有测试窗口，不干扰用户游戏。
5. **待做：步骤03最终核对**。正式消息、图标、输入、菜单、融合样包均具备证据后标做完，再由04记录最终diff与验收候选。不得以这个新清单覆盖或缩小独立验收卡四项要求。

## 已完成，不无故重测

- 做完：官方任务展示/图标和Core→Player→正式宿主接线。
- 做完：实际鼠标、Windows注入单指、键盘任务操作；分别保留其证据范围。
- 做完：多窗口菜单选择及关闭一窗后恢复另一窗。
- 做完：任务栏接管/实际工作区就绪后启用任务；手动恢复任务栏后继续正常操作。

统一人工要求仍为：同栏导航/应用；刷新和跨Desk取消；作者遮挡与鼠标/触摸/键盘；菜单/窄栏/隐藏全屏/退出恢复。原生缩略图与正式宿主选择/失败回退由014继续，桌面同步DESK-SYNC四包排队0/4。

## 2026-10-11 固定菜单阻断证据

独立 `fusion-pin-live` 场景使用单个自有程序，不再依赖多窗口前置流程。探针Release构建通过，实际Core49636/Player2352复现失败：受信任的右键pointerdown到达正确任务按钮且disabled=false；61ms后pointerup及contextmenu仍到达同一按钮，但disabled=true。等待结束按钮恢复enabled=true，menuPin仍为空。故当前证据定位为右键期间输入可用性撤销，不能归因于菜单文字定位或右键未送达；尚未确定Core就绪条件中哪一项撤销。

证据：`.build/fusion-pin-live.log`（包含完整PIN MENU OBSERVATION）、`.build/task-pin-probe-build.log`。候选main.js仅增加捕获监听诊断，无preventDefault或事件改写；不进入发行包。下一步区分任务栏租约、NativeDockAvailable、实际工作区匹配三项门控，禁止靠延时重试或强制enabled绕过。

多窗口旧通过记录仍有效，但本次此前运行又见剩余窗口最小化后按钮瞬间disabled；稳定性待收口，不能据旧PASS宣称此间歇问题不存在。试验结束已恢复原Core候选（PID28588，v3-core-exit-20261010）和原偏好，没有新增配置器。步骤03仍开做，整包2/4=50%。

## 2026-10-11 重复可见性通知修复与固定菜单通过

Core状态变化日志证明右键发生时lease/available/placement均保持true；同期页面发起invalidateGeometry，定位到main.js的dextNativeDockVisibility对相同visible通知也无条件suspend/refresh。重复通知在DOWN与contextmenu之间撤销任务可用性。现仅在实际paused变化时取消/刷新，作用域校验仍在去重之前，真正隐藏继续取消；不修改物理输入配对。

新增入口回归先失败（重复hidden使取消/刷新次数增加），修复后main与task-area-controller共18项通过。完整C# Release诊断构建通过；同一独立实机场景Core47612/Player22924，右键固定、再次右键取消固定、两次菜单收起与投影恢复全部通过，进程退出0。证据`.build/task-visibility-red.log`、`task-visibility-green.log`、`task-pin-readiness-build.log`、`fusion-pin-live.log`。原运行版/偏好/夹具已恢复。

第1项做完，下一实际操作第2项作者导航/窄任务区；不把本次菜单通过外推成多窗口间歇问题或物理触屏已统一验收。整包2/4=50%。

## 2026-10-11 同栏导航首轮实际证据

新增fusion-navigation-live：使用宿主readInputSample纯读取作者几何，真实鼠标点击下一页/上一页；验证Desk稳定、宽度缩小、内容溢出及前台未误切应用。探针构建通过。
首次下一页被MissingPermission拒绝，隔离夹具原未调用配置器正式enableNavigation；现通过EditRoomPersonal启用该临时Room导航，沿原finally清理，不修改用户Room授权。
第二次Core45792/Player37084实际下一页Accepted，只进入focus一次，任务区变窄并溢出、前台应用未变化，通过。实际上一页失败：04:15:36.865 DOWN、36.971 UP均到Core且sample=True，Player DOWN arm=True/ready，但没有返回native visible input sample，也没有activate结果。不是已证明的权限失败，不绕过或直接RPC切页。日志20261011_041518.txt、.build/fusion-navigation-live.log、task-navigation-probe-build.log。
第2项仍开做，下一步定位跨Desk后Player取样回报缺失；滚动与窄栏应用点击尚未执行。原Core与偏好/夹具已恢复，整包2/4=50%。

## 2026-10-11 跨Desk派发边界进一步定位

完整Release诊断构建通过（.build/task-navigation-dispatch-build.log），按流程start CoreOnly；同一导航场景Core40724/Player45408重现下一页通过、上一页失败。Player记录第二次DOWN arm=True、ready、forward-owned，随后completion-await-dispatch，约1.5秒超时并触发已有失败退出路径。证明转发目标仍属当前WebView，不是IsOwnedChild提前拒绝，也不是取样释放/回传后Core拒绝。日志20261011_041900.txt。

下一步只追踪作者帧派发回执生成与接收（guardian gate、frame identity及消息接收），不要扩大权限或将失败超时当成功；此前“取样缺失”的边界已收窄。诊断仅记录阶段/编号，无token、文件路径或作者数据；不更改点击和触摸语义。第2项仍开做，2/4=50%；原运行版与夹具恢复。
