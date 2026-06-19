import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronLeft, Film, Lock, Play } from 'lucide-react';
import { videos, type VideoEntry } from '@/data/videos';
import VideoPlayer from '@/components/VideoPlayer';
import StoryViewer from '@/components/StoryViewer';
import { usePlayerStore } from '@/store/usePlayerStore';
import { evaluateAll } from '@/engine/conditionEngine';
import { cn } from '@/lib/utils';
import { assetUrl } from '@/lib/assets';
import PageBackdrop from '@/components/PageBackdrop';
import { SCENE_BACKDROPS } from '@/lib/pageBackdrops';

export default function VideoGallery() {
  const navigate = useNavigate();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playingVideo = videos.find((v) => v.id === playingId);

  const spiritStones = usePlayerStore((s) => s.spiritStones);
  const reputation = usePlayerStore((s) => s.reputation);
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const affinityMap = usePlayerStore((s) => s.affinityMap);
  const relationshipStages = usePlayerStore((s) => s.relationshipStages);
  const completedNodes = usePlayerStore((s) => s.completedNodes);
  const flags = usePlayerStore((s) => s.flags);
  const dupeCount = usePlayerStore((s) => s.dupeCount);

  const conditionState = useMemo(
    () => ({
      spiritStones,
      reputation,
      ownedCharacters: ownedCharacters.map((c) => ({
        characterId: c.characterId,
        level: c.level,
      })),
      affinityMap,
      relationshipStages,
      completedNodes,
      flags,
      dupeCount,
    }),
    [spiritStones, reputation, ownedCharacters, affinityMap, relationshipStages, completedNodes, flags, dupeCount],
  );

  const isUnlocked = (video: VideoEntry) =>
    !video.unlockConditions || video.unlockConditions.length === 0 || evaluateAll(video.unlockConditions, conditionState);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050914] pb-nav">
      <PageBackdrop
        image={SCENE_BACKDROPS.studio.image}
        mobileImage={SCENE_BACKDROPS.studio.mobileImage}
        position={SCENE_BACKDROPS.studio.position}
        overlayClassName="from-slate-950/50 via-slate-950/60 to-slate-950/90"
      />

      <div className="relative z-10">
        <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/78 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20"
              aria-label="返回"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black tracking-wide text-white">影像回放</h1>
              <p className="text-xs font-medium text-amber-300">共 {videos.length} 段影像与记述，随时回看</p>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {videos.map((video, index) => {
              const unlocked = isUnlocked(video);
              return (
                <motion.button
                  key={video.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.25 }}
                  whileHover={unlocked ? { scale: 1.02 } : undefined}
                  whileTap={unlocked ? { scale: 0.98 } : undefined}
                  onClick={() => unlocked && setPlayingId(video.id)}
                  className={cn(
                    'group relative flex items-center gap-4 overflow-hidden rounded-xl text-left',
                    'bg-slate-900/60 backdrop-blur-md',
                    'border border-slate-700/30',
                    'p-4 transition-shadow duration-300',
                    unlocked
                      ? 'hover:shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                      : 'cursor-not-allowed opacity-50 grayscale',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-14 w-14 shrink-0 items-center justify-center rounded-lg shadow-lg',
                      unlocked ? 'bg-gradient-to-br from-amber-500 to-amber-700' : 'bg-slate-700',
                    )}
                  >
                    {video.story ? <BookOpen size={22} className="text-white" /> : <Film size={22} className="text-white" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-white">{video.title}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {unlocked ? video.description : '尚未解锁，完成相应进度后即可观看'}
                    </p>
                  </div>

                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
                      unlocked
                        ? 'bg-amber-400/15 text-amber-300 group-hover:bg-amber-400 group-hover:text-amber-950'
                        : 'bg-slate-700/50 text-slate-400',
                    )}
                  >
                    {unlocked ? <Play size={16} className="ml-0.5" fill="currentColor" /> : <Lock size={15} />}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 播放器 / 图文记述 */}
      <AnimatePresence>
        {playingVideo && (playingVideo.story ? (
          <StoryViewer
            key={playingVideo.id}
            title={playingVideo.title}
            image={playingVideo.story.image}
            paragraphs={playingVideo.story.paragraphs}
            onClose={() => setPlayingId(null)}
          />
        ) : playingVideo.src ? (
          <VideoPlayer
            key={playingVideo.id}
            src={assetUrl(playingVideo.src)!}
            onEnd={() => setPlayingId(null)}
          />
        ) : null)}
      </AnimatePresence>
    </div>
  );
}
