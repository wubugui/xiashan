import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toolDir = path.join(root, 'tools');
const studioHtml = path.join(toolDir, 'npc-bake-studio.html');
const bakeRoot = path.join(toolDir, 'npc-bake');
const characterId = 'suli';
const characterDir = path.join(bakeRoot, 'characters', characterId);
const draftsDir = path.join(characterDir, 'drafts');
const storyletDir = path.join(characterDir, 'storylets');
const compiledDir = path.join(characterDir, 'compiled');
const schemasDir = path.join(bakeRoot, 'schemas');
const codexBin = process.env.CODEX_BIN || '/Applications/Codex.app/Contents/Resources/codex';
const jobs = new Map();

const editableFiles = [
  '00_brief.md',
  '01_raw_script.md',
  '02_final_script.md',
  'state_model.json',
  'event_model.json',
  'situation_model.json',
  'storylets/storylets.json',
];

const modelFiles = [
  'state_model.json',
  'event_model.json',
  'situation_model.json',
  'storylets/storylets.json',
];

const sampleFiles = {
  '00_brief.md': `# 苏音音 Brief

苏音音是深夜电台主播。她习惯在节目里对所有人说晚安，但真正害怕的是下播以后手机安静下来。

她不是不想被喜欢，而是不想被别人替她安排好靠近的方式。玩家越是把路铺满，她越会退后；玩家给她退路，她反而会记住。

第一版先验证这些可玩局面：
- 下播后的空白
- 玩家把休息还给她
- 约好下播后见面
- 玩家推进太快触碰边界
- 雨夜错过末班车
`,

  '01_raw_script.md': `# 苏音音原始脚本 v0.1

## 角色核心

苏音音的矛盾是：她长期把自己的声音给了所有听众，但真正的自己很少被具体地照顾。她不怕有人靠近，她怕靠近被安排成一条不能拒绝的路。

## 生活节奏

她夜里直播，下播后精神还醒着，嗓子常常哑。白天补觉，白天被连续打扰会让她失去时间感。

## 关系边界

如果玩家给她空间，她会把这件事记下来。如果玩家推进太快，她不会爆发，而是先沉默，之后需要一个轻的动作来修复。

## 典型局面

### 下播后的空白

她刚下播，嗓子哑，手机亮着。她想被陪，但不想被追问。

### 被给过休息空间

玩家刚刚说“今晚不用照顾任何人的情绪”。这让她放松，但也会确认玩家是否真的还在。

### 约好下播后见面

她答应零点四十在电台楼下见。之后的晚安不再是结束聊天，而是提醒约定还在。

### 边界被碰到

玩家在她防备高的时候把见面说得太满，她会觉得自己被安排好，需要退一步。

### 雨夜错过末班车

下播后下雨，她错过末班车。此时任何轻的陪伴都会被她理解为“不是一个人等车”。
`,

  '02_final_script.md': `# 苏音音最终脚本 v0.1

## 角色核心

苏音音是深夜电台主播。她把“晚安”说给很多人，但她真正想确认的是：下播之后，是否还有一个人不是因为节目才留下。

她的核心防御不是冷漠，而是保留自主靠近权。她可以接受喜欢，但不能接受别人替她决定“我们已经到哪一步了”。

## 生活模型

夜里是她清醒的时间。下播后她疲惫、嗓子哑、情绪比节目里更慢。白天补觉失败会让她易碎，但她会用很平的语气遮住。

## 关系模型

初识时，她更愿意接受具体的小照顾，而不是热烈表白。

熟络后，她会记住玩家是否尊重她的退后。如果玩家在她退后时继续逼近，她会提高边界；如果玩家放轻，她会把这件事记成安全感。

## 记忆模型

她会记住三类事：具体照顾、尊重边界、稳定约定。她尤其会记住玩家有没有在她需要退路时给她退路。

## 典型局面

### after_broadcast_empty 下播后的空白

她刚下播，嗓子哑，精神还醒着。她想被陪着，但不想被追问。

可用输入：player.keep_quiet, player.care_voice, player.end_topic, player.tease, player.invite_after_show, system.life_tick.rain

### after_broadcast_given_space 被给过休息空间

玩家刚刚说“你先休息。今晚不用照顾任何人的情绪。”她表面接受，内心放松。她会观察玩家是不是说完就离开。

可用输入：player.goodnight, player.open_window, system.next_day

### before_appointment 约好下播后见面

她答应零点四十在电台楼下见。此时晚安不能被理解为结束聊天，而是约定前的轻确认。

可用输入：player.goodnight, player.arrive_early, player.cancel_meet

### autonomy_boundary_touched 自主边界被碰到

玩家在她防备还高时把约见说得太满，她没有完全拒绝，但需要把主动权拿回来。

可用输入：player.goodnight, player.open_window, player.push_again

### rain_missed_train 雨夜错过末班车

下播后下雨，她错过末班车。她在电台门口等雨小一点，此时很容易把轻的陪伴理解成“不是一个人在等车”。

可用输入：player.goodnight, player.open_window, player.offer_pickup
`,
};

