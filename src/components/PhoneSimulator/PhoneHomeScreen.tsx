import { useEffect, useRef } from 'react';
import { MessageCircle, MessageSquare, Phone as PhoneIcon, Globe, ChevronRight } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import { commsTier, type CommsTier } from '@/engine/phoneAccess';
import { checkNeglect } from '@/engine/neglect';
import { rollAmbient } from '@/engine/ambient';
import { signatureDetail, type SignatureKind } from '@/engine/signature';
import { assetUrl } from '@/lib/assets';
import { cn } from '@/lib/utils';

interface PhoneHomeScreenProps {
  onOpenContact: (characterId: string) => void;
  onOpenBrowser: () => void;
}

/**
 * 手机首页 = 以「人」为中心的消息中心。
 * 每个已加微信（抽到）的角色一行：头像 + 最近消息 + 未读 + 三档通讯图标（亮=已解锁/灰=未解锁）。
 * 取代旧的四个拟真 app 图标网格。
 */
export default function PhoneHomeScreen({ onOpenContact, onOpenBrowser }: PhoneHomeScreenProps) {
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const affinityMap = usePlayerStore((s) => s.affinityMap);
  const phoneMessages = usePlayerStore((s) => s.phoneMessages);
  const displayAvatar = usePlayerStore((s) => s.displayAvatar);
  const xinyiTarget = usePlayerStore((s) => s.xinyiTarget);
  const playerAvatarSource = usePlayerStore((s) => s.playerAvatarSource);
  const signatureSeen = usePlayerStore((s) => s.signatureSeen);
  const markSignatureSeen = usePlayerStore((s) => s.markSignatureSeen);
  const gameDay = usePlayerStore((s) => s.gameDay);
  // 签名按游戏天轮换：daySeed 用游戏天
  const today = String(gameDay);
  // 特别签名的点的染色：心事/恋人=粉，被选中=琥珀，吃醋=冷蓝
  const dotColor: Record<SignatureKind, string> = {
    feeling: 'bg-rose-400', lover: 'bg-rose-400', chosen: 'bg-amber-400', jealous: 'bg-sky-400',
    life: '', close: '', distant: '', default: '',
  };

  // 打开手机时结算"被冷落"：太久没联系的她会主动找你（每人每天最多一次）
  const neglectRan = useRef(false);
  useEffect(() => {
    if (neglectRan.current) return;
    neglectRan.current = true;
    const store = usePlayerStore.getState();
    // 被冷落/环境感按游戏天判定（与每日限频 tryDailyAction 同口径）
    const today = store.gameDay;
    const reactions = checkNeglect(
      {
        ownedCharacterIds: store.ownedCharacters.map((c) => c.characterId),
        affinityMap: store.affinityMap,
        lastContact: store.lastContact,
      },
      today,
    );
    const neglected = new Set<string>();
    for (const r of reactions) {
      if (!store.tryDailyAction(`neglect:${r.characterId}`)) continue;
      neglected.add(r.characterId);
      if (r.affinityDelta) store.addAffinity(r.characterId, r.affinityDelta);
      if (r.message) {
        store.addPhoneMessage({
          id: `neglect_${r.characterId}_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
          characterId: r.characterId, type: 'wechat', content: r.message, timestamp: Date.now(), read: false,
        });
      }
    }

    // 环境感：关系够近的她偶尔主动找你（每天至多一条；不和冷落重叠）
    const ambient = rollAmbient(
      { ownedCharacterIds: store.ownedCharacters.map((c) => c.characterId), affinityMap: store.affinityMap, lastContact: store.lastContact },
      today,
    );
    if (ambient && !neglected.has(ambient.characterId) && store.tryDailyAction('ambient:day')) {
      store.addPhoneMessage({
        id: `ambient_${ambient.characterId}_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
        characterId: ambient.characterId, type: 'wechat', content: ambient.message, timestamp: Date.now(), read: false,
      });
    }
  }, []);

  const contacts = ownedCharacters
    .map((oc) => {
      const char = getCharacterById(oc.characterId);
      if (!char) return null;
      const msgs = phoneMessages
        .filter((m) => m.characterId === oc.characterId)
        .sort((a, b) => a.timestamp - b.timestamp);
      const last = msgs[msgs.length - 1];
      const unread = msgs.filter((m) => !m.read && !m.id.startsWith('player_')).length;
      const aff = affinityMap[oc.characterId] ?? 0;
      const tier = commsTier(oc.characterId, true, aff);
      // 她当前的签名（她的状态）+ 是否有"没看过的特别变化"
      const avatarMood: 'chosen' | 'jealous' | null = !playerAvatarSource
        ? null : playerAvatarSource === oc.characterId ? 'chosen' : (aff >= 30 ? 'jealous' : null);
      const sig = signatureDetail(char, { isLover: xinyiTarget === oc.characterId, avatarMood, affinity: aff, daySeed: today });
      const sigIsNew = sig.special && signatureSeen[oc.characterId] !== sig.text;
      return { char, last, unread, tier, lastTs: last?.timestamp ?? 0, sig, sigIsNew };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.lastTs - a.lastTs);

  const formatTime = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const tierIcon = (tier: CommsTier, need: 1 | 2 | 3, Icon: typeof MessageCircle, onColor: string) => (
    <Icon size={14} className={tier >= need ? onColor : 'text-white/15'} />
  );

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0f0c29] via-[#16213e] to-[#0f0c29]">
      {/* 标题 */}
      <div className="flex items-center justify-between px-5 pb-2 pt-1">
        <h1 className="text-xl font-black text-white">消息</h1>
        <button
          onClick={onOpenBrowser}
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-sky-300 active:scale-95"
        >
          <Globe size={13} /> 城市情报
        </button>
      </div>

      {/* 联系人列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {contacts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
            <MessageCircle size={36} className="text-white/15" />
            <p className="text-sm text-white/40">还没有联系人</p>
            <p className="text-xs leading-relaxed text-white/25">在补给频道抽到她，就会自动加上微信——她会主动给你发消息。</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map(({ char, last, unread, tier, sig, sigIsNew }) => (
              <button
                key={char.id}
                onClick={() => { markSignatureSeen(char.id, sig.text); onOpenContact(char.id); }}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition-all active:scale-[0.99] hover:border-white/20"
              >
                <div className="relative shrink-0">
                  {char.avatarUrl ? (
                    <img src={assetUrl(displayAvatar[char.id] || char.avatarUrl)} alt={char.name} className="h-12 w-12 rounded-2xl object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-600 text-lg font-bold text-white">{char.name.charAt(0)}</div>
                  )}
                  {unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-white">{char.name}</span>
                    <span className="shrink-0 text-[10px] text-white/35">{formatTime(last?.timestamp ?? 0)}</span>
                  </div>
                  {unread > 0 ? (
                    <p className="mt-0.5 truncate text-xs text-white/80">{last?.content}</p>
                  ) : (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs italic text-white/45">
                      {sigIsNew && <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', dotColor[sig.kind], 'animate-pulse')} />}
                      <span className="truncate">{sig.text || (last ? last.content : '还没有聊过天')}</span>
                    </p>
                  )}
                  {/* 三档通讯图标：亮=已解锁 */}
                  <div className="mt-1.5 flex items-center gap-2.5">
                    {tierIcon(tier, 1, MessageCircle, 'text-green-400')}
                    {tierIcon(tier, 2, MessageSquare, 'text-sky-400')}
                    {tierIcon(tier, 3, PhoneIcon, 'text-amber-400')}
                  </div>
                </div>

                <ChevronRight size={16} className="shrink-0 text-white/25" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
