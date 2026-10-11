# DESK-SYNC-004 构建与统一验收交接

状态：做完（代码实施、完整候选与交接；真实Windows交互待统一验收）

所有入口只对同步Desk生效；串行文件操作与退场取消，不因单个文件失败清空整个桌面。修改C#/proto后运行scripts/build.ps1再scripts/start.ps1；非验收时仅复用旧版CoreOnly，不多开配置器。完整候选在D盘新目录用build-v3-release.ps1生成、verify-v3-release-candidate.ps1核对。按独立验收卡验证真实关联打开/改名/剪贴板/回收恢复/右键/原输入；自动检查与用户验收分开。003尚缺门槛继续保留，未获通过不合master。

- [x] 失败用例与实现
- [x] 生产接线、针对性回归及完整候选核对
- [x] 记录证据并提交
- 实机菜单/文件交互/触控仍在独立验收卡待验收，不计为通过。

2026-10-11开工：第05步代码完成。先检查D盘依赖/构建缓存和17项宿主白名单，在全新desktop-shell-actions-clean-20261011候选目录执行build-v3-release.ps1，核对inventory与当前源；候选完整后再核对启动身份。现有Core26668保留，未部署的新输入与全部人工门槛明确交接；不在后台重复打开配置器。

2026-10-11 第06步完整候选已生成，交接仍开做：来源提交830e785，目录D:/use/Orca/DEXT/DEXT_Core/.build/desktop-shell-actions-clean-20261011。package.json与package-lock.json分别核对与desktop-drop-build-env/deps完全一致，当前node_modules以junction复用该D盘依赖；TEMP/TMP/npm缓存与Cargo目标在D盘，未重新下载整套依赖。build-v3-release.ps1退出0，包含配置器、Core、Release Player/Watchdog、17项官方宿主；保留Rust原两项警告。655个inventory文件哈希及17项宿主和当前源码匹配、无已知夹具标记（.build/shell-actions-candidate-verify.log）。完整日志desktop-shell-actions-build-env/release-build.log。
start.ps1 CoreOnly核对该完整候选的Dext v3产品元数据成功，随后因主目录Debug Core26668占用mutex/pipe退出1（.build/shell-actions-candidate-start.log及工具输出）；没有启动本轮候选，当前没有额外配置器。构建改写的Cargo.toml经HEAD文本逐字规范化比较确认仅换行差异后恢复，未改变依赖声明。
下一执行先复核菜单退出的焦点：DesktopContextMenuWindow目前在菜单owner仍前台时恢复弹出前窗口；从其他应用首次右击时，这可能使菜单取消后键盘仍交给原应用，需要按Windows桌面交互预期处理并验证。随后核对原生菜单实际窗口、取消/属性/DPI与触控，不用构建结果替代OS证明。第06步继续开做，代码实施仍5/6≈83%、路线2/4=50%；用户统一验收/合并均未完成。
人工步骤仍为本卡1至6项；额外检查从其他应用首次右击文件后Esc关闭菜单，再按文件操作键时的焦点归属，避免将按键交给原应用。仅用唯一临时文件，现运行版未含本候选，无需用户现在操作。

菜单焦点收口（开做）：原生返回桌面、同一文件焦点短时恢复、外点与新窗口不抢焦点；自动检查不替代实际菜单/触控验收。

2026-10-11 第06步菜单焦点代码收口：不再恢复弹出前的应用窗口；仅菜单owner仍为前台时交回当前有效的原生桌面root，Shell新窗口/外点应用已取得前台则不抢回。原Desk仍有效且确实交回桌面后，最多1.5秒等待同会话/Desk/视口的当前文件几何，恢复文件键盘焦点；不创建动作证明。新点击/按键、切页/锁定/转场/文档更换、文件消失、视口变化及超时均取消恢复。取消退场菜单也释放owner焦点，但不恢复已失效文件。
证据：缺失实现编译失败见menu-focus-red.log，夹具按键编码校正后最终7/7（menu-focus-final.log）；右键上下沿8/8（menu-focus-context.log）、原有指针/采样/键盘57/57（menu-focus-pointer.log）。完整Core/Player/Watchdog Release通过（desktop-shell-actions-build-env/menu-focus-build.log）。实际Windows弹窗/Esc/外点/属性/触控尚未验证，不能把类级回归当实机通过。当前83%，06继续开做，下一步将新源码打包到全新r2候选，旧830e785候选保留但不再代表最新实现。

2026-10-11 第06步F2键码纠错开做：diff检查发现原实现与测试把F2统一写成114，Windows VK_F2实际0x71=113，114是F3。修正钩子、公共输入判断、Core动作、宿主路由与夹具，并新增F3放行检查。r2候选b87e75f已构建且655/17校验通过，但包含此旧缺陷，不作为最终验收包；最终重建r3。来源：https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes 。

2026-10-11 F2纠错代码实施做完：整条链路改为Windows VK_F2=0x71（113），F3=0x72（114）不接管。先只修夹具，真实F2复现“did not create a file command gesture”（f2-keycode-red.log），再修改生产代码；最终F2六组合、个人编辑25/25、键盘所有权11/11（含F2成对接管/F3放行）、指针传递18/18、dom/native宿主113/113通过。#330间歇存储问题仍未消除。下一步r3完整构建/哈希核对。
r2核对655文件/17资源成功；校验器成功后外层读取遗留LASTEXITCODE导致提前退出，r2启动检查并未执行（没有candidate-r2-start.log），不得宣称已调用启动。以后PowerShell脚本以终止异常/成功输出判断，LASTEXITCODE仅紧跟原生命令。

2026-10-11 第06步做完（实施与交接，实机未验收）：最新生产提交0ed6d12，完整候选D:/use/Orca/DEXT/DEXT_Core/.build/desktop-shell-actions-clean-20261011-r3；build-v3-release.ps1完成Core/Release Player/Watchdog/配置器打包，保留两项既有Rust警告。verify-v3-release-candidate.ps1确认655个inventory文件及17项官方宿主与源码匹配，日志.build/candidate-r3-verify.log；完整构建日志desktop-shell-actions-build-env/release-r3-build.log。start.ps1对r3完成产品元数据检查后因Core26668占用DEXT身份退出1（.build/candidate-r3-start.log和工具异常输出）；候选未启动，未新增配置器。Cargo.toml规范化逐字确认仅换行变化后恢复。
当前分支feat/DESK-SYNC-004-shell-actions；代码6/6=100%，桌面同步路线实施3/4=75%，用户验收与master合并未完成。旧r1/r2保留追溯，不作为当前候选。下一项按ROADMAP回补003实机门槛：重新核对Explorer可操作窗口与运行环境，不能继续用旧1×1窗口或身份冲突代替新检查；如切换运行候选，先保存当前数据/布局并准备原版恢复，然后执行有范围的真实Explorer拖入与输入回归。
统一人工步骤（仅唯一临时文件）：1单/Ctrl/Shift选择与切页清除；2双击/Enter打开、真实F2改名与Esc取消、F3不误改名；3Explorer双向复制剪切粘贴只执行一次；4Delete进回收站并恢复、Shift+Delete不永久删除；5右键/菜单键、多选、属性、Esc与外点、首次从应用右击后文件焦点；6原Dock/作者按钮、鼠标/触控/DPI、切页/停用/退出后旧操作失效。当前运行版不含新代码，这些门槛均不标通过。
