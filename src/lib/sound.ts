/**
 * 音效系统 — Web Audio API 合成，无外部文件，无版权风险。
 * 所有音效在浏览器端即时生成。iOS/Android/桌面全平台支持。
 */

import { safeStorage } from '@/lib/safeStorage';

let _ctx: AudioContext | null = null;
let _enabled: boolean = safeStorage.getItem('xiashan-sfx') !== '0';

function ctx(): AudioContext | null {
  if (!_enabled) return null;
  try {
    if (!_ctx) {
      _ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (_ctx.state === 'suspended') void _ctx.resume();
    return _ctx;
  } catch {
    return null;
  }
}

export function setSoundEnabled(on: boolean) {
  _enabled = on;
  safeStorage.setItem('xiashan-sfx', on ? '1' : '0');
}

export function isSoundEnabled(): boolean {
  return _enabled;
}

// 首次用户交互时自动解锁音频上下文（iOS Safari 要求）
if (typeof document !== 'undefined') {
  const unlock = () => { ctx(); };
  document.addEventListener('click', unlock, { once: true, passive: true });
  document.addEventListener('touchend', unlock, { once: true, passive: true });
}

// ─── 合成原语 ──────────────────────────────────────────────────────────────

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  freqEnd?: number;
  detune?: number;
}