const sampleJson = {
  'state_model.json': {
    characterId,
    dimensions: [
      {
        id: 'autonomy_pressure',
        label: '被安排感',
        kind: 'bucket',
        values: ['无', '轻微', '明显', '强烈'],
        evidence: [{ file: '02_final_script.md', quote: '她可以接受喜欢，但不能接受别人替她决定“我们已经到哪一步了”。' }],
        usage: ['约见', '边界修复', '推进过快'],
      },
      {
        id: 'need_connection',
        label: '连接需求',
        kind: 'bucket',
        values: ['低', '中', '高'],
        evidence: [{ file: '02_final_script.md', quote: '下播之后，是否还有一个人不是因为节目才留下。' }],
        usage: ['下播后', '雨夜', '冷落'],
      },
      {
        id: 'boundary_safety',
        label: '边界安全感',
        kind: 'bucket',
        values: ['低', '中', '高'],
        evidence: [{ file: '02_final_script.md', quote: '如果玩家放轻，她会把这件事记成安全感。' }],
        usage: ['退后后的修复', '关系推进'],
      },
    ],
  },

  'event_model.json': {
    characterId,
    events: [
      { id: 'player.keep_quiet', label: '安静陪她', actor: 'player', channel: 'wechat', meaning: '陪伴但不追问' },
      { id: 'player.care_voice', label: '关心嗓子', actor: 'player', channel: 'wechat', meaning: '具体照顾' },
      { id: 'player.end_topic', label: '先结束话题', actor: 'player', channel: 'wechat', meaning: '把休息还给她' },
      { id: 'player.tease', label: '轻轻逗她', actor: 'player', channel: 'wechat', meaning: '试探靠近' },
      { id: 'player.invite_after_show', label: '约下播后见', actor: 'player', channel: 'wechat', meaning: '进入她的时间' },
      { id: 'player.goodnight', label: '发晚安', actor: 'player', channel: 'wechat', meaning: '轻确认' },
      { id: 'player.open_window', label: '只开着窗口', actor: 'player', channel: 'wechat', meaning: '低侵入陪伴' },
      { id: 'player.arrive_early', label: '提前到达', actor: 'player', channel: 'world', meaning: '兑现约定' },
      { id: 'player.cancel_meet', label: '取消见面', actor: 'player', channel: 'world', meaning: '破坏约定' },
      { id: 'player.push_again', label: '继续推进', actor: 'player', channel: 'wechat', meaning: '无视退后' },
      { id: 'player.offer_pickup', label: '去接她', actor: 'player', channel: 'world', meaning: '行动照顾' },
      { id: 'system.next_day', label: '进入下一天', actor: 'system', channel: 'time', meaning: '时间推进' },
      { id: 'system.life_tick.rain', label: '雨夜生活事件', actor: 'system', channel: 'life', meaning: '她自己的生活推进' },
    ],
  },

  'situation_model.json': {
    characterId,
    initialSituation: 'after_broadcast_empty',
    situations: [
      {
        id: 'after_broadcast_empty',
        label: '下播后的空白',
        summary: '她刚下播，嗓子哑，想被陪但不想被追问。',
        snapshot: { time: '深夜', mood: '疲惫', autonomy_pressure: '无', need_connection: '高', boundary_safety: '中' },
        allowedEvents: ['player.keep_quiet', 'player.care_voice', 'player.end_topic', 'player.tease', 'player.invite_after_show', 'system.life_tick.rain'],
      },
      {
        id: 'after_broadcast_given_space',
        label: '被给过休息空间',
        summary: '玩家把休息还给她，她放松但确认玩家是否还在。',
        snapshot: { time: '深夜', mood: '放松', autonomy_pressure: '无', need_connection: '中', boundary_safety: '高' },
        allowedEvents: ['player.goodnight', 'player.open_window', 'system.next_day'],
      },
      {
        id: 'before_appointment',
        label: '约好下播后见面',
        summary: '零点四十电台楼下的约定已经成立。',
        snapshot: { time: '深夜', mood: '克制期待', commitment: '零点四十电台楼下', autonomy_pressure: '轻微' },
        allowedEvents: ['player.goodnight', 'player.arrive_early', 'player.cancel_meet'],
      },
      {
        id: 'autonomy_boundary_touched',
        label: '自主边界被碰到',
        summary: '玩家推进太满，她需要拿回主动权。',
        snapshot: { time: '深夜', mood: '退后', autonomy_pressure: '明显', boundary_safety: '低', unresolved_loop: 'invite_too_full' },
        allowedEvents: ['player.goodnight', 'player.open_window', 'player.push_again'],
      },
      {
        id: 'rain_missed_train',
        label: '雨夜错过末班车',
        summary: '她在电台门口等雨小一点，错过了末班车。',
        snapshot: { time: '深夜', mood: '疲惫孤单', life_event: '错过末班车', need_connection: '高' },
        allowedEvents: ['player.goodnight', 'player.open_window', 'player.offer_pickup'],
      },
    ],
  },

  'storylets/storylets.json': {
    characterId,
    storylets: [
      {
        id: 'after_broadcast_end_topic',
        from: 'after_broadcast_empty',
        event: 'player.end_topic',
        to: 'after_broadcast_given_space',
        outputs: [
          { type: 'dialogue', speaker: 'player', text: '你先休息。今晚不用照顾任何人的情绪。' },
          { type: 'dialogue', speaker: 'suli', text: '这句话我收下。' },
          { type: 'dialogue', speaker: 'suli', text: '那我关机十分钟。只十分钟。' },
          { type: 'dialogue', speaker: 'suli', text: '如果醒着，别走太远。' },
        ],
        effects: { boundary_safety: '高', need_connection_delta: -1, memory_add: '玩家把休息还给她' },
        sourceRefs: [{ file: '02_final_script.md', section: 'after_broadcast_empty', quote: '她想被陪着，但不想被追问。' }],
      },
      {
        id: 'goodnight_after_giving_space',
        from: 'after_broadcast_given_space',
        event: 'player.goodnight',
        to: 'after_broadcast_given_space',
        outputs: [
          { type: 'dialogue', speaker: 'player', text: '晚安。今晚这句不是群发。' },
          { type: 'dialogue', speaker: 'suli', text: '嗯。' },
          { type: 'dialogue', speaker: 'suli', text: '你刚刚把休息还给我，现在又没有走远。' },
          { type: 'dialogue', speaker: 'suli', text: '这句晚安，我会真的拿去睡。' },
        ],
        effects: { memory_add: '玩家在给她休息空间后又轻轻道晚安', need_connection_delta: -1 },
        sourceRefs: [{ file: '02_final_script.md', section: 'after_broadcast_given_space', quote: '她会观察玩家是不是说完就离开。' }],
      },
      {
        id: 'after_broadcast_invite_after_show',
        from: 'after_broadcast_empty',
        event: 'player.invite_after_show',
        to: 'before_appointment',
        outputs: [
          { type: 'dialogue', speaker: 'player', text: '今晚下播后，我能见你一面吗？' },
          { type: 'dialogue', speaker: 'suli', text: '下播后？' },
          { type: 'dialogue', speaker: 'suli', text: '那个时间，街上只剩清扫车和末班车。' },
          { type: 'dialogue', speaker: 'suli', text: '零点四十，电台楼下。别站在风口。' },
        ],
        effects: { commitment_set: '零点四十电台楼下', autonomy_pressure: '轻微', memory_add: '玩家主动约她在下播后的时间见面' },
        sourceRefs: [{ file: '02_final_script.md', section: 'before_appointment', quote: '她答应零点四十在电台楼下见。' }],
      },
      {
        id: 'goodnight_before_appointment',
        from: 'before_appointment',
        event: 'player.goodnight',
        to: 'before_appointment',
        outputs: [
          { type: 'dialogue', speaker: 'player', text: '晚安。今晚这句不是群发。' },
          { type: 'dialogue', speaker: 'suli', text: '嗯。晚安我收到了。不是群发，也不是结束聊天。' },
          { type: 'dialogue', speaker: 'suli', text: '零点四十，电台楼下。你如果先到，就站在便利店灯下面。' },
          { type: 'dialogue', speaker: 'suli', text: '我会下楼。' },
        ],
        effects: { commitment_keep: '零点四十电台楼下', memory_add: '玩家在赴约前发过一句不是结束聊天的晚安' },
        sourceRefs: [{ file: '02_final_script.md', section: 'before_appointment', quote: '晚安不能被理解为结束聊天，而是约定前的轻确认。' }],
      },
      {
        id: 'after_broadcast_tease_boundary',
        from: 'after_broadcast_empty',
        event: 'player.tease',
        to: 'autonomy_boundary_touched',
        outputs: [
          { type: 'dialogue', speaker: 'player', text: '三百多次晚安里，有没有哪一次是单独说给我的？' },
          { type: 'silence', speaker: 'system', text: '她的输入状态亮了，又灭掉。' },
          { type: 'dialogue', speaker: 'suli', text: '这句我听见了。只是如果马上接，会显得我太容易被你逗出来。' },
        ],
        effects: { autonomy_pressure: '明显', unresolved_loop: 'tease_too_fast', memory_add: '玩家在她防备时用玩笑试探过她' },
        sourceRefs: [{ file: '02_final_script.md', section: 'autonomy_boundary_touched', quote: '她没有完全拒绝，但需要把主动权拿回来。' }],
      },
      {
        id: 'goodnight_after_autonomy_boundary',
        from: 'autonomy_boundary_touched',
        event: 'player.goodnight',
        to: 'after_broadcast_given_space',
        outputs: [
          { type: 'dialogue', speaker: 'player', text: '晚安。今晚这句不是群发。' },
          { type: 'dialogue', speaker: 'suli', text: '刚才那句不是拒绝你。' },
          { type: 'dialogue', speaker: 'suli', text: '是我不想被安排好。' },
          { type: 'dialogue', speaker: 'suli', text: '你现在只说晚安，反而让我松了一点。' },
        ],
        effects: { autonomy_pressure: '轻微', unresolved_loop: null, memory_add: '玩家在她退后之后没有继续逼近' },
        sourceRefs: [{ file: '02_final_script.md', section: 'autonomy_boundary_touched', quote: '她没有完全拒绝，但需要把主动权拿回来。' }],
      },
      {
        id: 'after_broadcast_rain_life_tick',
        from: 'after_broadcast_empty',
        event: 'system.life_tick.rain',
        to: 'rain_missed_train',
        outputs: [
          { type: 'event', speaker: 'system', text: '下播后外面突然下大雨，她在电台门口多站了二十分钟。' },
          { type: 'signature', speaker: 'suli', text: '雨还没停。末班车也不会等人。' },
          { type: 'dialogue', speaker: 'suli', text: '刚才在台阶上等雨小一点。' },
          { type: 'dialogue', speaker: 'suli', text: '末班车没赶上。倒也不是第一次。' },
        ],
        effects: { life_event: '错过末班车', need_connection: '高', memory_add: '雨夜错过末班车' },
        sourceRefs: [{ file: '02_final_script.md', section: 'rain_missed_train', quote: '下播后下雨，她错过末班车。' }],
      },
      {
        id: 'goodnight_after_rain_missed_train',
        from: 'rain_missed_train',
        event: 'player.goodnight',
        to: 'rain_missed_train',
        outputs: [
          { type: 'dialogue', speaker: 'player', text: '晚安。今晚这句不是群发。' },
          { type: 'dialogue', speaker: 'suli', text: '嗯。' },
          { type: 'dialogue', speaker: 'suli', text: '这句晚安刚好落在雨声里。' },
          { type: 'dialogue', speaker: 'suli', text: '我还没到家，但手机亮了一下，就没那么像一个人在等车。' },
        ],
        effects: { memory_add: '她雨夜错过末班车时，玩家给过一句贴着当下的晚安', need_connection_delta: -1 },
        sourceRefs: [{ file: '02_final_script.md', section: 'rain_missed_train', quote: '轻的陪伴理解成“不是一个人在等车”。' }],
      },
    ],
  },
};

