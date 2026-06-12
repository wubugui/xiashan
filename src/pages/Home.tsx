import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Store, Sparkles, Users, Smartphone, Film, Gamepad2, Heart, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { characters } from '@/data/characters';
import { REWARDS } from '@/data/rewards';
import { cn } from '@/lib/utils';
import { assetUrl } from '@/lib/assets';
import { safeStorage } from '@/lib/safeStorage';
import ResetSaveButton from '@/components/ResetSaveButton';
import PageBackdrop from '@/components/PageBackdrop';
import { SCENE_BACKDROPS } from '@/lib/pageBackdrops';

type HomeAction = {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  color: string;
  onClick: () => void;
  full?: boolean;
  art?: {
    scene?: string;
    sceneOpacity?: string;
    face?: string;
    faceOpacity?: string;
    faceClassName?: string;
  };
};

const artworkMask: CSSProperties = {
  clipPath: 'polygon(34% 0, 100% 0, 100% 100%, 22% 100%, 30% 73%, 20% 49%, 31% 23%)',
  maskImage: 'linear-gradient(103deg, transparent 0%, rgba(0,0,0,0.14) 28%, rgba(0,0,0,0.75) 54%, #000 100%)',
  WebkitMaskImage: 'linear-gradient(103deg, transparent 0%, rgba(0,0,0,0.14) 28%, rgba(0,0,0,0.75) 54%, #000 100%)',
};

const faceMask: CSSProperties = {
  maskImage: 'linear-gradient(102deg, transparent 0%, rgba(0,0,0,0.18) 29%, rgba(0,0,0,0.82) 55%, #000 100%)',
  WebkitMaskImage: 'linear-gradient(102deg, transparent 0%, rgba(0,0,0,0.18) 29%, rgba(0,0,0,0.82) 55%, #000 100%)',
};

