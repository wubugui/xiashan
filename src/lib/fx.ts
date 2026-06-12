/**
 * 演出特效工具 — 震动 / 震屏关键帧 / canvas-confetti 粒子预设。
 * 抽卡（GachaAnimation）与补给开箱（SupplyReveal）共用，保证特效语言一致。
 */
import confetti from 'canvas-confetti';

/* ─── 触觉反馈（按稀有度分级） ─── */
export const VIBE = {
  light: 20,
  mid: [40, 60] as number[],
  heavy: [60, 40, 120] as number[],
};

export function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* 不支持就算了 */ }
}

/* ─── 震屏关键帧（配 framer-motion animate 使用） ─── */
export function shakeKeyframes(mag: number) {
  return {
    x: [0, -mag, mag, -mag * 0.6, mag * 0.6, -mag * 0.25, 0],
    y: [0, mag * 0.4, -mag * 0.4, mag * 0.25, -mag * 0.25, 0, 0],
  };
}

/* ─── 稀有度配色（粒子/光束统一从这里取） ─── */
export const FX_COLORS: Record<'N' | 'R' | 'SR' | 'SSR', string[]> = {
  N: ['#cbd5e1', '#94a3b8', '#ffffff'],
  R: ['#93c5fd', '#3b82f6', '#dbeafe', '#ffffff'],
  SR: ['#d8b4fe', '#9333ea', '#f3e8ff', '#ffffff'],
  SSR: ['#fbbf24', '#f59e0b', '#fcd34d', '#fff7d6', '#ffffff'],
};

/* ─── 粒子预设 ─── */

/** 卡牌落点尘爆：在元素中心炸一小撮稀有度色粒子 */
export function dustAt(el: HTMLElement | null, rarity: 'N' | 'R' | 'SR' | 'SSR') {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const origin = {
    x: (r.left + r.width / 2) / window.innerWidth,
    y: (r.top + r.height / 2) / window.innerHeight,
  };
  confetti({
    particleCount: rarity === 'SSR' ? 46 : rarity === 'SR' ? 30 : 16,
    spread: 70,
    startVelocity: 24,
    gravity: 1.2,
    scalar: 0.7,
    ticks: 90,
    origin,
    colors: FX_COLORS[rarity],
  });
}

/** SR 紫色侧喷（约 1 秒） */
export function burstPurpleSides() {
  const end = Date.now() + 900;
  const frame = () => {
    confetti({ particleCount: 3, angle: 60, spread: 50, startVelocity: 42, origin: { x: 0, y: 0.65 }, colors: FX_COLORS.SR });
    confetti({ particleCount: 3, angle: 120, spread: 50, startVelocity: 42, origin: { x: 1, y: 0.65 }, colors: FX_COLORS.SR });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

/** SSR 金色大爆发：中央礼花 + 双侧礼炮持续 duration 毫秒 */
export function burstGoldCelebration(duration = 2600) {
  const end = Date.now() + duration;
  const frame = () => {
    confetti({ particleCount: 4, angle: 60, spread: 58, startVelocity: 48, origin: { x: 0, y: 0.7 }, colors: FX_COLORS.SSR });
    confetti({ particleCount: 4, angle: 120, spread: 58, startVelocity: 48, origin: { x: 1, y: 0.7 }, colors: FX_COLORS.SSR });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
  confetti({ particleCount: 110, spread: 110, startVelocity: 42, origin: { y: 0.45 }, colors: [...FX_COLORS.SSR, '#ef4444'] });
}

/** 金粒瀑布：从顶部缓落的金箔（SSR 结算页氛围） */
export function goldRain(duration = 1800) {
  const end = Date.now() + duration;
  const frame = () => {
    confetti({
      particleCount: 2,
      angle: 270,
      spread: 120,
      startVelocity: 8,
      gravity: 0.5,
      drift: Math.random() * 2 - 1,
      scalar: 0.8,
      ticks: 240,
      origin: { x: Math.random(), y: -0.05 },
      colors: FX_COLORS.SSR,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
