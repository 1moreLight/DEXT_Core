# 03 构建与本地闭环
状态：做完
完整Release→start.ps1独立候选，复用现有探针验证身份。实际个人授权仅在隔离样包/临时受控数据上检验，不替用户给正在用的作品新增许可。
Expected: 构建0退出；Core/配置器同目录。真实桌面交互待统一验收。


完整build-v3-release.ps1与start.ps1通过，运行候选D:\use\Orca\DEXT\DEXT_Core\.build\v3-storage-grants-20261010。真实Core隔离Room9d0a1cfd-e...的允许/独立撤销/正常重启授权保持通过，未改用户作品授权。
开始前WallpaperLayout=[]，没有活动Room，所以第一次只读grants-status明确失败而非假报通过。随后生产Rust安装器安装临时新UUID，真实ReleasePlayer恢复和RPC闭环通过；finally关闭临时壁纸、正式RPC删除临时个人数据、恢复原checkpoint。安装证据移出发布目录到.build/storage-grant-installed-proof-20261010。
真实资源记录.build/v3-storage-grants-performance-20261010.json：无活动壁纸、配置器和应用Dock运行；Core平均CPU整机0.16%/工作集190.7MiB，配置器0.04%/32.9MiB。仅六次采样，不含WebView2子进程，不充当壁纸/首帧延迟性能结论。
