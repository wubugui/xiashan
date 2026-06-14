/**
 * 她当前的微信签名。设计哲学：真实的人有自己的生活轨迹——
 * 大部分时候签名是她过自己的日子(life 池，按日轮换、与游戏无关)，
 * 感情只在平常里「突然冒一下」才珍贵：暧昧期偶尔泄露心事、恋人期偶尔甜、
 * 头像博弈事件即时覆盖。纯函数，不读 store。
 */
import type { Character } from '@/data/types';
import { signaturesOf } from '@/engine/waifeStateAccess';

export interface SignatureCtx {
  /** 已确认心意（她是恋人） */
  isLover?: boolean;
  /** 玩家把自己头像设成了谁：'chosen'=她本人 / 'jealous'=别人 / null */
  avatarMood?: 'chosen' | 'jealous' | null;
  /** 当前好感：决定暧昧泄露 */
  affinity?: number;
  /** 当天种子(YYYY-MM-DD)：签名按日稳定、跨日轮换 */
  daySeed?: string;
}

/** 暧昧期心事「泄露」的最低好感 */
const FEELING_MIN_AFFINITY = 45;
/** 暧昧期某天泄露心事的概率（大部分日子还是过自己的生活） */
const FEELING_LEAK_CHANCE = 0.35;
/** 恋人期某天露出恋人签名的概率（其余日子也过自己的生活） */
const LOVER_SHOW_CHANCE = 0.7;

/** 字符串 → [0,1) 稳定哈希（同一天同一角色同一用途结果固定） */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
function pickBy(pool: string[] | undefined, seed: string): string | undefined {
  if (!pool || pool.length === 0) return undefined;
  return pool[Math.floor(hash01(seed) * pool.length) % pool.length];
}

export function signatureFor(character: Character, ctx: SignatureCtx = {}): string {
  const s = signaturesOf(character.id);
  const seed = (ctx.daySeed ?? '') + character.id;

  // 事件即时覆盖（最扎眼、玩家最在意的"突变"）
  if (ctx.avatarMood === 'chosen') { const v = pickBy(s.chosen, seed + 'chosen'); if (v) return v; }
  if (ctx.avatarMood === 'jealous') { const v = pickBy(s.jealous, seed + 'jealous'); if (v) return v; }

  // 新模型：有生活池 = 以她自己的日子为底色，感情偶尔在平常里冒头
  if (s.life && s.life.length) {
    if (ctx.isLover && s.lover?.length && hash01(seed + 'lover') < LOVER_SHOW_CHANCE) {
      return pickBy(s.lover, seed + 'loverpick')!;
    }
    if (!ctx.isLover && (ctx.affinity ?? 0) >= FEELING_MIN_AFFINITY && s.feeling?.length && hash01(seed + 'feel') < FEELING_LEAK_CHANCE) {
      return pickBy(s.feeling, seed + 'feelpick')!;
    }
    return pickBy(s.life, seed + 'life')!;
  }

  // 旧模型（未迁配置的角色）：单句状态签名
  if (ctx.isLover && s.lover?.[0]) return s.lover[0];
  const aff = ctx.affinity ?? 0;
  if (aff >= 60 && s.close?.[0]) return s.close[0];
  if (aff < 20 && s.distant?.[0]) return s.distant[0];
  return character.phonePersonality.signature ?? '';
}
