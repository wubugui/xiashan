import { ChevronLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getNewsById } from '@/engine/browserNewsEngine';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useShopStore } from '@/store/useShopStore';
import { getCharacterById } from '@/data/characters';
import { commissions } from '@/data/commissions';

interface BrowserPageProps {
  url: string;
  onBack: () => void;
}

/** 读后奖励的提示文案状态 */
type RewardState =
  | { kind: 'intel_now'; commissionName: string }    // 已接单：信任立即 +2
  | { kind: 'intel_saved'; commissionName: string }  // 未接单：接单时初始信任 +2
  | { kind: 'affinity'; characterName: string }      // 角色彩蛋：好感 +1
  | { kind: 'already' }                              // 今天已读过
  | null;

export default function BrowserPage({ url, onBack }: BrowserPageProps) {
  const page = useMemo(() => getNewsById(url), [url]);
  const [reward, setReward] = useState<RewardState>(null);
  const appliedRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current || !page?.effect) return;
    appliedRef.current = true;

    const player = usePlayerStore.getState();
    const shop = useShopStore.getState();

    if (page.effect.kind === 'commission_intel') {
      const cid = page.effect.commissionId;
      const name = commissions.find(c => c.id === cid)?.name ?? '';
      if (shop.gameOver) return; // 今日已结束，情报留到明天的新闻再读
      if (!player.tryDailyAction(`browser_intel:${cid}`)) {
        setReward({ kind: 'already' });
        return;
      }
      if (shop.commission?.id === cid) {
        shop.applyDelta({ trust: 2 });
        shop.addLog('📰 你在新闻里读到了相关报道，对委托的来龙去脉更清楚了。信任 +2。', 'good');
        setReward({ kind: 'intel_now', commissionName: name });
      } else {
        shop.grantIntel(cid);
        setReward({ kind: 'intel_saved', commissionName: name });
      }
    } else if (page.effect.kind === 'affinity') {
      const charId = page.effect.characterId;
      const name = getCharacterById(charId)?.name ?? '她';
      if (!player.tryDailyAction(`browser_affinity:${charId}`)) {
        setReward({ kind: 'already' });
        return;
      }
      player.addAffinity(charId, 2);
      setReward({ kind: 'affinity', characterName: name });
    }
  }, [page]);

  if (!page) {
    return (
      <div className="flex h-full flex-col" style={{ background: '#1c1c1e' }}>
        <div className="flex items-center gap-2 px-3 pt-2 pb-2">
          <button onClick={onBack} className="text-blue-400"><ChevronLeft size={20} /></button>
        </div>
        <p className="px-4 py-8 text-sm text-white/40">该页面不存在或已被删除。</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ background: '#1c1c1e' }}>
      {/* 地址栏 */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-2">
        <button onClick={onBack} className="text-blue-400">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 flex items-center gap-2 rounded-lg bg-[#2c2c2e] px-3 py-1.5">
          <span className="text-xs text-white/30">🔒</span>
          <span className="flex-1 truncate text-xs text-white/50">citynews.local/{url}</span>
        </div>
      </div>

      {/* 文章内容 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h1 className="text-lg font-bold text-white/90 leading-snug">
          {page.title}
        </h1>
        <p className="mt-2 text-xs text-white/30">都市晚报 · 城事频道</p>
        <div className="mt-4 space-y-3">
          {page.content.map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed text-white/60">
              {paragraph}
            </p>
          ))}
        </div>

        {/* 读后奖励提示 */}
        {reward && (
          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
            <p className="text-xs leading-relaxed text-amber-300/90">
              {reward.kind === 'intel_now' && `📌 你注意到了一些有用的细节——【${reward.commissionName}】的情况你心里更有数了。（信任 +2）`}
              {reward.kind === 'intel_saved' && `📌 你注意到了一些有用的细节。如果今天接下【${reward.commissionName}】，她会感到你有备而来。（接单时初始信任 +2）`}
              {reward.kind === 'affinity' && `♥ 读完这篇报道，你觉得自己离${reward.characterName}又近了一点。（好感 +2）`}
              {reward.kind === 'already' && '（这篇你今天已经仔细读过了。）'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
