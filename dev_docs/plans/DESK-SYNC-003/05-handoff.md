# DESK-SYNC-003 实机与候选交接

状态：开做

真实Explorer/Player拖放验证、原点击/触控验收保留；构建正式候选并核对来源、清临时内容、恢复原运行状态；交接未覆盖环境条件，不把合成事件当物理验收。

- [ ] 实现或验证
- [ ] 必要检查及证据
- [ ] 记录并提交

2026-10-11实机准备与恢复验证：RuntimeProbe新增desktop-drop-live，使用StorageGrantLiveProbe磁盘checkpoint备份/恢复，临时源与真实桌面唯一目标、8分钟上限、cancel信号、ready/result/cleaned记录。只清理本次唯一文件和空源目录，源内容/实际目的内容/私有槽位检查已写。
第一次候选缺宿主资源，应用前失败，按#321补齐16项官方资产与显式content后重试。第二次Core47700/Player33976实际Room及桌面同步ready，恢复备份runtime-recovery-d1874d4376f64f73b2b17ccc664b6534。
Orca UI接口仅列出Explorer14388的1×1窗口，新启动Explorer50264没有可枚举窗口，因此未执行鼠标拖动；主动写cancel退出，不计实际拖入通过。cleaned/restored标记存在；旧Core52420已恢复，session-status为空，checkpoint备份与当前哈希一致，配置器仍只有19704。日志 .build/desktop-drop-live-retry.log。该轮证明准备/取消恢复有效，不证明Explorer/OLE、文件传输、落点或触控。
待继续：解决当前桌面会话的Explorer窗口可见性后复用夹具实际拖入；或采用可观测的独立OLE源先补源效果证据。不能仅因看不到窗口反复切换Core。

2026-10-11 完整候选打包受阻：npm ci --prefer-offline --no-audit --no-fund 报 ENOSPC，C盘剩余0字节；已核对绝对路径并仅删除本轮新建且安装失败的 tauri-ui/node_modules，释放146161664字节。正式 desktop-drop-clean-20261011 尚未创建，未启动/替换Core或配置器。恢复条件：将依赖和临时构建目录安排到D盘（当时可用246813810688字节），或释放足够C盘空间后重跑完整打包及来源检查。真实Explorer拖入门槛仍待；实施0/5，桌面同步路线2/4=50%。日志 .build/drop-npm-ci.log。

2026-10-11 正式候选打包恢复：锁定package.json/package-lock.json复制至D盘独立构建环境，npm ci退出0；当前worktree node_modules链接到该依赖，未运行的Core bin搬到D盘并保留目录链接。TEMP/TMP/npm缓存及Rust目标均位于D盘；构建后C盘剩余391573504字节。完整build-v3-release.ps1退出0，候选 D:/use/Orca/DEXT/DEXT_Core/.build/desktop-drop-clean-20261011；来源c73d153（生产代码42d7add），654文件哈希核对、16项官方宿主与源码一致、已知夹具标记检查通过。保留Rust既有两项警告。日志D:/use/Orca/DEXT/DEXT_Core/.build/desktop-drop-build-env/release-build.log。
候选未启动；旧Core52420/配置器19704路径仍为v3-core-exit-20261010。构建造成的Cargo.toml纯换行变化经HEAD内容比较后恢复；工作区无代码变更。真实Explorer/WorkerW拖入、OLE源效果、重名/取消UI、落点及原触控仍待，05状态继续开做，实施0/5（完整门槛），路线2/4=50%。下一步补实际OS拖入证据，不重复打包或切换Core来代替鼠标验收。