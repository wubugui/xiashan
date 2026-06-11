// ---- Generic array editors reused across content editors ----

export function StringListEditor({ title, value, onChange, placeholder, addLabel = '+ 添加' }) {
  const items = value || [];
  function update(index, next) {
    const arr = items.slice();
    arr[index] = next;
    onChange(arr);
  }
  function remove(index) {
    const arr = items.slice();
    arr.splice(index, 1);
    onChange(arr);
  }
  function add() {
    onChange([...items, '']);
  }
  return (
    <div className="rule-editor">
      <div className="rule-head">
        <label>{title}</label>
        <button type="button" className="rule-add" onClick={add}>{addLabel}</button>
      </div>
      {items.length === 0 && <div className="muted">无</div>}
      <div className="array-editor">
        {items.map((item, index) => (
          <div className="row" key={index}>
            <input className="grow" value={item} onChange={(event) => update(index, event.target.value)} placeholder={placeholder} />
            <button type="button" className="rule-del" title="删除" onClick={() => remove(index)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Editor for an array of plain objects, rendered via a caller-supplied field renderer.
// `makeDefault` produces the object for a freshly added item.
export function ObjectListEditor({ title, items, onChange, makeDefault, addLabel = '+ 添加', renderItem }) {
  const list = items || [];
  function update(index, next) {
    const arr = list.slice();
    arr[index] = next;
    onChange(arr);
  }
  function remove(index) {
    const arr = list.slice();
    arr.splice(index, 1);
    onChange(arr);
  }
  function add() {
    onChange([...list, makeDefault()]);
  }
  return (
    <div className="rule-editor">
      <div className="rule-head">
        <label>{title}</label>
        <button type="button" className="rule-add" onClick={add}>{addLabel}</button>
      </div>
      {list.length === 0 && <div className="muted">无</div>}
      <div className="array-editor">
        {list.map((item, index) => (
          <div className="array-item" key={index}>
            <div className="array-item-head">
              <button type="button" className="rule-del" title="删除" onClick={() => remove(index)}>✕</button>
            </div>
            {renderItem(item, (next) => update(index, next), index)}
          </div>
        ))}
      </div>
    </div>
  );
}
