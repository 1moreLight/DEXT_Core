# DESK-SYNC-003 独立验收

状态：开做，实施0/5=0%。
目标：Explorer拖入启用同步Desk，真实落到Windows用户桌面并显示。
范围外：虚拟文件、Dock拖入、内部自由排序、右键菜单。

1. 单个/多个文件与文件夹拖入同步Desk，实际目标存在且显示在落点附近。
2. 同卷/跨卷默认效果及Ctrl复制、Shift移动、快捷方式修饰键符合Windows语义。
3. Esc取消、重名选择及部分失败保留未成功源文件，结果可确认；拖回同目录不复制自己。
4. 拖到其他窗口或未启用Desk不会误写桌面；切Room、退出、停用后旧接收器不接收。
5. 原Dock/桌面鼠标、触控、键盘和切页保持可用。

用唯一临时目录/文件验证。切运行版前磁盘备份恢复状态；测试结果与人工确认分开记录，不自动合并master。
2026-10-11 正式候选打包恢复：锁定package.json/package-lock.json复制至D盘独立构建环境，npm ci退出0；当前worktree node_modules链接到该依赖，未运行的Core bin搬到D盘并保留目录链接。TEMP/TMP/npm缓存及Rust目标均位于D盘；构建后C盘剩余391573504字节。完整build-v3-release.ps1退出0，候选 D:/use/Orca/DEXT/DEXT_Core/.build/desktop-drop-clean-20261011；来源c73d153（生产代码42d7add），654文件哈希核对、16项官方宿主与源码一致、已知夹具标记检查通过。保留Rust既有两项警告。日志D:/use/Orca/DEXT/DEXT_Core/.build/desktop-drop-build-env/release-build.log。
候选未启动；旧Core52420/配置器19704路径仍为v3-core-exit-20261010。构建造成的Cargo.toml纯换行变化经HEAD内容比较后恢复；工作区无代码变更。真实Explorer/WorkerW拖入、OLE源效果、重名/取消UI、落点及原触控仍待，05状态继续开做，实施0/5（完整门槛），路线2/4=50%。下一步补实际OS拖入证据，不重复打包或切换Core来代替鼠标验收。