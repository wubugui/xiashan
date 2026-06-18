/**
 * 手机浏览器 · 动态新闻引擎（纯函数，无 React 依赖）
 *
 * 新闻分四层，按优先级排列：
 * 1. 委托新闻：当日委托板上的单子各对应一篇报道，读后获得情报（接单初始信任 +2）
 * 2. 角色彩蛋：认识的角色（持有 / 好感≥40 / 完成过其委托）会出现在城市新闻里，读后好感 +1（每日一次）
 * 3. 街角新闻：当日路线地点的氛围报道，按日期轮换
 * 4. 世界观新闻：固定背景报道兜底（未开业时浏览器只显示这一层 + 角色彩蛋）
 */
import newsContent from '@/content/browser-news.json';
import { commissions } from '@/data/commissions';

export type NewsEffect =
  | { kind: 'commission_intel'; commissionId: string }
  | { kind: 'affinity'; characterId: string };

export interface BrowserNewsItem {
  id: string;
  tag: string;
  title: string;
  summary: string;
  time: string;
  content: string[];
  effect?: NewsEffect;
}

interface NewsTemplate {
  tag: string;
  title: string;
  summary: string;
  content: string[];
}

const data = newsContent as {
  commissionNews: Record<string, NewsTemplate>;
  characterNews: Record<string, NewsTemplate>;
  locationNews: Record<string, NewsTemplate[]>;
  staticNews: NewsTemplate[];
};

export interface BrowserNewsInput {
  /** 今日委托板（含已接单的委托 id） */
  boardIds: string[];
  acceptedCommissionId: string | null;
  /** 当前路线候选地点 id */
  routeLocationIds: string[];
  affinityMap: Record<string, number>;
  ownedCharacterIds: string[];
  flags: string[];
  /** 当前游戏天（gameDay）：同一游戏天内新闻不跳变 */
  gameDay: number;
}

/** 当日固定的伪随机（同一游戏天内新闻不跳变） */
function daySeed(gameDay: number): number {
  const d = String(gameDay);
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  return h;
}

/** 角色是否「认识」：持有 / 好感≥40 / 完成过其委托 */
function knowsCharacter(charId: string, input: BrowserNewsInput): boolean {
  if (input.ownedCharacterIds.includes(charId)) return true;
  if ((input.affinityMap[charId] ?? 0) >= 40) return true;
  return commissions.some(
    c => c.target === charId && input.flags.includes(`commission_${c.id}_done`),
  );
}

export function generateBrowserNews(input: BrowserNewsInput): BrowserNewsItem[] {
  const seed = daySeed(input.gameDay);
  const items: BrowserNewsItem[] = [];

  // 1. 委托新闻：板上的单 + 已接的单（已接的排最前）
  const commissionIds = [...new Set([
    ...(input.acceptedCommissionId ? [input.acceptedCommissionId] : []),
    ...input.boardIds,
  ])];
  commissionIds.forEach((cid, i) => {
    const tpl = data.commissionNews[cid];
    if (!tpl) return;
    items.push({
      id: `c_${cid}`,
      ...tpl,
      time: i === 0 ? '1小时前' : `${i + 1}小时前`,
      effect: { kind: 'commission_intel', commissionId: cid },
    });
  });

  // 2. 角色彩蛋：认识的角色中按日期轮选最多 2 位
  const known = Object.keys(data.characterNews).filter(id => knowsCharacter(id, input));
  if (known.length > 0) {
    const start = seed % known.length;
    const picked = [known[start], known.length > 1 ? known[(start + 1) % known.length] : null]
      .filter((x): x is string => x !== null);
    picked.forEach((charId, i) => {
      const tpl = data.characterNews[charId];
      items.push({
        id: `k_${charId}`,
        ...tpl,
        time: i === 0 ? '今晨' : '昨晚',
        effect: { kind: 'affinity', characterId: charId },
      });
    });
  }

  // 3. 街角新闻：当前路线地点，最多 2 条，变体按日期轮换
  input.routeLocationIds.slice(0, 2).forEach((locId, i) => {
    const variants = data.locationNews[locId];
    if (!variants?.length) return;
    const tpl = variants[seed % variants.length];
    items.push({ id: `l_${locId}_${seed % variants.length}`, ...tpl, time: i === 0 ? '今天' : '昨天' });
  });

  // 4. 世界观新闻兜底：至少保证 4 条可读
  const fillCount = Math.max(2, 4 - items.length);
  const start = seed % data.staticNews.length;
  for (let i = 0; i < Math.min(fillCount, data.staticNews.length); i++) {
    const idx = (start + i) % data.staticNews.length;
    items.push({ id: `s_${idx}`, ...data.staticNews[idx], time: `${i + 2}天前` });
  }

  return items;
}

/** 按 id 取详情（与列表生成解耦，路线中途变化也不影响已打开的页面） */
export function getNewsById(id: string): BrowserNewsItem | null {
  const [prefix, ...rest] = id.split('_');
  if (prefix === 'c') {
    const cid = rest.join('_');
    const tpl = data.commissionNews[cid];
    return tpl ? { id, ...tpl, time: '', effect: { kind: 'commission_intel', commissionId: cid } } : null;
  }
  if (prefix === 'k') {
    const charId = rest.join('_');
    const tpl = data.characterNews[charId];
    return tpl ? { id, ...tpl, time: '', effect: { kind: 'affinity', characterId: charId } } : null;
  }
  if (prefix === 'l') {
    const idx = Number(rest.pop());
    const locId = rest.join('_');
    const tpl = data.locationNews[locId]?.[idx];
    return tpl ? { id, ...tpl, time: '' } : null;
  }
  if (prefix === 's') {
    const tpl = data.staticNews[Number(rest[0])];
    return tpl ? { id, ...tpl, time: '' } : null;
  }
  return null;
}
