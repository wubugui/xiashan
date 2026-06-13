import { ChevronLeft, MessageCircle, MessageSquare, Phone as PhoneIcon } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import { commsTier } from '@/engine/phoneAccess';
import { assetUrl } from '@/lib/assets';
import { cn } from '@/lib/utils';
import ChatDetail from './WeChat/ChatDetail';
import SMSDetail from './SMS/SMSDetail';

type Tab = 'wechat' | 'sms' | 'call';

interface ContactScreenProps {
  characterId: string;
  initialTab?: Tab;
  onBack: () => void;
  /** 拨打电话：切到全屏通话（Phone.tsx 处理） */
  onCall: (characterId: string) => void;
}

/**
 * 角色专属通讯页：微信/短信/电话三个 tab 始终可点、可发起——不锁 UI。
 * 关系没到位的，由「她的反应」来 gate：电话无人接听、短信石沉大海。
 */
export default function ContactScreen({ characterId, initialTab = 'wechat', onBack, onCall }: ContactScreenProps) {
  const affinityMap = usePlayerStore((s) => s.affinityMap);
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const character = getCharacterById(characterId);
  const owned = ownedCharacters.some((c) => c.characterId === characterId);
  const affinity = affinityMap[characterId] ?? 0;
  const tier = commsTier(characterId, owned, affinity);
  /** 短信会不会有回音（tier≥2）/ 电话会不会接（tier≥3） */
  const smsReplies = tier >= 2;
  const callAnswers = tier >= 3;

  const [tab, setTab] = useState<Tab>(initialTab);

  // 兜底：角色查不到（如旧存档残留已删除角色）也不能黑屏——给个能返回的提示
  if (!character) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0f0c29] px-8 text-center">
        <p className="text-sm text-white/60">这个联系人已经不在了。</p>
        <button onClick={onBack} className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs text-white/80">返回消息</button>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; icon: typeof MessageCircle }[] = [
    { key: 'wechat', label: '微信', icon: MessageCircle },
    { key: 'sms', label: '短信', icon: MessageSquare },
    { key: 'call', label: '电话', icon: PhoneIcon },
  ];

  const CallPanel = () => (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
      {character.avatarUrl ? (
        <img src={assetUrl(character.avatarUrl)} alt={character.name} className="h-24 w-24 rounded-full object-cover ring-2 ring-white/15" />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-600 text-2xl font-bold text-white">{character.name.charAt(0)}</div>
      )}
      <div>
        <p className="text-base font-bold text-white">{character.name}</p>
        <p className="mt-0.5 text-xs text-white/45">{callAnswers ? '「深夜长谈」· 随时接你电话' : '拨个电话试试'}</p>
      </div>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => onCall(characterId)}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/30"
      >
        <PhoneIcon size={26} className="text-white" />
      </motion.button>
      <p className="text-[11px] text-white/35">点击拨打</p>
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-[#0f0c29]">
      {/* 统一顶栏：返回 + 头像 + 名字 + 关系 */}
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
        <button onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10">
          <ChevronLeft size={20} />
        </button>
        {character.avatarUrl ? (
          <img src={assetUrl(character.avatarUrl)} alt={character.name} className="h-9 w-9 rounded-xl object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-600 text-sm font-bold text-white">{character.name.charAt(0)}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{character.name}</p>
          <p className="truncate text-[10px] text-white/45">好感 {affinity} · {tier >= 3 ? '深夜长谈' : tier >= 2 ? '常联系' : '刚加好友'}</p>
        </div>
      </div>

      {/* Tab 栏：三个渠道始终可点，不锁不灰 */}
      <div className="flex border-b border-white/10">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors',
              tab === key ? 'text-amber-300' : 'text-white/55',
            )}
          >
            <Icon size={14} />
            {label}
            {tab === key && <motion.div layoutId="contactTab" className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-amber-400" />}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div className="min-h-0 flex-1">
        {tab === 'wechat' && <ChatDetail characterId={characterId} onBack={onBack} hideHeader />}
        {tab === 'sms' && <SMSDetail characterId={characterId} onBack={onBack} hideHeader willReply={smsReplies} />}
        {tab === 'call' && <CallPanel />}
      </div>
    </div>
  );
}
