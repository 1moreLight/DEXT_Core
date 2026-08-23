import path from 'node:path';
import { buildBatch } from './ua-batch-builder-common.mjs';

const serviceSummaries = new Map([
  ['Package.appxmanifest', '声明 Lively WinUI 包标识、版本、桌面应用入口、Windows 目标版本、视觉资产与应用描述。'],
  ['DialogNavigator.cs', '维护内容对话框内部的 Frame、当前页面和导航历史，为多步骤对话框提供页面切换与重新加载。'],
  ['DialogService.cs', '集中创建并显示显示器、应用选择、主题、壁纸创建、定制、分享、Gallery、确认和进度等 WinUI 对话框。'],
  ['DiskCacheService.cs', '以 URL 哈希为键把远程文件缓存到本地目录，并按有效期读取或清理过期缓存。'],
  ['DispatcherService.cs', '封装 WinUI DispatcherQueue，把操作安全地排入 UI 线程执行。'],
  ['FileService.cs', '统一封装 WinUI 文件、文件夹与保存选择器，提供壁纸过滤器、UWP 兼容选择和打开目录能力。'],
  ['MainNavigator.cs', '维护应用主 Frame、当前页面与导航历史，提供页面跳转和重新加载。'],
  ['MediaFormatConverter.cs', '判断媒体文件是否需要转换，并通过格式转换服务生成 Lively 支持的输出。'],
  ['ResourceService.cs', '通过 WinUI ResourceLoader 获取本地化字符串，并切换指定文化或系统默认文化。'],
  ['StartArgs.cs', '声明 WinUI 应用的命令行开关，用于仅启动托盘组件或直接打开更新页面。'],
]);

const locales = new Map([
  ['af-ZA', '南非荷兰语（南非）'], ['ar-AE', '阿拉伯语（阿联酋）'], ['az-Latn', '阿塞拜疆语（拉丁字母）'],
  ['be-BY', '白俄罗斯语'], ['bg-BG', '保加利亚语'], ['ca-ES', '加泰罗尼亚语'], ['cs-CZ', '捷克语'],
  ['da-DK', '丹麦语'], ['de-DE', '德语'], ['el-GR', '希腊语'], ['en-US', '英语（美国）'],
  ['es-ES', '西班牙语（西班牙）'], ['es-MX', '西班牙语（墨西哥）'], ['fa-IR', '波斯语'], ['fi-FI', '芬兰语'],
]);

function localeCode(file) {
  const match = file.path.match(/\/Strings\/([^/]+)\/Resources\.resw$/);
  return match?.[1];
}

function fileSummary(file) {
  const base = path.posix.basename(file.path);
  if (base === 'Resources.resw') {
    const code = localeCode(file);
    return `为 Lively WinUI 界面提供${locales.get(code) || code}本地化字符串，包含 384 个资源键，覆盖设置、壁纸库、Gallery、对话框和状态提示。`;
  }
  return serviceSummaries.get(base);
}

function fileTags(file) {
  const base = path.posix.basename(file.path);
  if (base === 'Resources.resw') return ['本地化', '资源字典', '界面文案', localeCode(file).toLowerCase()];
  if (base === 'Package.appxmanifest') return ['应用清单', 'msix', 'windows', 'deployment'];
  if (base.endsWith('Navigator.cs')) return ['导航服务', '页面路由', 'winui', '状态管理'];
  if (base === 'DialogService.cs') return ['service', '对话框', 'winui', '依赖注入'];
  if (base === 'DiskCacheService.cs') return ['service', '磁盘缓存', 'http', '过期清理'];
  if (base === 'DispatcherService.cs') return ['service', 'ui-thread', 'dispatcher', 'winui'];
  if (base === 'FileService.cs') return ['service', '文件选择器', 'winui', '平台集成'];
  if (base === 'MediaFormatConverter.cs') return ['service', '媒体转换', '格式检测', '异步操作'];
  if (base === 'ResourceService.cs') return ['service', '本地化', 'resource-loader', '文化切换'];
  return ['命令行参数', '启动模式', 'winui', 'configuration'];
}

