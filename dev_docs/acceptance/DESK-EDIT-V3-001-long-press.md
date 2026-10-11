# DESK-EDIT-V3-001 验收
状态：开做；人工未执行。
目标：恢复Room图标/小组件长按编辑并保存位置。
范围外：同步Windows文件排序、缩放、Dock编辑。
自动：长按门槛、短按、提前移动取消、取消回滚、保存冲突、切页和暂停失效；构建。
人工仅三组：
1. 短按原Room应用/切页正常；长按Room图标约半秒出现编辑框，移动松手不启动应用，切回来位置保留。
2. 长按小组件拖动后松手位置保留；按Esc或切页取消正在拖动，原位置不丢。
3. 触控重复前两项，确认Dock及Windows文件原有点击正常。

## 候选与证据
实施做完，待人工验收；分支feat/DESK-EDIT-V3-001-long-press。
候选：D:/use/Orca/DEXT/DEXT_Core/.build/longpress-edit-20261011。
完整构建退出0；发布前656/18校验通过；160项定向自动检查通过。
运行：Core32892、Player19232、配置器16076；恢复原v3 Basic/home。
自动检查不等于真实鼠标/触控通过，三组人工仍待做；不合主线。

2026-10-11 黑屏修复候选r2已启动：.build/longpress-edit-20261011-r2，Core27224 / Player19180 / 配置器5504，原v3 Basic/home恢复。真实资源服务器测试先复现press-edit.js 403，修复后16项HTML依赖成功加载；完整构建成功，发布656/18来源校验通过。新运行日志确认geometry Accepted（version2）和持续presentationRead，宿主初始化恢复；实际画面仍待用户确认。修复步骤3/3=100%，整包人工验收仍未通过，旧r1黑屏包不再用。
本次人工只需确认：当前Room画面及同步的本地桌面图标是否恢复。恢复后再执行原长按三组，不重复所有测试。

2026-10-11 用户确认画面恢复，但长按编辑/拖入未通过。只读核对：当前Room v3 Basic，Desk=focus，revision11；该Desk无icons/components，Windows同步设置为enabled=true/deskId=home。长按代码明确排除同步Windows文件（record.desktop），所以不能把“有Room编辑接口”称为所有桌面图标可编辑。拖入当前focus被同步Desk限制拒绝，尚无desktopDrop请求日志；不能据此断言home页拖入已正常。已询问用户实际长按对象和文件来源，待其说明后继续同分支修复，不合主线。当前只确认黑屏修复通过，其余人工项未通过。