function ArtworkLayer({ art, primary = false }: { art?: HomeAction['art']; primary?: boolean }) {
  if (!art) return null;

  return (
    <>
      {art.scene && (
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 bg-cover bg-center',
            primary ? 'w-[58%]' : 'w-[72%]',
            art.sceneOpacity ?? (primary ? 'opacity-45' : 'opacity-30'),
          )}
          style={{
            ...artworkMask,
            backgroundImage: `url("${assetUrl(art.scene)}")`,
          }}
        />
      )}

      {art.face && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-[74%] overflow-hidden"
          style={faceMask}
        >
          <img
            src={assetUrl(art.face)}
            alt=""
            aria-hidden="true"
            className={cn(
              'absolute max-w-none object-contain -scale-x-100',
              art.faceOpacity ?? 'opacity-[0.66]',
              art.faceClassName,
            )}
          />
        </div>
      )}

      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0',
          primary
            ? 'w-[62%] bg-gradient-to-r from-amber-500/45 via-amber-400/18 to-transparent'
            : 'w-[62%] bg-gradient-to-r from-slate-950/75 via-slate-950/35 to-transparent',
        )}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-white/[0.03]" />
    </>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const spiritStones = usePlayerStore((s) => s.spiritStones);
  const normalTickets = usePlayerStore((s) => s.normalTickets);
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const addSpiritStones = usePlayerStore((s) => s.addSpiritStones);

  const [showDailyReward, setShowDailyReward] = useState(false);

  const ownedCount = ownedCharacters.length;
  const totalCharacters = characters.length;

  useEffect(() => {
    const lastClaimDate = safeStorage.getItem('xiashan_daily_claim');
    const today = new Date().toDateString();
    if (lastClaimDate !== today) {
      setShowDailyReward(true);
    }
  }, []);

  const claimDailyReward = () => {
    addSpiritStones(REWARDS.daily_login);
    safeStorage.setItem('xiashan_daily_claim', new Date().toDateString());
    setShowDailyReward(false);
  };

  const primaryAction: HomeAction = {
    id: 'shop',
    label: '月光开店',
    hint: '推开第25小时的门',
    icon: Store,
    color: 'from-amber-500 to-orange-500',
    art: {
      scene: '/bg/scene/street-storefront.jpg',
      sceneOpacity: 'opacity-50',
    },
    onClick: () => navigate('/shop'),
  };

  const quickActions: HomeAction[] = [
    {
      id: 'gacha',
      label: '星愿邂逅',
      hint: '遇见未命名的心事',
      icon: Sparkles,
      color: 'from-purple-500 to-purple-700',
      art: {
        face: '/characters/face/suli/avatar.png',
        faceOpacity: 'opacity-[0.66]',
        faceClassName: 'h-[20.5rem] w-[20.5rem] -right-[8.4rem] -top-[7.7rem]',
      },
      onClick: () => navigate('/gacha'),
    },
    {
      id: 'collection',
      label: '心动名册',
      hint: '翻看羁绊与档案',
      icon: Users,
      color: 'from-blue-500 to-blue-700',
      art: {
        scene: '/bg/scene/studio-room.jpg',
        sceneOpacity: 'opacity-25',
        face: '/characters/face/sangluo/avatar.png',
        faceOpacity: 'opacity-[0.66]',
        faceClassName: 'h-[21.75rem] w-[21.75rem] -right-[7.2rem] -top-[8.6rem]',
      },
      onClick: () => navigate('/collection'),
    },
    {
      id: 'bonds',
      label: '缘分图鉴',
      hint: '她们的终极形态之路',
      icon: Heart,
      color: 'from-pink-500 to-rose-700',
      art: {
        scene: '/bg/scene/store-night.jpg',
        sceneOpacity: 'opacity-25',
      },
      onClick: () => navigate('/bonds'),
    },
    {
      id: 'phone',
      label: '月下来信',
      hint: '收取消息与来电',
      icon: Smartphone,
      color: 'from-green-500 to-green-700',
      art: {
        scene: '/bg/mobile/office-lobby-portrait.jpg',
        sceneOpacity: 'opacity-25',
      },
      onClick: () => navigate('/phone'),
    },
    {
      id: 'videos',
      label: '回忆放映',
      hint: '重看故事片段',
      icon: Film,
      color: 'from-rose-500 to-rose-700',
      art: {
        scene: '/bg/scene/store-night.jpg',
        sceneOpacity: 'opacity-30',
      },
      onClick: () => navigate('/videos'),
    },
    {
      id: 'minigame',
      label: '星夜小憩',
      hint: '夜班里的小消遣',
      icon: Gamepad2,
      color: 'from-emerald-500 to-teal-700',
      full: true,
      art: {
        scene: '/bg/scene/studio-room.jpg',
        sceneOpacity: 'opacity-30',
      },
      onClick: () => navigate('/minigame'),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#050914]"
    >
      <PageBackdrop
        image={SCENE_BACKDROPS.street.image}
        mobileImage={SCENE_BACKDROPS.street.mobileImage}
        position={SCENE_BACKDROPS.street.position}
        overlayClassName="from-slate-950/30 via-slate-950/50 to-slate-950/80"
      />

      <div className="absolute right-4 top-4 z-20">
        <ResetSaveButton compact />
      </div>

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center px-5 py-16 sm:px-6">
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8, type: 'spring', damping: 20 }}
          className="mb-6 text-center"
        >
          <h1
            className={cn(
              'leading-none',
              'bg-gradient-to-r from-amber-200 via-rose-100 to-fuchsia-200',
              'bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(251,191,36,0.38)]',
            )}
          >
            <span
              className="block text-[4.8rem] font-black tracking-normal sm:text-[5.75rem]"
              style={{ fontFamily: '"Didot","Bodoni 72","Times New Roman",serif' }}
            >
              25
            </span>
            <span className="-mt-2 block text-4xl font-black tracking-[0.22em] sm:text-5xl">
              时便利屋
            </span>
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-2 text-sm tracking-widest text-slate-400"
          >
            开在第25小时的都市便利屋
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className={cn(
            'mb-6 w-full rounded-xl',
            'bg-slate-950/60 backdrop-blur-xl',
            'border border-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.28)]',
            'px-5 py-4',
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">普通券</p>
              <p className="mt-0.5 text-sm font-medium text-amber-400">
                🎫 {normalTickets} 张可用
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">灵石</p>
              <p className="mt-0.5 text-sm font-bold text-amber-300">
                💎 {spiritStones.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">角色</p>
              <p className="mt-0.5 text-sm font-bold text-blue-300">
                {ownedCount}/{totalCharacters}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="w-full space-y-3">
          <motion.button
            initial={{ y: 30, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{
              delay: 0.7,
              type: 'spring',
              damping: 20,
              stiffness: 200,
            }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={primaryAction.onClick}
            className={cn(
              'group relative flex h-24 w-full items-center overflow-hidden rounded-[1.6rem] px-6 text-left',
              'border border-amber-200/35 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500',
              'shadow-[0_20px_45px_rgba(245,158,11,0.28),0_14px_36px_rgba(0,0,0,0.35)]',
              'transition-shadow duration-300 hover:shadow-[0_24px_55px_rgba(245,158,11,0.36),0_16px_42px_rgba(0,0,0,0.42)]',
            )}
          >
            <ArtworkLayer art={primaryAction.art} primary />
            <div className="relative z-10 mr-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/22 shadow-inner">
              <Store size={30} className="text-amber-950" strokeWidth={1.9} />
            </div>
            <div className="relative z-10 min-w-0">
              <div className="text-2xl font-black tracking-wide text-amber-950">{primaryAction.label}</div>
              <div className="mt-1 text-xs font-bold tracking-wider text-amber-950/65">{primaryAction.hint}</div>
            </div>
            <div className="relative z-10 ml-auto text-4xl font-black text-amber-950/75">›</div>
          </motion.button>

          <div className="grid w-full grid-cols-2 gap-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.id}
                  initial={{ y: 30, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{
                    delay: 0.78 + index * 0.08,
                    type: 'spring',
                    damping: 20,
                    stiffness: 200,
                  }}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={action.onClick}
                  className={cn(
                    'group relative flex h-[5.35rem] items-center overflow-hidden rounded-2xl px-3 text-left',
                    'border border-white/10 bg-slate-950/60 backdrop-blur-xl',
                    'shadow-[0_18px_42px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.06)]',
                    'transition-all duration-300 hover:border-white/18',
                    action.full && 'col-span-2',
                  )}
                >
                  <ArtworkLayer art={action.art} />

                  <div
                    className={cn(
                      'pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full opacity-25 blur-xl',
                      'bg-gradient-to-br',
                      action.color,
                    )}
                  />

                  <div
                    className={cn(
                      'relative z-10 mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                      'bg-gradient-to-br',
                      action.color,
                      'shadow-[0_12px_24px_rgba(0,0,0,0.28)]',
                    )}
                  >
                    <Icon size={23} className="text-white" strokeWidth={1.9} />
                  </div>

                  <div className="relative z-10 min-w-0">
                    <span className="block truncate text-base font-black tracking-wide text-white min-[440px]:text-lg">
                      {action.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[0.68rem] font-bold tracking-wider text-slate-300/75">
                      {action.hint}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDailyReward && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDailyReward(false)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'relative mx-4 w-full max-w-sm overflow-hidden rounded-2xl',
                'bg-slate-900/95 backdrop-blur-xl',
                'border border-amber-500/30',
                'p-6',
                'shadow-[0_0_60px_rgba(251,191,36,0.2)]',
              )}
            >
              <button
                onClick={() => setShowDailyReward(false)}
                className="absolute right-3 top-3 text-slate-500 hover:text-white"
              >
                <X size={18} />
              </button>

              <div className="mb-5 text-center">
                <motion.div
                  animate={{
                    textShadow: [
                      '0 0 10px rgba(251,191,36,0.3)',
                      '0 0 30px rgba(251,191,36,0.6)',
                      '0 0 10px rgba(251,191,36,0.3)',
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-2xl font-black text-amber-400"
                >
                  每日登录奖励
                </motion.div>
                <p className="mt-1 text-xs text-slate-500">每日签到领取灵石</p>
              </div>

              <div className="mb-6 flex items-center justify-center gap-3">
                <div
                  className={cn(
                    'flex h-20 w-20 items-center justify-center rounded-2xl',
                    'bg-gradient-to-br from-amber-500/20 to-amber-700/20',
                    'border border-amber-500/30',
                  )}
                >
                  <span className="text-3xl">💎</span>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-300">灵石 x {REWARDS.daily_login}</p>
                  <p className="text-xs text-slate-500">可用于抽卡和角色升级</p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={claimDailyReward}
                className={cn(
                  'w-full rounded-xl py-3',
                  'bg-gradient-to-r from-amber-500 to-amber-600',
                  'text-base font-bold text-amber-950',
                  'shadow-[0_0_20px_rgba(251,191,36,0.3)]',
                  'hover:from-amber-400 hover:to-amber-500',
                  'transition-all duration-200',
                )}
              >
                领取奖励
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
