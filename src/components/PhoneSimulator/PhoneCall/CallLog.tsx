import { ChevronLeft, PhoneIncoming, PhoneOutgoing, PhoneMissed, Phone } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';

interface CallLogProps {
  onBack: () => void;
  onRedial: (characterId: string) => void;
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

export default function CallLog({ onBack, onRedial }: CallLogProps) {
  const phoneCallLog = usePlayerStore((s) => s.phoneCallLog);

  const sortedLogs = [...phoneCallLog].sort((a, b) => b.timestamp - a.timestamp);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return `${date.getMonth() + 1}/${date.getDate()} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '未接通';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}分${s}秒` : `${s}秒`;
  };

  const getCallIcon = (type: 'incoming' | 'outgoing' | 'missed') => {
    switch (type) {
      case 'incoming':
        return <PhoneIncoming size={14} className="text-green-400" />;
      case 'outgoing':
        return <PhoneOutgoing size={14} className="text-blue-400" />;
      case 'missed':
        return <PhoneMissed size={14} className="text-red-400" />;
    }
  };

  const getCallLabel = (type: 'incoming' | 'outgoing' | 'missed') => {
    switch (type) {
      case 'incoming':
        return '来电';
      case 'outgoing':
        return '去电';
      case 'missed':
        return '未接';
    }
  };

  return (
    <div className="flex h-full flex-col bg-black">
      {/* Header */}
      <div className="flex items-center px-4 pb-2 pt-2" style={{ background: '#1c1c1e', height: '50px' }}>
        <button onClick={onBack} className="mr-3 flex items-center text-blue-400">
          <ChevronLeft size={22} />
        </button>
        <span className="text-base font-semibold text-white">通话记录</span>
      </div>

      {/* 通话列表 */}
      <div className="flex-1 overflow-y-auto" style={{ background: '#000' }}>
        {sortedLogs.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-white/30">
            暂无通话记录
          </div>
        ) : (
          sortedLogs.map((entry, index) => {
            const character = getCharacterById(entry.characterId);
            if (!character) return null;
            const color = avatarColors[entry.characterId] || '#999';

            return (
              <div
                key={`${entry.characterId}-${entry.timestamp}-${index}`}
                className="flex items-center gap-3 border-b border-white/5 px-4 py-3"
              >
                {/* 头像 */}
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {character.name.charAt(0)}
                </div>

                {/* 信息 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        entry.type === 'missed' ? 'text-red-400' : 'text-white'
                      }`}
                    >
                      {character.name}
                    </span>
                    {getCallIcon(entry.type)}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
                    <span>{getCallLabel(entry.type)}</span>
                    <span>·</span>
                    <span>{formatDuration(entry.duration)}</span>
                    <span>·</span>
                    <span>{formatTime(entry.timestamp)}</span>
                  </div>
                </div>

                {/* 回拨按钮 */}
                <button
                  onClick={() => onRedial(entry.characterId)}
                  className="flex-shrink-0 text-blue-400"
                >
                  <Phone size={20} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
