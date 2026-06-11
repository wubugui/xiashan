import { useEffect, useMemo, useState } from 'react';
import { RaritySelect, AutoTextarea } from './shared/pickers';
import { StringListEditor, ObjectListEditor } from './shared/listEditors';

const wechatStyleOptions = ['cold', 'mysterious', 'playful', 'casual', 'formal'];
const responseSpeedOptions = ['slow', 'fast', 'instant', 'unpredictable'];
const interactionTypeOptions = ['touch', 'gift', 'talk'];
const characterEffectTypeOptions = ['passive', 'story'];

function emptyCharacter() {
  return {
    id: '',
    name: '',
    title: '',
    rarity: 'R',
    element: '',
    description: '',
    portraitUrl: '',
    avatarUrl: '',
    gachaPortraitUrl: '',
    gachaBackgroundUrl: '',
    dialogues: [],
    interactions: [],
    effects: [],
    phonePersonality: { wechatStyle: 'casual', responseSpeed: 'fast', commonPhrases: [] },
  };
}

function ImageField({ label, value, onChange, options }) {
  const listId = useMemo(() => `img-opts-${label}-${Math.random().toString(36).slice(2)}`, [label]);
  return (
    <div className="form-field">
      <label>{label}</label>
      <input list={listId} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="/characters/xxx.svg" />
      {options && options.length > 0 && (
        <datalist id={listId}>{options.map((option) => <option key={option} value={option} />)}</datalist>
      )}
      <div className="thumb-row">
        {value ? <img src={value} alt={label} onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} /> : <span className="muted">无预览</span>}
      </div>
    </div>
  );
}

