import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import PhoneFrame from '@/components/PhoneSimulator/PhoneFrame';
import PhoneHomeScreen from '@/components/PhoneSimulator/PhoneHomeScreen';
import ContactScreen from '@/components/PhoneSimulator/ContactScreen';
import InCall from '@/components/PhoneSimulator/PhoneCall/InCall';
import BrowserHome from '@/components/PhoneSimulator/Browser/BrowserHome';
import BrowserPage from '@/components/PhoneSimulator/Browser/BrowserPage';
import PageBackdrop from '@/components/PageBackdrop';
import { SCENE_BACKDROPS } from '@/lib/pageBackdrops';
import { getPhoneEventsByCharacter } from '@/data/phoneEvents';

type ContactTab = 'wechat' | 'sms' | 'call';

type PhoneScreen =
  | { type: 'home' }
  | { type: 'contact'; characterId: string; tab?: ContactTab }
  | { type: 'in_call'; characterId: string }
  | { type: 'browser' }
  | { type: 'browser_page'; url: string };

/** 通话台词取角色的来电事件（写好的真台词），无则用一句兜底问候——不再是占位「……嗯。我知道了」 */
function callLinesFor(characterId: string): string[] {
  const ev = getPhoneEventsByCharacter(characterId).find((e) => e.type === 'call');
  const lines = ev?.messages?.map((m) => m.content).filter(Boolean) ?? [];
  return lines.length > 0 ? lines : ['喂？……是我。', '没什么事，就是突然想听听你的声音。'];
}

export default function Phone() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<PhoneScreen>({ type: 'home' });

  const goHome = useCallback(() => setScreen({ type: 'home' }), []);

  const renderScreen = () => {
    switch (screen.type) {
      case 'home':
        return (
          <PhoneHomeScreen
            onOpenContact={(characterId) => setScreen({ type: 'contact', characterId })}
            onOpenBrowser={() => setScreen({ type: 'browser' })}
          />
        );

      case 'contact':
        return (
          <ContactScreen
            characterId={screen.characterId}
            initialTab={screen.tab}
            onBack={goHome}
            onCall={(characterId) => setScreen({ type: 'in_call', characterId })}
          />
        );

      case 'in_call':
        return (
          <InCall
            characterId={screen.characterId}
            dialogueLines={callLinesFor(screen.characterId)}
            onEnd={() => setScreen({ type: 'contact', characterId: screen.characterId, tab: 'call' })}
          />
        );

      case 'browser':
        return <BrowserHome onOpenPage={(url) => setScreen({ type: 'browser_page', url })} onBack={goHome} />;

      case 'browser_page':
        return <BrowserPage url={screen.url} onBack={() => setScreen({ type: 'browser' })} />;

      default:
        return null;
    }
  };

  const screenKey =
    screen.type === 'contact' || screen.type === 'in_call'
      ? `${screen.type}-${screen.characterId}`
      : screen.type === 'browser_page'
        ? `browser_page-${screen.url}`
        : screen.type;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050914]"
    >
      <PageBackdrop
        image={SCENE_BACKDROPS.street.image}
        mobileImage={SCENE_BACKDROPS.street.mobileImage}
        position={SCENE_BACKDROPS.street.position}
        overlayClassName="from-slate-950/40 via-slate-950/60 to-slate-950/90"
      />

      {/* 返回按钮 */}
      <div className="absolute left-4 top-4 z-30">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      {/* 手机模拟器 */}
      <div className="relative z-10">
        <PhoneFrame onClose={() => navigate(-1)}>
          <AnimatePresence mode="wait">
            <motion.div
              key={screenKey}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderScreen()}
            </motion.div>
          </AnimatePresence>
        </PhoneFrame>
      </div>
    </motion.div>
  );
}
