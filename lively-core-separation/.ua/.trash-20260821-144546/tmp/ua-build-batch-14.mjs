import path from 'node:path';
import { buildBatch } from './ua-batch-builder-common.mjs';

const summaries = new Map([
  ['src/Lively/Lively.Player.Wmf/MainWindow.xaml', '定义无边框、非激活的 WPF 媒体播放器窗口，并以 MediaElement 作为 WMF 动态壁纸的播放表面。'],
  ['src/Lively/Lively.Player.Wmf/MainWindow.xaml.cs', '实现 WPF/WMF 动态壁纸播放器主窗口，负责启动参数、MediaElement 播放控制、音量设置与标准输入 IPC。'],
  ['src/Lively/Lively.Player.Wmf/Properties/AssemblyInfo.cs', '声明 WPF/WMF 播放器程序集的主题资源、DPI 感知、版本与产品元数据。'],
  ['src/Lively/Lively.Player.Wmf/Properties/Resources.Designer.cs', '由资源工具生成 WPF/WMF 播放器的强类型 ResourceManager 与 Culture 访问入口。'],
  ['src/Lively/Lively.Player.Wmf/Properties/Resources.resx', '定义 WPF/WMF 播放器的 RESX 资源清单；当前仅保留标准资源头和读写器信息。'],
  ['src/Lively/Lively.Player.Wmf/Properties/Settings.Designer.cs', '由设置工具生成 WPF/WMF 播放器的强类型默认设置访问器。'],
  ['src/Lively/Lively.Player.Wmf/Properties/Settings.settings', '定义 WPF/WMF 播放器的 Visual Studio 设置架构；当前不包含持久化设置项。'],
  ['src/Lively/Lively.Player.Wmf/StartArgs.cs', '声明 WMF 播放器的媒体路径、音量、属性文件、几何范围与日志等命令行启动参数。'],
  ['src/Lively/Lively.Player.Wmf/app.manifest', '声明 WPF/WMF 播放器以 asInvoker 权限运行，并配置 Windows 兼容性与 DPI 行为。'],
  ['src/Lively/Lively.UI.Shared/Factories/AppThemeFactory.cs', '从主题文件或目录读取元数据并构建 ThemeModel，为共享 UI 提供统一的主题发现入口。'],
  ['src/Lively/Lively.UI.Shared/Factories/AudioDeviceFactory.cs', '枚举 Windows 音频渲染设备、解析默认设备与设备图标，并缓存可供设置界面使用的音频设备模型。'],
  ['src/Lively/Lively.UI.Shared/Factories/IAppThemeFactory.cs', '声明从主题文件和目录创建 ThemeModel 的工厂契约。'],
  ['src/Lively/Lively.UI.Shared/Factories/IAudioDeviceFactory.cs', '声明查询默认音频设备、设备列表及按标识查找设备的工厂契约。'],
  ['src/Lively/Lively.UI.Shared/Helpers/WebViewUtil.cs', '检测 Microsoft WebView2 Runtime 是否可用，并在缺失时下载和启动 Evergreen 安装程序。'],
  ['src/Lively/Lively.UI.Shared/Lively.UI.Shared.projitems', '列出共享 UI 项目的 C# 源文件，使多个桌面前端能够编译同一组工厂、帮助器和 ViewModel。'],
  ['src/Lively/Lively.UI.Shared/Lively.UI.Shared.shproj', '定义 Visual Studio 共享项目并导入 Lively.UI.Shared.projitems，为不同 UI 宿主提供公共源码。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/AboutViewModel.cs', '向关于页面提供版本、许可证、项目链接和第三方信息等只读展示数据。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/AddWallpaperCreateViewModel.cs', '管理创建新动态壁纸项目的名称、类型和导航状态，并协调创建流程。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/AddWallpaperDataViewModel.cs', '管理壁纸元数据编辑状态，包括标题、作者、描述、缩略图和保存命令。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/AddWallpaperViewModel.cs', '协调从网页链接、单个文件或批量文件添加壁纸，并维护浏览、导入和相关设置状态。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/AppUpdateViewModel.cs', '管理应用更新检查、下载、状态展示、安装文件检测以及 WebView2 Runtime 安装流程。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/ChooseDisplayViewModel.cs', '为显示器选择对话框维护屏幕布局、选中项和关闭结果。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/ControlPanel/ControlPanelViewModel.cs', '协调控制面板中的页面导航、内容切换和窗口关闭生命周期。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/ControlPanel/ScreensaverLayoutViewModel.cs', '管理多显示器屏保布局，支持添加、移除、校验、刷新和生成屏保配置。'],
  ['src/Lively/Lively.UI.Shared/ViewModels/ControlPanel/WallpaperLayoutViewModel.cs', '管理多显示器壁纸布局，支持关闭、定制、刷新显示器映射并保存布局变化。'],
]);

