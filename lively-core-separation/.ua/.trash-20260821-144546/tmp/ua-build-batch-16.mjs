import path from 'node:path';
import { buildBatch } from './ua-batch-builder-common.mjs';

const summaries = new Map([
  ['SliderValueChangedBehavior.cs', '为 WinUI Slider 提供可绑定的 Command 与 CommandParameter，把数值变化桥接到 MVVM 命令。'],
  ['TextBoxTextChangedBehavior.cs', '为 WinUI TextBox 提供可绑定命令，把文本变化和参数转发给 ViewModel。'],
  ['Directory.Build.props', '定义 WinUI 项目的目录级 MSBuild 默认属性，并把 IsMsixRelease 默认设为 false。'],
  ['ColorExtensions.cs', '在十六进制颜色字符串与 WinUI Color 之间进行双向转换。'],
  ['ContentDialogExtensions.cs', '扩展 WinUI ContentDialog，提供排队显示、可拖动显示以及两者组合的异步对话框流程。'],
  ['WindowExtensions.cs', '封装 WinUI 窗口句柄、图标、尺寸、深色模式、自定义标题栏拖动区域与 DPI 缩放操作。'],
  ['WindowsStoragePickersExtensions.cs', '为 Windows 文件与文件夹选择器设置宿主窗口句柄，使其能在桌面 WinUI 应用中正确显示。'],
  ['AudioVolumeGlyphConverter.cs', '把音量数值转换为对应的静音、低、中或高音量图标字形。'],
  ['BoolToBackButtonVisibilityConverter.cs', '把布尔状态转换为导航返回按钮的 Visibility，并支持反向转换。'],
  ['BoolToVisibilityConverter.cs', '把布尔值转换为 WinUI Visibility，支持通过参数控制反转逻辑。'],
  ['FloatToBoolConverter.cs', '在浮点值与布尔选择状态之间转换，用于绑定数值选项。'],
  ['HexStringToColorConverter.cs', '把十六进制颜色字符串转换为 WinUI Color，并支持反向序列化。'],
  ['ListViewSelectionModeStringToEnumConverter.cs', '在字符串配置与 ListViewSelectionMode 枚举之间转换。'],
  ['NullVisibilityConverter.cs', '依据绑定值是否为空返回 Visibility，并支持反向判断。'],
  ['StringToInfoBarSeverityConverter.cs', '把状态字符串映射为 WinUI InfoBarSeverity 枚举。'],
  ['StringToInfoBarSeverityIconConverter.cs', '把状态字符串映射为 InfoBar 对应的语义图标。'],
  ['StringTruncateConverter.cs', '按绑定参数截断过长字符串并添加省略标记。'],
  ['UriToBitmapImageConverter.cs', '把 URI 转换为可供 WinUI 图像控件使用的 BitmapImage。'],
  ['WallpaperTypeEnumToStringConverter.cs', '把壁纸类型枚举转换为本地化展示字符串，并支持必要的反向转换。'],
  ['ExplorerItemTemplateSelector.cs', '根据资源浏览项类型选择文件夹或文件数据模板。'],
  ['LivelyControlTemplateSelector.cs', '根据动态壁纸属性控件模型选择滑块、文本、颜色、复选框或下拉框模板。'],
  ['MicaCustomBackdrop.cs', '封装 WinUI MicaController 的创建、目标连接、主题同步与释放，提供自定义窗口背景。'],
  ['NavigationMenuItemTemplateSelector.cs', '根据主导航项或分隔项类型选择对应的菜单数据模板。'],
  ['Lively.UI.WinUI.csproj', '配置面向 net9.0-windows10.0.22621.0 的 WinUI WinExe，支持 x86、x64、ARM64，并引用 Windows App SDK、CommunityToolkit、WinUIEx、NLog 等组件。'],
  ['Nlog.config', '配置 NLog 控制台、滚动文件和调试器目标，分别记录 Info、Debug 与 Trace 级别日志。'],
]);

function fileSummary(file) { return summaries.get(path.posix.basename(file.path)); }

