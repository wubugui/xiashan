import { useEffect, useState } from 'react';
import { CONDITION_SCHEMA, collectFlags } from './shared/ruleSchemas';
import { AutoTextarea } from './shared/pickers';
import { RuleListEditor } from './shared/ruleEditor';

function emptyVideo() {
  return { id: '', title: '', description: '', src: '', unlockConditions: [] };
}

export default function VideoEditor() {
  const [content, setContent] = useState(null);
  const [assets, setAssets] = useState({ videos: [] });
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState({ text: '', ok: true });

  useEffect(() => {
    Promise.all([
      fetch('/api/content').then((r) => r.json()),
      fetch('/api/assets').then((r) => r.json()).catch(() => ({ videos: [] })),
    ]).then(([loadedContent, loadedAssets]) => {
      setContent(loadedContent);
      setAssets(loadedAssets);
      if (loadedContent.videos.length > 0) {
        setSelectedId(loadedContent.videos[0].id);
        setForm(loadedContent.videos[0]);
      }
    });
  }, []);

  function selectVideo(video) {
    setSelectedId(video.id);
    setForm(video);
    setMessage({ text: '', ok: true });
  }

  function addVideo() {
    const fresh = emptyVideo();
    setContent((prev) => ({ ...prev, videos: [...prev.videos, fresh] }));
    setSelectedId('');
    setForm(fresh);
    setMessage({ text: '', ok: true });
  }

  function removeVideo(video) {
    if (!window.confirm(`删除视频「${video.title || video.id}」？`)) return;
    const next = content.videos.filter((v) => v !== video);
    setContent((prev) => ({ ...prev, videos: next }));
    if (form.id === video.id) {
      setSelectedId(next[0]?.id || '');
      setForm(next[0] || null);
    }
    setMessage({ text: '', ok: true });
  }

  function updateForm(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function save() {
    const list = content.videos;
    const index = list.findIndex((v) => v.id === selectedId);
    const next = list.slice();
    if (index >= 0) next[index] = form;
    else next.push(form);
    const response = await fetch('/api/videos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    }).then((r) => r.json());
    if (!response.ok) {
      setMessage({ text: (response.issues || [response.error]).join('\n'), ok: false });
      return;
    }
    setContent((prev) => ({ ...prev, videos: next }));
    setSelectedId(form.id);
    setMessage({ text: '已保存。', ok: true });
  }

  if (!content || !form) return <div className="loading">加载中...</div>;

  const ctx = { characters: content.characters, chapters: content.story.chapters, nodes: content.story.nodes, phoneEvents: content.phoneEvents, flags: collectFlags(content.story) };
  const filtered = search.trim()
    ? content.videos.filter((v) => v.id.includes(search.trim()) || v.title.includes(search.trim()))
    : content.videos;

  return (
    <div className="list-editor">
      <div className="entity-list">
        <div className="entity-list-toolbar">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索视频..." />
          <button type="button" className="primary" onClick={addVideo}>+ 新增</button>
        </div>
        {filtered.map((video) => (
          <button
            type="button"
            key={video.id || video}
            className={video.id === selectedId ? 'entity-list-item selected' : 'entity-list-item'}
            onClick={() => selectVideo(video)}
          >
            <span className="eli-id">{video.id || '（未命名）'}</span>
            <span className="eli-sub">{video.title}</span>
          </button>
        ))}
      </div>
      <div className="entity-form">
        <div className="entity-form-header">
          <strong>{form.title || form.id || '新视频'}</strong>
          {message.text && <div className={message.ok ? 'message ok' : 'message error'}>{message.text}</div>}
          <button type="button" className="danger" onClick={() => removeVideo(form)}>删除</button>
          <button type="button" className="primary" onClick={save}>保存</button>
        </div>

        <div className="kv-grid">
          <div className="form-field"><label>ID</label><input value={form.id} onChange={(event) => updateForm({ id: event.target.value })} /></div>
          <div className="form-field"><label>标题</label><input value={form.title || ''} onChange={(event) => updateForm({ title: event.target.value })} /></div>
          <div className="form-field full">
            <label>视频文件 (src)</label>
            <input list="video-asset-options" value={form.src || ''} onChange={(event) => updateForm({ src: event.target.value })} placeholder="/video/xxx.mp4" />
            <datalist id="video-asset-options">{(assets.videos || []).map((src) => <option key={src} value={src} />)}</datalist>
          </div>
        </div>

        <div className="form-field full" style={{ marginTop: 10 }}>
          <label>简介</label>
          <AutoTextarea value={form.description || ''} onChange={(event) => updateForm({ description: event.target.value })} />
        </div>

        <div style={{ marginTop: 14 }}>
          <RuleListEditor title="解锁条件 (unlockConditions)" schema={CONDITION_SCHEMA} value={form.unlockConditions} onChange={(rules) => updateForm({ unlockConditions: rules })} ctx={ctx} addLabel="+ 添加条件" />
        </div>
      </div>
    </div>
  );
}
