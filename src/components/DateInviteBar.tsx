import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { getCharacterById } from '@/data/characters';
import { useDateInvite } from '@/hooks/useDateInvite';
import { cn } from '@/lib/utils';
import DateReveal from '@/components/DateReveal';

/**
 * 「约她出去」入口条：手机联系人页 + 角色主页共用同一套逻辑与揭示。
 * 未拥有角色不渲染；关系没到位时显示「好感 X/Y」进度，让玩家知道差多少、去哪刷。
 */
export default function DateInviteBar({ characterId, className }: { characterId: string | undefined; className?: string }) {
  const d = useDateInvite(characterId);
  const character = characterId ? getCharacterById(characterId) : undefined;
  if (!d.owned || !character) return null;

  return (
    <div className={cn('px-3 py-2', className)}>
      {d.allUnlocked ? (
        <p className="text-center text-[11px] text-rose-300/70">💞 你们的约会回忆已集齐——在「心动名册」里回味吧</p>
      ) : (
        <button
          onClick={d.handleDate}
          disabled={!d.canDate}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-[0.99]',
            d.canDate
              ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-[0_0_14px_rgba(244,63,94,0.3)]'
              : 'bg-white/8 text-white/40',
          )}
        >
          <Heart size={15} className={d.canDate ? 'fill-white' : ''} />
          {d.tierTooLow
            ? `好感 ${d.affinity}/${d.threshold} · 再升 ${d.affinityRemain} 就能约她出去`
            : d.datedToday
              ? '今天已约过她 · 明天再来'
              : '约她出去 · 解锁一段约会回忆'}
        </button>
      )}

      {/* 约会解锁场景揭示 */}
      <AnimatePresence>
        {d.dateReveal && (
          <DateReveal scene={d.dateReveal} characterName={character.name} onClose={d.clearReveal} />
        )}
      </AnimatePresence>

      {/* 约会限频 / 门槛提示 */}
      <AnimatePresence>
        {d.dateToast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="pointer-events-none fixed left-1/2 top-1/3 z-[120] w-[80%] max-w-xs -translate-x-1/2 rounded-xl bg-slate-800/95 px-4 py-2.5 text-center text-xs text-rose-100 shadow-xl"
          >
            {d.dateToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
