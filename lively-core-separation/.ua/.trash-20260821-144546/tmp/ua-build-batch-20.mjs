import path from 'node:path';
import { buildBatch } from './ua-batch-builder-common.mjs';

const summaries = new Map([
  ['src/Lively/Lively.UI.WinUI/Views/Pages/AddWallpaperCreateView.xaml.cs', '初始化创建壁纸项目页面，并连接 AddWallpaperCreateViewModel 与页面资源。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/AddWallpaperDataView.xaml', '定义壁纸元数据录入表单，包含标题、描述、作者和联系方式字段。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/AddWallpaperDataView.xaml.cs', '初始化壁纸元数据页面，并连接 AddWallpaperDataViewModel。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/AddWallpaperView.xaml', '定义添加壁纸入口页面，提供网页链接、文件导入、项目创建和拖放区域。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/AddWallpaperView.xaml.cs', '初始化添加壁纸页面，并把文件拖放数据转交给 AddWallpaperViewModel 导入。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/AppThemeView.xaml', '定义应用主题设置页面，提供主题选择、背景、预览和主题文件操作。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/AppThemeView.xaml.cs', '初始化主题设置页面，并连接 AppThemeViewModel。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/AppUpdateView.xaml', '定义应用更新页面，展示更新状态、版本信息、下载进度、操作按钮和 WebView2 发布说明。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/AppUpdateView.xaml.cs', '管理更新页面的 WebView2 初始化、加载进度与外部链接拦截，并连接 AppUpdateViewModel。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/ChooseDisplayView.xaml', '以 DisplaySelector 呈现显示器布局和选择状态，供壁纸操作选择目标屏幕。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/ChooseDisplayView.xaml.cs', '初始化显示器选择页面，并连接 ChooseDisplayViewModel。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/ControlPanel/ControlPanelView.xaml', '定义控制面板导航外壳，以 NavigationView 和 Frame 承载壁纸或屏保布局页面。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/ControlPanel/ControlPanelView.xaml.cs', '初始化控制面板页面，并连接 ControlPanelViewModel 与内部导航 Frame。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/ControlPanel/ScreensaverLayoutView.xaml', '定义多显示器屏保布局页面，提供布局模式、屏幕选择、添加移除与相关系统设置。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/ControlPanel/ScreensaverLayoutView.xaml.cs', '初始化屏保布局页面，并连接 ScreensaverLayoutViewModel。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/ControlPanel/WallpaperLayoutCustomiseView.xaml', '定义壁纸布局定制容器，以 Frame 承载具体的壁纸属性页面。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/ControlPanel/WallpaperLayoutCustomiseView.xaml.cs', '初始化壁纸布局定制容器，并连接内容导航。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/ControlPanel/WallpaperLayoutView.xaml', '定义多显示器壁纸布局页面，提供排列模式、显示器选择、关闭与定制操作。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/ControlPanel/WallpaperLayoutView.xaml.cs', '初始化壁纸布局页面，并连接 WallpaperLayoutViewModel。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/DepthEstimateWallpaperView.xaml', '定义深度估计壁纸创建页面，包含输入预览、模型下载进度、动画背景与运行状态。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/DepthEstimateWallpaperView.xaml.cs', '初始化深度估计页面，并连接 DepthEstimateWallpaperViewModel。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/Gallery/GalleryFeaturedView.xaml', '定义 Gallery 精选页的页面容器，为在线精选内容保留展示区域。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/Gallery/GalleryFeaturedView.xaml.cs', '初始化 Gallery 精选页面并连接相应导航上下文。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/Gallery/GalleryLibraryView.xaml', '定义 Gallery 壁纸库页面，包含网格列表、进入退出动画、加载状态、空结果提示和更多内容反馈。'],
  ['src/Lively/Lively.UI.WinUI/Views/Pages/Gallery/GalleryLibraryView.xaml.cs', '初始化 Gallery 库页面，并在滚动接近末尾时触发增量加载。'],
]);

function fileSummary(file) { return summaries.get(file.path); }

function fileTags(file) {
  const p = file.path;
  const base = path.posix.basename(p);
  if (p.endsWith('.xaml')) return ['xaml', '界面布局', '数据绑定', 'winui'];
  if (p.includes('/ControlPanel/')) return ['页面组件', '控制面板', '多显示器', 'winui'];
  if (p.includes('/Gallery/')) return ['页面组件', 'gallery', '增量加载', 'winui'];
  if (base.startsWith('AppUpdate')) return ['页面组件', '应用更新', 'webview2', 'winui'];
  if (base.startsWith('AddWallpaper')) return ['页面组件', '壁纸导入', 'mvvm', 'winui'];
  if (base.startsWith('DepthEstimate')) return ['页面组件', '深度估计', '壁纸生成', 'winui'];
  return ['页面组件', 'mvvm', '数据绑定', 'winui'];
}

