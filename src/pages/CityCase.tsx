/**
 * 都市群像事件垂直切片：演出、线索选择与后果结算。
 * 使用已有角色立绘、背景、Zustand 持久化状态、抽卡货币和手机系统。
 * 不修改旧委托与抽卡概率；这是一个并行可对比的玩法入口。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, FileText, LockKeyhole, Phone, ShieldCheck, Sparkles, Ticket, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageBackdrop from '@/components/PageBackdrop';
import { assetUrl } from '@/lib/assets';
import { usePlayerStore } from '@/store/usePlayerStore';
import {
  CASE_DONE_FLAG,
  CITY_CLUES,
  CITY_OUTCOMES,
  CITY_THEORIES,
  availableOutcomes,
  canVerify,
  caseStage,
  chosenOutcome,
  chosenTheory,
  clueFlag,
  foundClues,
  theoryFlag,
  type CityClueId,
  type CityOutcomeId,
  type CityTheoryId,
} from '@/engine/cityCase';

const clueIcons = { receipt: FileText, camera: Eye, voicemail: Volume2 } as const;
const clueClasses = { receipt: 'text-amber-300', camera: 'text-sky-300', voicemail: 'text-rose-300' } as const;

function HeroPortrait({ src, name, position = '' }: { src: string; name: string; position?: string }) {
  return (
    <img
      src={assetUrl(src)}
      alt={name}
      className={`pointer-events-none absolute bottom-0 h-full w-auto max-w-none object-contain object-bottom drop-shadow-[0_12px_34px_rgba(0,0,0,0.8)] ${position}`}
    />
  );
}

export default function CityCase() {
  const navigate = useNavigate();
  const flags = usePlayerStore(s => s.flags);
  const ownedCharacters = usePlayerStore(s => s.ownedCharacters);
  const tutorialStep = usePlayerStore(s => s.tutorialStep);
  const [selectedClue, setSelectedClue] = useState<CityClueId | null>(null);
  const [pendingOutcome, setPendingOutcome] = useState<CityOutcomeId | null>(null);
  const [notice, setNotice] = useState('');

  const ownedIds = ownedCharacters.map(c => c.characterId);
  const knownClues = foundClues(flags);
  const theory = chosenTheory(flags);
  const stage = caseStage(flags);
  const resultId = chosenOutcome(flags);
  const result = resultId ? CITY_OUTCOMES[resultId] : null;
  const canDecide = availableOutcomes(flags, ownedIds);
  const isCompleted = flags.includes(CASE_DONE_FLAG);

  const inspect = (id: CityClueId) => {
    if (isCompleted) return;
    setSelectedClue(id);
    if (!flags.includes(clueFlag(id))) usePlayerStore.getState().setFlag(clueFlag(id));
  };

  const deduce = (id: CityTheoryId) => {
    const store = usePlayerStore.getState();
    if (store.flags.includes(CASE_DONE_FLAG) || chosenTheory(store.flags) || foundClues(store.flags).length < 2) return;
    store.setFlag(theoryFlag(id)); // 一次判断，不可通过换页面撤销
    setSelectedClue(null);
    setNotice(id === 'rescue'
      ? '你意识到被隐瞒的也许不是盗窃，而是纸箱里有什么。'
      : '你提交了推断。但未被核实的判断将限制你之后可以采用的处理方式。');
  };

  const finish = (id: CityOutcomeId) => {
    // Zustand 单次原子写入，避免两次点击重复发奖或中途留下半完成存档。
    const completed = usePlayerStore.getState().completeCityCase(id);
    if (!completed) return;
    setPendingOutcome(null);
    setSelectedClue(null);
  };

  if (tutorialStep !== -1) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-white">
        <button onClick={() => navigate('/')} className="mb-8 flex items-center gap-2 text-amber-300">
          <ArrowLeft size={18} /> 返回首页
        </button>
        <h1 className="text-2xl font-black">午夜事件 · 尚未开放</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">先完成江夏带领的第一单委托，再来调查这桩跨人物事件。原抽卡、教学和养成路线不会受到影响。</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070d18] text-white">
      <PageBackdrop
        image="/bg/scene/store-night.jpg"
        mobileImage="/bg/mobile/store-night-portrait.jpg"
        overlayClassName="from-slate-950/80 via-slate-950/85 to-slate-950/95"
      />
      <div className="relative z-10 mx-auto max-w-2xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-2 py-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-200">
            <ArrowLeft size={16} /> 便利屋
          </button>
          <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-1.5 text-xs tracking-widest text-rose-200">特别事件 · 首次调查</span>
        </header>

        <section className="relative mt-2 overflow-hidden rounded-3xl border border-white/15 bg-slate-900/75 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-100/5 via-transparent to-black/70" />
          <div className="relative h-56 overflow-hidden sm:h-64">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(244,114,182,0.25),transparent_55%)]" />
            <HeroPortrait src="/characters/face/yunzhiyi/calm.png" name="陈小满" position="-right-7 opacity-95" />
            <HeroPortrait src="/characters/face/shenzhaoning/calm.png" name="祁宁" position="-left-16 opacity-35" />
            <div className="absolute bottom-4 left-5 max-w-[60%]">
              <p className="text-xs tracking-[0.2em] text-amber-300">CITY STORY 001 · 01:07 AM</p>
              <h1 className="mt-2 text-3xl font-black leading-tight tracking-wider drop-shadow-lg">凌晨一点<br />的纸箱</h1>
              <p className="mt-2 text-xs text-rose-100/90">“我没偷东西。但我也没法解释。”</p>
            </div>
          </div>
          <div className="relative border-t border-white/10 px-5 py-4 text-sm leading-7 text-slate-100">
            {isCompleted
              ? '故事已经落幕，但城市还在继续。她们记得你当晚做过的选择。'
              : '凌晨一点，小满推开便利屋的门。她被一段监控视频指控偷走快递，配送站已经暂停她的工作。手机里不断跳出辱骂，她却不肯说纸箱里装着什么。祁宁要求别泄露住户信息，沈疏桐则准备调查那段视频。'}
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/65 px-4 py-3">
          <div>
            <p className="text-xs text-slate-400">调查记录</p>
            <p className="mt-1 text-sm font-bold">{knownClues.length}/3 条线索 · {stage === 'ending' ? '事件已结' : stage === 'decision' ? '等待处置' : stage === 'theory' ? '可以推断' : '调查中'}</p>
          </div>
          <div className="flex gap-1.5">
            {CITY_CLUES.map(c => (
              <span key={c.id} className={`h-2.5 w-7 rounded-full ${knownClues.includes(c.id) ? 'bg-amber-400' : 'bg-white/15'}`} />
            ))}
          </div>
        </div>

        {!isCompleted && (
          <>
            <div className="mt-7 flex items-end justify-between gap-2">
              <div>
                <p className="text-xs font-bold tracking-widest text-amber-300">01 / 调查</p>
                <h2 className="mt-1 text-xl font-bold">别急着相信网传视频</h2>
              </div>
              <span className="text-xs text-slate-400">线索可反复查看</span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {CITY_CLUES.map(c => {
                const Icon = clueIcons[c.id];
                const found = knownClues.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => inspect(c.id)}
                    className={`rounded-2xl border p-4 text-left transition active:scale-[0.99] ${selectedClue === c.id ? 'border-amber-300 bg-amber-400/15' : found ? 'border-emerald-400/30 bg-slate-800/85' : 'border-white/15 bg-slate-900/80 hover:border-amber-300/60'}`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon size={21} className={clueClasses[c.id]} />
                      {found && <Check size={16} className="text-emerald-300" />}
                    </div>
                    <p className="mt-3 text-[11px] text-slate-400">{c.eyebrow}</p>
                    <h3 className="mt-1 min-h-12 text-sm font-bold leading-6">{c.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{c.preview}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs text-amber-300">{found ? '重看线索' : '调查线索'} <ArrowRight size={13} /></span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {selectedClue && (() => {
                const c = CITY_CLUES.find(item => item.id === selectedClue);
                if (!c) return null;
                const hasHelper = c.helper && ownedIds.includes(c.helper.characterId);
                return (
                  <motion.div
                    key={selectedClue}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mt-3 rounded-2xl border border-amber-400/35 bg-slate-900/95 p-4"
                  >
                    <p className="text-xs tracking-widest text-amber-300">已发现 · {c.title}</p>
                    <div className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                      {c.lines.map(line => <p key={line}>{line}</p>)}
                    </div>
                    {hasHelper && (
                      <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm leading-6 text-rose-100">
                        <Sparkles size={14} className="mr-1 inline" /> 同行角色的特殊协助：{c.helper?.text}
                      </p>
                    )}
                    {!hasHelper && c.helper && <p className="mt-3 text-xs text-slate-500">如果已通过抽卡结识相关角色，她能提供专属调查信息。</p>}
                    <button onClick={() => setSelectedClue(null)} className="mt-3 text-xs text-amber-300">收起记录</button>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {!theory && (
              <section className="mt-7 rounded-2xl border border-white/15 bg-slate-900/85 p-4">
                <p className="text-xs font-bold tracking-widest text-amber-300">02 / 推断</p>
                <h2 className="mt-2 text-lg font-bold">那个纸箱里，究竟是什么？</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  至少调查两份证据才能做出判断。判断只有一次；与案件有关的角色卡能提供额外的调查路径。
                </p>
                {knownClues.length < 2 ? (
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-400"><LockKeyhole size={15} /> 还需调查 {2 - knownClues.length} 条线索</p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {CITY_THEORIES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => deduce(t.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/15 bg-slate-800/70 px-4 py-3 text-left text-sm hover:border-amber-300/65"
                      >
                        {t.title} <ArrowRight size={16} className="shrink-0 text-amber-300" />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {theory && (
              <section className="mt-7 rounded-2xl border border-white/15 bg-slate-900/90 p-4">
                <p className="text-xs font-bold tracking-widest text-amber-300">02 / 你的判断已记录</p>
                <h2 className="mt-2 text-lg font-bold">{CITY_THEORIES.find(t => t.id === theory)?.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {theory === 'rescue'
                    ? '纸箱里的确是一只濒危的幼猫。但拍下监控并剪掉七秒的人仍然没有找到。'
                    : '这项判断不能被现有证据证实。仓促下结论，将限制你能采取的后续行动。'}
                </p>
                {theory === 'rescue' && !canVerify(flags, ownedIds) && (
                  <p className="mt-3 rounded-xl bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">要制作可供正式澄清的证据，还需要补齐全部三条线索；若已抽到祁宁或沈疏桐，她们可凭专业能力加速核实。</p>
                )}
              </section>
            )}

            {theory && (
              <section className="mt-7 rounded-2xl border border-white/15 bg-slate-900/90 p-4">
                <p className="text-xs font-bold tracking-widest text-amber-300">03 / 行动</p>
                <h2 className="mt-2 text-lg font-bold">你决定怎样处理这段录像？</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">每一种做法都会改变小满、祁宁与沈疏桐的处境。做出的决定将被存入游戏档案。</p>
                <div className="mt-4 space-y-3">
                  {(Object.keys(CITY_OUTCOMES) as CityOutcomeId[]).map(id => {
                    const o = CITY_OUTCOMES[id];
                    const allowed = canDecide.includes(id);
                    return (
                      <button
                        key={id}
                        disabled={!allowed}
                        onClick={() => setPendingOutcome(id)}
                        className={`w-full rounded-xl border px-4 py-3 text-left ${allowed ? 'border-white/20 bg-slate-800/75 hover:border-amber-300' : 'cursor-not-allowed border-white/5 bg-slate-950/40 opacity-40'}`}
                      >
                        <span className="flex items-center justify-between gap-2 text-sm font-bold">{o.title} {allowed ? <ArrowRight size={16} className="text-amber-300" /> : <LockKeyhole size={15} />}</span>
                        <span className="mt-1 block text-xs text-slate-400">{o.sub}</span>
                      </button>
                    );
                  })}
                </div>
                {notice && <p className="mt-3 text-xs text-amber-200">{notice}</p>}
              </section>
            )}
          </>
        )}

        {isCompleted && result && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6 overflow-hidden rounded-2xl border border-amber-300/30 bg-slate-900/90">
            <div className="border-b border-white/10 bg-amber-400/10 p-5">
              <p className="flex items-center gap-2 text-xs tracking-wider text-amber-300"><CheckCircle2 size={16} /> 已结案 · 城市会记得</p>
              <h2 className="mt-2 text-xl font-black">{result.title}</h2>
              <p className="mt-1 text-sm text-amber-100/80">{result.sub}</p>
            </div>
            <div className="space-y-3 p-5 text-sm leading-7 text-slate-200">
              {result.story.map(line => <p key={line}>{line}</p>)}
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-sm font-bold text-white">她们的后续反应</p>
                {result.changes.map(change => (
                  <div className="mt-3" key={change.characterId}>
                    <p className="text-xs font-semibold text-rose-200">
                      {{ yunzhiyi: '陈小满', shenzhaoning: '祁宁', murongxue: '沈疏桐' }[change.characterId as 'yunzhiyi' | 'shenzhaoning' | 'murongxue']}
                      <span className="ml-2 text-slate-400">好感 {change.affinity >= 0 ? '+' : ''}{change.affinity}</span>
                    </p>
                    <p className="mt-1 text-xs leading-6 text-slate-300">{change.message}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 rounded-xl bg-amber-400/10 p-3 text-sm font-semibold text-amber-200">
                <span className="flex items-center gap-1"><Ticket size={16} /> 普通券 +{result.normalTickets}</span>
                <span className="flex items-center gap-1"><Sparkles size={16} /> 月光 +{result.spiritStones}</span>
              </div>
              <p className="text-xs leading-6 text-slate-400">奖励只发放一次。已抽到的相关角色会发来后续消息；尚未抽到的角色也已记录她们的好感变化。此事件暂不影响其他旧委托。</p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={() => navigate('/')} className="rounded-xl border border-white/20 bg-slate-800 px-3 py-3 text-sm font-bold">回到便利屋</button>
                <button onClick={() => navigate('/gacha')} className="rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-600 px-3 py-3 text-sm font-bold">去抽角色</button>
              </div>
            </div>
          </motion.section>
        )}

        <footer className="mt-7 rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-6 text-slate-400">
          <p className="flex items-center gap-2 font-semibold text-slate-200"><ShieldCheck size={15} /> 叙事玩法 V1 · 独立试验</p>
          <p>调查线索、角色协作、一次性判断、多个长期结局。原委托玩法和角色抽卡保持不变，方便对照体验。</p>
          {ownedIds.some(id => ['shenzhaoning', 'murongxue', 'aman'].includes(id)) && (
            <p className="mt-1 flex items-center gap-1 text-amber-200"><Phone size={13} /> 你已抽到能在这桩事件里提供特殊协助的角色。</p>
          )}
        </footer>
      </div>

      <AnimatePresence>
        {pendingOutcome && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 px-5 backdrop-blur-md">
            <motion.div initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} className="w-full max-w-sm rounded-2xl border border-amber-400/30 bg-slate-900 p-5">
              <p className="text-xs tracking-widest text-amber-300">即将改变人物关系</p>
              <h3 className="mt-2 text-lg font-black">{CITY_OUTCOMES[pendingOutcome].title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{CITY_OUTCOMES[pendingOutcome].sub}。这是一个会被记住的决定，确认后不能重选。</p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setPendingOutcome(null)} className="flex-1 rounded-xl border border-white/20 bg-slate-800 py-3 text-sm">继续考虑</button>
                <button onClick={() => finish(pendingOutcome)} className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-bold text-amber-950">确认行动</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
