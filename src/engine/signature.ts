/**
 * 她当前的微信签名。设计哲学：真实的人有自己的生活轨迹——
 * 大部分时候签名是她过自己的日子(life 池，按日轮换、与游戏无关)，
 * 感情只在平常里「突然冒一下」才珍贵：暧昧期偶尔泄露心事、恋人期偶尔甜、
 * 头像博弈事件即时覆盖。
 *
 * 为了让签名不沦为背景噪音、勾着玩家回来看：signatureDetail 同时给出「种类」，
 * 调用方据此对「特别签名」(非日常)做不动声色的"有变化"暗示。纯函数，不读 store。
 */
import type { Character } from '@/data/types';
import type { TimeBucket } from '@/data/waife';
import { signaturesOf } from '@/engine/waifeStateAccess';

/** 真实时钟 → 时段（让签名跟着她的作息走） */
export function timeBucket(hour: number): TimeBucket {
  if (hour >= 5 && hour <= 8) return '清晨';
  if (hour >= 9 && hour <= 11) return '上午';
  if (hour >= 12 && hour <= 17) return '午后';
  if (hour >= 18 && hour <= 22) return '夜晚';
  return '深夜';
}

/** 把 life（扁平或分时段）解析成当前时段可用的句池 */
function resolveLife(life: SignaturePoolsLife, hour: number | undefined): string[] {
  if (!life) return [];
  if (Array.isArray(life)) return life;
  const b = timeBucket(hour ?? 23);
  const pool = life[b];
  if (pool && pool.length) return pool;
  return Object.values(life).flat(); // 该时段没配 → 退回全部生活池
}
type SignaturePoolsLife = string[] | Partial<Record<TimeBucket, string[]>> | undefined;

export type SignatureKind = 'life' | 'feeling' | 'lover' | 'chosen' | 'jealous' | 'close' | 'distant' | 'default';

export interface SignatureResult {
  text: string;
  kind: SignatureKind;
  /** 是否"特别签名"(非日常生活)——调用方据此给极克制的变化暗示 */
  special: boolean;
}

export interface SignatureCtx {
  isLover?: boolean;
  avatarMood?: 'chosen' | 'jealous' | null;
  affinity?: number;
  /** 当天种子(YYYY-MM-DD)：签名按日稳定、跨日轮换 */
  daySeed?: string;
  /** 当前真实小时(0-23)：让生活签名跟着她的作息时段走 */
  hour?: number;
}

const FEELING_MIN_AFFINITY = 45;
const FEELING_LEAK_CHANCE = 0.35;
const LOVER_SHOW_CHANCE = 0.7;

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

const SPECIAL: SignatureKind[] = ['feeling', 'lover', 'chosen', 'jealous'];

export function signatureDetail(character: Character, ctx: SignatureCtx = {}): SignatureResult {
  const s = signaturesOf(character.id);
  const seed = (ctx.daySeed ?? '') + character.id;
  const done = (text: string, kind: SignatureKind): SignatureResult => ({ text, kind, special: SPECIAL.includes(kind) });

  // 事件即时覆盖（最扎眼、玩家最在意的"突变"）
  if (ctx.avatarMood === 'chosen') { const v = pickBy(s.chosen, seed + 'chosen'); if (v) return done(v, 'chosen'); }
  if (ctx.avatarMood === 'jealous') { const v = pickBy(s.jealous, seed + 'jealous'); if (v) return done(v, 'jealous'); }

  // 新模型：以她自己的日子为底色，感情偶尔在平常里冒头
  const lifePool = resolveLife(s.life, ctx.hour);
  if (lifePool.length) {
    if (ctx.isLover && s.lover?.length && hash01(seed + 'lover') < LOVER_SHOW_CHANCE) {
      return done(pickBy(s.lover, seed + 'loverpick')!, 'lover');
    }
    if (!ctx.isLover && (ctx.affinity ?? 0) >= FEELING_MIN_AFFINITY && s.feeling?.length && hash01(seed + 'feel') < FEELING_LEAK_CHANCE) {
      return done(pickBy(s.feeling, seed + 'feelpick')!, 'feeling');
    }
    // 生活签名按"日+时段"选，半夜和白天看到的是不同的她
    return done(pickBy(lifePool, seed + 'life' + timeBucket(ctx.hour ?? 23))!, 'life');
  }

  // 旧模型（未迁配置的角色）：单句状态签名
  if (ctx.isLover && s.lover?.[0]) return done(s.lover[0], 'lover');
  const aff = ctx.affinity ?? 0;
  if (aff >= 60 && s.close?.[0]) return done(s.close[0], 'close');
  if (aff < 20 && s.distant?.[0]) return done(s.distant[0], 'distant');
  return done(character.phonePersonality.signature ?? '', 'default');
}

export function signatureFor(character: Character, ctx: SignatureCtx = {}): string {
  return signatureDetail(character, ctx).text;
}