function fileNotes(file) {
  const base = path.posix.basename(file.path);
  if (base === 'Resources.resw') return 'RESW 使用相同资源键和不同区域值接入 WinUI PRI 本地化管线。';
  if (base === 'Package.appxmanifest') return 'MSIX 清单同时声明 Windows.Universal 与 Windows.Desktop 目标设备族，并启动打包后的 Lively.exe。';
  if (base === 'ResourceService.cs') return 'ResourceLoader 根据当前 PrimaryLanguageOverride 从对应 RESW 资源映射中解析字符串。';
  return undefined;
}

function classSummary(file, item) {
  const name = item.name;
  const summaries = {
    DialogNavigator: '管理内容对话框中的 Frame 导航、当前页面与重新加载。',
    DialogService: '构造并排队显示应用各类 WinUI 内容对话框。',
    DiskCacheService: '管理基于 URL 哈希的本地文件缓存和过期清理。',
    DispatcherService: '把回调封装为可安全投递到 WinUI UI 线程的操作。',
    FileService: '统一管理文件、文件夹和保存选择器及系统目录打开操作。',
    MainNavigator: '管理应用主 Frame 的导航、当前页面和重新加载。',
    MediaFormatConverter: '判断媒体兼容性并执行必要的格式转换。',
    ResourceService: '从 WinUI 资源映射读取字符串并切换应用文化。',
    StartArgs: '聚合托盘模式与更新页面启动开关。',
  };
  return summaries[name] || `封装 ${name} 的 WinUI 服务职责。`;
}

function classTags(file, item) {
  const name = item.name;
  if (name.endsWith('Navigator')) return ['导航服务', '页面路由', 'winui', '状态管理'];
  if (name === 'StartArgs') return ['命令行参数', '启动模式', '数据模型', 'configuration'];
  if (name === 'ResourceService') return ['service', '本地化', 'resource-loader', '文化切换'];
  if (name === 'DiskCacheService') return ['service', '磁盘缓存', 'http', '过期清理'];
  if (name === 'FileService') return ['service', '文件选择器', 'winui', '平台集成'];
  return ['service', 'winui', '异步操作', '依赖注入'];
}

const dialogLabels = {
  ShowDisplayChooseDialogAsync: '显示器选择', ShowApplicationPickerDialogAsync: '应用选择', ShowDialogAsync: '通用内容',
  ShowTextInputDialogAsync: '文本输入', ShowThemeDialogAsync: '主题选择', ShowCustomiseWallpaperDialogAsync: '壁纸定制',
  ShowDepthWallpaperDialogAsync: '深度壁纸', ShowAddWallpaperDialogAsync: '添加壁纸', ShowWallpaperCreateDialogAsync: '壁纸创建',
  InnerShowWallpaperCreateDialog: '内部壁纸创建', ShowAboutDialogAsync: '关于应用', ShowPatreonSupportersDialogAsync: 'Patreon 支持者',
  ShowControlPanelDialogAsync: '控制面板', ShowHelpDialogAsync: '帮助', ShowShareWallpaperDialogAsync: '壁纸分享',
  ShowAboutWallpaperDialogAsync: '壁纸详情', ShowDeleteWallpaperDialogAsync: '删除壁纸', ShowReportWallpaperDialogAsync: '举报壁纸',
  ShowGalleryRestoreWallpaperDialogAsync: 'Gallery 壁纸恢复', ShowGalleryEditProfileDialogAsync: 'Gallery 资料编辑',
  ShowWaitDialogAsync: '等待', ShowWallpaperProjectDirectoryDialogAsync: '壁纸项目目录', ShowConfirmationDialogAsync: '确认',
  ShowCancellableProgressDialogAsync: '可取消进度',
};

