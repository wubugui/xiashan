/**
 * 她的聊天/短信回复选择。
 * - 已迁入「一角色一配置」的角色：走 chat 矩阵——按「玩家意图 × 好感层」精确取，
 *   空格子 = 已读不回(返回 null)。有人味、贴人设。
 * - 其余角色：回退旧的按好感层随机池(chatReplies.json)，不看意图。
 * 纯函数，不读 store。
 */
import content from '@/content/chatReplies.json';
import { waifeChat } from '@/data/waifes';
import type { ChatIntent, ChatChannel } from '@/data/waife';

export type ReplyTier = '生疏' | '熟络' | '亲密';
export type { ChatIntent, ChatChannel } from '@/data/waife';

type ChannelPools = Partial<Record<ReplyTier, string[]>>;
const replies = (content as {
  replies: Record<string, Partial<Record<ChatChannel, ChannelPools>>>;
}).replies;

/** 好感+恋人 → 语气层。≥60 或已确认心意=亲密；<20=生疏；中间=熟络 */
export function replyTier(affinity: number, isLover: boolean): ReplyTier {
  if (isLover || affinity >= 60) return '亲密';
  if (affinity < 20) return '生疏';
  return '熟络';
}

function pickFrom(pool: string[], rng: () => number): string {
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/** 旧版：按好感层随机池取（无意图，给未迁配置的角色兜底） */
export function pickReply(
  charId: string, channel: ChatChannel, affinity: number, isLover: boolean, rng: () => number = Math.random,
): string {
  const tier = replyTier(affinity, isLover);
  const charPools = replies[charId]?.[channel] ?? {};
  const defPools = replies.default?.[channel] ?? {};
  const pool =
    charPools[tier]?.length ? charPools[tier]! :
    charPools['熟络']?.length ? charPools['熟络']! :
    defPools[tier]?.length ? defPools[tier]! :
    defPools['熟络']?.length ? defPools['熟络']! :
    ['嗯。'];
  return pickFrom(pool, rng);
}

/**
 * 上下文化回复：按「意图 × 好感层」取她的回应。
 * 返回 null = 她已读不回（配置里该格子为空）。未迁配置的角色回退按层随机池。
 */
export function replyTo(
  charId: string, channel: ChatChannel, intent: ChatIntent, affinity: number, isLover: boolean, rng: () => number = Math.random,
): string | null {
  const matrix = waifeChat(charId);
  if (matrix) {
    const tier = replyTier(affinity, isLover);
    const cell = matrix[channel]?.[intent]?.[tier];
    if (cell) return cell.length === 0 ? null : pickFrom(cell, rng); // 空格子=已读不回
    // 配置里没写该格子 → 回退按层池（仍贴该角色）
  }
  return pickReply(charId, channel, affinity, isLover, rng);
}
