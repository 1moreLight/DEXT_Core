import { buildBatch } from './ua-batch-builder-common.mjs';

const locales = new Map([
  ['fil-PH', '菲律宾语'], ['fr-FR', '法语'], ['ga-IE', '爱尔兰语'], ['gl-ES', '加利西亚语'],
  ['he-IL', '希伯来语'], ['hi-IN', '印地语'], ['hu-HU', '匈牙利语'], ['id-ID', '印度尼西亚语'],
  ['it-IT', '意大利语'], ['ja-JP', '日语'], ['kk-KZ', '哈萨克语'], ['ko-KR', '韩语'],
  ['lt-LT', '立陶宛语'], ['ms-MY', '马来语'], ['my-MM', '缅甸语'], ['nb-NO', '挪威博克马尔语'],
  ['nl-NL', '荷兰语'], ['pl-PL', '波兰语'], ['pt-BR', '葡萄牙语（巴西）'], ['pt-PT', '葡萄牙语（葡萄牙）'],
  ['ro-RO', '罗马尼亚语'], ['ru-RU', '俄语'], ['sk-SK', '斯洛伐克语'],
  ['sr-Cyrl', '塞尔维亚语（西里尔字母）'], ['sr-Latn', '塞尔维亚语（拉丁字母）'],
]);

function localeCode(file) {
  return file.path.match(/\/Strings\/([^/]+)\/Resources\.resw$/)?.[1];
}

const result = buildBatch({
  batchIndex: 18,
  fileSummary: (file) => {
    const code = localeCode(file);
    return `为 Lively WinUI 界面提供${locales.get(code) || code}本地化字符串，包含 384 个资源键，覆盖设置、壁纸库、Gallery、对话框和状态提示。`;
  },
  fileTags: (file) => ['本地化', '资源字典', '界面文案', localeCode(file).toLowerCase()],
  fileLanguageNotes: () => 'RESW 使用统一资源键和区域专属值接入 WinUI PRI 本地化管线。',
  classSummary: (file, item) => `封装 ${item.name} 的本地化资源结构。`,
  classTags: () => ['本地化', '资源字典', 'winui', '数据模型'],
  functionSummary: (file, item) => `处理 ${item.name} 对应的本地化资源操作。`,
  functionTags: () => ['本地化', '资源处理', 'winui', 'utility'],
});

console.log(JSON.stringify(result, null, 2));
