import { ChevronLeft, MessageCircle, MessageSquare, Phone as PhoneIcon, Lock } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import { getRelationshipStages } from '@/data/relationship';
import { commsTier, smsThreshold, callThreshold, type CommsTier } from '@/engine/phoneAccess';
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
 * 角色专属通讯页：以「人」为中心，顶部 tab 切微信/短信/电话。
 * 未解锁的通讯方式灰显并标注解锁条件——通讯权限随好感递进解锁，是养成的可见回报。
 */
export default function ContactScreen({ characterId, initialTab = 'wechat', onBack, onCall }: ContactScreenProps) {
  const affinityMap = usePlayerStore((s) => s.affinityMap);
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const character = getCharacterById(characterId);
  const owned = ownedCharacters.some((c) => c.characterId === characterId);
  const affinity = affinityMap[characterId] ?? 0;
  const tier = commsTier(characterId, owned, affinity);

  const stageName = (stage: number) => getRelationshipStages(characterId).find((s) => s.stage === stage)?.name ?? '';

  const [tab, setTab] = useState<Tab>(initialTab);

  if (!character) return null;

  const TABS: { key: Tab; label: string; icon: typeof MessageCircle; need: CommsTier }[] = [
    { key: 'wechat', label: '微信', icon: MessageCircle, need: 1 },
    { key: 'sms', label: '短信', icon: MessageSquare, need: 2 },
    { key: 'call', label: '电话', icon: PhoneIcon, need: 3 },
  ];

  const locked = (need: CommsTier) => tier < need;

  const LockedPanel = ({ kind }: { kind: 'sms' | 'call' }) => {
    const threshold = kind === 'sms' ? smsThreshold(characterId) : callThreshold(characterId);
    const stage = kind === 'sms' ? 2 : 3;
    const remain = Math.max(0, threshold - affinity);
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <Lock size={32} className="text-white/20" />
        <p className="text-sm font-bold text-white/70">
          {kind === 'sms' ? '短信还没解锁' : '还不能打电话'}
        </p>
        <p className="text-xs leading-relaxed text-white/40">
          关系到「{stageName(stage)}」才会{kind === 'sms' ? '开始发短信' : '愿意接你电话'}。
        </p>
        <div className="mt-1 w-44">
          <div className="mb-1 flex justify-between text-[10px] text-white/40">
            <span>好感 {affinity}/{threshold}</span>
            <span>还差 {remain}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn('h-full rounded-full', kind === 'sms' ? 'bg-sky-400' : 'bg-amber-400')}
              style={{ width: `${threshold > 0 ? Math.min(100, (affinity / threshold) * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  const CallPanel = () => (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
      {character.avatarUrl ? (
        <img src={assetUrl(character.avatarUrl)} alt={character.name} className="h-24 w-24 rounded-full object-cover ring-2 ring-amber-400/40" />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-600 text-2xl font-bold text-white">{character.name.charAt(0)}</div>
      )}
      <div>
        <p className="text-base font-bold text-white">{character.name}</p>
        <p className="mt-0.5 text-xs text-amber-300/80">「{stageName(3)}」· 随时可以聊聊</p>
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

      {/* Tab 栏 */}
      <div className="flex border-b border-white/10">
        {TABS.map(({ key, label, icon: Icon, need }) => {
          const isLocked = locked(need);
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors',
                tab === key ? 'text-amber-300' : isLocked ? 'text-white/25' : 'text-white/55',
              )}
            >
              {isLocked ? <Lock size={12} /> : <Icon size={14} />}
              {label}
              {tab === key && <motion.div layoutId="contactTab" className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-amber-400" />}
            </button>
          );
        })}
      </div>

      {/* 内容 */}
      <div className="min-h-0 flex-1">
        {tab === 'wechat' && <ChatDetail characterId={characterId} onBack={onBack} hideHeader />}
        {tab === 'sms' && (locked(2) ? <LockedPanel kind="sms" /> : <SMSDetail characterId={characterId} onBack={onBack} hideHeader />)}
        {tab === 'call' && (locked(3) ? <LockedPanel kind="call" /> : <CallPanel />)}
      </div>
    </div>
  );
}
