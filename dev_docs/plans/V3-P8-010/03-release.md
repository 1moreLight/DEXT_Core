# 03 构建与检查
状态：待做
定向模型/存储/导航、原WPF点击回归、UI和完整Release；保持配置器只有一份，先构建后CoreOnly启动。

完整发布候选已构建：D:/use/Orca/DEXT/DEXT_Core/.build/v3-desk-dock-pins-20261010。
通过：私人存储3、导航13、原应用模型33、原WPF18、UI上下文2、TS/Vite、Core/Player/Watchdog/配置器Release。
当前尚未切换运行候选，待独立审查后按精确身份正常退出再启动。人工切页/固定/鼠标保持在04。

状态更新：做完。最终Core重建通过，当前运行PID41528，产品路径为本步骤候选；唯一配置器38444。实际RPC启用true、8个运行应用、error空，无Room重铺或固定项变更。
旧候选RPC退出残留：应用Dock/Watchdog已退出，任务栏恢复日志移除，但Core42912无响应；核对精确路径后终止残留。退出正确性留OPS-006，不能把这次升级写成正常退出通过。
