import path from 'node:path';
import { buildBatch } from './ua-batch-builder-common.mjs';

const summaries = new Map([
  ['src/Lively/Lively.UI.Shared/ViewModels/CustomiseWallpaperViewModel.cs', '加载动态壁纸属性定义，维护滑块、颜色、文本、复选框和下拉框状态，并把修改持久化后发送给运行中的壁纸。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/DepthEstimateWallpaperViewModel.cs', '协调深度估计模型下载与推理流程，把普通图像转换为带深度效果的动态壁纸项目。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/Gallery/GalleryLoginViewModel.cs', '管理在线 Gallery 登录认证、会话状态与已订阅壁纸恢复。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/Gallery/GallerySubscriptionViewModel.cs', '加载并展示用户订阅的 Gallery 壁纸，维护订阅列表及异步刷新状态。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/Gallery/GalleryViewModel.cs', '为在线 Gallery 提供分页壁纸数据源，并协调筛选、加载与导航状态。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/Gallery/ManageAccountViewModel.cs', '管理 Gallery 账户信息与删除账户操作，并向界面公开处理状态。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/Gallery/ReportWallpaperViewModel.cs', '承载举报 Gallery 壁纸所需的原因、说明与提交状态。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/Gallery/RestoreWallpaperViewModel.cs', '加载可恢复的在线壁纸列表并协调重新订阅或下载流程。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/LibraryAboutViewModel.cs', '向壁纸详情页面提供当前库项目的元数据、操作命令与 Gallery 关联状态。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/LibraryViewModel.cs', '管理本地壁纸库的扫描、选择、安装、删除、导出、Gallery 下载及多文件导入，是壁纸资产工作流的核心 ViewModel。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/MainViewModel.cs', '协调应用主导航、壁纸创建与批量导入、主题切换、Gallery 登录状态、更新通知和桌面事件。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/PatreonSupportersViewModel.cs', '加载并展示 Patreon 支持者信息，同时处理 WebView2 Runtime 缺失时的安装入口。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/Settings/AppThemeViewModel.cs', '管理应用主题浏览、选择、预览与设置持久化。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/Settings/FindMoreAppsViewModel.cs', '展示相关应用推荐并通过系统浏览器打开选定应用链接。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/Settings/SettingsGeneralViewModel.cs', '管理语言、启动、壁纸目录、托盘、音频输出和通用应用行为设置，并同步配置文件。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/Settings/SettingsPerformanceViewModel.cs', '管理暂停策略、进程监控、性能阈值与应用规则，并持久化性能相关配置。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/Settings/SettingsScreensaverViewModel.cs', '管理屏保类型、布局、音量、锁定、淡入与空闲时间等设置，并提供系统屏保入口。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/Settings/SettingsSystemViewModel.cs', '管理更新通道、日志导出、调试与系统集成设置，并同步应用配置。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/Settings/SettingsWallpaperViewModel.cs', '管理壁纸播放器、硬件加速、缩放、音频排除规则与 WebView2 Runtime，并支持重启壁纸应用设置。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/ShareWallpaperViewModel.cs', '把壁纸项目导出为可分享文件或上传到在线服务，并报告进度、结果与错误。'],
  ['src/Lively/Lively.UI.WinUI/App.xaml', '定义 WinUI 应用级字体、尺寸、控件资源及深浅色和高对比度 Acrylic 画刷。'],
  ['src/Lively/Lively.UI.WinUI/App.xaml.cs', '作为 WinUI 应用组合根，配置依赖注入服务、启动主窗口、应用主题、记录未处理异常并协调安全关闭。'],
  ['src/Lively/Lively.UI.WinUI/Behaviors/CheckBoxCheckedChangedBehavior.cs', '为 WinUI CheckBox 提供可绑定的 Command 与 CommandParameter，把选中状态变化桥接到 MVVM 命令。'],
  ['src/Lively/Lively.UI.WinUI/Behaviors/ComboBoxSelectionChangedBehavior.cs', '为 WinUI ComboBox 提供可绑定命令，把选择变化和参数转发给 ViewModel。'],
  ['src/Lively/Lively.UI.WinUI/Behaviors/GridViewItemClickBehavior.cs', '为 WinUI GridView 提供可绑定的条目点击命令，把 ItemClick 事件桥接到 MVVM。'],
]);

