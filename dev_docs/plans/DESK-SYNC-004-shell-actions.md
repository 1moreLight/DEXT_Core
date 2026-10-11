# DESK-SYNC-004 Windows桌面常用文件交互

状态：开做，实施1/6≈17%；桌面同步路线2/4=50%。
基线96c9ef7；分支feat/DESK-SYNC-004-shell-actions；托管worktree desktop-shell-actions。源码约109MiB，依赖/构建输出继续放D盘。
执行：按executing-plans在当前会话顺序实施，不启用代理；用户已要求无需审核、统一验收，按此覆盖技能中的逐段确认。每步独立文件、待做/开做/做完；提交不等于人工验收或合并。

## 目标与设计

让同步Desk上的真实文件按Windows习惯选中、双击打开、F2改名、复制/剪切/粘贴、Delete回收和原生右键操作。文件仍归Windows桌面目录，Dext只保存个人布局；作者按钮与Dock继续原单击语义，不扩大点击透明层。
采用现有官方图标层+原生输入证据+Core解析文件ID+Windows Shell操作。选择状态仅属当前Desk/会话；稳定文件ID在监听刷新后保留选择，删除项被剔除，换Desk/Room/失焦取消待双击和键盘操作资格。鼠标单击选择、双击打开；触控沿用已确认输入链并单独验证，不用鼠标DOM事件替换原生采样。
不嵌入Explorer完整视图（与WorkerW层级冲突）；不以纯DOM点击调用本机文件操作（现有输入证明会被绕开）。保留原生读数/输入链，只给official.desktop增加语义。
范围外：永久删除入口、Shell虚拟文件、内部自由排序、完整Explorer替代、Dock文件拖入。

## 六步

| 步骤 | 状态 | 文件 |
|---|---|---|
| 01 选择状态与焦点 | 做完（实施） | [01](DESK-SYNC-004/01-selection.md) |
| 02 双击/键盘打开与F2改名 | 开做 | [02](DESK-SYNC-004/02-open-rename.md) |
| 03 系统剪贴板复制剪切粘贴 | 待做 | [03](DESK-SYNC-004/03-clipboard.md) |
| 04 删除到回收站 | 待做 | [04](DESK-SYNC-004/04-recycle.md) |
| 05 原生右键与属性 | 待做 | [05](DESK-SYNC-004/05-context-menu.md) |
| 06 完整接线/候选/交接 | 待做 | [06](DESK-SYNC-004/06-handoff.md) |

003保留全部未通过的Explorer/OLE/触控门槛：窗口接口仍只有Explorer14388/657916的1×1空窗口；已有正式候选及真实Shell跨卷证据，不能标做完。本轮先推进独立后续功能，下一项回补003实际OS验证，不能通过跳包宣称完整桌面已交付。