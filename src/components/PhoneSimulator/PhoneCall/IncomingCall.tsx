import { motion } from 'framer-motion';
import { PhoneOff, Phone } from 'lucide-react';
import { getCharacterById } from '@/data/characters';

interface IncomingCallProps {
  characterId: string;
  onAnswer: () => void;
  onReject: () => void;
}

const avatarColors: Record<string, string> = {
  suli: '#4FC3F7',
  chujinghong: '#AB47BC',
  sujinli: '#7E57C2',
  aruo: '#66BB6A',
  huapi: '#EC407A',
  sangluo: '#5C6BC0',
  aman: '#FF7043',
  shenzhaoning: '#FFA726',
  peiyanzhi: '#26A69A',
  zhoulei: '#EF5350',
  murongxue: '#42A5F5',
  yunzhiyi: '#8D6E63',
  linxia: '#FFCA28',
  jinmantang: '#FFD54F',
  wanjia: '#78909C',
  youhun: '#B0BEC5',
  lurenjia: '#90A4AE',
  xiaogui: '#CE93D8',
};

export default function IncomingCall({ characterId, onAnswer, onReject }: IncomingCallProps) {
  const character = getCharacterById(characterId);
  const color = avatarColors[characterId] || '#999';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full flex-col items-center justify-between py-16"
      style={{
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0c29 100%)',
      }}
    >
      {/* 上半部分：头像和信息 */}
      <div className="flex flex-col items-center">
        {/* 脉冲光环 */}
        <div className="relative flex items-center justify-center">
          <motion.div
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 0, 0.3],
            }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            className="absolute h-32 w-32 rounded-full"
            style={{ backgroundColor: color, opacity: 0.2 }}
          />
          <motion.div
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0, 0.2],
            }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut', delay: 0.3 }}
            className="absolute h-28 w-28 rounded-full"
            style={{ backgroundColor: color, opacity: 0.15 }}
          />
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white shadow-xl"
            style={{ backgroundColor: color }}
          >
            {character?.name.charAt(0) || '?'}
          </div>
        </div>

        <h2 className="mt-6 text-xl font-semibold text-white">
          {character?.name || '未知号码'}
        </h2>
        <p className="mt-2 text-sm text-white/50">来电</p>
      </div>

      {/* 下半部分：操作按钮 */}
      <div className="flex w-full items-end justify-around px-8 pb-8">
        {/* 拒绝 */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onReject}
          className="flex flex-col items-center gap-2"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/30">
            <PhoneOff size={28} className="text-white" />
          </div>
          <span className="text-xs text-white/60">拒绝</span>
        </motion.button>

        {/* 接听 */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onAnswer}
          className="flex flex-col items-center gap-2"
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/30"
          >
            <Phone size={28} className="text-white" />
          </motion.div>
          <span className="text-xs text-white/60">接听</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