function fileTags(file) {
  const p = file.path;
  const base = path.posix.basename(p);
  if (base === 'MainWindow.xaml') return ['xaml', '媒体播放', 'wpf', '界面布局'];
  if (base === 'MainWindow.xaml.cs') return ['播放器', 'wpf', '进程通信', '媒体控制'];
  if (base === 'AssemblyInfo.cs') return ['程序集元数据', '版本信息', 'wpf', '构建配置'];
  if (base === 'Resources.Designer.cs' || base.endsWith('.resx')) return ['自动生成', '资源访问', 'resource-manager', '本地化'];
  if (base === 'Settings.Designer.cs' || base === 'Settings.settings') return ['自动生成', '应用设置', 'configuration', '强类型访问'];
  if (base === 'StartArgs.cs') return ['命令行参数', '启动配置', '数据模型', 'validation'];
  if (base === 'app.manifest') return ['应用清单', 'windows', '权限配置', '兼容性'];
  if (base.endsWith('.projitems')) return ['共享项目', 'msbuild', '源码清单', 'build-system'];
  if (base.endsWith('.shproj')) return ['共享项目', 'msbuild', 'build-system', '源码复用'];
  if (p.includes('/Factories/')) return [base.startsWith('I') ? '接口契约' : 'factory', '依赖注入', p.includes('Audio') ? '音频设备' : '主题管理', '共享服务'];
  if (base === 'WebViewUtil.cs') return ['utility', 'webview2', '运行时检测', '安装器'];
  if (p.includes('/ViewModels/')) return ['mvvm', '视图模型', '状态管理', p.includes('ControlPanel') ? '多显示器' : '命令处理'];
  return ['共享界面', 'lively', '桌面应用', '组件'];
}

function fileNotes(file) {
  const base = path.posix.basename(file.path);
  if (base === 'MainWindow.xaml') return 'XAML 通过 x:Class 与 MainWindow.xaml.cs 配对，MediaElement 由 WPF 媒体管线负责播放。';
  if (base === 'MainWindow.xaml.cs') return 'WPF 事件模型与标准输入输出 JSON IPC 共同驱动 WMF 播放器。';
  if (base.endsWith('.shproj') || base.endsWith('.projitems')) return 'Visual Studio Shared Project 通过 MSBuild Import 把同一组 C# 文件编译进多个宿主项目。';
  if (file.path.includes('/ViewModels/')) return 'C# MVVM 将界面状态、命令和服务协作集中在 ViewModel 中，供不同 UI 宿主复用。';
  return undefined;
}

function classSummary(file, item) {
  const name = item.name;
  if (name === 'MainWindow') return '协调 WPF MediaElement 播放、窗口初始化、父进程命令与音量控制。';
  if (name === 'Resources') return '提供 WPF/WMF 播放器资源管理器和区域文化的强类型访问。';
  if (name === 'StartArgs') return '聚合 WPF/WMF 播放器的命令行启动选项。';
  if (name === 'AppThemeFactory') return '从主题清单或目录资源构建 ThemeModel。';
  if (name === 'AudioDeviceFactory') return '发现 Windows 音频渲染设备并构造带图标的设备模型。';
  if (name === 'IAppThemeFactory') return '定义主题模型创建能力的抽象契约。';
  if (name === 'IAudioDeviceFactory') return '定义音频渲染设备发现与查找能力的抽象契约。';
  if (name === 'WebViewUtil') return '封装 WebView2 Runtime 检测、下载和安装操作。';
  if (name.endsWith('ViewModel')) return `为 ${name.replace('ViewModel', '')} 界面集中管理状态、命令与服务协作。`;
  return `封装 ${name} 的共享 UI 职责。`;
}

function classTags(file, item) {
  const name = item.name;
  if (name === 'MainWindow') return ['桌面窗口', '媒体播放', '进程通信', 'wpf'];
  if (name === 'Resources') return ['自动生成', '资源访问', 'resource-manager', '本地化'];
  if (name === 'StartArgs') return ['命令行参数', '启动配置', '数据模型', 'validation'];
  if (name.startsWith('I')) return ['接口契约', '抽象', '依赖注入', 'factory'];
  if (name.endsWith('Factory')) return ['factory', '对象创建', '依赖注入', name.includes('Audio') ? '音频设备' : '主题管理'];
  if (name === 'WebViewUtil') return ['utility', 'webview2', '运行时检测', '安装器'];
  return ['mvvm', '视图模型', '状态管理', '命令处理'];
}

