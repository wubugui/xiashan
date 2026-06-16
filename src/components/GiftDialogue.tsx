import { useState } from 'react';
import { motion } from 'framer-motion';
import DialogueBox from '@/components/DialogueBox';
import { getCharacterById } from '@/data/characters';
import { assetUrl } from '@/lib/assets';

/**
 * 送礼对白 — 收下信物后，她说出送礼时的话（按性格×层次写）。
 * 她的表情立绘站在对白框上方，逐句推进；最后一句点完即收场。
 */
export default function GiftDialogue({ characterId, expression, lines, onClose }: {
  characterId: string;
  expression: string;
  lines: string[];
  onClose: () => void;
}) {
  const char = getCharacterById(characterId);
  const [i, setI] = useState(0);
  const face = char?.expressionUrls?.[expression as keyof typeof char.expressionUrls] || char?.portraitUrl || char?.avatarUrl;

  const next = () => {
    if (i < lines.length - 1) setI((n) => n + 1);
    else onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] overflow-hidden bg-gradient-to-b from-[#1a1430] via-[#241a3a] to-[#0f0a1e]"
    >
      {/* 柔光氛围 */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[55vh] w-[55vh] -translate-x-1/2 rounded-full bg-rose-400/15 blur-3xl" />

      {/* 她的表情立绘：站在对白框正上方 */}
      {face && (
        <div
          className="pointer-events-none absolute inset-x-0 top-[8vh] z-10 flex items-end justify-center"
          style={{ bottom: 'calc(var(--dlg-h, 30vh) - 4vh)' }}
        >
          <motion.img
            key={expression}
            initial={{ opacity: 0, scale: 1.04, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            src={assetUrl(face)}
            alt={char?.name}
            className="max-h-full max-w-[94vw] object-contain object-bottom drop-shadow-2xl"
          />
        </div>
      )}

      <DialogueBox
        key={i}
        speaker={char?.name}
        speakerColor="text-rose-300"
        text={lines[i]}
        onNext={next}
        onSkipTyping={() => {}}
      />
    </motion.div>
  );
}
