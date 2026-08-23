import path from 'node:path';
import { buildBatch } from './ua-batch-builder-common.mjs';

const locales = new Map([
  ['sv-SE', '瑞典语'], ['tr-TR', '土耳其语'], ['uk-UA', '乌克兰语'], ['vi-VN', '越南语'],
  ['zh-CN', '简体中文'], ['zh-Hant', '繁体中文'],
]);

const summaries = new Map([
  ['src/Lively/Lively.UI.WinUI/UserControls/ColorPickerButton.xaml', '定义带 Flyout 的颜色选择按钮，把当前颜色、取色器和 ColorPicker 组合为可复用控件。'],
  ['src/Lively/Lively.UI.WinUI/UserControls/ColorPickerButton.xaml.cs', '实现颜色选择按钮的依赖属性与屏幕取色器启动逻辑，并把取色结果同步回控件。'],
  ['src/Lively/Lively.UI.WinUI/UserControls/DisplaySelector.xaml', '定义多显示器选择控件的画布、屏幕矩形、选中效果与显示器信息文本。'],
  ['src/Lively/Lively.UI.WinUI/UserControls/DisplaySelector.xaml.cs', '根据显示器拓扑计算归一化画布布局，维护选择状态并响应依赖属性变化。'],
  ['src/Lively/Lively.UI.WinUI/UserControls/FolderDropdown.xaml', '定义文件夹下拉控件的文件列表、缩略图、删除按钮和文件选择入口。'],
  ['src/Lively/Lively.UI.WinUI/UserControls/FolderDropdown.xaml.cs', '管理文件夹下拉控件的依赖属性、文件模型、缩略图缓存、单项删除和多文件选择。'],
  ['src/Lively/Lively.UI.WinUI/UserControls/FolderView.xaml', '定义递归文件夹树视图，并通过模板选择器区分文件夹与文件条目。'],
  ['src/Lively/Lively.UI.WinUI/UserControls/FolderView.xaml.cs', '遍历目标目录构建 ExplorerItem 树，为 FolderView 提供递归文件数据。'],
  ['src/Lively/Lively.UI.WinUI/Views/LivelyProperty/EyeDropper.xaml', '定义屏幕取色器浮动窗口，以边框和文本预览当前像素颜色。'],
  ['src/Lively/Lively.UI.WinUI/Views/LivelyProperty/EyeDropper.xaml.cs', '跟踪鼠标位置、读取屏幕像素颜色、调整预览窗口位置和前景色，并返回最终选择。'],
  ['src/Lively/Lively.UI.WinUI/Views/LivelyProperty/LivelyPropertiesTray.xaml', '定义动态壁纸属性托盘窗口，并以 Frame 承载具体属性页面。'],
  ['src/Lively/Lively.UI.WinUI/Views/LivelyProperty/LivelyPropertiesTray.xaml.cs', '初始化属性托盘窗口、设置宿主内容并协调窗口生命周期。'],
  ['src/Lively/Lively.UI.WinUI/Views/LivelyProperty/LivelyPropertiesView.xaml', '定义动态壁纸属性编辑页面，为滑块、文本、颜色、复选框、下拉框和按钮提供数据模板。'],
  ['src/Lively/Lively.UI.WinUI/Views/LivelyProperty/LivelyPropertiesView.xaml.cs', '初始化动态壁纸属性页面并连接共享 CustomiseWallpaperViewModel。'],
  ['src/Lively/Lively.UI.WinUI/Views/MainWindow.xaml', '定义 Lively WinUI 主窗口的自定义标题栏、导航视图、搜索框、背景图和主要页面内容。'],
  ['src/Lively/Lively.UI.WinUI/Views/MainWindow.xaml.cs', '实现应用主窗口，负责标题栏与窗口状态、导航、搜索、父进程消息监听和关闭清理。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/AboutView.xaml', '定义关于页面，展示应用信息、贡献者、项目链接、许可证及相关操作。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/AboutView.xaml.cs', '初始化关于页面并连接 AboutViewModel 与页面资源。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/AddWallpaperCreateView.xaml', '定义创建壁纸页面的项目类型列表、说明、预览图与继续操作布局。'],
]);

