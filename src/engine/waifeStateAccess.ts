/**
 * 状态/反应取数的统一入口：优先「一角色一配置」(waifes/<id>.json)，
 * 否则回退旧 waifeStates.json。把两套字段名归一成配置形态，社交引擎只认这一套。
 */
import legacy from '@/content/waifeStates.json';
import { waifeReactions, waifeSignatures } from '@/data/waifes';
import type { WaifeConfig } from '@/data/waife';

const legacyStates = (legacy as {
  states: Record<string, {
    sigDistant?: string; sigClose?: string; sigLover?: string; sigChosen?: string; sigJealous?: string;
    reactSweet?: string[]; reactReject?: string[]; reactFlattered?: string[]; reactJealous?: string[];
    reactNeglect?: string[]; reactAmbient?: string[]; reactPassedOver?: string[];
  }>;
}).states;

export function reactionsOf(id: string): WaifeConfig['reactions'] {
  const cfg = waifeReactions(id);
  if (cfg) return cfg;
  const s = legacyStates[id] ?? {};
  return {
    sweet: s.reactSweet, reject: s.reactReject, flattered: s.reactFlattered, jealous: s.reactJealous,
    neglect: s.reactNeglect, ambient: s.reactAmbient, passedOver: s.reactPassedOver,
  };
}

export function signaturesOf(id: string): WaifeConfig['signatures'] {
  const cfg = waifeSignatures(id);
  if (cfg) return cfg;
  const s = legacyStates[id] ?? {};
  return { distant: s.sigDistant, close: s.sigClose, lover: s.sigLover, chosen: s.sigChosen, jealous: s.sigJealous };
}
