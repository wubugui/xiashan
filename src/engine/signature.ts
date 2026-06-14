/**
 * 她当前的微信签名：默认人设签名(characters.json) + 状态覆盖(waifeStates.json)。
 * 让签名"活"起来——随确认心意 / 玩家头像博弈而变。纯函数，不读 store，状态由调用方传入。
 */
import type { Character } from '@/data/types';
import { signaturesOf } from '@/engine/waifeStateAccess';

export interface SignatureCtx {
  /** 已确认心意（她是恋人） */
  isLover?: boolean;
  /** 玩家把自己头像设成了谁：'chosen'=她本人 / 'jealous'=别人(她吃醋) / null=无关 */
  avatarMood?: 'chosen' | 'jealous' | null;
  /** 当前好感：驱动日常签名分层（生疏/熟络/暧昧） */
  affinity?: number;
}

/** 优先级：头像博弈（最新最扎眼）> 恋人 > 好感分层（暧昧/生疏）> 默认人设(熟络) */
export function signatureFor(character: Character, ctx: SignatureCtx = {}): string {
  const s = signaturesOf(character.id);
  if (ctx.avatarMood === 'chosen' && s.chosen) return s.chosen;
  if (ctx.avatarMood === 'jealous' && s.jealous) return s.jealous;
  if (ctx.isLover && s.lover) return s.lover;
  const aff = ctx.affinity ?? 0;
  if (aff >= 60 && s.close) return s.close;
  if (aff < 20 && s.distant) return s.distant;
  return character.phonePersonality.signature ?? '';
}
