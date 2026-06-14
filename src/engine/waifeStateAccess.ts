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

/** 归一后的签名池：配置角色给 life/feeling/lover/chosen/jealous；旧角色给 distant/close/lover/chosen/jealous(单句包成数组) */
export interface SignaturePools {
  life?: string[]; feeling?: string[]; lover?: string[]; chosen?: string[]; jealous?: string[];
  distant?: string[]; close?: string[];
}
const wrap = (v?: string): string[] | undefined => (v ? [v] : undefined);

export function signaturesOf(id: string): SignaturePools {
  const cfg = waifeSignatures(id);
  if (cfg) return cfg; // 新模型：life/feeling/lover/chosen/jealous 都是数组
  const s = legacyStates[id] ?? {};
  return {
    distant: wrap(s.sigDistant), close: wrap(s.sigClose), lover: wrap(s.sigLover),
    chosen: wrap(s.sigChosen), jealous: wrap(s.sigJealous),
  };
}
