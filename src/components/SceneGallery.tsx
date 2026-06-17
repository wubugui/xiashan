import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import { getScenes, type DateScene } from '@/data/scenes';
import { assetUrl } from '@/lib/assets';
import { playSound } from '@/lib/sound';
import { cn } from '@/lib/utils';

/**
 * 约会场景收藏：按角色分组。未解锁=剪影不可见；解锁后点开看大图、读故事、设为她的主页背景。
 * 通过手机联系人页「约她出去」按顺序解锁。
 */
export default function SceneGallery() {
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const unlockedScenes = usePlayerStore((s) => s.unlockedScenes);
  const characterBg = usePlayerStore((s) => s.characterBg);
  const setCharacterBg = usePlayerStore((s) => s.setCharacterBg);

  const unlockedSet = new Set(unlockedScenes);
  const [open, setOpen] = useState<{ scene: DateScene; charId: string; charName: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2000); };

  const rows = ownedCharacters
    .map((oc) => {
      const char = getCharacterById(oc.characterId);
      const scenes = getScenes(oc.characterId);
      if (!char || scenes.length === 0) return null;
      return { char, scenes };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (rows.length === 0) {
    return <p className="py-20 text-center text-sm text-slate-400">还没有角色——抽到她，再去手机里约她出去，留下约会回忆。</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <p className="text-center text-[11px] leading-relaxed text-slate-400">
        在<span className="text-rose-300">角色主页</span>或手机「月下来信」里点<span className="text-rose-300">约她出去</span>，按顺序解锁约会回忆——解锁后可看大图、读故事、设为她的主页背景。
      </p>
      {rows.map(({ char, scenes }) => {
        const got = scenes.filter((s) => unlockedSet.has(s.id)).length;
        return (
          <div key={char.id}>
            <div className="mb-2 flex items-center gap-2">
              <img src={assetUrl(char.avatarUrl)} alt={char.name} className="h-7 w-7 rounded-full object-cover" />
              <span className="text-sm font-bold text-white">{char.name}</span>
              <span className="text-[11px] text-rose-300/70">约会回忆 {got}/{scenes.length}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {scenes.map((scene) => {
                const unlocked = unlockedSet.has(scene.id);
                const isBg = characterBg[char.id] === scene.image;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => { playSound('btn-confirm'); setOpen({ scene, charId: char.id, charName: char.name }); }}
                    className={cn(
                      'group relative aspect-video overflow-hidden rounded-lg border text-left',
                      isBg ? 'border-amber-400/70 shadow-[0_0_12px_rgba(251,191,36,0.25)]' : 'border-white/10',
                      unlocked && 'hover:border-rose-300/40 active:scale-[0.98]',
                    )}
                  >
                    {unlocked ? (
                      <>
                        <img src={assetUrl(scene.image)} alt={scene.title} className="h-full w-full object-cover" loading="lazy" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-1 text-[10px] font-bold text-white">{scene.title}</span>
                        {isBg && <span className="absolute left-1 top-1 rounded bg-amber-400/90 px-1.5 py-0.5 text-[9px] font-black text-amber-950">主页背景</span>}
                      </>
                    ) : (
                      <>
                        {scene.silhouette
                          ? <img src={assetUrl(scene.silhouette)} alt="" aria-hidden className="h-full w-full object-cover opacity-40" />
                          : <img src={assetUrl(scene.image)} alt="" aria-hidden className="h-full w-full object-cover opacity-[0.08] blur-xl grayscale" />}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/30">
                          <Lock size={15} className="text-white/50" />
                          <span className="text-[9px] text-white/45">约她出去解锁</span>
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 场景大图 + 故事 + 设为背景 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm"
            onClick={() => setOpen(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 14, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-slate-900 pb-3 shadow-2xl"
            >
              <img src={assetUrl(open.scene.image)} alt={open.scene.title} className="aspect-video w-full object-cover" />
              <div className="px-4 pt-3">
                <p className="text-base font-black text-white">{open.scene.title}</p>
                <p className="mt-0.5 text-[11px] text-rose-300/80">和{open.charName}的约会 · {open.scene.dateHook}</p>
                <div className="mt-3 space-y-2">
                  {open.scene.story.map((p, i) => (
                    <p key={i} className="text-[13px] leading-relaxed text-slate-200">{p}</p>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  {characterBg[open.charId] === open.scene.image ? (
                    <button
                      onClick={() => { playSound('btn-confirm'); setCharacterBg(open.charId, null); flash('已还原默认背景'); }}
                      className="flex-1 rounded-xl border border-white/15 bg-slate-800 py-2.5 text-sm font-bold text-slate-300 active:scale-[0.99]"
                    >取消主页背景</button>
                  ) : (
                    <button
                      onClick={() => { playSound('stage-up'); setCharacterBg(open.charId, open.scene.image); flash(`已设为${open.charName}的主页背景`); }}
                      className="flex-1 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 py-2.5 text-sm font-black text-white shadow-[0_0_14px_rgba(244,63,94,0.3)] active:scale-[0.99]"
                    >设为 {open.charName} 的主页背景</button>
                  )}
                  <button onClick={() => setOpen(null)} className="rounded-xl border border-white/15 bg-slate-800 px-4 py-2.5 text-sm text-slate-400">关闭</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="pointer-events-none fixed above-nav left-1/2 z-[210] w-max max-w-[85vw] -translate-x-1/2 rounded-xl bg-slate-800 px-4 py-2 text-sm text-white shadow-xl"
          >{toast}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
