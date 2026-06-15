/**
 * 全局静音 —— 浏览器级别禁声，而非逐个关游戏功能。
 * 原理：劫持 HTMLMediaElement.prototype.play，静音时强制 muted=true，
 * 覆盖所有 <video>/<audio> 与 new Audio()（开场视频、BGM、角色配音等）。
 * Web Audio 合成音效另由 sound.ts 的 setSoundEnabled 关闭。
 */
import { safeStorage } from '@/lib/safeStorage';

const MUTE_KEY = 'xiashan-muted';

let muted = safeStorage.getItem(MUTE_KEY) === '1';
let patched = false;

function applyToAllMedia() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('audio, video').forEach((el) => {
    try {
      (el as HTMLMediaElement).muted = muted;
    } catch {
      /* ignore */
    }
  });
}

function patchPlayOnce() {
  if (patched || typeof HTMLMediaElement === 'undefined') return;
  patched = true;
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement, ...args: unknown[]) {
    if (muted) {
      try { this.muted = true; } catch { /* ignore */ }
    }
    return origPlay.apply(this, args as []);
  };
}

export function setGlobalMute(on: boolean): void {
  muted = on;
  safeStorage.setItem(MUTE_KEY, on ? '1' : '0');
  patchPlayOnce();
  applyToAllMedia();
}

export function isGlobalMuted(): boolean {
  return muted;
}

// 模块加载即安装劫持，保证开场视频/BGM 播放前已生效
if (typeof document !== 'undefined') {
  patchPlayOnce();
  if (muted) applyToAllMedia();
}
