import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import PhoneFrame from '@/components/PhoneSimulator/PhoneFrame';
import PhoneHomeScreen from '@/components/PhoneSimulator/PhoneHomeScreen';
import ChatList from '@/components/PhoneSimulator/WeChat/ChatList';
import ChatDetail from '@/components/PhoneSimulator/WeChat/ChatDetail';
import CallLog from '@/components/PhoneSimulator/PhoneCall/CallLog';
import IncomingCall from '@/components/PhoneSimulator/PhoneCall/IncomingCall';
import InCall from '@/components/PhoneSimulator/PhoneCall/InCall';
import SMSList from '@/components/PhoneSimulator/SMS/SMSList';
import SMSDetail from '@/components/PhoneSimulator/SMS/SMSDetail';
import BrowserHome from '@/components/PhoneSimulator/Browser/BrowserHome';
import BrowserPage from '@/components/PhoneSimulator/Browser/BrowserPage';

type PhoneScreen =
  | { type: 'home' }
  | { type: 'wechat' }
  | { type: 'wechat_chat'; characterId: string }
  | { type: 'call_log' }
  | { type: 'incoming_call'; characterId: string }
  | { type: 'in_call'; characterId: string }
  | { type: 'sms' }
  | { type: 'sms_chat'; characterId: string }
  | { type: 'browser' }
  | { type: 'browser_page'; url: string };

export default function Phone() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<PhoneScreen>({ type: 'home' });

  const goHome = useCallback(() => setScreen({ type: 'home' }), []);

  const renderScreen = () => {
    switch (screen.type) {
      case 'home':
        return (
          <PhoneHomeScreen
            onOpenWeChat={() => setScreen({ type: 'wechat' })}
            onOpenPhone={() => setScreen({ type: 'call_log' })}
            onOpenSMS={() => setScreen({ type: 'sms' })}
            onOpenBrowser={() => setScreen({ type: 'browser' })}
          />
        );

      case 'wechat':
        return (
          <ChatList
            onOpenChat={(characterId) => setScreen({ type: 'wechat_chat', characterId })}
            onBack={goHome}
          />
        );

      case 'wechat_chat':
        return (
          <ChatDetail
            characterId={screen.characterId}
            onBack={() => setScreen({ type: 'wechat' })}
          />
        );

      case 'call_log':
        return (
          <CallLog
            onBack={goHome}
            onRedial={(characterId) => setScreen({ type: 'in_call', characterId })}
          />
        );

      case 'incoming_call':
        return (
          <IncomingCall
            characterId={screen.characterId}
            onAnswer={() => setScreen({ type: 'in_call', characterId: screen.characterId })}
            onReject={goHome}
          />
        );

      case 'in_call':
        return (
          <InCall
            characterId={screen.characterId}
            dialogueLines={['……', '嗯。', '我知道了。']}
            onEnd={goHome}
          />
        );

      case 'sms':
        return (
          <SMSList
            onOpenChat={(characterId) => setScreen({ type: 'sms_chat', characterId })}
            onBack={goHome}
          />
        );

      case 'sms_chat':
        return (
          <SMSDetail
            characterId={screen.characterId}
            onBack={() => setScreen({ type: 'sms' })}
          />
        );

      case 'browser':
        return (
          <BrowserHome
            onOpenPage={(url) => setScreen({ type: 'browser_page', url })}
            onBack={goHome}
          />
        );

      case 'browser_page':
        return (
          <BrowserPage
            url={screen.url}
            onBack={() => setScreen({ type: 'browser' })}
          />
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex min-h-screen items-center justify-center bg-slate-950"
    >
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
      <PhoneFrame onClose={() => navigate(-1)}>
        <AnimatePresence mode="wait">
          <motion.div
            key={screen.type + (screen.type === 'wechat_chat' || screen.type === 'sms_chat' || screen.type === 'in_call' || screen.type === 'incoming_call' || screen.type === 'browser_page' ? `-${(screen as { characterId?: string; url?: string }).characterId || (screen as { url?: string }).url || ''}` : '')}
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
    </motion.div>
  );
}
