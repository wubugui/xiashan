// Schema-driven definitions for conditions / effects. Keep field metadata in one
// place so adding a new type only means editing these tables.
export const CONDITION_SCHEMA = {
  has_character: [{ key: 'characterId', label: '角色', kind: 'character' }],
  character_level: [
    { key: 'characterId', label: '角色', kind: 'character' },
    { key: 'minLevel', label: '最低等级', kind: 'number' },
  ],
  reputation: [{ key: 'minValue', label: '最低声望', kind: 'number' }],
  affinity: [
    { key: 'characterId', label: '角色', kind: 'character' },
    { key: 'minValue', label: '最低好感', kind: 'number' },
  ],
  chapter_complete: [{ key: 'chapterId', label: '章节', kind: 'chapter' }],
  node_complete: [{ key: 'nodeId', label: '节点', kind: 'node' }],
  flag_set: [{ key: 'flag', label: '标记', kind: 'flag' }],
  spirit_stones: [{ key: 'minValue', label: '最低灵石', kind: 'number' }],
  random: [{ key: 'chance', label: '概率(0-1)', kind: 'number', step: 0.01 }],
};

export const EFFECT_SCHEMA = {
  add_spirit_stones: [{ key: 'value', label: '灵石', kind: 'number' }],
  add_reputation: [{ key: 'value', label: '声望', kind: 'number' }],
  add_affinity: [
    { key: 'characterId', label: '角色', kind: 'character' },
    { key: 'value', label: '好感', kind: 'number' },
  ],
  add_exp: [
    { key: 'characterId', label: '角色', kind: 'character' },
    { key: 'value', label: '经验', kind: 'number' },
  ],
  set_flag: [{ key: 'flag', label: '标记', kind: 'flag' }],
  unlock_chapter: [{ key: 'chapterId', label: '章节', kind: 'chapter' }],
  trigger_phone_event: [{ key: 'eventId', label: '手机事件', kind: 'phoneEvent' }],
  trigger_face_slap: [{ key: 'faceSlapId', label: '打脸 ID', kind: 'text' }],
};

export function collectFlags(story) {
  const flags = new Set();
  const scanRules = (rules) => {
    for (const rule of rules || []) {
      if (rule?.flag) flags.add(rule.flag);
    }
  };
  for (const node of story.nodes) {
    scanRules(node.conditions);
    scanRules(node.effects);
    for (const choice of node.choices || []) {
      scanRules(choice.conditions);
      scanRules(choice.effects);
    }
  }
  return [...flags].sort();
}

export const nodeTypeOptions = ['narration', 'dialogue', 'choice', 'gacha_trigger', 'face_slap', 'phone_notify'];
export const rarityOptions = ['', 'N', 'R', 'SR', 'SSR'];
export const phoneTypeOptions = ['wechat', 'call', 'sms'];
export const colorPresets = ['#FFB347', '#60A5FA', '#34D399', '#F472B6', '#A78BFA', '#F87171', '#FBBF24', '#94A3B8'];
