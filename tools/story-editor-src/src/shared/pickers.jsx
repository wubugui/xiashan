import { useLayoutEffect, useRef } from 'react';
import { rarityOptions } from './ruleSchemas';

export function CharacterSelect({ value, onChange, characters }) {
  return (
    <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
      <option value="">（未选择）</option>
      {characters.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.name}</option>)}
    </select>
  );
}

export function PhoneEventSelect({ value, onChange, phoneEvents, filterType }) {
  const list = filterType ? phoneEvents.filter((event) => event.type === filterType || event.id === value) : phoneEvents;
  return (
    <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
      <option value="">（未选择）</option>
      {list.map((event) => <option key={event.id} value={event.id}>{event.id} · {event.type}</option>)}
    </select>
  );
}

export function RaritySelect({ value, onChange }) {
  return (
    <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
      {rarityOptions.map((rarity) => <option key={rarity || 'none'} value={rarity}>{rarity || '（不限）'}</option>)}
    </select>
  );
}

export function AutoTextarea({ value, onChange, minHeight = 120, maxHeight = 420, ...rest }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(maxHeight, Math.max(minHeight, el.scrollHeight + 2))}px`;
  }, [value, minHeight, maxHeight]);
  return <textarea ref={ref} value={value} onChange={onChange} {...rest} />;
}
