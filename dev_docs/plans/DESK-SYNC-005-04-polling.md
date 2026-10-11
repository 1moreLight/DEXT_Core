# 005 第04步：空白命中轮询开销
状态：做完（实现与构建），部署核对开做。目标：50ms原生右键offer刷新不读取个人配置文件；菜单实际弹出/操作仍验证当前同步设置。
证据：CaptureDesktopContextOffer调用NativeReadPresentation+NativeCheckDesktopDrop，两者都ReadForDispatch→ReadState，反复打开/解析personal.json。
步骤：限定内存范围快照；锁住夹具文件时快照仍可读但菜单执行检查拒绝；限定回归、构建、采样与交接。

验证：锁住测试夹具 personal.json 的回归先 27/28 失败，改为内存提示后 28/28 通过；实际菜单派发仍要求当前配置可读。Release 构建退出0，日志 background-poll-build.log。