const schemas = {
  'draft_text.schema.json': {
    type: 'object',
    properties: {
      content: { type: 'string' },
      notes: { type: 'array', items: { type: 'string' } },
    },
    required: ['content'],
    additionalProperties: false,
  },
  'state_model.schema.json': {
    type: 'object',
    properties: {
      characterId: { type: 'string' },
      dimensions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            kind: { type: 'string' },
            values: { type: 'array', items: { type: 'string' } },
            evidence: { type: 'array', items: { type: 'object' } },
            usage: { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'label', 'kind', 'values', 'evidence', 'usage'],
          additionalProperties: true,
        },
      },
    },
    required: ['characterId', 'dimensions'],
    additionalProperties: false,
  },
  'event_model.schema.json': {
    type: 'object',
    properties: {
      characterId: { type: 'string' },
      events: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            actor: { type: 'string' },
            channel: { type: 'string' },
            meaning: { type: 'string' },
          },
          required: ['id', 'label', 'actor', 'channel', 'meaning'],
          additionalProperties: true,
        },
      },
    },
    required: ['characterId', 'events'],
    additionalProperties: false,
  },
  'situation_model.schema.json': {
    type: 'object',
    properties: {
      characterId: { type: 'string' },
      initialSituation: { type: 'string' },
      situations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            summary: { type: 'string' },
            snapshot: { type: 'object' },
            allowedEvents: { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'label', 'summary', 'snapshot', 'allowedEvents'],
          additionalProperties: true,
        },
      },
    },
    required: ['characterId', 'initialSituation', 'situations'],
    additionalProperties: false,
  },
  'storylets.schema.json': {
    type: 'object',
    properties: {
      characterId: { type: 'string' },
      storylets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            from: { type: 'string' },
            event: { type: 'string' },
            to: { type: 'string' },
            outputs: { type: 'array', items: { type: 'object' } },
            effects: { type: 'object' },
            sourceRefs: { type: 'array', items: { type: 'object' } },
          },
          required: ['id', 'from', 'event', 'to', 'outputs', 'effects', 'sourceRefs'],
          additionalProperties: true,
        },
      },
    },
    required: ['characterId', 'storylets'],
    additionalProperties: false,
  },
};

