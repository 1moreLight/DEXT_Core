# OPS-005 配置器启动去重
目标：重复启动不再堆积配置器，后台验证可只启动Core。
基线213ca76；fix/OPS-005-configurator-launch，worktree v3-workbench-runtime（尚未用于P7）。
范围：start.ps1中的配置器进程检查与CoreOnly开关，本轮多余窗口清理。
范围外：更改配置器编辑/草稿、Core点击、全局杀进程、自动关闭其他版本窗口。
01 cleanup 做完：五个旧窗口均在房间库，无未保存编辑UI，正常关闭；两个早期空窗口残留按精确路径结束。只剩30336。
02 launcher 开做：同路径复用；其他路径存在时报告并不新开；CoreOnly跳过配置器。
03 verify 待做：脚本定向策略/真实重复启动计数，提交后继续P7-002。