function fileTags(file) {
  const p = file.path;
  const base = path.posix.basename(p);
  if (base === 'App.xaml') return ['xaml', '应用资源', '主题样式', 'winui'];
  if (base === 'App.xaml.cs') return ['入口点', '依赖注入', '应用生命周期', 'winui'];
  if (p.includes('/Behaviors/')) return ['附加行为', '事件桥接', 'mvvm', 'winui'];
  if (p.includes('/Gallery/')) return ['mvvm', '视图模型', 'gallery', '异步操作'];
  if (p.includes('/Settings/')) return ['mvvm', '视图模型', '应用设置', '持久化'];
  if (base === 'LibraryViewModel.cs') return ['mvvm', '壁纸库', '资产管理', '异步操作'];
  if (base === 'MainViewModel.cs') return ['mvvm', '主导航', '应用编排', '事件处理'];
  if (base === 'DepthEstimateWallpaperViewModel.cs') return ['mvvm', '深度估计', '模型下载', '壁纸生成'];
  if (base === 'CustomiseWallpaperViewModel.cs') return ['mvvm', '壁纸属性', '状态同步', '序列化'];
  if (base === 'ShareWallpaperViewModel.cs') return ['mvvm', '壁纸分享', '文件导出', '上传'];
  return ['mvvm', '视图模型', '状态管理', '命令处理'];
}

function fileNotes(file) {
  if (file.path.endsWith('App.xaml')) return 'WinUI XAML 使用 ThemeDictionaries 为 Default、Light 与 HighContrast 提供不同资源。';
  if (file.path.endsWith('App.xaml.cs')) return 'WinUI 应用通过 Host/DI 组合服务与 ViewModel，并在应用生命周期中集中处理主题和异常。';
  if (file.path.includes('/Behaviors/')) return 'AttachedProperty 将 WinUI 控件事件适配为 ICommand，避免 code-behind 直接依赖业务逻辑。';
  if (file.path.includes('/ViewModels/')) return 'C# MVVM 将异步服务调用、命令状态和事件订阅集中到可跨 UI 宿主复用的 ViewModel。';
  return undefined;
}

function classSummary(file, item) {
  const name = item.name;
  if (name === 'App') return '配置 WinUI 应用服务容器并协调启动、主题、异常记录和关闭。';
  if (name.endsWith('Behavior')) return `把 ${name.replace('Behavior', '')} 控件事件适配为可绑定的 ICommand。`;
  if (name.endsWith('ViewModel')) return `为 ${name.replace('ViewModel', '')} 界面集中管理状态、命令、异步操作与服务协作。`;
  return `封装 ${name} 的 UI 状态与行为。`;
}

function classTags(file, item) {
  const name = item.name;
  if (name === 'App') return ['入口点', '依赖注入', '应用生命周期', 'winui'];
  if (name.endsWith('Behavior')) return ['附加行为', '事件桥接', 'mvvm', 'winui'];
  if (file.path.includes('/Gallery/')) return ['mvvm', '视图模型', 'gallery', '异步操作'];
  if (file.path.includes('/Settings/')) return ['mvvm', '视图模型', '应用设置', '持久化'];
  return ['mvvm', '视图模型', '状态管理', '命令处理'];
}

