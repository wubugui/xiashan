import { ChevronLeft, MessageCircle, MessageSquare, Phone as PhoneIcon, Heart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import { commsTier } from '@/engine/phoneAccess';
import { signatureFor } from '@/engine/signature';
import { nextLockedScene, type DateScene } from '@/data/scenes';
import { assetUrl } from '@/lib/assets';
import { cn } from '@/lib/utils';
import ChatDetail from './WeChat/ChatDetail';
import SMSDetail from './SMS/SMSDetail';
import DateReveal from '@/components/DateReveal';

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
  const displayAvatar = usePlayerStore((s) => s.displayAvatar);
  const xinyiTarget = usePlayerStore((s) => s.xinyiTarget);
  const playerAvatarSource = usePlayerStore((s) => s.playerAvatarSource);
  const character = getCharacterById(characterId);
  // 手机头像：玩家在收藏里「设为头像」过就用她选的表情，否则用默认
  const avatarSrc = displayAvatar[characterId] || character?.avatarUrl;
  const owned = ownedCharacters.some((c) => c.characterId === characterId);
  const affinity = affinityMap[characterId] ?? 0;
  const tier = commsTier(characterId, owned, affinity);
  // 她当前的微信签名（随恋人/头像博弈状态变化）
  const avatarMood: 'chosen' | 'jealous' | null = !playerAvatarSource
    ? null
    : playerAvatarSource === characterId ? 'chosen'
      : (affinity >= 30 ? 'jealous' : null);
  const signature = character ? signatureFor(character, { isLover: xinyiTarget === characterId, avatarMood, affinity, daySeed: new Date().toISOString().slice(0, 10) }) : '';
  /** 短信会不会有回音（tier≥2）/ 电话会不会接（tier≥3） */
  const smsReplies = tier >= 2;
  const callAnswers = tier >= 3;

  const [tab, setTab] = useState<Tab>(initialTab);

  // 打开联系人即清掉她的全部未读（微信+短信），红点不再因没切到短信 tab 而残留
  const markContactRead = usePlayerStore((s) => s.markContactRead);
  useEffect(() => { markContactRead(characterId); }, [characterId, markContactRead]);

  /* ── 约她出去：解锁约会场景收藏（关系够近 + 每日一次）── */
  const unlockedScenes = usePlayerStore((s) => s.unlockedScenes);
  const unlockScene = usePlayerStore((s) => s.unlockScene);
  const tryDailyAction = usePlayerStore((s) => s.tryDailyAction);
  const dailyActions = usePlayerStore((s) => s.dailyActions);
  const gameDay = usePlayerStore((s) => s.gameDay);
  const addAffinity = usePlayerStore((s) => s.addAffinity);
  const markContact = usePlayerStore((s) => s.markContact);
  const [dateReveal, setDateReveal] = useState<DateScene | null>(null);
  const [dateToast, setDateToast] = useState<string | null>(null);

  const nextScene = owned ? nextLockedScene(characterId, unlockedScenes) : null;
  const datedToday = dailyActions[`date:${characterId}`] === String(gameDay);
  /** 约会门槛：关系到「常联系」(tier≥2) 才肯赴约 */
  const canDate = !!nextScene && tier >= 2;

  const handleDate = () => {
    if (!nextScene || !character) return;
    if (tier < 2) { flashDate('再熟一点……她还不太好意思单独和你出去。'); return; }
    if (!tryDailyAction(`date:${characterId}`)) { flashDate(`今天已经和${character.name}约过了，明天再约吧。`); return; }
    unlockScene(nextScene.id);
    addAffinity(characterId, 3);
    markContact(characterId);
    setDateReveal(nextScene);
  };
  const flashDate = (msg: string) => { setDateToast(msg); window.setTimeout(() => setDateToast(null), 2400); };

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
        <img src={assetUrl(avatarSrc)} alt={character.name} className="h-24 w-24 rounded-full object-cover ring-2 ring-white/15" />
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
          <img src={assetUrl(avatarSrc)} alt={character.name} className="h-9 w-9 rounded-xl object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-600 text-sm font-bold text-white">{character.name.charAt(0)}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{character.name}</p>
          <p className="truncate text-[10px] italic text-white/55">{signature || `好感 ${affinity}`}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[9px] text-white/45">
          好感 {affinity} · {tier >= 3 ? '深夜长谈' : tier >= 2 ? '常联系' : '刚加好友'}
        </span>
      </div>

      {/* 约她出去：解锁约会场景收藏 */}
      {owned && (
        <div className="border-b border-white/10 px-3 py-2">
          {!nextScene ? (
            <p className="text-center text-[11px] text-rose-300/70">💞 你们的约会回忆已集齐——在「心动名册」里回味吧</p>
          ) : (
            <button
              onClick={handleDate}
              disabled={!canDate || datedToday}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-[0.99]',
                canDate && !datedToday
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-[0_0_14px_rgba(244,63,94,0.3)]'
                  : 'bg-white/8 text-white/40',
              )}
            >
              <Heart size={15} className={canDate && !datedToday ? 'fill-white' : ''} />
              {tier < 2 ? '关系再近一点，才能约她出去' : datedToday ? '今天已约过她 · 明天再来' : '约她出去 · 解锁一段约会回忆'}
            </button>
          )}
        </div>
      )}

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

      {/* 约会解锁场景揭示 */}
      <AnimatePresence>
        {dateReveal && (
          <DateReveal scene={dateReveal} characterName={character.name} onClose={() => setDateReveal(null)} />
        )}
      </AnimatePresence>
      {/* 约会限频提示 */}
      <AnimatePresence>
        {dateToast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="pointer-events-none fixed left-1/2 top-1/3 z-[120] w-[80%] max-w-xs -translate-x-1/2 rounded-xl bg-slate-800/95 px-4 py-2.5 text-center text-xs text-rose-100 shadow-xl"
          >
            {dateToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
