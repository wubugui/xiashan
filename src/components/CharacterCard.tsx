import { motion } from 'framer-motion';
import { getCharacterById } from '@/data/characters';
import { cn } from '@/lib/utils';
import { assetUrl } from '@/lib/assets';

interface CharacterCardProps {
  characterId: string;
  name: string;
  title: string;
  rarity: 'N' | 'R' | 'SR' | 'SSR';
  level?: number;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const rarityConfig = {
  N: {
    frame: 'border-slate-400/70',
    bg: 'from-slate-600 via-slate-500 to-slate-800',
    name: 'text-slate-100',
    stars: 2,
    badge: 'bg-slate-600/90 text-white',
  },
  R: {
    frame: 'border-blue-300/80',
    bg: 'from-blue-500 via-blue-300 to-slate-800',
    name: 'text-blue-50',
    stars: 3,
    badge: 'bg-blue-500/90 text-white',
  },
  SR: {
    frame: 'border-purple-300/90',
    bg: 'from-purple-500 via-violet-300 to-slate-900',
    name: 'text-purple-50',
    stars: 4,
    badge: 'bg-purple-500/90 text-white',
  },
  SSR: {
    frame: 'border-amber-200',
    bg: 'from-amber-500 via-yellow-200 to-amber-900',
    name: 'text-amber-50',
    stars: 5,
    badge: 'bg-amber-300 text-amber-950',
  },
};

const sizeConfig = {
  sm: { card: 'aspect-[0.72]', name: 'text-xs', title: 'text-[10px]', stars: 'text-sm', badge: 'text-[10px]' },
  md: { card: 'aspect-[0.72]', name: 'text-sm', title: 'text-xs', stars: 'text-base', badge: 'text-xs' },
  lg: { card: 'aspect-[0.72]', name: 'text-base', title: 'text-sm', stars: 'text-lg', badge: 'text-sm' },
};

export default function CharacterCard({
  characterId,
  name,
  title,
  rarity,
  level,
  onClick,
  size = 'md',
}: CharacterCardProps) {
  const config = rarityConfig[rarity];
  const sizeConf = sizeConfig[size];
  const character = getCharacterById(characterId);
  const artUrl = character?.gachaBackgroundUrl || character?.portraitUrl;
  const hasSceneArt = Boolean(character?.gachaBackgroundUrl);

  return (
    <motion.button
      type="button"
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'group relative w-full overflow-hidden rounded-md text-left',
        sizeConf.card,
        'border-2 bg-slate-950 shadow-[0_8px_18px_rgba(0,0,0,0.38)]',
        config.frame,
      )}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br', config.bg)} />

      {artUrl ? (
        <img
          src={assetUrl(artUrl)}
          alt={name}
          className={cn(
            'absolute inset-0 h-full w-full transition-transform duration-300 group-hover:scale-[1.08]',
            hasSceneArt ? 'scale-[1.14] object-cover object-center' : 'object-cover object-top',
          )}
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-4xl text-white/25">
          人
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/22 via-transparent to-black/88" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_16%,rgba(255,255,255,0.18),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-[3px] rounded-[4px] border border-white/18" />

      <div className="absolute right-2 top-2 z-10">
        <span className={cn('rounded-sm px-2 py-0.5 font-black shadow', sizeConf.badge, config.badge)}>
          {rarity}
        </span>
      </div>

      {level && (
        <div className="absolute left-2 top-2 z-10 rounded-sm bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
          Lv.{level}
        </div>
      )}

      <div className="absolute inset-x-2 bottom-2 z-10">
        <div className="mb-1 flex items-center gap-0.5 text-amber-200 drop-shadow-[0_0_5px_rgba(251,191,36,0.75)]">
          {Array.from({ length: config.stars }).map((_, i) => (
            <span key={i} className={sizeConf.stars}>
              ★
            </span>
          ))}
        </div>
        <p className={cn('truncate font-black drop-shadow', sizeConf.name, config.name)}>{name}</p>
        <p className={cn('mt-0.5 truncate text-white/65', sizeConf.title)}>{title}</p>
      </div>
    </motion.button>
  );
}
