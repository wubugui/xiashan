import { motion } from 'framer-motion';
import { Lock, Sparkles } from 'lucide-react';
import { assetUrl } from '@/lib/assets';
import { cn } from '@/lib/utils';
import type { GiftEffect, CollectibleTier } from '@/data/collectibles';

/**
 * 礼物卡 — SSR「物品之窗」卡。
 * 整张卡就是一扇透出礼物实物的窗，套 SSR 金框 + 流光/箔面/粒子，卡名与效果直接印在卡面。
 * grid 变体用于收藏九宫格（紧凑，仅名/层/类型）；full 变体用于点开大图（含被动/动用/氛围文案）。
 * 同一组件也用于委托剧场展示随身信物，故只吃数据、不依赖角色上下文。
 */
export interface GiftCardData {
  name: string;
  asset: string;
  tier: CollectibleTier;
  tierName: string;
  effect: GiftEffect;
  summary?: string;
  intimacy?: string;
}

interface Props {
  data: GiftCardData;
  variant?: 'grid' | 'full';
  /** 未解锁：模糊剪影 + 指引 */
  locked?: boolean;
  hint?: string;
  /** 随身装备中 */
  equipped?: boolean;
  className?: string;
  onClick?: () => void;
}

export default function GiftCard({ data, variant = 'grid', locked = false, hint, equipped = false, className, onClick }: Props) {
  const full = variant === 'full';

  if (locked) {
    return (
      <div className={cn('relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/70', className)}>
        <img src={assetUrl(data.asset)} alt="" aria-hidden className="h-full w-full object-cover object-top opacity-[0.12] blur-md grayscale" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2 text-center">
          <Lock size={full ? 22 : 16} className="text-amber-300/70" />
          <span className="text-[10px] leading-tight text-amber-300/80">{hint}</span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group relative aspect-[3/4] w-full overflow-hidden rounded-xl text-left',
        'border-2 border-amber-300/70',
        'bg-gradient-to-br from-amber-200/15 via-slate-900/40 to-amber-500/15',
        'shadow-[0_0_18px_rgba(251,191,36,0.28)]',
        onClick && 'active:scale-[0.98] transition-transform',
        className,
      )}
    >
      {/* 物品之窗：礼物实物 */}
      <img src={assetUrl(data.asset)} alt={data.name} className="absolute inset-0 h-full w-full object-cover object-top" loading="lazy" />

      {/* 暗角 + 上下压暗，保证卡面文字可读 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/45" />
      <div className="pointer-events-none absolute inset-0 rounded-[10px] shadow-[inset_0_0_22px_rgba(0,0,0,0.55)]" />

      {/* SSR 箔面流光：斜向扫光，循环 */}
      <motion.div
        className="pointer-events-none absolute inset-0 mix-blend-screen"
        style={{
          background:
            'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.0) 40%, rgba(255,246,200,0.55) 50%, rgba(255,255,255,0.0) 60%, transparent 70%)',
          backgroundSize: '250% 250%',
        }}
        animate={{ backgroundPosition: ['180% 180%', '-80% -80%'] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.2 }}
      />
      {/* 金边内辉 */}
      <div className="pointer-events-none absolute inset-0 rounded-[10px] ring-1 ring-inset ring-amber-200/40" />

      {/* 顶栏：SSR 标 + 层级 */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1.5">
        <span className="flex items-center gap-0.5 rounded bg-gradient-to-r from-amber-400 to-yellow-300 px-1.5 py-0.5 text-[9px] font-black text-amber-950 shadow">
          <Sparkles size={9} /> SSR
        </span>
        <span className="rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-amber-200 backdrop-blur-sm">
          {data.tier}层 · {data.tierName}
        </span>
      </div>

      {/* 随身中缎带 */}
      {equipped && (
        <span className="absolute right-0 top-7 rounded-l-md bg-rose-500/90 px-2 py-0.5 text-[9px] font-black text-white shadow">随身中</span>
      )}

      {/* 卡面文字 */}
      <div className={cn('absolute inset-x-0 bottom-0 p-2', full && 'p-3')}>
        <p className={cn('font-black leading-tight text-white drop-shadow', full ? 'text-base' : 'text-xs')}>{data.name}</p>
        <span className="mt-1 inline-block rounded bg-amber-400/25 px-1.5 py-0.5 text-[9px] font-bold text-amber-200 ring-1 ring-amber-300/40">
          {data.effect.type}
        </span>

        {full && (
          <div className="mt-2 space-y-1.5">
            <div className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-2 py-1.5">
              <p className="text-[10px] font-bold text-sky-300">随身被动</p>
              <p className="text-[11px] leading-snug text-slate-100">{data.effect.passive}</p>
            </div>
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-2 py-1.5">
              <p className="text-[10px] font-bold text-amber-300">动用 · 每日一次</p>
              <p className="text-[11px] leading-snug text-slate-100">{data.effect.active}</p>
            </div>
            {data.summary && <p className="pt-0.5 text-[11px] leading-relaxed text-slate-300">{data.summary}</p>}
            {data.intimacy && <p className="text-[11px] leading-relaxed text-rose-200/80">{data.intimacy}</p>}
          </div>
        )}
      </div>
    </button>
  );
}