function localeCode(file) { return file.path.match(/\/Strings\/([^/]+)\/Resources\.resw$/)?.[1]; }
function fileSummary(file) {
  const code = localeCode(file);
  if (code) return `为 Lively WinUI 界面提供${locales.get(code) || code}本地化字符串，包含 384 个资源键，覆盖设置、壁纸库、Gallery、对话框和状态提示。`;
  return summaries.get(file.path);
}

function fileTags(file) {
  const p = file.path;
  const code = localeCode(file);
  if (code) return ['本地化', '资源字典', '界面文案', code.toLowerCase()];
  if (p.endsWith('.xaml')) return ['xaml', p.includes('/UserControls/') ? '用户控件' : '界面布局', '数据绑定', 'winui'];
  if (p.includes('/UserControls/')) return ['用户控件', '依赖属性', '事件处理', 'winui'];
  if (p.includes('/LivelyProperty/')) return ['壁纸属性', '窗口交互', '数据绑定', 'winui'];
  if (p.endsWith('MainWindow.xaml.cs')) return ['主窗口', '导航', '搜索', 'winui'];
  return ['页面组件', 'mvvm', '数据绑定', 'winui'];
}

function fileNotes(file) {
  const code = localeCode(file);
  if (code) return 'RESW 使用统一资源键和区域专属值接入 WinUI PRI 本地化管线。';
  if (file.path.endsWith('.xaml')) return 'XAML 通过 x:Class 与同名 code-behind 配对，并使用 Binding 或 x:Bind 连接状态与命令。';
  if (file.path.endsWith('MainWindow.xaml.cs')) return 'WinUIEx 窗口与自定义标题栏、NavigationView 及标准输入 IPC 共同构成主窗口外壳。';
  return undefined;
}

function classSummary(file, item) {
  const name = item.name;
  const map = {
    ColorPickerButton: '管理颜色选择依赖属性、Flyout 与屏幕取色交互。',
    DisplaySelector: '把显示器拓扑转换为可交互的归一化屏幕布局。',
    FolderDropdown: '管理文件列表、选择、删除和缩略图缓存的复合控件。',
    FolderView: '遍历目录并向树控件提供递归 ExplorerItem 数据。',
    EyeDropper: '读取屏幕像素并提供跟随鼠标的颜色预览与选择窗口。',
    LivelyPropertiesTray: '承载动态壁纸属性页面的独立托盘窗口。',
    LivelyPropertiesView: '承载动态壁纸属性模板和编辑 ViewModel 的页面。',
    MainWindow: '协调主窗口标题栏、导航、搜索、IPC 和关闭生命周期。',
    AboutView: '承载关于页面布局和 AboutViewModel。',
  };
  return map[name] || `封装 ${name} 的 WinUI 视图交互。`;
}

function classTags(file, item) {
  const name = item.name;
  if (file.path.includes('/UserControls/')) return ['用户控件', '依赖属性', '事件处理', 'winui'];
  if (name === 'MainWindow') return ['主窗口', '导航', '搜索', 'winui'];
  if (file.path.includes('/LivelyProperty/')) return ['壁纸属性', '窗口交互', '数据绑定', 'winui'];
  return ['页面组件', 'mvvm', '数据绑定', 'winui'];
}