const jobConfigs = {
  draft_script: {
    label: '根据 Brief 生成原始脚本',
    schema: 'draft_text.schema.json',
    draft: 'drafts/01_raw_script.draft.json',
    target: '01_raw_script.md',
    prompt: () => `根据 00_brief.md 生成《苏音音原始脚本》。这是人类可读脚本，不要写 storylet。必须覆盖：角色核心、生活模型、关系模型、记忆模型、边界模型、典型局面、语言样本。\n\n${readPromptBlock(['00_brief.md'])}`,
  },
  finalize_script: {
    label: '整理最终脚本',
    schema: 'draft_text.schema.json',
    draft: 'drafts/02_final_script.draft.json',
    target: '02_final_script.md',
    prompt: () => `把 01_raw_script.md 整理成《苏音音最终脚本》。保留人类可读性，但必须让后续能抽取状态、事件、局面。不要写 storylet。\n\n${readPromptBlock(['00_brief.md', '01_raw_script.md'])}`,
  },
  extract_state_model: {
    label: '从最终脚本抽取状态模型',
    schema: 'state_model.schema.json',
    draft: 'drafts/state_model.draft.json',
    target: 'state_model.json',
    prompt: () => `从 02_final_script.md 抽取苏音音状态模型。每个状态维度必须有原文证据 evidence，不能新增无来源状态。\n\n${readPromptBlock(['02_final_script.md'])}`,
  },
  extract_event_model: {
    label: '从最终脚本抽取事件模型',
    schema: 'event_model.schema.json',
    draft: 'drafts/event_model.draft.json',
    target: 'event_model.json',
    prompt: () => `从 02_final_script.md 抽取会影响苏音音叙事树的事件目录。事件必须是结构化 event id，不要使用自由文本。\n\n${readPromptBlock(['02_final_script.md'])}`,
  },
  extract_situation_model: {
    label: '从最终脚本抽取局面库',
    schema: 'situation_model.schema.json',
    draft: 'drafts/situation_model.draft.json',
    target: 'situation_model.json',
    prompt: () => `从 02_final_script.md、state_model.json、event_model.json 抽取苏音音局面库。每个局面要有 snapshot 和 allowedEvents。\n\n${readPromptBlock(['02_final_script.md', 'state_model.json', 'event_model.json'])}`,
  },
  generate_storylets: {
    label: '生成 storylet 草稿',
    schema: 'storylets.schema.json',
    draft: 'drafts/storylets.draft.json',
    target: 'storylets/storylets.json',
    prompt: () => `根据最终脚本、状态模型、事件模型、局面库生成 storylet 草稿。每张 storylet 是 from + event -> to + outputs + effects。必须可追溯 sourceRefs。\n\n${readPromptBlock(['02_final_script.md', 'state_model.json', 'event_model.json', 'situation_model.json'])}`,
  },
  repair_storylets: {
    label: '根据校验报告修复 storylet',
    schema: 'storylets.schema.json',
    draft: 'drafts/storylets.repair.draft.json',
    target: 'storylets/storylets.json',
    prompt: () => `根据 validation_report.json 修复 storylets。只输出完整 storylets JSON，不要解释。\n\n${readPromptBlock(['02_final_script.md', 'state_model.json', 'event_model.json', 'situation_model.json', 'storylets/storylets.json', 'compiled/validation_report.json'])}`,
  },
};