function functionSummary(file, item) {
  const name = item.name;
  if (dialogLabels[name]) return `构造并异步显示${dialogLabels[name]}对话框，管理作用域、导航和返回结果。`;
  const specific = {
    NavigateTo: '把导航请求转发到当前 Frame，并更新页面状态。',
    Reload: '重新加载当前页面并保留导航上下文。',
    InternalNavigateTo: '执行实际 Frame 导航并维护当前页面引用。',
    DialogService: '注入本地化、导航和作用域工厂，准备统一对话框服务。',
    DiskCacheService: '初始化 HTTP 客户端、缓存目录和缓存有效期。',
    GetFileFromCacheAsync: '按 URL 哈希读取有效缓存，缺失时下载文件并写入磁盘。',
    RemoveExpired: '异步启动缓存过期清理。',
    InternalRemoveExpired: '扫描缓存目录并删除超过有效期的文件。',
    CreateHash64: '为 URL 计算稳定的 64 位哈希缓存键。',
    DispatcherService: '捕获当前线程的 DispatcherQueue 作为 UI 调度目标。',
    TryEnqueue: '尝试把回调排入 WinUI UI 线程队列。',
    FileService: '注入本地化服务以构建文件选择器显示名称与过滤器。',
    PickFileAsync: '显示文件选择器并返回符合扩展名条件的单个文件。',
    PickWallpaperFile: '使用壁纸类型过滤器选择可导入的媒体或壁纸包。',
    PickSaveFileAsync: '显示保存选择器并返回用户确认的目标文件。',
    PickFolderAsync: '显示文件夹选择器并返回所选目录路径。',
    OpenFolderAsync: '通过系统文件管理器打开目标目录或选中文件。',
    PickSingleFileUwp: '使用兼容 UWP/WinUI 的选择器选择单个文件。',
    PickMultipleFileUwp: '使用兼容 UWP/WinUI 的选择器选择多个文件。',
    GetWallpaperFilters: '根据支持的壁纸类型构建文件扩展名过滤器。',
    GetFilterNative: '把托管扩展名集合转换为原生文件对话框过滤器。',
    RequiresConversion: '根据输入扩展名与目标播放器判断媒体是否需要转码。',
    TryConvertAsync: '调用媒体转换流程生成兼容格式，并返回成功状态与输出路径。',
    ResourceService: '初始化 WinUI ResourceLoader 以读取当前文化资源。',
    GetString: '按资源键读取当前文化的本地化字符串。',
    SetCulture: '设置应用语言覆盖并重建资源加载器。',
    SetSystemDefaultCulture: '清除语言覆盖，恢复系统默认文化资源。',
  };
  return specific[name] || `处理 ${name} 对应的 WinUI 服务操作。`;
}

function functionTags(file, item) {
  const name = item.name;
  if (dialogLabels[name] || file.path.endsWith('DialogService.cs')) return ['对话框', '异步操作', 'winui', '依赖注入'];
  if (file.path.endsWith('DiskCacheService.cs')) return ['磁盘缓存', 'http', '异步操作', '过期清理'];
  if (file.path.endsWith('FileService.cs')) return ['文件选择器', '平台集成', 'winui', '异步操作'];
  if (file.path.endsWith('ResourceService.cs')) return ['本地化', 'resource-loader', '文化切换', 'winui'];
  if (file.path.endsWith('MediaFormatConverter.cs')) return ['媒体转换', '格式检测', '异步操作', 'service'];
  if (file.path.endsWith('DispatcherService.cs')) return ['ui-thread', 'dispatcher', 'winui', '事件调度'];
  return ['导航服务', '页面路由', 'winui', '状态管理'];
}

const result = buildBatch({
  batchIndex: 17,
  fileSummary,
  fileTags,
  fileLanguageNotes: fileNotes,
  classSummary,
  classTags,
  functionSummary,
  functionTags,
});

console.log(JSON.stringify(result, null, 2));
