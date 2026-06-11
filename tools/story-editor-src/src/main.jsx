import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';
import './styles.css';
import { CONDITION_SCHEMA, EFFECT_SCHEMA, nodeTypeOptions, phoneTypeOptions, colorPresets, collectFlags } from './shared/ruleSchemas';
import { CharacterSelect, PhoneEventSelect, RaritySelect, AutoTextarea } from './shared/pickers';
import { RuleListEditor, FieldControl, makeDefaultRule } from './shared/ruleEditor';
import CharacterEditor from './characterEditor';
import PhoneEventEditor from './phoneEventEditor';
import ConfigEditor from './configEditor';
import VideoEditor from './videoEditor';

const NODE_W = 190;
const NODE_H = 120;
const nodeTypes = { story: StoryNode };

function StoryNode({ data, selected }) {
  return (
    <div className={`story-node type-${data.type} ${selected ? 'selected' : ''}`}>
      <Handle id="in" type="target" position={Position.Left} />
      <div className="top">
        <div className="id">{data.label}</div>
        <div className="type">{data.type}</div>
      </div>
      <div className="text">{data.preview || '...'}</div>
      <Handle id="out" type="source" position={Position.Right} />
    </div>
  );
}

// React Flow's native edge rendering does not draw reliably with the manual node
// sizing used here, so edges are rendered by this SVG overlay instead. The native
// edge layer is hidden via CSS (.react-flow__edges) to avoid double lines/labels.
function ManualEdges({ edges, nodes, onSelect }) {
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  return (
    <ViewportPortal>
      <svg className="manual-edges">
        <defs>
          <marker id="manual-arrow" markerWidth="10" markerHeight="10" viewBox="-10 -10 20 20" orient="auto" refX="0" refY="0">
            <path d="M -6 -5 L 1 0 L -6 5 Z" fill="#94a3b8" />
          </marker>
          <marker id="manual-arrow-choice" markerWidth="10" markerHeight="10" viewBox="-10 -10 20 20" orient="auto" refX="0" refY="0">
            <path d="M -6 -5 L 1 0 L -6 5 Z" fill="#f59e0b" />
          </marker>
        </defs>
        {edges.map((edge) => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) return null;
          const sx = source.position.x + 190;
          const sy = source.position.y + 60;
          const tx = target.position.x;
          const ty = target.position.y + 60;
          const dx = Math.max(80, Math.abs(tx - sx) * 0.45);
          const path = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
          const choice = edge.data?.kind === 'choice';
          return (
            <g key={edge.id} className={`manual-edge ${choice ? 'choice' : 'next'} ${edge.selected ? 'selected' : ''}`}>
              <path
                d={path}
                markerEnd={`url(#${choice ? 'manual-arrow-choice' : 'manual-arrow'})`}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(edge);
                }}
              />
              <text x={(sx + tx) / 2} y={(sy + ty) / 2 - 8}>{edge.label}</text>
            </g>
          );
        })}
      </svg>
    </ViewportPortal>
  );
}

const TABS = [
  { id: 'story', label: '剧情图' },
  { id: 'characters', label: '角色' },
  { id: 'phoneEvents', label: '手机事件' },
  { id: 'config', label: '抽卡与奖励' },
  { id: 'videos', label: '视频' },
];

function App() {
  const [tab, setTab] = useState('story');
  return (
    <div className="content-app">
      <nav className="tab-bar">
        <strong className="tab-title">内容编辑器</strong>
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
        <a className="tab-home" href="/">工具中心</a>
      </nav>
      <div className="tab-body">
        {tab === 'story' && (
          <ReactFlowProvider>
            <StoryGraphEditor />
          </ReactFlowProvider>
        )}
        {tab === 'characters' && <CharacterEditor />}
        {tab === 'phoneEvents' && <PhoneEventEditor />}
        {tab === 'config' && <ConfigEditor />}
        {tab === 'videos' && <VideoEditor />}
      </div>
    </div>
  );
}