function fileNotes(file) {
  if (file.path.endsWith('.xaml')) return 'XAML 通过 x:Class 与同名 code-behind 配对，并以 Binding 或 x:Bind 连接共享 ViewModel。';
  if (file.path.endsWith('AppUpdateView.xaml.cs')) return '页面使用 WebView2 异步初始化发布说明，同时拦截新窗口请求交由外部浏览器处理。';
  return undefined;
}

function classSummary(file, item) {
  const name = item.name;
  const label = {
    AddWallpaperCreateView: '创建壁纸项目', AddWallpaperDataView: '壁纸元数据录入', AddWallpaperView: '添加壁纸',
    AppThemeView: '应用主题设置', AppUpdateView: '应用更新', ChooseDisplayView: '显示器选择',
    ControlPanelView: '控制面板导航', ScreensaverLayoutView: '屏保布局', WallpaperLayoutCustomiseView: '壁纸布局定制',
    WallpaperLayoutView: '壁纸布局', DepthEstimateWallpaperView: '深度估计壁纸', GalleryFeaturedView: 'Gallery 精选',
    GalleryLibraryView: 'Gallery 壁纸库',
  }[name] || name;
  return `承载${label}页面并连接相应 ViewModel、资源与界面事件。`;
}

function classTags(file, item) {
  if (file.path.includes('/ControlPanel/')) return ['页面组件', '控制面板', '多显示器', 'winui'];
  if (file.path.includes('/Gallery/')) return ['页面组件', 'gallery', '增量加载', 'winui'];
  if (item.name === 'AppUpdateView') return ['页面组件', '应用更新', 'webview2', 'winui'];
  return ['页面组件', 'mvvm', '数据绑定', 'winui'];
}

function functionSummary(file, item) {
  const name = item.name;
  const constructors = {
    AddWallpaperCreateView: '初始化创建壁纸项目页面并绑定 AddWallpaperCreateViewModel。',
    AddWallpaperDataView: '初始化壁纸元数据录入页面并绑定 AddWallpaperDataViewModel。',
    AddWallpaperView: '初始化添加壁纸页面、拖放区域和 AddWallpaperViewModel。',
    AppThemeView: '初始化主题设置页面并绑定 AppThemeViewModel。',
    AppUpdateView: '初始化更新页面、AppUpdateViewModel 与 WebView2 加载状态。',
    ChooseDisplayView: '初始化显示器选择页面并绑定 ChooseDisplayViewModel。',
    ControlPanelView: '初始化控制面板导航外壳并绑定 ControlPanelViewModel。',
    ScreensaverLayoutView: '初始化屏保布局页面并绑定 ScreensaverLayoutViewModel。',
    WallpaperLayoutCustomiseView: '初始化壁纸布局定制容器与内部 Frame。',
    WallpaperLayoutView: '初始化壁纸布局页面并绑定 WallpaperLayoutViewModel。',
    DepthEstimateWallpaperView: '初始化深度估计壁纸页面并绑定对应 ViewModel。',
    GalleryFeaturedView: '初始化 Gallery 精选页面。',
    GalleryLibraryView: '初始化 Gallery 壁纸库、动画与增量数据源。',
  };
  if (constructors[name]) return constructors[name];
  const specific = {
    Page_Drop: '读取拖放中的文件项，并把可导入路径交给 AddWallpaperViewModel 批量处理。',
    InitializeWebView2Async: '创建 WebView2 环境、配置浏览器设置并导航到更新发布说明。',
    WebView_CoreWebView2Initialized: '在 WebView2 初始化完成后注册导航和新窗口事件。',
    CoreWebView2_NewWindowRequested: '拦截发布说明中的新窗口链接并交由系统浏览器打开。',
    ScrollViewer_ViewChanged: '监控 Gallery 列表滚动位置，在接近末尾时请求下一页数据。',
  };
  return specific[name] || `处理 ${name} 对应的页面交互或生命周期。`;
}

function functionTags(file, item) {
  const name = item.name;
  if (file.path.includes('/Gallery/')) return ['gallery', '增量加载', '事件处理', 'winui'];
  if (file.path.endsWith('AppUpdateView.xaml.cs')) return ['应用更新', 'webview2', '异步操作', 'winui'];
  if (name === 'Page_Drop') return ['拖放导入', '壁纸导入', '事件处理', 'winui'];
  if (file.path.includes('/ControlPanel/')) return ['控制面板', '多显示器', 'mvvm', 'winui'];
  return ['页面初始化', 'mvvm', '数据绑定', 'winui'];
}

const result = buildBatch({
  batchIndex: 20,
  fileSummary,
  fileTags,
  fileLanguageNotes: fileNotes,
  classSummary,
  classTags,
  functionSummary,
  functionTags,
  addEdges: ({ batch, expectedPaths, edges, nodeId }) => {
    for (const source of batch.files.filter((file) => file.path.endsWith('.xaml'))) {
      const target = `${source.path}.cs`;
      if (expectedPaths.includes(target)) edges.push({ source: nodeId(source), target: `file:${target}`, type: 'depends_on', direction: 'forward', weight: 0.6 });
    }
  },
});

console.log(JSON.stringify(result, null, 2));