function fileTags(file) {
  const p = file.path;
  const base = path.posix.basename(p);
  if (p.includes('/Behaviors/')) return ['附加行为', '事件桥接', 'mvvm', 'winui'];
  if (base === 'Directory.Build.props') return ['configuration', 'msbuild', 'build-system', 'msix'];
  if (base === 'Lively.UI.WinUI.csproj') return ['configuration', 'build-system', 'winui', '.net'];
  if (base === 'Nlog.config') return ['configuration', 'logging', 'nlog', 'diagnostics'];
  if (p.includes('/Converters/')) return ['数据绑定', '值转换器', 'winui', 'mvvm'];
  if (base.includes('TemplateSelector')) return ['模板选择器', '数据模板', 'winui', 'mvvm'];
  if (base === 'MicaCustomBackdrop.cs') return ['窗口背景', 'mica', 'winui', '主题'];
  if (p.includes('/Extensions/')) return ['extension-method', 'winui', '平台集成', 'utility'];
  return ['winui', '界面帮助器', 'mvvm', '组件'];
}

function fileNotes(file) {
  const base = path.posix.basename(file.path);
  if (base === 'Lively.UI.WinUI.csproj') return '.NET 9 WinUI 项目使用 Windows App SDK 1.7，并针对 x86、x64 与 ARM64 构建。';
  if (base === 'Nlog.config') return 'NLog 通过不同最低级别把日志同时路由到控制台、按大小归档的文件和调试器。';
  if (file.path.includes('/Converters/')) return 'IValueConverter 把 ViewModel 数据转换为 XAML 控件可直接绑定的表示。';
  if (file.path.includes('/Behaviors/')) return 'AttachedProperty 将控件事件适配为 ICommand，保持 View 与 ViewModel 解耦。';
  return undefined;
}

function classSummary(file, item) {
  const name = item.name;
  if (name.endsWith('Behavior')) return `把 ${name.replace('Behavior', '')} 控件事件适配为可绑定命令。`;
  if (name.endsWith('Converter')) return `实现 ${name.replace('Converter', '')} 的 XAML 双向值转换。`;
  if (name.endsWith('Extensions')) return `汇集 ${name.replace('Extensions', '')} 相关的 WinUI 扩展方法。`;
  if (name.endsWith('TemplateSelector')) return `依据绑定项类型为 ${name.replace('TemplateSelector', '')} 选择 DataTemplate。`;
  if (name === 'MicaCustomBackdrop') return '管理 Mica 系统背景控制器、窗口目标和主题状态。';
  return `封装 ${name} 的 WinUI 界面辅助逻辑。`;
}

function classTags(file, item) {
  const name = item.name;
  if (name.endsWith('Behavior')) return ['附加行为', '事件桥接', 'mvvm', 'winui'];
  if (name.endsWith('Converter')) return ['数据绑定', '值转换器', 'winui', 'mvvm'];
  if (name.endsWith('Extensions')) return ['extension-method', 'winui', '平台集成', 'utility'];
  if (name.endsWith('TemplateSelector')) return ['模板选择器', '数据模板', 'winui', 'mvvm'];
  return ['窗口背景', 'mica', 'winui', '主题'];
}

function converterSummary(file, name) {
  const base = path.posix.basename(file.path, '.cs');
  const action = {
    AudioVolumeGlyphConverter: '音量数值与音量图标字形',
    BoolToBackButtonVisibilityConverter: '布尔状态与返回按钮可见性',
    BoolToVisibilityConverter: '布尔状态与控件可见性',
    FloatToBoolConverter: '浮点选项与布尔选择状态',
    HexStringToColorConverter: '十六进制字符串与 WinUI Color',
    ListViewSelectionModeStringToEnumConverter: '字符串与 ListViewSelectionMode 枚举',
    NullVisibilityConverter: '空值状态与控件可见性',
    StringToInfoBarSeverityConverter: '状态字符串与 InfoBarSeverity',
    StringToInfoBarSeverityIconConverter: '状态字符串与 InfoBar 语义图标',
    StringTruncateConverter: '原始字符串与截断后的展示文本',
    UriToBitmapImageConverter: 'URI 与 BitmapImage',
    WallpaperTypeEnumToStringConverter: '壁纸类型枚举与本地化名称',
  }[base] || '绑定源值与目标表示';
  return name === 'Convert' ? `把${action.split('与')[0]}转换为${action.split('与').slice(1).join('与')}。` : `尝试把目标表示反向转换为${action.split('与')[0]}。`;
}