export default function CharacterEditor() {
  const [characters, setCharacters] = useState(null);
  const [assets, setAssets] = useState({ portraits: [], avatars: [] });
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState({ text: '', ok: true });

  useEffect(() => {
    Promise.all([
      fetch('/api/content').then((r) => r.json()),
      fetch('/api/assets').then((r) => r.json()).catch(() => ({ portraits: [], avatars: [] })),
    ]).then(([content, loadedAssets]) => {
      setCharacters(content.characters);
      setAssets(loadedAssets);
      if (content.characters.length > 0) {
        setSelectedId(content.characters[0].id);
        setForm(content.characters[0]);
      }
    });
  }, []);

  function selectCharacter(character) {
    setSelectedId(character.id);
    setForm(character);
    setMessage({ text: '', ok: true });
  }

  function addCharacter() {
    const fresh = emptyCharacter();
    const next = [...characters, fresh];
    setCharacters(next);
    setSelectedId('');
    setForm(fresh);
    setMessage({ text: '', ok: true });
  }

  function removeCharacter(character) {
    if (!window.confirm(`删除角色「${character.name || character.id}」？`)) return;
    const next = characters.filter((c) => c !== character);
    setCharacters(next);
    if (form.id === character.id) {
      setSelectedId(next[0]?.id || '');
      setForm(next[0] || null);
    }
    setMessage({ text: '', ok: true });
  }

  function updateForm(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function save() {
    const index = characters.findIndex((c) => c.id === selectedId);
    const next = characters.slice();
    if (index >= 0) next[index] = form;
    else next.push(form);
    const response = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    }).then((r) => r.json());
    if (!response.ok) {
      setMessage({ text: (response.issues || [response.error]).join('\n'), ok: false });
      return;
    }
    setCharacters(next);
    setSelectedId(form.id);
    setMessage({ text: '已保存。', ok: true });
  }

  if (!characters || !form) return <div className="loading">加载中...</div>;

  const ctx = { characters, chapters: [], nodes: [], phoneEvents: [], flags: [] };
  const filtered = search.trim()
    ? characters.filter((c) => c.id.includes(search.trim()) || c.name.includes(search.trim()))
    : characters;
  const personality = form.phonePersonality || { wechatStyle: 'casual', responseSpeed: 'fast', commonPhrases: [] };

  return (
    <div className="list-editor">
      <div className="entity-list">
        <div className="entity-list-toolbar">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索角色..." />
          <button type="button" className="primary" onClick={addCharacter}>+ 新增</button>
        </div>
        {filtered.map((character) => (
          <button
            type="button"
            key={character.id || character}
            className={character.id === selectedId ? 'entity-list-item selected' : 'entity-list-item'}
            onClick={() => selectCharacter(character)}
          >
            <span className="eli-id">{character.id || '（未命名）'} · {character.name}</span>
            <span className="eli-sub">{character.rarity} · {character.title}</span>
          </button>
        ))}
      </div>
      <div className="entity-form">
        <div className="entity-form-header">
          <strong>{form.name || form.id || '新角色'}</strong>
          {message.text && <div className={message.ok ? 'message ok' : 'message error'}>{message.text}</div>}
          <button type="button" className="danger" onClick={() => removeCharacter(form)}>删除</button>
          <button type="button" className="primary" onClick={save}>保存</button>
        </div>

        <div className="kv-grid">
          <div className="form-field"><label>ID</label><input value={form.id} onChange={(event) => updateForm({ id: event.target.value })} /></div>
          <div className="form-field"><label>名称</label><input value={form.name} onChange={(event) => updateForm({ name: event.target.value })} /></div>
          <div className="form-field"><label>称号</label><input value={form.title || ''} onChange={(event) => updateForm({ title: event.target.value })} /></div>
          <div className="form-field"><label>属性</label><input value={form.element || ''} onChange={(event) => updateForm({ element: event.target.value })} /></div>
          <div className="form-field"><label>稀有度</label><RaritySelect value={form.rarity} onChange={(value) => updateForm({ rarity: value })} /></div>
        </div>

        <div className="form-field full" style={{ marginTop: 10 }}>
          <label>简介</label>
          <AutoTextarea value={form.description || ''} onChange={(event) => updateForm({ description: event.target.value })} />
        </div>

        <div className="kv-grid" style={{ marginTop: 10 }}>
          <ImageField label="角色立绘 (portraitUrl)" value={form.portraitUrl} onChange={(value) => updateForm({ portraitUrl: value })} options={assets.portraits} />
          <ImageField label="头像 (avatarUrl)" value={form.avatarUrl} onChange={(value) => updateForm({ avatarUrl: value })} options={assets.avatars} />
          <ImageField label="抽卡立绘 (gachaPortraitUrl)" value={form.gachaPortraitUrl} onChange={(value) => updateForm({ gachaPortraitUrl: value })} options={assets.portraits} />
          <ImageField label="抽卡背景 (gachaBackgroundUrl)" value={form.gachaBackgroundUrl} onChange={(value) => updateForm({ gachaBackgroundUrl: value })} options={assets.bg} />
        </div>

        <div style={{ marginTop: 14 }}>
          <ObjectListEditor
            title="羁绊台词 (dialogues)"
            items={form.dialogues}
            onChange={(items) => updateForm({ dialogues: items })}
            makeDefault={() => ({ level: 1, text: '' })}
            addLabel="+ 添加台词"
            renderItem={(item, update) => (
              <div className="rule-fields">
                <div className="rule-field"><label>等级</label><input type="number" value={item.level ?? 0} onChange={(event) => update({ ...item, level: Number(event.target.value) })} /></div>
                <div className="rule-field" style={{ gridColumn: '1 / -1' }}><label>台词</label><AutoTextarea minHeight={48} value={item.text || ''} onChange={(event) => update({ ...item, text: event.target.value })} /></div>
              </div>
            )}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <ObjectListEditor
            title="互动 (interactions)"
            items={form.interactions}
            onChange={(items) => updateForm({ interactions: items })}
            makeDefault={() => ({ type: 'touch', response: '', level: 1 })}
            addLabel="+ 添加互动"
            renderItem={(item, update) => (
              <div className="rule-fields">
                <div className="rule-field">
                  <label>类型</label>
                  <select value={item.type} onChange={(event) => update({ ...item, type: event.target.value })}>
                    {interactionTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="rule-field"><label>解锁等级</label><input type="number" value={item.level ?? 0} onChange={(event) => update({ ...item, level: Number(event.target.value) })} /></div>
                <div className="rule-field" style={{ gridColumn: '1 / -1' }}><label>回应文案</label><AutoTextarea minHeight={48} value={item.response || ''} onChange={(event) => update({ ...item, response: event.target.value })} /></div>
              </div>
            )}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <ObjectListEditor
            title="效果 (effects)"
            items={form.effects}
            onChange={(items) => updateForm({ effects: items })}
            makeDefault={() => ({ type: 'passive', description: '', value: 0, level: 1 })}
            addLabel="+ 添加效果"
            renderItem={(item, update) => (
              <div className="rule-fields">
                <div className="rule-field">
                  <label>类型</label>
                  <select value={item.type} onChange={(event) => update({ ...item, type: event.target.value })}>
                    {characterEffectTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="rule-field"><label>数值</label><input type="number" value={item.value ?? 0} onChange={(event) => update({ ...item, value: Number(event.target.value) })} /></div>
                <div className="rule-field"><label>解锁等级</label><input type="number" value={item.level ?? 0} onChange={(event) => update({ ...item, level: Number(event.target.value) })} /></div>
                <div className="rule-field" style={{ gridColumn: '1 / -1' }}><label>描述</label><input value={item.description || ''} onChange={(event) => update({ ...item, description: event.target.value })} /></div>
              </div>
            )}
          />
        </div>

        <div className="rule-editor" style={{ marginTop: 14 }}>
          <div className="rule-head"><label>微信人设 (phonePersonality)</label></div>
          <div className="rule-row">
            <div className="rule-fields">
              <div className="rule-field">
                <label>聊天风格</label>
                <select value={personality.wechatStyle || 'casual'} onChange={(event) => updateForm({ phonePersonality: { ...personality, wechatStyle: event.target.value } })}>
                  {wechatStyleOptions.map((style) => <option key={style} value={style}>{style}</option>)}
                </select>
              </div>
              <div className="rule-field">
                <label>回复速度</label>
                <select value={personality.responseSpeed || 'fast'} onChange={(event) => updateForm({ phonePersonality: { ...personality, responseSpeed: event.target.value } })}>
                  {responseSpeedOptions.map((speed) => <option key={speed} value={speed}>{speed}</option>)}
                </select>
              </div>
            </div>
            <StringListEditor
              title="常用短语 (commonPhrases)"
              value={personality.commonPhrases}
              onChange={(items) => updateForm({ phonePersonality: { ...personality, commonPhrases: items } })}
              placeholder="嗯。"
              addLabel="+ 添加短语"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