function StoryGraphEditor() {
  const rf = useReactFlow();
  const [content, setContent] = useState(null);
  const [assets, setAssets] = useState({ bg: [], portraits: [], avatars: [] });
  const [layout, setLayout] = useState({});
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [chapterId, setChapterId] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState({ text: '加载中...', ok: true });
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [search, setSearch] = useState('');
  const [newNodeId, setNewNodeId] = useState('');
  const [newNodeType, setNewNodeType] = useState('narration');

  useEffect(() => {
    Promise.all([
      fetch('/api/content').then((r) => r.json()),
      fetch('/api/story-layout').then((r) => r.json()),
      fetch('/api/assets').then((r) => r.json()).catch(() => ({ bg: [], portraits: [], avatars: [] })),
    ]).then(([contentData, layoutData, assetData]) => {
      const start = contentData.story.chapters[0]?.startNodeId || contentData.story.nodes[0]?.id || '';
      setContent(contentData);
      setAssets(assetData || { bg: [], portraits: [], avatars: [] });
      setLayout(layoutData || {});
      setChapterId(contentData.story.nodes.find((node) => node.id === start)?.chapterId || contentData.story.chapters[0]?.id || 1);
      setSelectedNodeId(start);
      setMessage({ text: '已加载剧情图。', ok: true });
    }).catch((error) => setMessage({ text: String(error.message || error), ok: false }));
  }, []);

  const graph = useMemo(() => content ? buildGraph(content.story, chapterId, layout) : { nodes: [], edges: [] }, [content, chapterId, layout]);
  const selectedNode = content?.story.nodes.find((node) => node.id === selectedNodeId);
  const knownFlags = useMemo(() => content ? collectFlags(content.story) : [], [content]);
  const ruleCtx = useMemo(() => ({
    characters: content?.characters || [],
    chapters: content?.story.chapters || [],
    nodes: content?.story.nodes || [],
    phoneEvents: content?.phoneEvents || [],
    flags: knownFlags,
  }), [content, knownFlags]);

  useEffect(() => {
    setNodes(graph.nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId })));
    setEdges(graph.edges.map((edge) => ({ ...edge, selected: edge.id === selectedEdge?.id })));
  }, [graph, selectedNodeId, selectedEdge]);

  useEffect(() => {
    setForm(selectedNode ? nodeToForm(selectedNode) : {});
  }, [selectedNodeId, content]);

  useEffect(() => {
    function onKeyDown(event) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        focusSelected();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeId, nodes]);

  function updateStory(updater) {
    setContent((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      updater(next.story);
      return next;
    });
  }

  function onNodesChange(changes) {
    const removed = changes.filter((change) => change.type === 'remove').map((change) => change.id);
    if (removed.length) {
      updateStory((story) => {
        for (const id of removed) removeStoryNode(story, id);
      });
    }
    setNodes((current) => applyNodeChanges(changes, current));
  }

  function onEdgesChange(changes) {
    const removed = changes.filter((change) => change.type === 'remove').map((change) => change.id);
    if (removed.length) {
      updateStory((story) => {
        for (const id of removed) removeStoryEdgeById(story, id);
      });
    }
    setEdges((current) => applyEdgeChanges(changes, current));
  }

  function onNodeDragStop(_event, node) {
    setLayout((current) => ({ ...current, [node.id]: node.position }));
  }

  function onConnect(conn) {
    if (!conn.source || !conn.target || conn.source === conn.target) return;
    updateStory((story) => addStoryEdge(story, conn.source, conn.target));
    setSelectedNodeId(conn.source);
    setSelectedEdge(null);
    setMessage({ text: `已连接 ${conn.source} -> ${conn.target}，记得保存。`, ok: true });
  }

  function applyNodeForm() {
    if (!selectedNodeId) return;
    try {
      updateStory((story) => {
        const index = story.nodes.findIndex((node) => node.id === selectedNodeId);
        if (index < 0) throw new Error('当前节点不存在。');
        const original = story.nodes[index];
        const nextId = String(form.id || '').trim();
        if (!nextId) throw new Error('节点 ID 不能为空。');
        const next = {
          ...original,
          id: nextId,
          type: form.type || 'narration',
          text: form.text || '',
          chapterId,
        };
        setOptional(next, 'speaker', form.speaker);
        setOptional(next, 'speakerColor', form.speakerColor);
        setOptional(next, 'backgroundUrl', form.backgroundUrl);
        setRuleArray(next, 'conditions', form.conditions);
        setRuleArray(next, 'effects', form.effects);
        applySpecialForm(next, form);
        story.nodes[index] = next;
        if (nextId !== selectedNodeId) {
          renameNodeRefs(story, selectedNodeId, nextId);
          setLayout((current) => renameLayoutRef(current, selectedNodeId, nextId));
          setSelectedNodeId(nextId);
        }
      });
      setSelectedEdge(null);
      setMessage({ text: '节点修改已应用，记得保存。', ok: true });
    } catch (error) {
      setMessage({ text: String(error.message || error), ok: false });
    }
  }

  function deleteNode() {
    if (!selectedNodeId || !confirm(`删除节点 ${selectedNodeId}？引用这个节点的流向也会被移除。`)) return;
    updateStory((story) => removeStoryNode(story, selectedNodeId));
    setLayout((current) => {
      const next = { ...current };
      delete next[selectedNodeId];
      return next;
    });
    const fallback = content?.story.nodes.find((node) => node.chapterId === chapterId && node.id !== selectedNodeId)?.id || '';
    setSelectedNodeId(fallback);
    setSelectedEdge(null);
    setMessage({ text: '节点已删除，记得保存。', ok: true });
  }

  function addNode() {
    const id = String(newNodeId || '').trim();
    if (!id) {
      setMessage({ text: '请填写新节点 ID。', ok: false });
      return;
    }
    if (content.story.nodes.some((node) => node.id === id)) {
      setMessage({ text: `节点 ${id} 已存在。`, ok: false });
      return;
    }
    updateStory((story) => story.nodes.push({ id, chapterId, type: newNodeType || 'narration', text: '新剧情节点' }));
    const center = rf.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    setLayout((current) => ({ ...current, [id]: center }));
    setSelectedNodeId(id);
    setSelectedEdge(null);
    setNewNodeId('');
    setMessage({ text: '已新增节点，记得保存。', ok: true });
  }

  function deleteSelectedEdge() {
    if (!selectedEdge) return;
    updateStory((story) => removeStoryEdgeById(story, selectedEdge.id));
    setSelectedEdge(null);
    setMessage({ text: '连线已删除，记得保存。', ok: true });
  }

  function applyEdgeEdit(targetId, choiceText) {
    if (!selectedEdge) return;
    updateStory((story) => updateStoryEdge(story, selectedEdge, targetId, choiceText));
    setSelectedEdge(null);
    setMessage({ text: '连线已更新，记得保存。', ok: true });
  }

  function updateChoiceRules(choiceIndex, key, value) {
    const sourceId = selectedEdge?.source;
    if (!sourceId) return;
    updateStory((story) => {
      const source = story.nodes.find((node) => node.id === sourceId);
      const choice = source?.choices?.[choiceIndex];
      if (!choice) return;
      if (value && value.length) choice[key] = cleanRules(value);
      else delete choice[key];
    });
  }

  function autoLayout() {
    if (!content) return;
    const next = dagreLayout(graph.nodes, graph.edges);
    setLayout((current) => ({ ...current, ...next }));
    window.setTimeout(() => rf.fitView({ padding: 0.22, duration: 180 }), 60);
  }

  function focusSelected() {
    if (!selectedNodeId) return;
    rf.fitView({ nodes: [{ id: selectedNodeId }], padding: 0.45, duration: 180, maxZoom: 1.25 });
  }

  function jumpToNode(node) {
    if (node.chapterId !== chapterId) setChapterId(node.chapterId);
    setSelectedNodeId(node.id);
    setSelectedEdge(null);
    setSearch('');
    window.setTimeout(() => rf.fitView({ nodes: [{ id: node.id }], padding: 0.45, duration: 180, maxZoom: 1.25 }), 80);
  }

  async function validate() {
    applyNodeForm();
    const response = await fetch('/api/validate').then((r) => r.json());
    setMessage({ text: response.ok ? '校验通过。' : response.issues.join('\n'), ok: response.ok });
  }

  async function saveAll() {
    applyNodeForm();
    const storyResponse = await fetch('/api/story', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(content.story),
    }).then((r) => r.json());
    if (!storyResponse.ok) {
      setMessage({ text: (storyResponse.issues || [storyResponse.error]).join('\n'), ok: false });
      return;
    }
    await fetch('/api/story-layout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(layout),
    });
    setMessage({ text: '已保存剧情和节点坐标。', ok: true });
  }

  if (!content) return <div className="loading">{message.text}</div>;

  const searchResults = search.trim()
    ? content.story.nodes.filter((node) => node.id.includes(search.trim()) || String(node.text || '').includes(search.trim())).slice(0, 8)
    : [];

  return (
    <div className="app">
      <header>
        <strong>剧情图</strong>
        <select value={chapterId} onChange={(event) => {
          const id = Number(event.target.value);
          setChapterId(id);
          setSelectedNodeId(content.story.nodes.find((node) => node.chapterId === id)?.id || '');
          setSelectedEdge(null);
        }}>
          {content.story.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>第{chapter.id}章 {chapter.title}</option>)}
        </select>
        <div className="search-box">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索节点 ID / 文本" />
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((node) => (
                <button key={node.id} onClick={() => jumpToNode(node)}>
                  <span className="sr-id">{node.id}</span>
                  <span className="sr-type">{node.type}{node.chapterId !== chapterId ? ` · 第${node.chapterId}章` : ''}</span>
                  <span className="sr-text">{String(node.text || '').replace(/\s+/g, ' ').slice(0, 30)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={autoLayout}>自动布局</button>
        <button onClick={() => rf.fitView({ padding: 0.2, duration: 180 })}>适配视图</button>
        <button onClick={focusSelected}>聚焦选中 F</button>
        <button onClick={validate}>校验</button>
        <button className="primary" onClick={saveAll}>保存剧情图</button>
        <label className="inline-check"><input type="checkbox" checked={showMiniMap} onChange={(event) => setShowMiniMap(event.target.checked)} />小地图</label>
        <span className="muted">{message.ok ? 'OK' : '需要处理'} · {nodes.length} 节点 · {edges.length} 连线</span>
      </header>
      <main>
        <section className="canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_event, node) => { setSelectedNodeId(node.id); setSelectedEdge(null); }}
            onEdgeClick={(_event, edge) => { setSelectedEdge(edge); setSelectedNodeId(edge.source); }}
            onNodeDragStop={onNodeDragStop}
            fitView
            onlyRenderVisibleElements={false}
            minZoom={0.12}
            maxZoom={2.3}
            panOnDrag={[1, 2]}
            selectionOnDrag
            multiSelectionKeyCode="Shift"
            deleteKeyCode={['Backspace', 'Delete']}
            defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#94a3b8', strokeWidth: 2.6 } }}
          >
            <ManualEdges edges={edges} nodes={nodes} onSelect={(edge) => { setSelectedEdge(edge); setSelectedNodeId(edge.source); }} />
            <Background gap={18} size={1} />
            {showMiniMap && <MiniMap pannable zoomable />}
            <Controls />
          </ReactFlow>
        </section>
        <aside>
          <div className="panel">
            <label>当前选择</label>
            <div className="kv">
              <strong>ID</strong><span>{selectedNode?.id || selectedEdge?.id || '未选择'}</span>
              <strong>类型</strong><span>{selectedNode ? selectedNode.type : selectedEdge ? selectedEdge.data?.kind : '-'}</span>
              <strong>连线</strong><span>从节点右侧圆点拖到目标左侧圆点</span>
              <strong>快捷键</strong><span>F 聚焦，Delete 删除选中连线</span>
            </div>
          </div>
          <div className="panel">
            <label>新增节点</label>
            <div className="row">
              <input className="grow" value={newNodeId} onChange={(event) => setNewNodeId(event.target.value)} placeholder="新节点 ID，例如 ch1_26" />
              <select value={newNodeType} onChange={(event) => setNewNodeType(event.target.value)}>
                {nodeTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <button className="primary" onClick={addNode}>新增</button>
            </div>
          </div>
          <div className="panel">
            <label>节点属性</label>
            {selectedNode ? <NodeForm form={form} setForm={setForm} ctx={ruleCtx} assets={assets} /> : <div className="muted">选择一个节点后编辑属性。</div>}
            <div className="row">
              <button className="primary" onClick={applyNodeForm}>应用节点修改</button>
              <button className="danger" onClick={deleteNode}>删除节点</button>
            </div>
          </div>
          <div className="panel">
            <label>连线编辑</label>
            <EdgeEditor
              selectedEdge={selectedEdge}
              content={content}
              chapterId={chapterId}
              ctx={ruleCtx}
              onApply={applyEdgeEdit}
              onDelete={deleteSelectedEdge}
              onChoiceRules={updateChoiceRules}
            />
          </div>
          <div className="panel">
            <label>节点流向</label>
            <EdgeList node={selectedNode} onSelect={setSelectedEdge} />
          </div>
          <div className="panel">
            <label>消息</label>
            <div className={`message ${message.ok ? 'ok' : 'error'}`}>{message.text}</div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function NodeForm({ form, setForm, ctx, assets }) {
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setValue = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="form-grid">
      <div className="form-field"><label>节点 ID</label><input value={form.id || ''} onChange={update('id')} /></div>
      <div className="form-field"><label>节点类型</label><select value={form.type || 'narration'} onChange={update('type')}>{nodeTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
      <div className="form-field"><label>说话人</label><SpeakerCombo value={form.speaker || ''} onChange={setValue('speaker')} characters={ctx.characters} /></div>
      <div className="form-field"><label>说话人颜色</label><ColorField value={form.speakerColor || ''} onChange={setValue('speakerColor')} /></div>
      <div className="form-field full"><label>背景资源</label><BackgroundSelect value={form.backgroundUrl || ''} onChange={setValue('backgroundUrl')} options={assets.bg} /></div>
      <div className="form-field full">
        <label>剧情文本</label>
        <ExpandableTextarea value={form.text || ''} onChange={setValue('text')} className="node-text" title="剧情文本" speaker={form.speaker} speakerColor={form.speakerColor} preview />
      </div>
      <SpecialFields form={form} setForm={setForm} ctx={ctx} />
      <div className="form-field full">
        <RuleListEditor title="进入条件" schema={CONDITION_SCHEMA} value={form.conditions} onChange={setValue('conditions')} ctx={ctx} addLabel="+ 添加条件" />
      </div>
      <div className="form-field full">
        <RuleListEditor title="触发效果" schema={EFFECT_SCHEMA} value={form.effects} onChange={setValue('effects')} ctx={ctx} addLabel="+ 添加效果" />
      </div>
      <div className="form-field full"><div className="hint">剧情流向直接在图上拉线，或在连线编辑里调整；选项的条件/效果在连线编辑里设置。</div></div>
    </div>
  );
}

function SpecialFields({ form, setForm, ctx }) {
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setValue = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  if (form.type === 'gacha_trigger') {
    return <div className="form-field full"><div className="form-grid">
      <div className="form-field"><label>免费抽数</label><input type="number" min="0" value={form.gachaFreePulls || 1} onChange={update('gachaFreePulls')} /></div>
      <div className="form-field"><label>要求稀有度</label><RaritySelect value={form.gachaRequiredRarity || ''} onChange={setValue('gachaRequiredRarity')} /></div>
    </div></div>;
  }
  if (form.type === 'face_slap') {
    return <div className="form-field full"><div className="form-grid">
      <div className="form-field full"><label>出场角色</label><CharacterSelect value={form.faceCharacterId || ''} onChange={setValue('faceCharacterId')} characters={ctx.characters} /></div>
      <div className="form-field full"><label>反派名</label><input value={form.faceEnemyName || ''} onChange={update('faceEnemyName')} /></div>
      <div className="form-field full"><label>反派台词</label><ExpandableTextarea value={form.faceEnemyLine || ''} onChange={setValue('faceEnemyLine')} title="反派台词" /></div>
      <div className="form-field full"><label>角色台词</label><ExpandableTextarea value={form.faceCharacterLine || ''} onChange={setValue('faceCharacterLine')} title="角色台词" /></div>
      <div className="form-field full"><label>结果文本</label><ExpandableTextarea value={form.faceResultText || ''} onChange={setValue('faceResultText')} title="结果文本" /></div>
    </div></div>;
  }
  if (form.type === 'phone_notify') {
    return <div className="form-field full"><div className="form-grid">
      <div className="form-field"><label>通知类型</label><select value={form.phoneType || 'wechat'} onChange={update('phoneType')}>{phoneTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
      <div className="form-field"><label>角色</label><CharacterSelect value={form.phoneCharacterId || ''} onChange={setValue('phoneCharacterId')} characters={ctx.characters} /></div>
      <div className="form-field full"><label>手机事件</label><PhoneEventSelect value={form.phoneEventId || ''} onChange={setValue('phoneEventId')} phoneEvents={ctx.phoneEvents} filterType={form.phoneType} /></div>
    </div></div>;
  }
  return null;
}

// ---- Selector components ----

function SpeakerCombo({ value, onChange, characters }) {
  const listId = useMemo(() => `speakers-${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <>
      <input list={listId} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="旁白可留空，可填 NPC" />
      <datalist id={listId}>
        {characters.map((c) => <option key={c.id} value={c.name} />)}
      </datalist>
    </>
  );
}

function ColorField({ value, onChange }) {
  const valid = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value || '');
  return (
    <div className="color-field">
      <div className="color-row">
        <input type="color" value={valid ? value : '#ffb347'} onChange={(event) => onChange(event.target.value)} />
        <input className="color-text" value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="#FFB347" />
      </div>
      <div className="color-presets">
        {colorPresets.map((color) => (
          <button key={color} type="button" className="swatch" style={{ background: color }} title={color} onClick={() => onChange(color)} />
        ))}
      </div>
    </div>
  );
}

function BackgroundSelect({ value, onChange, options }) {
  const known = options.includes(value);
  const custom = value && !known;
  return (
    <div className="bg-select">
      <div className="bg-row">
        <select value={custom ? '__custom__' : (value || '')} onChange={(event) => onChange(event.target.value === '__custom__' ? value : event.target.value)}>
          <option value="">（无背景）</option>
          {options.map((url) => <option key={url} value={url}>{url.replace('/bg/', '')}</option>)}
          {custom && <option value="__custom__">自定义…</option>}
        </select>
        {value ? <img className="bg-thumb" src={value} alt="bg" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} /> : null}
      </div>
      {custom && <input className="bg-custom" value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="/bg/custom.svg" />}
    </div>
  );
}

// ---- Long-text editing ----

function ExpandableTextarea({ value, onChange, className, title, speaker, speakerColor, preview }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="expandable">
      <AutoTextarea className={className} value={value || ''} onChange={(event) => onChange(event.target.value)} />
      <button type="button" className="expand-btn" title="展开编辑" onClick={() => setOpen(true)}>⤢</button>
      {open && (
        <TextEditorModal
          title={title}
          value={value || ''}
          onChange={onChange}
          onClose={() => setOpen(false)}
          speaker={speaker}
          speakerColor={speakerColor}
          preview={preview}
        />
      )}
    </div>
  );
}

function TextEditorModal({ title, value, onChange, onClose, speaker, speakerColor, preview }) {
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    function onKey(event) {
      if (event.key === 'Escape') { commit(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  function commit() {
    onChange(draft);
    onClose();
  }
  const chars = draft.length;
  const lines = draft.split('\n').length;
  const paragraphs = draft.split(/\n{2,}/).filter((p) => p.trim().length);
  return (
    <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) commit(); }}>
      <div className="modal">
        <div className="modal-head">
          <strong>{title || '文本编辑'}</strong>
          <span className="muted">{chars} 字 · {lines} 行</span>
          <button className="primary" onClick={commit}>完成 (Esc)</button>
        </div>
        <div className={`modal-body ${preview ? 'with-preview' : ''}`}>
          <textarea ref={ref} className="modal-text" value={draft} onChange={(event) => setDraft(event.target.value)} />
          {preview && (
            <div className="modal-preview">
              {speaker ? <div className="pv-speaker" style={{ color: speakerColor || '#FFB347' }}>{speaker}</div> : <div className="pv-speaker pv-narration">旁白</div>}
              <div className="pv-text">
                {paragraphs.length
                  ? paragraphs.map((p, index) => <p key={index}>{p}</p>)
                  : <p className="muted">（空）</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EdgeEditor({ selectedEdge, content, chapterId, ctx, onApply, onDelete, onChoiceRules }) {
  const [target, setTarget] = useState('');
  const [choiceText, setChoiceText] = useState('');
  const source = selectedEdge ? content.story.nodes.find((node) => node.id === selectedEdge.source) : null;
  const isChoice = selectedEdge?.data?.kind === 'choice';
  const choiceIndex = selectedEdge?.data?.choiceIndex;
  const choice = isChoice ? source?.choices?.[choiceIndex] : null;

  useEffect(() => {
    if (!selectedEdge) return;
    setTarget(selectedEdge.target);
    setChoiceText(choice?.text || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEdge?.id]);

  if (!selectedEdge) return <div className="muted">从节点右侧圆点拖到目标节点左侧圆点即可连线；点击已有连线可以修改目标或删除。</div>;
  return (
    <div>
      <div className="kv">
        <strong>来源</strong><span>{selectedEdge.source}</span>
        <strong>类型</strong><span>{selectedEdge.data?.kind}</span>
        <strong>目标</strong>
        <select value={target} onChange={(event) => setTarget(event.target.value)}>
          {content.story.nodes.filter((node) => node.chapterId === chapterId).map((node) => <option key={node.id} value={node.id}>{node.id}</option>)}
        </select>
      </div>
      {isChoice && <div className="edge-text"><label>选项文本</label><input value={choiceText} onChange={(event) => setChoiceText(event.target.value)} /></div>}
      {isChoice && choice && (
        <div className="choice-rules">
          <RuleListEditor title="选项条件" schema={CONDITION_SCHEMA} value={choice.conditions} onChange={(val) => onChoiceRules(choiceIndex, 'conditions', val)} ctx={ctx} addLabel="+ 添加条件" />
          <RuleListEditor title="选项效果" schema={EFFECT_SCHEMA} value={choice.effects} onChange={(val) => onChoiceRules(choiceIndex, 'effects', val)} ctx={ctx} addLabel="+ 添加效果" />
        </div>
      )}
      <div className="row">
        <button className="primary" onClick={() => onApply(target, choiceText || '新选项')}>应用连线修改</button>
        <button className="danger" onClick={onDelete}>删除连线</button>
      </div>
    </div>
  );
}

function EdgeList({ node, onSelect }) {
  if (!node) return <div className="muted">选择一个节点查看出口。</div>;
  const items = [];
  if (node.nextNodeId) items.push({ label: `next -> ${node.nextNodeId}`, edge: makeEdge(`${node.id}__next__${node.nextNodeId}`, node.id, node.nextNodeId, 'next', 'next') });
  (node.choices || []).forEach((choice, index) => items.push({ label: `choice ${index + 1}: ${choice.text} -> ${choice.nextNodeId}`, edge: makeEdge(`${node.id}__choice__${index}__${choice.nextNodeId}`, node.id, choice.nextNodeId, 'choice', choice.text, index) }));
  if (!items.length) return <div className="muted">这个节点还没有出口。</div>;
  return <div className="edge-list">{items.map((item, index) => <div key={index} className="edge-item"><button onClick={() => onSelect(item.edge)}>{item.label}</button></div>)}</div>;
}

function buildGraph(story, chapterId, layout) {
  const storyNodes = story.nodes.filter((node) => node.chapterId === chapterId);
  const ids = new Set(storyNodes.map((node) => node.id));
  const edges = [];
  for (const node of storyNodes) {
    if (node.nextNodeId && ids.has(node.nextNodeId)) edges.push(makeEdge(`${node.id}__next__${node.nextNodeId}`, node.id, node.nextNodeId, 'next', 'next'));
    (node.choices || []).forEach((choice, index) => {
      if (ids.has(choice.nextNodeId)) edges.push(makeEdge(`${node.id}__choice__${index}__${choice.nextNodeId}`, node.id, choice.nextNodeId, 'choice', choice.text.slice(0, 14), index));
    });
  }
  const needFallback = storyNodes.some((node) => !layout[node.id]);
  const fallback = needFallback ? dagreLayout(storyNodes.map((node) => ({ id: node.id })), edges) : {};
  const nodes = storyNodes.map((node, index) => ({
    id: node.id,
    type: 'story',
    position: layout[node.id] || fallback[node.id] || { x: (index % 4) * 280, y: Math.floor(index / 4) * 170 },
    initialWidth: NODE_W,
    initialHeight: NODE_H,
    measured: { width: NODE_W, height: NODE_H },
    data: { label: node.id, type: node.type, preview: String(node.text || '').replace(/\s+/g, ' ').slice(0, 46) },
  }));
  return { nodes, edges };
}

function dagreLayout(nodes, edges, { rankdir = 'LR', nodesep = 60, ranksep = 130, width = NODE_W, height = NODE_H } = {}) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir, nodesep, ranksep });
  g.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) g.setNode(node.id, { width, height });
  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);
  const out = {};
  for (const node of nodes) {
    const pos = g.node(node.id);
    if (pos) out[node.id] = { x: Math.round(pos.x - width / 2), y: Math.round(pos.y - height / 2) };
  }
  return out;
}

function makeEdge(id, source, target, kind, label, choiceIndex) {
  return {
    id,
    source,
    target,
    sourceHandle: 'out',
    targetHandle: 'in',
    label,
    className: kind,
    data: { kind, choiceIndex },
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: kind === 'choice' ? '#f59e0b' : '#94a3b8', strokeWidth: 2.6 },
    labelStyle: { fill: '#e5e7eb', fontWeight: 700 },
    labelBgStyle: { fill: '#020617', fillOpacity: 0.82 },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
  };
}

function nodeToForm(node) {
  return {
    id: node.id,
    type: node.type,
    speaker: node.speaker || '',
    speakerColor: node.speakerColor || '',
    backgroundUrl: node.backgroundUrl || '',
    text: node.text || '',
    conditions: structuredClone(node.conditions || []),
    effects: structuredClone(node.effects || []),
    gachaFreePulls: node.gachaTrigger?.freePulls || 1,
    gachaRequiredRarity: node.gachaTrigger?.requiredRarity || '',
    faceCharacterId: node.faceSlap?.characterId || '',
    faceEnemyName: node.faceSlap?.enemyName || '',
    faceEnemyLine: node.faceSlap?.enemyLine || '',
    faceCharacterLine: node.faceSlap?.characterLine || '',
    faceResultText: node.faceSlap?.resultText || '',
    phoneType: node.phoneNotify?.type || 'wechat',
    phoneCharacterId: node.phoneNotify?.characterId || '',
    phoneEventId: node.phoneNotify?.eventId || '',
  };
}

function cleanRules(rules) {
  return structuredClone(rules).map((rule) => ({ ...rule }));
}

function setRuleArray(target, key, rules) {
  if (rules && rules.length) target[key] = cleanRules(rules);
  else delete target[key];
}

function addStoryEdge(story, sourceId, targetId) {
  const source = story.nodes.find((node) => node.id === sourceId);
  if (!source || !story.nodes.some((node) => node.id === targetId)) return;
  if (source.type === 'choice' || source.nextNodeId) {
    source.choices = source.choices || [];
    source.choices.push({ text: '新选项', nextNodeId: targetId });
  } else {
    source.nextNodeId = targetId;
  }
}

function removeStoryNode(story, id) {
  story.nodes = story.nodes.filter((node) => node.id !== id);
  for (const node of story.nodes) {
    if (node.nextNodeId === id) delete node.nextNodeId;
    if (node.choices) {
      node.choices = node.choices.filter((choice) => choice.nextNodeId !== id);
      if (!node.choices.length) delete node.choices;
    }
  }
}

function removeStoryEdgeById(story, edgeId) {
  const parsed = parseEdgeId(edgeId);
  if (!parsed) return;
  const source = story.nodes.find((node) => node.id === parsed.source);
  if (!source) return;
  if (parsed.kind === 'next') delete source.nextNodeId;
  if (parsed.kind === 'choice' && source.choices) {
    source.choices.splice(parsed.choiceIndex, 1);
    if (!source.choices.length) delete source.choices;
  }
}

function updateStoryEdge(story, edge, targetId, choiceText) {
  const parsed = parseEdgeId(edge.id);
  if (!parsed) return;
  const source = story.nodes.find((node) => node.id === parsed.source);
  if (!source) return;
  if (parsed.kind === 'next') source.nextNodeId = targetId;
  if (parsed.kind === 'choice' && source.choices?.[parsed.choiceIndex]) {
    source.choices[parsed.choiceIndex].nextNodeId = targetId;
    source.choices[parsed.choiceIndex].text = choiceText;
  }
}

function parseEdgeId(edgeId) {
  const parts = String(edgeId).split('__');
  if (parts[1] === 'next') return { source: parts[0], kind: 'next' };
  if (parts[1] === 'choice') return { source: parts[0], kind: 'choice', choiceIndex: Number(parts[2]) };
  return null;
}

function setOptional(target, key, value) {
  const text = String(value || '').trim();
  if (text) target[key] = text;
  else delete target[key];
}

function applySpecialForm(node, form) {
  if (node.type === 'gacha_trigger') {
    node.gachaTrigger = { freePulls: Number(form.gachaFreePulls || 1) };
    if (form.gachaRequiredRarity) node.gachaTrigger.requiredRarity = form.gachaRequiredRarity;
  } else delete node.gachaTrigger;

  if (node.type === 'face_slap') {
    node.faceSlap = {
      ...(node.faceSlap || {}),
      characterId: form.faceCharacterId || '',
      enemyName: form.faceEnemyName || '',
      enemyLine: form.faceEnemyLine || '',
      characterLine: form.faceCharacterLine || '',
      resultText: form.faceResultText || '',
      effects: node.faceSlap?.effects || [],
    };
  } else delete node.faceSlap;

  if (node.type === 'phone_notify') {
    node.phoneNotify = {
      type: form.phoneType || 'wechat',
      characterId: form.phoneCharacterId || '',
      eventId: form.phoneEventId || '',
    };
  } else delete node.phoneNotify;
}

function renameNodeRefs(story, oldId, newId) {
  for (const node of story.nodes) {
    if (node.nextNodeId === oldId) node.nextNodeId = newId;
    for (const choice of node.choices || []) if (choice.nextNodeId === oldId) choice.nextNodeId = newId;
  }
  for (const chapter of story.chapters) if (chapter.startNodeId === oldId) chapter.startNodeId = newId;
}

function renameLayoutRef(layout, oldId, newId) {
  const next = { ...layout };
  if (next[oldId]) {
    next[newId] = next[oldId];
    delete next[oldId];
  }
  return next;
}

createRoot(document.getElementById('root')).render(<App />);
