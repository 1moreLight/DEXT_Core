# V3-P2B-001 顶层 Dock 与 AppBar 原型
基线7a1f31b；独立feat/V3-P2B-001-top-dock / v3-top-dock，按executing-plans内联推进。
目标：用现有Release WebView2 Player的显式原型入口验证普通软件前的底部HTML Dock、正常原生输入、无意焦点抢占与AppBar工作区协商，产出P8可复用窗口基础。
范围外：正式Core安装/动作/授权接线、系统任务栏隐藏恢复（P8）、分享、游戏覆盖和拖动。没有把原型当成已启用产品。
Ruling：沿已授权依赖链从P7提交继续；游戏期间只编码，不构建/启动/桌面输入，验证集中到游戏结束后，不扩展测试矩阵。
## 四步
1. 编码独立Dock窗口角色、主屏底部宿主尺寸约束、原生普通输入和明确键盘焦点退出。
2. 编码AppBar注册/协商/注销、触边自动隐藏、全屏抑制、DPI/显示器/Explorer重启重新定位。
3. 编码固定本地HTML交互样包、当前窗口/工作区/输入计数诊断与手动启动脚本，默认不上桌面、不启用Core。
4. 游戏结束后scripts/build.ps1再scripts/start.ps1，一次原生功能冒烟及验收卡，记录实际物理输入/焦点/工作区恢复证据；集中整体验收后才合并。
## 原型约束
- 主屏一个独立顶层窗口，绝不SetParent到WorkerW；正常WebView输入，绝不重复转发壁纸RawInput。
- 临时高度默认128 DIP，范围48..240 DIP且不超过主屏20%；只作为原型限制，最终产品值待真实验收。
- overlay不占位，autohide不额外预留工作区，reserve走SHAppBarMessage，不写SPI_SETWORKAREA；底边和最终矩形由宿主/系统掌控。
- 正常显示/触边/协商不主动激活。只有人工点击键盘模式才请求焦点，Escape/失去激活恢复非激活策略。
- 全屏检测/原生AppBar通知隐藏Dock，不自动唤出；保持reserve注册至切模式/退出，工作区行为需实测。
- 原型固定内容不调用Core、不带用户目标/权限/Room私有路径；单独临时WebView profile和本地诊断日志。
## 技术来源
SHAppBarMessage和系统通知：https://learn.microsoft.com/en-us/windows/win32/shell/application-desktop-toolbars
API结构：https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shappbarmessage
CodeGraph目录存在但未初始化，沿已核对状态使用rg兜底，不进行索引。
透明框调用参考：https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmextendframeintoclientarea；黑色client绘制参考：https://learn.microsoft.com/en-us/windows/win32/dwm/customframe。HRESULT和浏览器透明都不能替代原生画面证据。