function ensureProject() {
  for (const dir of [characterDir, draftsDir, storyletDir, compiledDir, schemasDir]) fs.mkdirSync(dir, { recursive: true });
  for (const [file, content] of Object.entries(sampleFiles)) writeIfMissing(path.join(characterDir, file), content);
  for (const [file, data] of Object.entries(sampleJson)) writeJsonIfMissing(path.join(characterDir, file), data);
  for (const [file, data] of Object.entries(schemas)) writeJson(path.join(schemasDir, file), data);
  writeJsonIfMissing(path.join(compiledDir, 'validation_report.json'), { ok: false, issues: ['尚未运行校验。'], warnings: [] });
  writeJsonIfMissing(path.join(compiledDir, 'nodes.json'), []);
  writeJsonIfMissing(path.join(compiledDir, 'edges.json'), []);
  writeJsonIfMissing(path.join(compiledDir, 'baked_tree.json'), { characterId, initialNodeId: '', nodes: {} });
}

function writeIfMissing(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, content, 'utf8');
}

function writeJsonIfMissing(file, data) {
  if (!fs.existsSync(file)) writeJson(file, data);
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function safeCharacterPath(relPath) {
  if (!editableFiles.includes(relPath) && !relPath.startsWith('drafts/') && !relPath.startsWith('compiled/')) {
    throw new Error(`文件不在允许范围内: ${relPath}`);
  }
  const resolved = path.resolve(characterDir, relPath);
  if (!resolved.startsWith(`${characterDir}${path.sep}`)) throw new Error('非法路径');
  return resolved;
}

function readEditableFile(relPath) {
  const file = safeCharacterPath(relPath);
  return fs.existsSync(file) ? readText(file) : '';
}

function parseEditableJson(relPath, fallback) {
  try {
    return JSON.parse(readEditableFile(relPath));
  } catch {
    return fallback;
  }
}

function readPromptBlock(files) {
  return files.map((file) => {
    const content = readEditableFile(file);
    return `--- ${file} ---\n${content}`;
  }).join('\n\n');
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, text, type = 'text/plain; charset=utf-8', status = 200) {
  res.writeHead(status, {
    'content-type': type,
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error('请求体过大'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function getDrafts() {
  if (!fs.existsSync(draftsDir)) return [];
  return fs.readdirSync(draftsDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const relPath = `drafts/${name}`;
      const file = path.join(characterDir, relPath);
      let parsed = null;
      try {
        parsed = readJson(file);
      } catch {
        parsed = null;
      }
      const meta = parsed?._npcBakeMeta || {};
      return {
        relPath,
        target: meta.target || guessTargetFromDraft(name),
        jobType: meta.jobType || '',
        label: meta.label || name,
        createdAt: meta.createdAt || fs.statSync(file).mtime.toISOString(),
        summary: summarizeDraft(parsed),
      };
    });
}

function guessTargetFromDraft(name) {
  if (name.includes('state_model')) return 'state_model.json';
  if (name.includes('event_model')) return 'event_model.json';
  if (name.includes('situation_model')) return 'situation_model.json';
  if (name.includes('storylets')) return 'storylets/storylets.json';
  if (name.includes('01_raw_script')) return '01_raw_script.md';
  if (name.includes('02_final_script')) return '02_final_script.md';
  return '';
}

function summarizeDraft(parsed) {
  if (!parsed) return '无法解析 JSON';
  if (typeof parsed.content === 'string') return parsed.content.slice(0, 120);
  if (Array.isArray(parsed.dimensions)) return `${parsed.dimensions.length} 个状态维度`;
  if (Array.isArray(parsed.events)) return `${parsed.events.length} 个事件`;
  if (Array.isArray(parsed.situations)) return `${parsed.situations.length} 个局面`;
  if (Array.isArray(parsed.storylets)) return `${parsed.storylets.length} 张 storylet`;
  return Object.keys(parsed).join(', ');
}

function loadProject() {
  return {
    characterId,
    codex: {
      bin: codexBin,
      exists: fs.existsSync(codexBin),
    },
    files: Object.fromEntries(editableFiles.map((file) => [file, readEditableFile(file)])),
    models: Object.fromEntries(modelFiles.map((file) => [file, parseEditableJson(file, null)])),
    drafts: getDrafts(),
    validation: parseEditableJson('compiled/validation_report.json', { ok: false, issues: ['尚未运行校验。'], warnings: [] }),
    compiled: {
      nodes: parseEditableJson('compiled/nodes.json', []),
      edges: parseEditableJson('compiled/edges.json', []),
      bakedTree: parseEditableJson('compiled/baked_tree.json', { characterId, initialNodeId: '', nodes: {} }),
    },
    jobs: [...jobs.values()],
  };
}

function validateBakeData() {
  const issues = [];
  const warnings = [];
  const stateModel = parseEditableJson('state_model.json', { dimensions: [] });
  const eventModel = parseEditableJson('event_model.json', { events: [] });
  const situationModel = parseEditableJson('situation_model.json', { situations: [] });
  const storyletModel = parseEditableJson('storylets/storylets.json', { storylets: [] });

  const dimensionIds = new Set();
  for (const dim of stateModel.dimensions || []) {
    if (!dim.id) issues.push('state_model: 状态维度缺少 id');
    if (dimensionIds.has(dim.id)) issues.push(`state_model: 重复状态维度 ${dim.id}`);
    dimensionIds.add(dim.id);
    if (!Array.isArray(dim.values) || dim.values.length === 0) issues.push(`state_model: ${dim.id} 缺少 values`);
    if (!Array.isArray(dim.evidence) || dim.evidence.length === 0) issues.push(`state_model: ${dim.id} 缺少脚本证据 evidence`);
  }

  const eventIds = new Set();
  for (const event of eventModel.events || []) {
    if (!event.id) issues.push('event_model: 事件缺少 id');
    if (eventIds.has(event.id)) issues.push(`event_model: 重复事件 ${event.id}`);
    eventIds.add(event.id);
    if (!event.label) issues.push(`event_model: ${event.id} 缺少 label`);
  }

  const situationIds = new Set();
  const allowedBySituation = new Map();
  for (const situation of situationModel.situations || []) {
    if (!situation.id) issues.push('situation_model: 局面缺少 id');
    if (situationIds.has(situation.id)) issues.push(`situation_model: 重复局面 ${situation.id}`);
    situationIds.add(situation.id);
    if (!situation.summary) warnings.push(`situation_model: ${situation.id} 缺少 summary`);
    if (!situation.snapshot || typeof situation.snapshot !== 'object') issues.push(`situation_model: ${situation.id} 缺少 snapshot`);
    if (!Array.isArray(situation.allowedEvents)) issues.push(`situation_model: ${situation.id} 缺少 allowedEvents`);
    allowedBySituation.set(situation.id, new Set(situation.allowedEvents || []));
    for (const eventId of situation.allowedEvents || []) {
      if (!eventIds.has(eventId)) issues.push(`situation_model: ${situation.id} 引用了不存在的事件 ${eventId}`);
    }
  }
  if (!situationIds.has(situationModel.initialSituation)) {
    issues.push(`situation_model: initialSituation 不存在: ${situationModel.initialSituation}`);
  }

  const storyletIds = new Set();
  const edgeKeys = new Set();
  for (const storylet of storyletModel.storylets || []) {
    if (!storylet.id) issues.push('storylets: storylet 缺少 id');
    if (storyletIds.has(storylet.id)) issues.push(`storylets: 重复 storylet ${storylet.id}`);
    storyletIds.add(storylet.id);
    if (!situationIds.has(storylet.from)) issues.push(`storylets: ${storylet.id} from 不存在: ${storylet.from}`);
    if (!situationIds.has(storylet.to)) issues.push(`storylets: ${storylet.id} to 不存在: ${storylet.to}`);
    if (!eventIds.has(storylet.event)) issues.push(`storylets: ${storylet.id} event 不存在: ${storylet.event}`);
    const key = `${storylet.from}::${storylet.event}`;
    if (edgeKeys.has(key)) issues.push(`storylets: 同一 from+event 命中多个 storylet: ${key}`);
    edgeKeys.add(key);
    if (allowedBySituation.has(storylet.from) && !allowedBySituation.get(storylet.from).has(storylet.event)) {
      issues.push(`storylets: ${storylet.id} 的事件 ${storylet.event} 不在 ${storylet.from}.allowedEvents 内`);
    }
    if (!Array.isArray(storylet.outputs) || storylet.outputs.length === 0) issues.push(`storylets: ${storylet.id} 缺少 outputs`);
    for (const [index, output] of (storylet.outputs || []).entries()) {
      if (!output.text) issues.push(`storylets: ${storylet.id}.outputs[${index}] 缺少 text`);
      if (!output.speaker && output.type === 'dialogue') issues.push(`storylets: ${storylet.id}.outputs[${index}] 对话缺少 speaker`);
    }
    if (!storylet.effects || typeof storylet.effects !== 'object') issues.push(`storylets: ${storylet.id} 缺少 effects`);
    if (!Array.isArray(storylet.sourceRefs) || storylet.sourceRefs.length === 0) issues.push(`storylets: ${storylet.id} 缺少 sourceRefs`);
  }

  for (const situation of situationModel.situations || []) {
    for (const eventId of situation.allowedEvents || []) {
      if (!edgeKeys.has(`${situation.id}::${eventId}`)) {
        warnings.push(`未覆盖边: ${situation.id} + ${eventId}`);
      }
    }
  }

  const report = {
    ok: issues.length === 0,
    issues,
    warnings,
    counts: {
      dimensions: (stateModel.dimensions || []).length,
      events: (eventModel.events || []).length,
      situations: (situationModel.situations || []).length,
      storylets: (storyletModel.storylets || []).length,
    },
    generatedAt: new Date().toISOString(),
  };
  writeJson(safeCharacterPath('compiled/validation_report.json'), report);
  return report;
}

function compileBakeTree() {
  const report = validateBakeData();
  if (!report.ok) return { ok: false, report };

  const situationModel = parseEditableJson('situation_model.json', { situations: [] });
  const eventModel = parseEditableJson('event_model.json', { events: [] });
  const storyletModel = parseEditableJson('storylets/storylets.json', { storylets: [] });
  const eventById = new Map((eventModel.events || []).map((event) => [event.id, event]));
  const situationById = new Map((situationModel.situations || []).map((situation) => [situation.id, situation]));
  const outgoing = new Map();
  for (const storylet of storyletModel.storylets || []) {
    if (!outgoing.has(storylet.from)) outgoing.set(storylet.from, []);
    outgoing.get(storylet.from).push(storylet);
  }

  const reachable = new Set();
  const queue = [situationModel.initialSituation];
  while (queue.length) {
    const id = queue.shift();
    if (!id || reachable.has(id)) continue;
    reachable.add(id);
    for (const storylet of outgoing.get(id) || []) {
      if (!reachable.has(storylet.to)) queue.push(storylet.to);
    }
  }

  const nodes = [...reachable].map((id, index) => {
    const situation = situationById.get(id);
    return {
      id,
      timeIndex: index,
      label: situation.label,
      summary: situation.summary,
      snapshot: situation.snapshot || {},
      allowedEvents: situation.allowedEvents || [],
    };
  });

  const edges = [];
  const bakedNodes = {};
  for (const node of nodes) {
    bakedNodes[node.id] = {
      nodeId: node.id,
      timeIndex: node.timeIndex,
      snapshot: {
        situation: node.id,
        label: node.label,
        summary: node.summary,
        ...node.snapshot,
      },
      edges: {},
    };
  }

  for (const storylet of storyletModel.storylets || []) {
    if (!reachable.has(storylet.from)) continue;
    const event = eventById.get(storylet.event);
    const edge = {
      id: `${storylet.from}__${storylet.event}`,
      from: storylet.from,
      event: storylet.event,
      eventLabel: event?.label || storylet.event,
      to: storylet.to,
      storyletId: storylet.id,
      outputs: storylet.outputs,
      effects: storylet.effects,
      sourceRefs: storylet.sourceRefs,
    };
    edges.push(edge);
    bakedNodes[storylet.from].edges[storylet.event] = {
      to: storylet.to,
      storyletId: storylet.id,
      outputs: storylet.outputs,
      effects: storylet.effects,
      sourceRefs: storylet.sourceRefs,
    };
  }

  const bakedTree = {
    characterId,
    initialNodeId: situationModel.initialSituation,
    generatedAt: new Date().toISOString(),
    runtimeContract: 'currentNodeId + eventId -> edge.to + play(edge.outputs)',
    nodes: bakedNodes,
  };

  writeJson(safeCharacterPath('compiled/nodes.json'), nodes);
  writeJson(safeCharacterPath('compiled/edges.json'), edges);
  writeJson(safeCharacterPath('compiled/baked_tree.json'), bakedTree);
  return { ok: true, report, nodes, edges, bakedTree };
}

function startAgentJob(type) {
  const config = jobConfigs[type];
  if (!config) throw new Error(`未知 Agent job: ${type}`);
  if (!fs.existsSync(codexBin)) throw new Error(`找不到 Codex CLI: ${codexBin}`);

  const jobId = `${Date.now()}_${type}`;
  const resultRelPath = config.draft;
  const resultPath = safeCharacterPath(resultRelPath);
  const schemaPath = path.join(schemasDir, config.schema);
  const prompt = [
    '你是 NPC Bake Pipeline 的离线 Agent。',
    '禁止修改任何正式文件。只输出符合 schema 的最终 JSON。',
    '如果信息不足，请在 notes 或对应字段里说明，不要编造脚本证据。',
    `任务：${config.label}`,
    '',
    config.prompt(),
  ].join('\n');

  const job = {
    id: jobId,
    type,
    label: config.label,
    status: 'running',
    draft: resultRelPath,
    target: config.target,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    logs: [],
  };
  jobs.set(jobId, job);

  fs.mkdirSync(path.dirname(resultPath), { recursive: true });
  const args = [
    'exec',
    '--ephemeral',
    '--sandbox',
    'read-only',
    '--cd',
    root,
    '--output-schema',
    schemaPath,
    '-o',
    resultPath,
    prompt,
  ];
  const child = spawn(codexBin, args, { cwd: root, env: process.env });
  child.stdout.on('data', (chunk) => {
    job.logs.push(chunk.toString());
    job.logs = job.logs.slice(-80);
  });
  child.stderr.on('data', (chunk) => {
    job.logs.push(chunk.toString());
    job.logs = job.logs.slice(-80);
  });
  child.on('error', (error) => {
    job.status = 'failed';
    job.finishedAt = new Date().toISOString();
    job.logs.push(error.message);
  });
  child.on('close', (code) => {
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();
    if (code === 0 && fs.existsSync(resultPath)) {
      try {
        const parsed = readJson(resultPath);
        parsed._npcBakeMeta = {
          jobId,
          jobType: type,
          label: config.label,
          target: config.target,
          createdAt: new Date().toISOString(),
        };
        writeJson(resultPath, parsed);
        job.status = 'completed';
      } catch (error) {
        job.status = 'failed';
        job.logs.push(`无法解析 Codex 输出: ${error.message}`);
      }
    } else {
      job.status = 'failed';
    }
  });

  return job;
}

function applyDraft(relPath, target) {
  const draftPath = safeCharacterPath(relPath);
  const targetPath = safeCharacterPath(target);
  const parsed = readJson(draftPath);
  let content;
  if (typeof parsed.content === 'string' && target.endsWith('.md')) {
    content = parsed.content.endsWith('\n') ? parsed.content : `${parsed.content}\n`;
    fs.writeFileSync(targetPath, content, 'utf8');
  } else {
    const clean = { ...parsed };
    delete clean._npcBakeMeta;
    writeJson(targetPath, clean);
  }
  return { ok: true, target };
}

async function handleApi(req, res, url) {
  try {
    if (req.method === 'GET' && url.pathname === '/api/project') {
      sendJson(res, loadProject());
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/jobs') {
      sendJson(res, [...jobs.values()]);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/file') {
      const body = await readBody(req);
      if (!editableFiles.includes(body.path)) throw new Error(`不能编辑该文件: ${body.path}`);
      fs.writeFileSync(safeCharacterPath(body.path), body.content || '', 'utf8');
      sendJson(res, { ok: true });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/job') {
      const body = await readBody(req);
      sendJson(res, startAgentJob(body.type));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/apply-draft') {
      const body = await readBody(req);
      sendJson(res, applyDraft(body.draft, body.target));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/validate') {
      sendJson(res, validateBakeData());
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/compile') {
      sendJson(res, compileBakeTree());
      return;
    }
    sendJson(res, { error: 'Not found' }, 404);
  } catch (error) {
    sendJson(res, { error: error.message }, 500);
  }
}

function serve(req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url);
    return;
  }
  if (url.pathname === '/' || url.pathname === '/npc-bake-studio.html') {
    sendText(res, readText(studioHtml), 'text/html; charset=utf-8');
    return;
  }
  sendText(res, 'Not found', 'text/plain; charset=utf-8', 404);
}

function main() {
  ensureProject();
  const port = Number(process.env.NPC_BAKE_PORT || 5188);
  const server = http.createServer(serve);
  server.listen(port, '127.0.0.1', () => {
    console.log(`NPC Bake Studio: http://127.0.0.1:${port}/`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