function functionSummary(file, item) {
  const name = item.name;
  const specific = {
    Load: '读取壁纸属性定义与当前值，构建可编辑控件集合并准备事件同步。',
    SliderValueChanged: '处理滑块值变化，更新属性文件并把数值发送给运行中的壁纸。',
    ColorPickerValueChanged: '处理颜色选择变化，持久化颜色并通知运行中的壁纸。',
    TextboxValueChanged: '处理文本属性变化，更新持久化值并发送消息。',
    CheckboxValueChanged: '处理布尔属性变化，更新持久化值并发送消息。',
    DropdownValueChanged: '处理下拉选项变化，保存选择并通知壁纸。',
    RestoreDefault: '从原始属性定义恢复默认值并重新应用到壁纸。',
    OnClose: '在页面关闭时保存必要状态、取消任务并释放事件订阅。',
    UpdatePropertyFile: '把当前属性值写回壁纸属性 JSON 文件。',
    WallpaperSendMsg: '构造属性 IPC 消息并发送给正在运行的壁纸实例。',
    CreatePropertyCopy: '为当前显示器创建独立的壁纸属性副本。',
    Run: '执行深度估计工作流，准备模型与输入图像并生成深度壁纸资源。',
    DownloadModel: '下载深度估计模型文件并报告进度与失败状态。',
    Authenticate: '发起 Gallery 身份认证并保存登录会话。',
    RestoreSubscribedWallpapers: '同步账户订阅并恢复本地缺失的 Gallery 壁纸。',
    PopulateSubbedWallpapers: '分页加载用户已订阅壁纸并更新展示集合。',
    GetPagedItemsAsync: '从 Gallery API 异步获取指定页壁纸并转换为增量数据项。',
    DeleteAccount: '请求删除 Gallery 账户并处理确认、退出和错误状态。',
    PopulateWallpapers: '加载可恢复壁纸并更新选择与操作状态。',
    LibraryClick: '处理壁纸库条目点击，在选择模式或桌面设置模式下执行对应动作。',
    SelectItem: '进入选择模式并异步等待用户选择壁纸。',
    CancelDownload: '取消指定 Gallery 壁纸的下载任务并清理跟踪状态。',
    UpdateSelectedWallpaper: '根据当前显示器和运行中壁纸同步库选中项。',
    WallpaperDelete: '关闭并删除壁纸资源，更新本地库并按需取消 Gallery 订阅。',
    WallpaperExport: '整理壁纸文件和元数据并导出为可分享的 Lively 包。',
    WallpaperShowOnDisk: '在系统文件管理器中打开壁纸资源位置。',
    CancelAllDownloads: '取消所有进行中的 Gallery 壁纸下载。',
    AddWallpaperGallery: '订阅并下载 Gallery 壁纸，跟踪进度后安装到本地库。',
    AddWallpaperFileGallery: '解包 Gallery 壁纸文件、更新元数据并加入本地库。',
    AddWallpaperFile: '识别媒体或壁纸包，按需转换后创建并安装壁纸。',
    AddWallpapers: '批量过滤、转换和导入媒体文件，并报告整体进度。',
    AddWallpaperLink: '验证网页或视频流地址并创建在线壁纸。',
    AddWallpaperFolder: '从已准备的项目目录向本地库添加壁纸。',
    UpdateWallpaperDirectory: '切换壁纸目录并重新扫描、加载库项目。',
    UpdateAnimationSettings: '根据应用状态启用或暂停库界面动画。',
    AddWallpaper: '从项目目录创建库模型并加入壁纸集合。',
    RemoveWallpaper: '从当前库集合移除指定壁纸模型。',
    ScanWallpaperFolders: '扫描壁纸目录，读取有效项目并生成本地库模型。',
    InstallWebView2: '检测并安装 WebView2 Runtime，同时更新界面进度和结果状态。',
    AppUpdater_UpdateChecked: '响应更新检查结果并刷新主界面通知状态。',
    DesktopCore_WallpaperError: '响应壁纸运行错误并展示诊断或恢复操作。',
    DesktopCore_WallpaperChanged: '响应桌面壁纸变化并同步库选择和界面状态。',
    Navigator_ContentPageChanged: '响应主导航页面切换并同步当前页面状态。',
    OpenAddWallpaper: '打开添加壁纸流程并准备目标页面。',
    CreateWallpaper: '根据创建向导数据生成新的壁纸项目。',
    SetAppTheme: '应用主题资源、强调色和背景，并持久化用户选择。',
    GalleryInit: '初始化 Gallery 客户端状态、登录事件和相关页面。',
    GalleryClient_LoggedIn: '响应 Gallery 登录状态变化并刷新账户与订阅页面。',
    GetPages: '构建主导航可用页面集合。',
    GetPageName: '根据页面类型返回本地化导航名称。',
    BrowseTheme: '打开主题文件或目录选择器并加载选定主题。',
    UpdateSettingsConfigFile: '把当前 ViewModel 的设置变化写入应用配置存储。',
    BrowseApp: '通过系统浏览器打开选定推荐应用的链接。',
    WallpaperDirectoryChange: '验证并切换壁纸目录，按用户选择迁移现有资源。',
    UpdateAudioOutputScreens: '依据显示器与音频设备刷新每屏音频输出选项。',
    AddAppRule: '创建或更新性能暂停规则并刷新规则集合。',
    UpdateAppRulesConfigFile: '把性能应用规则序列化到配置文件。',
    OpenWindowsSettings: '打开 Windows 屏幕保护程序系统设置页面。',
    SwitchReleaseChannel: '切换稳定版或测试版更新通道并触发重新检查。',
    ExtractLog: '收集并导出应用日志用于故障诊断。',
    AddAppMusicExclusionRule: '向壁纸音频排除列表添加应用规则。',
    GetAppMusicExclusionRule: '读取并转换当前壁纸音频排除规则集合。',
    IsVideoPlayerAvailable: '检测所选视频播放器运行时是否可用。',
    IsGifPlayerAvailable: '检测所选 GIF 播放器运行时是否可用。',
    WallpaperRestart: '重启正在运行的壁纸以应用播放器或渲染设置。',
    ExportFile: '打包并导出壁纸项目，同时报告进度和错误。',
    UploadFile: '上传已打包壁纸文件并更新分享结果。',
    OnLaunched: '完成 WinUI 启动流程，解析参数并创建主窗口。',
    ConfigureServices: '注册应用服务、工厂、导航器与 ViewModel 到依赖注入容器。',
    SetupUnhandledExceptionLogging: '注册 UI、AppDomain 和任务调度器的未处理异常记录。',
    ShutDown: '协调壁纸核心安全关闭、保存设置并退出应用。',
    OnCommandChanged: '在附加 Command 变化时订阅或取消控件事件。',
    OnCheckBoxCheckedChanged: '把 CheckBox 选中状态和命令参数转发给绑定命令。',
    OnComboBoxSelectionChanged: '把 ComboBox 当前选择和参数转发给绑定命令。',
    OnItemClickCommandChanged: '在 GridView 点击命令变化时维护 ItemClick 事件订阅。',
    GridView_ItemClick: '把被点击条目转发给 GridView 绑定命令。',
  };
  if (name.endsWith('ViewModel')) return `注入 ${name.replace('ViewModel', '')} 界面所需服务并初始化属性、命令和事件订阅。`;
  if (name === 'App') return '创建 WinUI 应用宿主、配置服务并准备启动生命周期。';
  if (name.startsWith('Get') && name.includes('Command')) return '读取控件关联的附加命令属性。';
  if (name.startsWith('Set') && name.includes('Command')) return '设置控件关联的附加命令属性。';
  if (name.startsWith('GetCommandParameter')) return '读取控件附加的命令参数。';
  if (name.startsWith('SetCommandParameter')) return '设置控件附加的命令参数。';
  return specific[name] || `处理 ${name} 对应的界面命令、异步操作或状态同步流程。`;
}

