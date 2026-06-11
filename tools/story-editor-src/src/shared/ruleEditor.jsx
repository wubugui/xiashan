import { CharacterSelect, PhoneEventSelect } from './pickers';

// ---- Conditions / effects editor ----

export function RuleListEditor({ title, schema, value, onChange, ctx, addLabel }) {
  const rules = value || [];
  const types = Object.keys(schema);
  function update(index, next) {
    const arr = rules.slice();
    arr[index] = next;
    onChange(arr);
  }
  function remove(index) {
    const arr = rules.slice();
    arr.splice(index, 1);
    onChange(arr);
  }
  function add() {
    onChange([...rules, makeDefaultRule(schema, types[0])]);
  }
  return (
    <div className="rule-editor">
      <div className="rule-head">
        <label>{title}</label>
        <button type="button" className="rule-add" onClick={add}>{addLabel}</button>
      </div>
      {rules.length === 0 && <div className="muted">无</div>}
      <div className="rule-list">
        {rules.map((rule, index) => (
          <div className="rule-row" key={index}>
            <div className="rule-top">
              <select value={rule.type} onChange={(event) => update(index, makeDefaultRule(schema, event.target.value))}>
                {types.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <button type="button" className="rule-del" title="删除" onClick={() => remove(index)}>✕</button>
            </div>
            <div className="rule-fields">
              {(schema[rule.type] || []).map((field) => (
                <div className="rule-field" key={field.key}>
                  <label>{field.label}</label>
                  <FieldControl field={field} value={rule[field.key]} onChange={(val) => update(index, { ...rule, [field.key]: val })} ctx={ctx} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FieldControl({ field, value, onChange, ctx }) {
  if (field.kind === 'character') return <CharacterSelect value={value || ''} onChange={onChange} characters={ctx.characters} />;
  if (field.kind === 'phoneEvent') return <PhoneEventSelect value={value || ''} onChange={onChange} phoneEvents={ctx.phoneEvents} />;
  if (field.kind === 'chapter') {
    return (
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}>
        <option value="">（未选择）</option>
        {ctx.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>第{chapter.id}章 {chapter.title}</option>)}
      </select>
    );
  }
  if (field.kind === 'node') {
    return (
      <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">（未选择）</option>
        {ctx.nodes.map((node) => <option key={node.id} value={node.id}>{node.id}</option>)}
      </select>
    );
  }
  if (field.kind === 'flag') {
    const listId = `flags-${field.key}`;
    return (
      <>
        <input list={listId} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="flag 名" />
        <datalist id={listId}>{ctx.flags.map((flag) => <option key={flag} value={flag} />)}</datalist>
      </>
    );
  }
  if (field.kind === 'number') {
    return <input type="number" step={field.step || 1} value={value ?? 0} onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))} />;
  }
  return <input value={value || ''} onChange={(event) => onChange(event.target.value)} />;
}

export function makeDefaultRule(schema, type) {
  const rule = { type };
  for (const field of schema[type] || []) {
    rule[field.key] = field.kind === 'number' ? (field.default ?? 0) : (field.kind === 'chapter' ? '' : '');
  }
  return rule;
}
