import type { CapacitorConfig } from '@capacitor/cli';

// ⚠️ appId（Android applicationId / 包名）上线后永不可更改。
//    参见 TapTap 发布规范：正式上线后请勿变更包名。
const config: CapacitorConfig = {
  appId: 'com.ershiwushi.bianliwu',
  appName: '二十五时便利屋',
  webDir: 'dist',
  android: {
    // 允许加载混合内容（部分视频/音频可能走 http），如全站 https 可改回 false
    allowMixedContent: true,
  },
};

export default config;
