import { useEffect, useState } from 'react';
import { CONDITION_SCHEMA, EFFECT_SCHEMA, phoneTypeOptions, collectFlags } from './shared/ruleSchemas';
import { CharacterSelect, PhoneEventSelect, AutoTextarea } from './shared/pickers';
import { RuleListEditor } from './shared/ruleEditor';
import { StringListEditor, ObjectListEditor } from './shared/listEditors';

const messageSenderOptions = ['character', 'player'];
const messageTypeOptions = ['text', 'image'];

function emptyPhoneEvent() {
  return {
    id: '',
    type: 'wechat',
    characterId: '',
    triggerConditions: [],
    messages: [],
    choices: [],
    effects: [],
    nextEventId: '',
  };
}

function emptyChoice() {
  return { text: '', effects: [], nextMessages: [] };
}

export default function PhoneEventEditor() {
  const [content, setContent] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState({ text: '', ok: true });

  useEffect(() => {
    fetch('/api/content').then((r) => r.json()).then((loaded) => {
      setContent(loaded);
      if (loaded.phoneEvents.length > 0) {
        setSelectedId(loaded.phoneEvents[0].id);
        setForm(loaded.phoneEvents[0]);
      }
    });
  }, []);

  function selectEvent(event) {
    setSelectedId(event.id);
    setForm(event);
    setMessage({ text: '', ok: true });
  }

  function addEvent() {
    const fresh = emptyPhoneEvent();
    setContent((prev) => ({ ...prev, phoneEvents: [...prev.phoneEvents, fresh] }));
    setSelectedId('');
    setForm(fresh);
    setMessage({ text: '', ok: true });
  }

  function removeEvent(event) {
    if (!window.confirm(`删除手机事件「${event.id}」？`)) return;
    const next = content.phoneEvents.filter((e) => e !== event);
    setContent((prev) => ({ ...prev, phoneEvents: next }));
    if (form.id === event.id) {
      setSelectedId(next[0]?.id || '');
      setForm(next[0] || null);
    }
    setMessage({ text: '', ok: true });
  }

  function updateForm(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function save() {
    const list = content.phoneEvents;
    const index = list.findIndex((e) => e.id === selectedId);
    const next = list.slice();
    if (index >= 0) next[index] = form;
    else next.push(form);
    const response = await fetch('/api/phone-events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    }).then((r) => r.json());
    if (!response.ok) {
      setMessage({ text: (response.issues || [response.error]).join('\n'), ok: false });
      return;
    }
    setContent((prev) => ({ ...prev, phoneEvents: next }));
    setSelectedId(form.id);
    setMessage({ text: '已保存。', ok: true });
  }

  if (!content || !form) return <div className="loading">加载中...</div>;

  const ctx = { characters: content.characters, chapters: content.story.chapters, nodes: content.story.nodes, phoneEvents: content.phoneEvents, flags: collectFlags(content.story) };
  const filtered = search.trim()
    ? content.phoneEvents.filter((e) => e.id.includes(search.trim()) || e.type.includes(search.trim()))
    : content.phoneEvents;

  return (
    <div className="list-editor">
      <div className="entity-list">
        <div className="entity-list-toolbar">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索事件..." />
          <button type="button" className="primary" onClick={addEvent}>+ 新增</button>
        </div>
        {filtered.map((event) => (
          <button
            type="button"
            key={event.id || event}
            className={event.id === selectedId ? 'entity-list-item selected' : 'entity-list-item'}
            onClick={() => selectEvent(event)}
          >
            <span className="eli-id">{event.id || '（未命名）'}</span>
            <span className="eli-sub">{event.type} · {event.characterId}</span>
          </button>
        ))}
      </div>
      <div className="entity-form">
        <div className="entity-form-header">
          <strong>{form.id || '新事件'}</strong>
          {message.text && <div className={message.ok ? 'message ok' : 'message error'}>{message.text}</div>}
          <button type="button" className="danger" onClick={() => removeEvent(form)}>删除</button>
          <button type="button" className="primary" onClick={save}>保存</button>
        </div>

        <div className="kv-grid">
          <div className="form-field"><label>ID</label><input value={form.id} onChange={(event) => updateForm({ id: event.target.value })} /></div>
          <div className="form-field">
            <label>类型</label>
            <input list="phone-event-types" value={form.type} onChange={(event) => updateForm({ type: event.target.value })} />
            <datalist id="phone-event-types">{phoneTypeOptions.map((type) => <option key={type} value={type} />)}</datalist>
          </div>
          <div className="form-field">
            <label>关联角色</label>
            <CharacterSelect value={form.characterId} onChange={(value) => updateForm({ characterId: value })} characters={content.characters} />
          </div>
          <div className="form-field">
            <label>后续事件 (nextEventId)</label>
            <PhoneEventSelect value={form.nextEventId} onChange={(value) => updateForm({ nextEventId: value })} phoneEvents={content.phoneEvents} />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <RuleListEditor title="触发条件 (triggerConditions)" schema={CONDITION_SCHEMA} value={form.triggerConditions} onChange={(rules) => updateForm({ triggerConditions: rules })} ctx={ctx} addLabel="+ 添加条件" />
        </div>

        <div style={{ marginTop: 14 }}>
          <RuleListEditor title="触发效果 (effects)" schema={EFFECT_SCHEMA} value={form.effects} onChange={(rules) => updateForm({ effects: rules })} ctx={ctx} addLabel="+ 添加效果" />
        </div>

        <div style={{ marginTop: 14 }}>
          <ObjectListEditor
            title="消息序列 (messages)"
            items={form.messages}
            onChange={(items) => updateForm({ messages: items })}
            makeDefault={() => ({ sender: 'character', content: '', type: 'text', delay: 1000 })}
            addLabel="+ 添加消息"
            renderItem={(item, update) => (
              <div className="rule-fields">
                <div className="rule-field">
                  <label>发送者</label>
                  <select value={item.sender} onChange={(event) => update({ ...item, sender: event.target.value })}>
                    {messageSenderOptions.map((sender) => <option key={sender} value={sender}>{sender}</option>)}
                  </select>
                </div>
                <div className="rule-field">
                  <label>类型</label>
                  <select value={item.type} onChange={(event) => update({ ...item, type: event.target.value })}>
                    {messageTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="rule-field"><label>延迟 (ms)</label><input type="number" value={item.delay ?? 0} onChange={(event) => update({ ...item, delay: Number(event.target.value) })} /></div>
                <div className="rule-field" style={{ gridColumn: '1 / -1' }}><label>内容</label><AutoTextarea minHeight={48} value={item.content || ''} onChange={(event) => update({ ...item, content: event.target.value })} /></div>
              </div>
            )}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <ObjectListEditor
            title="选项 (choices)"
            items={form.choices}
            onChange={(items) => updateForm({ choices: items })}
            makeDefault={emptyChoice}
            addLabel="+ 添加选项"
            renderItem={(choice, update) => (
              <div className="choice-rules">
                <div className="form-field full"><label>选项文案</label><input value={choice.text || ''} onChange={(event) => update({ ...choice, text: event.target.value })} /></div>
                <RuleListEditor title="选项效果 (effects)" schema={EFFECT_SCHEMA} value={choice.effects} onChange={(rules) => update({ ...choice, effects: rules })} ctx={ctx} addLabel="+ 添加效果" />
                <StringListEditor title="后续消息 (nextMessages)" value={choice.nextMessages} onChange={(items) => update({ ...choice, nextMessages: items })} placeholder="角色的回复文案" addLabel="+ 添加消息" />
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}