function functionSummary(file, item) {
  const name = item.name;
  if (file.path.includes('/Converters/')) return converterSummary(file, name);
  const specific = {
    GetCommand: '读取控件关联的附加命令属性。',
    SetCommand: '设置控件关联的附加命令属性。',
    GetCommandParameter: '读取控件附加的命令参数。',
    SetCommandParameter: '设置控件附加的命令参数。',
    OnCommandChanged: '在附加 Command 变化时维护控件事件订阅。',
    Slider_ValueChanged: '把 Slider 当前数值和命令参数转发给绑定命令。',
    TextBox_TextChanged: '把 TextBox 当前文本和命令参数转发给绑定命令。',
    ToColor: '解析十六进制字符串并构造对应的 WinUI Color。',
    ToHex: '把 WinUI Color 序列化为带透明度的十六进制字符串。',
    ShowAsyncQueue: '把 ContentDialog 加入串行队列，避免多个对话框同时显示。',
    ShowAsyncDraggable: '显示允许通过标题区域拖动宿主窗口的 ContentDialog。',
    ShowAsyncQueueDraggable: '组合对话框排队与窗口拖动能力并异步返回结果。',
    SetIconEx: '通过窗口句柄为 WinUI 窗口设置应用图标。',
    SetWindowSizeEx: '结合 DPI 缩放把 WinUI 窗口调整到指定逻辑尺寸。',
    GetWindowHandleEx: '返回 WinUI 窗口对应的原生 HWND。',
    UseImmersiveDarkModeEx: '调用 DWM 属性切换窗口沉浸式深色模式。',
    SetDragRegionForCustomTitleBar: '计算并设置自定义标题栏可拖动区域。',
    GetScaleAdjustment: '根据窗口 DPI 返回像素与逻辑尺寸之间的缩放系数。',
    SetOwnerWindow: '用宿主 HWND 初始化 Windows Storage Picker 的所有者窗口。',
    SelectTemplateCore: '依据动态壁纸属性模型类型选择对应的 XAML DataTemplate。',
    MicaCustomBackdrop: '初始化 Mica 背景配置并准备窗口目标连接。',
    OnTargetConnected: '在背景连接到窗口时创建 MicaController、同步主题并注册状态变化。',
  };
  return specific[name] || `处理 ${name} 对应的 WinUI 绑定、窗口或事件逻辑。`;
}

function functionTags(file, item) {
  const name = item.name;
  if (file.path.includes('/Behaviors/')) return ['附加行为', '事件桥接', 'icommand', 'winui'];
  if (file.path.includes('/Converters/')) return ['数据绑定', '值转换器', 'winui', name === 'ConvertBack' ? '反向转换' : '格式转换'];
  if (file.path.includes('/Extensions/')) return ['extension-method', 'winui', '平台集成', 'utility'];
  if (name === 'SelectTemplateCore') return ['模板选择器', '数据模板', 'winui', 'mvvm'];
  return ['窗口背景', 'mica', 'winui', '主题同步'];
}

const result = buildBatch({
  batchIndex: 16,
  fileSummary,
  fileTags,
  fileLanguageNotes: fileNotes,
  classSummary,
  classTags,
  functionSummary,
  functionTags,
  addEdges: ({ batch, expectedPaths, edges, nodeId }) => {
    const project = batch.files.find((file) => file.path.endsWith('Lively.UI.WinUI.csproj'));
    const nlogPath = 'src/Lively/Lively.UI.WinUI/Nlog.config';
    if (project && expectedPaths.includes(nlogPath)) edges.push({ source: nodeId(project), target: `file:${nlogPath}`, type: 'depends_on', direction: 'forward', weight: 0.6 });
  },
});

console.log(JSON.stringify(result, null, 2));
