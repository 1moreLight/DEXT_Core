# v3 Release候选与性能基线
当前为源码阶段，Windows执行、数值及发布资格尚未确认。
## 候选构建
游戏结束后执行scripts/build-v3-release.ps1 -OutputDirectory <全新用户可写目录>。它只构建/部署，不启动；Core自包含.NET9，Player/Watchdog为Release，配置器features v3-release。产品需要Windows/WebView2和既有Player所需.NET Framework。
部署按v3-release-assets.json只复制官方宿主必需资产，旧Room渲染器/独立播放器和Bundle入口不进入候选。许可和上游说明保持；release-inventory.json记录实际文件/大小/摘要，不表示已验收。
此阶段为可搬移的用户可写便携目录；安装器/自动更新另属后续范围。配置器、Core及作者安装内容必须来自同一候选，程序目录需可写，不能混用旧Core二进制。
## 旧安装维护
设置→Room库与诊断→读取旧安装。每页32项、总扫描上限1024项，不轮询大资源。退出Core后可选择恢复或清理；正式操作再次核验目录/文件身份和摘要。当前清单错误显示诊断，资源字节在执行前完整复核。
完整旧安装可恢复，当前安装保留为quarantine；源作品和个人数据保持。新暂存先记录Windows目录身份/预期摘要，清理验证所有剩余字节后才逐句柄删除；失败可按身份记录重试。缺少证明、未知文件或字节不匹配保留并报告，禁止猜测半成品。孤立身份记录可清理，不能按可变路径递归删除。
实现依据：[SetFileInformationByHandle](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfileinformationbyhandle)、[FILE_ID_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info)、[FILE_DISPOSITION_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_disposition_info)。实际Windows行为仍待本包验收。
## 实测采集
scripts/record-v3-performance.ps1 -ProductDirectory <候选目录> -Scenario <样包与操作> -Seconds 5 -OutputPath <新JSON路径>，只读该目录的Dext进程，采CPU/内存/GPU逐引擎并截取本轮内核时间事件；不自动启动、注入输入或改变桌面。
配置器已有导出诊断包含最多64条实际启动/安装/应用确认/维护恢复时间。只有新建Core进程才记录spawn.ready，不把复用已启动进程当冷启动；apply.sessionConfirmed是Core会话确认时间，不冒称屏幕首帧。
Core DEXT_PERF记录单调时钟内核切页完成/中断，不在gateway锁内写日志；这不是呈现帧延迟。CPU首样本、无事件和不可用GPU均标缺失，未测不得填0或通过。
## 固定记录模板（实际执行后填写）
- 构建提交/Core/Player/配置器版本与release-inventory摘要：待测
- 机器CPU/GPU/RAM/Windows、主屏分辨率/DPI/电源模式：待测
- 首发六个zip摘要与样包资源量：引用P10-002固定catalog，实际安装另核对
- 基线仅Core、连续场景、独立Dock两模式：启动/内存/CPU/GPU/切页/恢复数据待测
- 屏幕首帧、动画帧耗时、普通重启checkpoint恢复与DPI/Explorer恢复观测：待测
- 可接受增量：实际基线后按D13确定，不在代码阶段假定阈值
- 四媒体/两Dock/原件/私人绑定/退出恢复和原用户状态：独立卡六项待验收
只有完整16项与真实Release/兼容/性能证据通过后才具备发布资格，当前不合并或发布。