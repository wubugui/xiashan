import { motion } from 'framer-motion';
import { assetUrl } from '@/lib/assets';

type FullStep = {
  kind: 'full';
  portrait: string;
  speaker: string;
  lines: string[];
  btnText: string;
};

type HintStep = {
  kind: 'hint';
  portrait: string;
  text: string;
};

const STEPS: Record<number, FullStep | HintStep> = {
  1: {
    kind: 'full',
    portrait: '/characters/face/linxia/smile.png',
    speaker: '江夏',
    lines: [
      '你好！我是江夏，二十五时便利屋的后勤搭档。',
      '这里是专门接「时间表漏掉的麻烦」的便利屋——深夜急件、凌晨找钥匙、早六点修灯……都接。',
    ],
    btnText: '继续',
  },
  2: {
    kind: 'full',
    portrait: '/characters/face/linxia/shy.png',
    speaker: '江夏',
    lines: [
      '……说起来，今天我自己有个大麻烦。我有个重要的面试，但地铁把交通卡吞了！简历和工牌全在里面！',
      '帮帮我吧？你的第一个委托就是它——【面试前的最后十分钟】。',
    ],
    btnText: '好，我来！',
  },
  3: {
    kind: 'hint',
    portrait: '/characters/face/linxia/calm.png',
    text: '前往「委托」Tab → 找到委托 → 点击「接单」',
  },
  4: {
    kind: 'hint',
    portrait: '/characters/face/linxia/calm.png',
    text: '去「地图」选地点 → 点热点标记 → 打出一张推荐类型的卡',
  },
  5: {
    kind: 'hint',
    portrait: '/characters/face/linxia/smile.png',
    text: '太棒了！信任够了之后，在「委托」Tab点「▶ 交付委托」',
  },
  6: {
    kind: 'full',
    portrait: '/characters/face/linxia/laugh.png',
    speaker: '江夏',
    lines: [
      '面试……通过了！！通知邮件刚到，我手都在抖……',
      '你帮了我太多了。我决定正式加入二十五时便利屋——以后，请多关照！',
    ],
    btnText: '领取奖励（江夏入伙）',
  },
};

interface TutorialOverlayProps {
  step: number;
  onContinue: () => void;
}

export default function TutorialOverlay({ step, onContinue }: TutorialOverlayProps) {
  const data = STEPS[step];
  if (!data) return null;

  if (data.kind === 'full') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex flex-col items-center justify-end bg-black/75 backdrop-blur-sm"
        onClick={onContinue}
      >
        <img
          src={assetUrl(data.portrait)}
          alt="江夏"
          className="relative z-10 h-64 w-auto object-contain drop-shadow-2xl pointer-events-none select-none"
        />
        <div
          className="relative z-10 w-full bg-slate-900/98 border-t border-white/10 px-5 pt-4 pb-8 pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-[11px] font-bold text-amber-300 mb-2 tracking-wide">{data.speaker}</p>
          {data.lines.map((line, i) => (
            <p key={i} className="text-sm leading-relaxed text-slate-100 mb-1.5">{line}</p>
          ))}
          <button
            onClick={onContinue}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-sm font-black text-amber-950 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
          >
            {data.btnText}
          </button>
        </div>
      </motion.div>
    );
  }

  // Non-blocking hint banner — positioned above the action bar
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="fixed left-2 right-2 z-[150] flex items-center gap-3 rounded-xl border border-amber-400/30 bg-slate-900/95 backdrop-blur-sm px-3 py-2.5 shadow-xl pointer-events-none"
      style={{ bottom: 'calc(var(--bar-h, 56px) + var(--nav-h, 0px) + 8px)' }}
    >
      <img
        src={assetUrl(data.portrait)}
        alt="江夏"
        className="h-9 w-9 rounded-full object-cover shrink-0 border-2 border-amber-400/40"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-amber-300 mb-0.5">江夏 · 教学提示</p>
        <p className="text-xs leading-snug text-white">{data.text}</p>
      </div>
      <span className="shrink-0 text-amber-400 animate-bounce text-sm">▼</span>
    </motion.div>
  );
}
