export interface PromptAnalysis {
  framework: string;
  features: string[];
  components: string[];
}

const FEATURE_RULES: Array<[RegExp, string]> = [
  [/auth|login|sign.?in|登录|注册/i, 'authentication'],
  [/dashboard|analytics|指标|数据面板/i, 'dashboard and analytics'],
  [/search|filter|搜索|筛选/i, 'search and filtering'],
  [/upload|file|上传|文件/i, 'file upload'],
  [/chat|message|聊天|对话/i, 'chat and messaging'],
  [/payment|checkout|billing|支付|订阅/i, 'payments and billing'],
  [/notification|alert|通知/i, 'notifications'],
  [/real.?time|websocket|实时/i, 'real-time updates'],
  [/responsive|mobile|移动端|响应式/i, 'responsive layout'],
  [/drag.?and.?drop|拖拽/i, 'drag and drop'],
];

const COMPONENT_RULES: Array<[RegExp, string]> = [
  [/nav|sidebar|导航/i, 'Navigation'],
  [/form|login|注册|表单/i, 'Form'],
  [/table|列表|数据表/i, 'DataTable'],
  [/chart|graph|图表/i, 'Chart'],
  [/modal|dialog|弹窗/i, 'Dialog'],
  [/card|卡片/i, 'Card'],
  [/search|搜索/i, 'SearchInput'],
  [/upload|上传/i, 'FileUpload'],
  [/chat|聊天/i, 'ChatPanel'],
];

export class PromptAnalyzer {
  analyze(prompt: string): PromptAnalysis {
    const input = prompt.trim();
    if (!input) throw new Error('Prompt must not be empty');

    const framework = /vue/i.test(input) ? 'vue'
      : /svelte/i.test(input) ? 'svelte'
      : /next\.js|nextjs/i.test(input) ? 'next'
      : /html|vanilla js|原生网页/i.test(input) ? 'html'
      : 'react';

    const features = FEATURE_RULES
      .filter(([pattern]) => pattern.test(input))
      .map(([, feature]) => feature);
    if (!features.length) features.push('core user interface');

    const components = COMPONENT_RULES
      .filter(([pattern]) => pattern.test(input))
      .map(([, component]) => component);

    return { framework, features: [...new Set(features)], components: [...new Set(components)] };
  }
}
