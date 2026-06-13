import { assetUrl } from '@/lib/assets';
import { safeStorage } from '@/lib/safeStorage';

const MUSIC_KEY = 'xiashan-bgm';
const BGM_VOLUME = 0.16;
const BGM_SRC = assetUrl('/audio/bgm.mp3') ?? '/audio/bgm.mp3';

type Listener = () => void;

const listeners = new Set<Listener>();
const pauseReasons = new Set<string>();

let audio: HTMLAudioElement | null = null;
let enabled = safeStorage.getItem(MUSIC_KEY) !== '0';

function ensureAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio(BGM_SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = BGM_VOLUME;
  }
  return audio;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function shouldPlay() {
  return enabled && pauseReasons.size === 0;
}

function playIfAllowed() {
  if (!shouldPlay()) return;
  const player = ensureAudio();
  player?.play().catch(() => {
    // 移动端浏览器会等到下一次用户手势再允许播放。
  });
}

export function subscribeBackgroundMusic(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBackgroundMusicState() {
  return {
    enabled,
    pausedBySystem: pauseReasons.size > 0,
  };
}

export function setBackgroundMusicEnabled(on: boolean) {
  enabled = on;
  safeStorage.setItem(MUSIC_KEY, on ? '1' : '0');

  if (on) {
    playIfAllowed();
  } else {
    audio?.pause();
  }
  emit();
}

export function toggleBackgroundMusic() {
  setBackgroundMusicEnabled(!enabled);
}

export function pauseBackgroundMusic(reason: string) {
  pauseReasons.add(reason);
  audio?.pause();
  emit();
}

export function resumeBackgroundMusic(reason: string) {
  pauseReasons.delete(reason);
  playIfAllowed();
  emit();
}

export function primeBackgroundMusic() {
  playIfAllowed();
}

if (typeof document !== 'undefined') {
  const unlock = () => primeBackgroundMusic();
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('touchend', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
}
