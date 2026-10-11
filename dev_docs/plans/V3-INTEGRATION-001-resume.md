# V3-INTEGRATION-001 集成续项
状态：待统一验收；本次续项3/4=75%，原集成2/4=50%。基线22ed4e9。
目标：补齐已声明的本机存储授权入口，验证读取/写入/撤销和保存，整理统一验收证据。
范围外：桌面输入重写、拖动、云服务、多屏、自动替用户授权、合并master。
用户明确要求持续推进，人工缺项留清单，不在阶段提交后停止。
|步骤|状态|文件|
|---|---|---|
|01 Core存储授权|做完|[01-storage.md](V3-INTEGRATION-001-resume/01-storage.md)|
|02 配置器和观测台接入|做完|[02-ui.md](V3-INTEGRATION-001-resume/02-ui.md)|
|03 构建和本地闭环|做完|[03-build.md](V3-INTEGRATION-001-resume/03-build.md)|
|04 集中证据与交接|开做|[04-evidence.md](V3-INTEGRATION-001-resume/04-evidence.md)|
设计决定：复用现有受信配置器授权RPC，数据读取仍限四项；storage.read/write写入现有Grants，只修改所选存储项，保持其余同安装授权。无需私人格式迁移，旧构建可读。
Review Focus：只读授权不改变存储，存储授权不改变动作；旧安装不能被晋升；失败不更新勾选；样包异步读写不覆盖更新计数。
