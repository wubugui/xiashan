import { ChevronLeft, Search } from 'lucide-react';

interface BrowserHomeProps {
  onOpenPage: (url: string) => void;
  onBack: () => void;
}

const newsItems = [
  {
    id: 1,
    title: '都市传说：深夜地铁末班车上的神秘乘客',
    summary: '多位市民反映，在末班地铁上看到一位身穿古装的乘客，到站后凭空消失……',
    url: 'https://citynews.local/urban-legend-metro',
    time: '2小时前',
    tag: '热门',
  },
  {
    id: 2,
    title: '修仙者下山？某小区住户称邻居会飞',
    summary: '城东翠湖小区多位住户反映，顶层住户经常在深夜出现在阳台外，疑似悬浮空中……',
    url: 'https://citynews.local/flying-neighbor',
    time: '5小时前',
    tag: '奇闻',
  },
  {
    id: 3,
    title: '灵异事件频发！废弃医院深夜传出歌声',
    summary: '城北废弃医院连续一周在凌晨两点传出女子歌声，附近居民彻夜难眠……',
    url: 'https://citynews.local/haunted-hospital',
    time: '昨天',
    tag: '灵异',
  },
  {
    id: 4,
    title: '神秘组织"幽冥司"被曝真实存在？',
    summary: '有网友爆料称，传说中的幽冥司并非虚构，而是真实存在的特殊机构……',
    url: 'https://citynews.local/youmingsi-exposed',
    time: '昨天',
    tag: '揭秘',
  },
  {
    id: 5,
    title: '古董店老板：有人用灵石买走了千年法器',
    summary: '城中古董街一家店铺老板称，一神秘顾客用一枚发光的石头换走了一把古剑……',
    url: 'https://citynews.local/spirit-stone-trade',
    time: '3天前',
    tag: '奇闻',
  },
];

export default function BrowserHome({ onOpenPage, onBack }: BrowserHomeProps) {
  return (
    <div className="flex h-full flex-col" style={{ background: '#1c1c1e' }}>
      {/* 地址栏 */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-2">
        <button onClick={onBack} className="text-blue-400">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 flex items-center gap-2 rounded-lg bg-[#2c2c2e] px-3 py-1.5">
          <span className="text-xs text-white/30">🔒</span>
          <span className="text-xs text-white/40">citynews.local</span>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 rounded-xl bg-[#2c2c2e] px-4 py-3">
          <Search size={16} className="text-white/30" />
          <span className="text-sm text-white/30">搜索或输入网址</span>
        </div>
      </div>

      {/* 新闻列表 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <h3 className="mb-3 text-xs font-semibold text-white/40 uppercase tracking-wider">都市传说</h3>
        <div className="space-y-3">
          {newsItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onOpenPage(item.url)}
              className="w-full rounded-xl bg-[#2c2c2e] p-3 text-left transition-colors active:bg-[#3c3c3e]"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                  {item.tag}
                </span>
                <span className="text-[10px] text-white/30">{item.time}</span>
              </div>
              <h4 className="text-sm font-medium text-white/90 line-clamp-2">
                {item.title}
              </h4>
              <p className="mt-1 text-xs text-white/40 line-clamp-2">
                {item.summary}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