function functionSummary(file, item) {
  const name = item.name;
  const specific = {
    ColorPickerButton: '初始化颜色选择控件并连接 Flyout、ColorPicker 与取色器。',
    OpenEyeDropper: '打开屏幕取色器并把用户选定颜色写回控件。',
    OnDependencyPropertyChanged: '在显示器数据或选择依赖属性变化时刷新布局。',
    DisplaySelector: '初始化显示器选择控件并准备画布绘制。',
    UpdateCanvas: '根据显示器坐标与缩放比例重建屏幕矩形和标签。',
    OnRequiredDependencyPropertyChanged: '在文件夹、过滤器或必需属性变化时重新初始化控件。',
    OnSelectedFilePropertyChanged: '在选中文件变化时同步列表选择和预览。',
    FolderDropdown: '初始化文件夹下拉控件、依赖属性与事件。',
    InitializeControl: '读取目标目录并构建可选文件模型与缩略图。',
    Delete_Button_Click: '删除选中文件条目并清理对应缩略图缓存。',
    OpenFile: '使用系统服务打开或定位当前文件。',
    Flyout_Opened: '在下拉面板打开时刷新文件和选择状态。',
    OpenMultipleFilePicker: '打开多文件选择器并把选定文件加入目标目录。',
    CreateModel: '根据文件路径创建带名称、路径和缩略图的控件模型。',
    GetThumbnailTempCache: '为文件生成或读取临时缩略图缓存。',
    DeleteThumbnailTempCache: '删除控件生成的临时缩略图文件。',
    FolderView: '初始化目录树控件并加载根节点数据。',
    GetDataFromFolder: '读取指定目录并构建第一层文件和文件夹节点。',
    TraverseFolder: '递归遍历子目录并填充 ExplorerItem 树。',
    EyeDropper: '初始化屏幕取色窗口、鼠标跟踪和完成结果。',
    SetPreviewColor: '更新取色预览背景、文本和当前颜色值。',
    SetPosAndForeground: '根据鼠标位置移动窗口，并按背景亮度选择可读前景色。',
    GetColorAt: '从屏幕设备上下文读取指定坐标的像素颜色。',
    LivelyPropertiesTray: '初始化属性托盘窗口并导航到属性编辑页面。',
    LivelyPropertiesView: '初始化属性编辑页面并连接当前 ViewModel。',
    MainWindow: '初始化主窗口、服务、导航、标题栏、搜索与消息监听。',
    Window_Closed: '在主窗口关闭时释放订阅并触发应用安全退出。',
    StdInListener: '持续读取父进程消息并处理窗口或应用控制命令。',
    AppTitleBar_Loaded: '在标题栏加载后设置拖动区域和窗口标题栏属性。',
    AppTitleBar_SizeChanged: '在标题栏尺寸变化时重新计算可拖动区域。',
    AutoSuggestBox_TextChanged: '根据用户输入更新壁纸搜索建议和筛选状态。',
    Search: '应用搜索文本过滤壁纸库并同步导航页面。',
    AboutView: '初始化关于页面并绑定 AboutViewModel。',
  };
  return specific[name] || `处理 ${name} 对应的 WinUI 视图事件或状态更新。`;
}

function functionTags(file, item) {
  if (file.path.includes('/UserControls/')) return ['用户控件', '事件处理', '依赖属性', 'winui'];
  if (file.path.includes('/LivelyProperty/')) return ['壁纸属性', '窗口交互', '事件处理', 'winui'];
  if (file.path.endsWith('MainWindow.xaml.cs')) return ['主窗口', '导航', '搜索', '事件处理'];
  return ['页面组件', 'mvvm', '数据绑定', 'winui'];
}

const result = buildBatch({
  batchIndex: 19,
  fileSummary,
  fileTags,
  fileLanguageNotes: fileNotes,
  classSummary,
  classTags,
  functionSummary,
  functionTags,
  addEdges: ({ batch, expectedPaths, edges, nodeId }) => {
    const pairs = [
      'src/Lively/Lively.UI.WinUI/UserControls/ColorPickerButton.xaml',
      'src/Lively/Lively.UI.WinUI/UserControls/DisplaySelector.xaml',
      'src/Lively/Lively.UI.WinUI/UserControls/FolderDropdown.xaml',
      // FolderView pair straddles the mandated split boundary, so no cross-part edge is emitted.
      'src/Lively/Lively.UI.WinUI/Views/LivelyProperty/EyeDropper.xaml',
      'src/Lively/Lively.UI.WinUI/Views/LivelyProperty/LivelyPropertiesTray.xaml',
      'src/Lively/Lively.UI.WinUI/Views/LivelyProperty/LivelyPropertiesView.xaml',
      'src/Lively/Lively.UI.WinUI/Views/MainWindow.xaml',
      'src/Lively/Lively.UI.WinUI/Views/Pages/AboutView.xaml',
    ];
    for (const xamlPath of pairs) {
      const source = batch.files.find((file) => file.path === xamlPath);
      const target = `${xamlPath}.cs`;
      if (source && expectedPaths.includes(target)) edges.push({ source: nodeId(source), target: `file:${target}`, type: 'depends_on', direction: 'forward', weight: 0.6 });
    }
  },
});

console.log(JSON.stringify(result, null, 2));