function tone(freq: number, dur: number, t0: number, opts: ToneOpts = {}) {
  const c = ctx();
  if (!c) return;
  const { type = 'sine', gain = 0.32, attack = 0.008, freqEnd, detune = 0 } = opts;

  const osc = c.createOscillator();
  const g = c.createGain();
  osc.connect(g);
  g.connect(c.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  if (detune) osc.detune.setValueAtTime(detune, t0);

  g.gain.setValueAtTime(0.001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, t0: number, opts: { gain?: number; hpFreq?: number; lpFreq?: number } = {}) {
  const c = ctx();
  if (!c) return;
  const { gain = 0.18, hpFreq, lpFreq } = opts;

  const sz = Math.ceil(c.sampleRate * (dur + 0.05));
  const buf = c.createBuffer(1, sz, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < sz; i++) d[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  let node: AudioNode = src;
  if (hpFreq) {
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpFreq;
    node.connect(hp);
    node = hp;
  }
  if (lpFreq) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lpFreq;
    node.connect(lp);
    node = lp;
  }
  node.connect(g);
  g.connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// ─── 音效库 ───────────────────────────────────────────────────────────────
// 音符频率（Hz）参考：C5=523 D5=587 E5=659 G5=784 A5=880 C6=1047 E6=1319 G6=1568

const SOUNDS: Record<string, () => void> = {

  /* ── 核心玩法 ── */

  // 热点标记点击，弹窗打开
  'spot-open': () => {
    const c = ctx(); if (!c) return;
    tone(880, 0.12, c.currentTime, { gain: 0.22 });
  },

  // 打出与热点匹配的卡
  'card-hit': () => {
    const c = ctx(); if (!c) return;
    tone(659, 0.1, c.currentTime, { gain: 0.28 });
    tone(880, 0.14, c.currentTime + 0.07, { gain: 0.28 });
  },

  // 打出不匹配卡，或直接处理
  'card-miss': () => {
    const c = ctx(); if (!c) return;
    tone(392, 0.13, c.currentTime, { type: 'triangle', gain: 0.2, detune: -25 });
  },

  // 连携！同类型连续命中
  'combo': () => {
    const c = ctx(); if (!c) return;
    [523, 659, 784].forEach((f, i) =>
      tone(f, 0.12, c.currentTime + i * 0.07, { gain: 0.28 })
    );
  },

  // 冒险选项（危险热点）
  'risk': () => {
    const c = ctx(); if (!c) return;
    tone(220, 0.15, c.currentTime, { type: 'sawtooth', gain: 0.14 });
    tone(185, 0.22, c.currentTime + 0.06, { type: 'sawtooth', gain: 0.11 });
  },

  // 完成当前地点
  'location-done': () => {
    const c = ctx(); if (!c) return;
    [523, 659, 784].forEach((f, i) =>
      tone(f, 0.15, c.currentTime + i * 0.1, { gain: 0.27 })
    );
  },

  // 接下委托
  'commission-accept': () => {
    const c = ctx(); if (!c) return;
    tone(400, 0.28, c.currentTime, { freqEnd: 700, gain: 0.26 });
  },

  // 委托交付成功
  'commission-success': () => {
    const c = ctx(); if (!c) return;
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(f, 0.2, c.currentTime + i * 0.11, { gain: 0.3 })
    );
  },

  // 委托失败/今日失败
  'commission-fail': () => {
    const c = ctx(); if (!c) return;
    tone(440, 0.14, c.currentTime, { gain: 0.22 });
    tone(330, 0.22, c.currentTime + 0.13, { gain: 0.22 });
  },

  /* ── 委托剧场 ── */

  // 对白推进（极轻，近乎无感）
  'dialog-next': () => {
    const c = ctx(); if (!c) return;
    tone(1200, 0.04, c.currentTime, { gain: 0.09 });
  },

  // 信任值浮字 +X
  'trust-gain': () => {
    const c = ctx(); if (!c) return;
    tone(1047, 0.16, c.currentTime, { gain: 0.2 });
    tone(1319, 0.1, c.currentTime + 0.07, { gain: 0.16 });
  },

  // 挑战节点弹出
  'challenge-appear': () => {
    const c = ctx(); if (!c) return;
    tone(440, 0.14, c.currentTime, { gain: 0.24 });
    tone(466, 0.18, c.currentTime + 0.03, { gain: 0.2 });
  },

  /* ── 抽卡 ── */

  // 单张卡牌翻面
  'card-flip': () => {
    const c = ctx(); if (!c) return;
    noise(0.1, c.currentTime, { gain: 0.16, hpFreq: 3500 });
    tone(900, 0.1, c.currentTime + 0.04, { freqEnd: 1300, gain: 0.18 });
  },

  // 出货：R/SR 人物
  'gacha-char': () => {
    const c = ctx(); if (!c) return;
    tone(300, 0.07, c.currentTime, { gain: 0.28, type: 'triangle' });
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(f, 0.17, c.currentTime + 0.1 + i * 0.09, { gain: 0.28 })
    );
  },

  // 出货：SSR（大爆发）
  'gacha-ssr': () => {
    const c = ctx(); if (!c) return;
    tone(80, 0.28, c.currentTime, { gain: 0.35 });
    noise(0.15, c.currentTime, { gain: 0.22, lpFreq: 400 });
    [1047, 1319, 1568, 2093, 2637].forEach((f, i) =>
      tone(f, 0.1, c.currentTime + 0.18 + i * 0.08, { gain: 0.2 })
    );
  },

  // 抽卡蓄力：光束坠落的上升音（riser，约 1 秒）
  'gacha-riser': () => {
    const c = ctx(); if (!c) return;
    tone(180, 1.0, c.currentTime, { type: 'sawtooth', freqEnd: 1100, gain: 0.1 });
    tone(240, 1.0, c.currentTime, { type: 'triangle', freqEnd: 1400, gain: 0.12, detune: 8 });
    noise(1.0, c.currentTime, { gain: 0.06, hpFreq: 1200 });
  },

  // 抽卡冲击帧：光束砸地 / 卡牌落地的重击
  'gacha-impact': () => {
    const c = ctx(); if (!c) return;
    tone(70, 0.32, c.currentTime, { type: 'sine', freqEnd: 38, gain: 0.4 });
    noise(0.2, c.currentTime, { gain: 0.26, lpFreq: 500 });
    tone(420, 0.06, c.currentTime, { gain: 0.18 });
  },

  // 紫变金升变：碎裂 + 急速上行琶音
  'gacha-upgrade': () => {
    const c = ctx(); if (!c) return;
    noise(0.12, c.currentTime, { gain: 0.24, hpFreq: 2600 });
    [784, 1047, 1319, 1568, 2093].forEach((f, i) =>
      tone(f, 0.12, c.currentTime + 0.06 + i * 0.05, { gain: 0.24 })
    );
    tone(60, 0.25, c.currentTime + 0.05, { gain: 0.32, freqEnd: 40 });
  },

  // 卡牌砸入屏幕
  'card-slam': () => {
    const c = ctx(); if (!c) return;
    tone(130, 0.16, c.currentTime, { type: 'triangle', freqEnd: 60, gain: 0.3 });
    noise(0.1, c.currentTime, { gain: 0.18, hpFreq: 900 });
  },

  // 结算页星星逐颗钉入
  'star-pin': () => {
    const c = ctx(); if (!c) return;
    tone(1568, 0.09, c.currentTime, { gain: 0.2 });
    noise(0.05, c.currentTime, { gain: 0.08, hpFreq: 5000 });
  },

  // SSR 角色名逐字砸出
  'name-hit': () => {
    const c = ctx(); if (!c) return;
    tone(300, 0.07, c.currentTime, { type: 'triangle', freqEnd: 180, gain: 0.22 });
  },

  // 出货：道具/月光
  'gacha-item': () => {
    const c = ctx(); if (!c) return;
    tone(1319, 0.12, c.currentTime, { gain: 0.19 });
    tone(1047, 0.1, c.currentTime + 0.07, { gain: 0.15 });
  },

  /* ── 消消乐 ── */

  // 方块交换
  'swap': () => {
    const c = ctx(); if (!c) return;
    tone(600, 0.08, c.currentTime, { freqEnd: 420, gain: 0.18 });
  },

  // 消除（单次）
  'match': () => {
    const c = ctx(); if (!c) return;
    noise(0.09, c.currentTime, { gain: 0.2, hpFreq: 2200 });
    tone(784, 0.1, c.currentTime + 0.02, { gain: 0.22 });
  },

  // 消除连击（cascade depth ≥ 2）
  'match-combo': () => {
    const c = ctx(); if (!c) return;
    noise(0.09, c.currentTime, { gain: 0.26, hpFreq: 2800 });
    [784, 988, 1175].forEach((f, i) =>
      tone(f, 0.1, c.currentTime + i * 0.06, { gain: 0.26 })
    );
  },

  // 无解自动重排
  'reshuffle': () => {
    const c = ctx(); if (!c) return;
    tone(700, 0.28, c.currentTime, { freqEnd: 280, gain: 0.18 });
    noise(0.18, c.currentTime + 0.08, { gain: 0.1, lpFreq: 700 });
  },

  /* ── UI 通用 ── */

  // 轻量确认/接单按钮
  'btn-confirm': () => {
    const c = ctx(); if (!c) return;
    tone(600, 0.07, c.currentTime, { gain: 0.18 });
  },

  // 地点路线选择
  'route-select': () => {
    const c = ctx(); if (!c) return;
    tone(720, 0.1, c.currentTime, { gain: 0.17 });
  },

  // Tab 切换
  'tab-switch': () => {
    const c = ctx(); if (!c) return;
    tone(900, 0.05, c.currentTime, { gain: 0.13 });
  },

  // Toast 弹出
  'toast': () => {
    const c = ctx(); if (!c) return;
    tone(880, 0.11, c.currentTime, { gain: 0.17 });
  },

  // 关系阶段升级
  'stage-up': () => {
    const c = ctx(); if (!c) return;
    [392, 494, 587, 784].forEach((f, i) =>
      tone(f, 0.2, c.currentTime + i * 0.13, { gain: 0.26 })
    );
  },

  // 手机收到新通知
  'phone-notify': () => {
    const c = ctx(); if (!c) return;
    tone(1047, 0.09, c.currentTime, { gain: 0.21 });
    tone(1047, 0.09, c.currentTime + 0.15, { gain: 0.21 });
  },

  // 教学步骤推进
  'tutorial-next': () => {
    const c = ctx(); if (!c) return;
    tone(523, 0.17, c.currentTime, { gain: 0.2 });
  },

  // 每日奖励弹出
  'daily-reward': () => {
    const c = ctx(); if (!c) return;
    [523, 659, 784, 659, 1047].forEach((f, i) =>
      tone(f, 0.15, c.currentTime + i * 0.09, { gain: 0.27 })
    );
  },
};

// ─── 防连击：同一音效的最小间隔（ms） ────────────────────────────────────

const COOLDOWN: Partial<Record<string, number>> = {
  'star-pin': 60,
  'name-hit': 55,
  'card-slam': 80,
  'dialog-next': 80,
  'tab-switch': 100,
  'swap': 60,
  'match': 60,
  'match-combo': 120,
  'btn-confirm': 100,
  'spot-open': 150,
};

const _last: Record<string, number> = {};

export function playSound(id: string) {
  if (!_enabled) return;
  const now = Date.now();
  const min = COOLDOWN[id] ?? 50;
  if (now - (_last[id] ?? 0) < min) return;
  _last[id] = now;
  SOUNDS[id]?.();
}