function functionTags(file, item) {
  const name = item.name;
  if (file.path.endsWith('App.xaml.cs')) return ['应用生命周期', '依赖注入', 'winui', '事件处理'];
  if (file.path.includes('/Behaviors/')) return ['附加行为', '事件桥接', 'icommand', 'winui'];
  if (file.path.includes('/Gallery/')) return ['gallery', '异步操作', 'mvvm', '状态管理'];
  if (file.path.includes('/Settings/')) return ['应用设置', '持久化', 'mvvm', '命令处理'];
  if (name.includes('_') || name.startsWith('On')) return ['事件处理', '状态同步', 'mvvm', '生命周期'];
  if (name.startsWith('Get') || name.startsWith('Is')) return ['状态查询', 'mvvm', '数据访问', '界面逻辑'];
  return ['命令处理', '异步操作', 'mvvm', '状态管理'];
}

const result = buildBatch({
  batchIndex: 15,
  fileSummary: (file) => summaries.get(file.path),
  fileTags,
  fileLanguageNotes: fileNotes,
  classSummary,
  classTags,
  functionSummary,
  functionTags,
  addEdges: ({ batch, expectedPaths, edges, nodeId }) => {
    const xaml = batch.files.find((file) => file.path === 'src/Lively/Lively.UI.WinUI/App.xaml');
    const codeBehind = 'src/Lively/Lively.UI.WinUI/App.xaml.cs';
    if (xaml && expectedPaths.includes(codeBehind)) edges.push({ source: nodeId(xaml), target: `file:${codeBehind}`, type: 'depends_on', direction: 'forward', weight: 0.6 });
  },
});

console.log(JSON.stringify(result, null, 2));
