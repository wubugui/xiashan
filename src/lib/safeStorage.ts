/**
 * localStorage 的安全包装。
 * 在禁用 storage 的环境（无痕/隐私模式、iOS「阻止所有 Cookie」、部分内嵌 WebView）里，
 * 访问 window.localStorage 本身就会抛 SecurityError；旧版 Safari 无痕模式则是 setItem 抛错。
 * 这里统一降级为内存存储：游戏照常可玩，只是本次会话的进度不持久化。
 */
const memory = new Map<string, string>();

function detectNative(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__xiashan_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const native = detectNative();

export const storageAvailable = native !== null;

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (native) return native.getItem(key);
    } catch {
      // fall through to memory
    }
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    try {
      if (native) {
        native.setItem(key, value);
        return;
      }
    } catch {
      // fall through to memory
    }
    memory.set(key, value);
  },
  removeItem(key: string): void {
    try {
      native?.removeItem(key);
    } catch {
      // ignore
    }
    memory.delete(key);
  },
};
