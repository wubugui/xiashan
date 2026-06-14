/**
 * 她的聊天/短信回复选择：按好感分层取，让语气随关系升温（生疏→熟络→亲密）。
 * 纯函数，不读 store；内容在 chatReplies.json。
 */
import content from '@/content/chatReplies.json';

export type ReplyTier = '生疏' | '熟络' | '亲密';
export type ReplyChannel = 'wechat' | 'sms';

type ChannelPools = Partial<Record<ReplyTier, string[]>>;
const replies = (content as {
  replies: Record<string, Partial<Record<ReplyChannel, ChannelPools>>>;
}).replies;

/** 好感+恋人 → 语气层。≥60 或已确认心意=亲密；<20=生疏；中间=熟络 */
export function replyTier(affinity: number, isLover: boolean): ReplyTier {
  if (isLover || affinity >= 60) return '亲密';
  if (affinity < 20) return '生疏';
  return '熟络';
}

/** 取一条她的回复：先按层取，缺则回落熟络层 / 默认角色 */
export function pickReply(
  charId: string,
  channel: ReplyChannel,
  affinity: number,
  isLover: boolean,
  rng: () => number = Math.random,
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
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}