function functionSummary(file, item) {
  const name = item.name;
  const specific = {
    MainWindow: '解析启动参数、初始化 MediaElement 窗口并启动父进程消息监听。',
    RunOptions: '把命令行选项应用到媒体路径、窗口几何范围、属性和音量。',
    MediaPlayer_Loaded: '在媒体控件加载后设置播放源并启动媒体壁纸。',
    Pause: '暂停 WPF MediaElement 的当前媒体播放。',
    Play: '开始或恢复 WPF MediaElement 的媒体播放。',
    Stop: '停止当前媒体播放并重置播放器状态。',
    SetVolume: '把宿主音量值转换并应用到 MediaElement。',
    StdInListener: '持续读取父进程 JSON 消息并执行播放、暂停、音量和属性控制。',
    CreateFromFile: '读取主题文件及相邻资源并构造 ThemeModel。',
    CreateFromDirectory: '扫描主题目录、加载清单和预览资源并构造 ThemeModel。',
    GetDefaultRenderDevice: '查询 Windows 当前默认音频渲染设备并转换为界面模型。',
    GetRenderDevices: '枚举可用音频渲染设备并附加名称和图标。',
    GetDeviceById: '按设备标识查找音频渲染设备并构造模型。',
    GetAndCacheDeviceIcon: '解析音频设备图标资源并缓存可复用的图像文件。',
    IsWebView2Available: '查询 WebView2 Runtime 版本以判断运行环境是否可用。',
    InstallWebView2: '下载 WebView2 Evergreen 安装器并启动静默安装流程。',
    UpdateSettingsConfigFile: '更新设置配置文件，使新增壁纸入口与用户选择保持一致。',
    WebBrowseAction: '打开网页入口并校验用户输入的壁纸链接。',
    AddWallpaperLink: '校验网络地址并请求壁纸库从链接创建动态壁纸。',
    FileBrowseAction: '打开文件选择流程并把结果交给壁纸导入逻辑。',
    AddWallpaperFile: '导入单个媒体或壁纸包，并更新界面状态。',
    AddWallpaperFiles: '批量导入用户选择的媒体文件并报告进度。',
    CheckUpdate: '请求更新服务检查新版本并把结果转换为界面状态。',
    DownloadUpdate: '下载更新包、跟踪进度并处理取消或失败状态。',
    UpdateState: '根据更新服务状态刷新可见文案、命令可用性与进度。',
    IsUpdateFileExists: '检查更新安装文件是否已完整下载到本地。',
    OnWindowClosing: '在窗口关闭时提交选择结果、释放订阅并保存必要状态。',
    UpdateLayout: '根据当前显示器集合和选择状态重新计算可视化布局。',
    DialogNavigator_ContentPageChanged: '响应控制面板页面切换并同步当前内容状态。',
    AddScreensaver: '为目标显示器选择并添加屏保壁纸映射。',
    RemoveScreensaver: '从当前多屏布局中移除选定屏保映射。',
    CanRemoveScreensaver: '判断当前布局是否允许移除指定屏保条目。',
    GetScreensaverConfigFile: '根据当前屏保布局生成供运行时使用的配置文件。',
    CloseWallpaper: '关闭选定显示器上的动态壁纸并刷新布局。',
    CanCloseWallpaper: '判断当前显示器映射是否允许关闭壁纸。',
    CustomiseWallpaper: '打开选定壁纸的属性定制页面。',
    CustomiseWallpaperPageOnClosed: '在定制页面关闭后恢复控制面板状态并刷新布局。',
    UpdateDisplayLayout: '依据显示器拓扑更新屏幕布局项和选择状态。',
    UpdateWallpaperLayout: '根据正在运行的壁纸同步多显示器布局模型。',
  };
  if (name.endsWith('ViewModel')) return `注入 ${name.replace('ViewModel', '')} 界面所需服务并初始化状态、命令与事件订阅。`;
  return specific[name] || `处理 ${name} 对应的界面命令、状态更新或生命周期流程。`;
}

function functionTags(file, item) {
  const name = item.name;
  if (file.path.includes('MainWindow')) return ['媒体控制', '进程通信', 'wpf', '事件处理'];
  if (file.path.includes('/Factories/')) return ['factory', '对象创建', '资源解析', '共享服务'];
  if (file.path.endsWith('WebViewUtil.cs')) return ['utility', 'webview2', '运行时检测', '安装器'];
  if (name === 'OnWindowClosing' || name.includes('_')) return ['事件处理', 'mvvm', '状态同步', '生命周期'];
  if (name.startsWith('Can')) return ['命令校验', 'mvvm', '状态判断', '控制面板'];
  return ['命令处理', 'mvvm', '状态管理', file.path.includes('ControlPanel') ? '多显示器' : '异步操作'];
}

const result = buildBatch({
  batchIndex: 14,
  fileSummary: (file) => summaries.get(file.path),
  fileTags,
  fileLanguageNotes: fileNotes,
  classSummary,
  classTags,
  functionSummary,
  functionTags,
  addEdges: ({ batch, expectedPaths, edges, nodeId }) => {
    const xaml = batch.files.find((file) => file.path === 'src/Lively/Lively.Player.Wmf/MainWindow.xaml');
    const codeBehind = 'src/Lively/Lively.Player.Wmf/MainWindow.xaml.cs';
    if (xaml && expectedPaths.includes(codeBehind)) edges.push({ source: nodeId(xaml), target: `file:${codeBehind}`, type: 'depends_on', direction: 'forward', weight: 0.6 });
    const sharedProject = batch.files.find((file) => file.path.endsWith('Lively.UI.Shared.shproj'));
    const sharedItems = 'src/Lively/Lively.UI.Shared/Lively.UI.Shared.projitems';
    if (sharedProject && expectedPaths.includes(sharedItems)) edges.push({ source: nodeId(sharedProject), target: `file:${sharedItems}`, type: 'depends_on', direction: 'forward', weight: 0.6 });
  },
});

console.log(JSON.stringify(result, null, 2));
