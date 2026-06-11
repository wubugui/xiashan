import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(root, 'src', 'content');
const publicDir = path.join(root, 'public');
const storyLayoutFile = path.join(root, 'tools', 'story-layout.json');
const storyEditorDist = path.join(root, 'tools', 'story-editor-dist');

const files = {
  characters: path.join(contentDir, 'characters.json'),
  story: path.join(contentDir, 'story.json'),
  phone: path.join(contentDir, 'phone-events.json'),
  gacha: path.join(contentDir, 'gacha.json'),
  rewards: path.join(contentDir, 'rewards.json'),
  videos: path.join(contentDir, 'videos.json'),
  commissions: path.join(contentDir, 'commissions.json'),
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function loadContent() {
  return {
    characters: readJson(files.characters).characters,
    story: readJson(files.story),
    phoneEvents: readJson(files.phone).phoneEvents,
    gacha: readJson(files.gacha),
    rewards: readJson(files.rewards),
    videos: readJson(files.videos).videos,
  };
}

function listAssetDir(sub, exts) {
  const dir = path.join(publicDir, sub);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => {
      const file = path.join(dir, name);
      return fs.statSync(file).isFile() && exts.some((ext) => name.toLowerCase().endsWith(ext));
    })
    .sort()
    .map((name) => `/${sub}/${name}`);
}

function listAssets() {
  const imageExts = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
  const videoExts = ['.mp4', '.webm'];
  return {
    bg: listAssetDir('bg', imageExts),
    portraits: listAssetDir('characters', imageExts),
    avatars: listAssetDir('avatars', imageExts),
    videos: listAssetDir('video', videoExts),
  };
}

function loadStoryLayout() {
  if (!fs.existsSync(storyLayoutFile)) return {};
  return readJson(storyLayoutFile);
}

function saveStoryLayout(layout) {
  writeJson(storyLayoutFile, layout);
}

function addUniqueIssues(items, key, label, issues) {
  const seen = new Set();
  for (const item of items) {
    const value = item[key];
    if (!value) issues.push(`${label} missing ${key}`);
    if (seen.has(value)) issues.push(`${label} duplicate ${key}: ${value}`);
    seen.add(value);
  }
}

function collectRefsFromCondition(condition) {
  if (!condition || typeof condition !== 'object') return [];
  if ('characterId' in condition) return [{ type: 'character', id: condition.characterId }];
  if ('nodeId' in condition) return [{ type: 'node', id: condition.nodeId }];
  return [];
}

function collectRefsFromEffect(effect) {
  if (!effect || typeof effect !== 'object') return [];
  const refs = [];
  if ('characterId' in effect) refs.push({ type: 'character', id: effect.characterId });
  if (effect.type === 'trigger_phone_event') refs.push({ type: 'phoneEvent', id: effect.eventId });
  return refs;
}

export function validateContent(content = loadContent()) {
  const issues = [];
  const { characters, story, phoneEvents, gacha, rewards, videos } = content;
  const characterIds = new Set(characters.map((c) => c.id));
  const chapterIds = new Set(story.chapters.map((c) => c.id));
  const nodeIds = new Set(story.nodes.map((n) => n.id));
  const phoneEventIds = new Set(phoneEvents.map((e) => e.id));

  addUniqueIssues(characters, 'id', 'character', issues);
  addUniqueIssues(story.chapters, 'id', 'chapter', issues);
  addUniqueIssues(story.nodes, 'id', 'story node', issues);
  addUniqueIssues(phoneEvents, 'id', 'phone event', issues);
  addUniqueIssues(videos, 'id', 'video', issues);

  for (const character of characters) {
    for (const asset of [character.portraitUrl, character.avatarUrl, character.gachaPortraitUrl, character.gachaBackgroundUrl]) {
      if (!asset) continue;
      const assetPath = path.join(publicDir, asset.replace(/^\/+/, ''));
      if (!fs.existsSync(assetPath)) issues.push(`missing asset for character ${character.id}: ${asset}`);
    }
  }

  for (const chapter of story.chapters) {
    if (!nodeIds.has(chapter.startNodeId)) issues.push(`chapter ${chapter.id} startNodeId missing: ${chapter.startNodeId}`);
  }

  for (const node of story.nodes) {
    if (!chapterIds.has(node.chapterId)) issues.push(`node ${node.id} has unknown chapterId: ${node.chapterId}`);
    if (node.nextNodeId && !nodeIds.has(node.nextNodeId)) issues.push(`node ${node.id} nextNodeId missing: ${node.nextNodeId}`);
    if (node.speaker && !characters.some((c) => c.name === node.speaker || c.id === node.speaker)) {
      // Speaker names can be NPC display names, so this is intentionally not an error.
    }
    for (const choice of node.choices || []) {
      if (!nodeIds.has(choice.nextNodeId)) issues.push(`node ${node.id} choice target missing: ${choice.nextNodeId}`);
      for (const condition of choice.conditions || []) {
        for (const ref of collectRefsFromCondition(condition)) checkRef(ref, issues, `node ${node.id} choice`);
      }
      for (const effect of choice.effects || []) {
        for (const ref of collectRefsFromEffect(effect)) checkRef(ref, issues, `node ${node.id} choice`);
      }
    }
    for (const condition of node.conditions || []) {
      for (const ref of collectRefsFromCondition(condition)) checkRef(ref, issues, `node ${node.id}`);
    }
    for (const effect of node.effects || []) {
      for (const ref of collectRefsFromEffect(effect)) checkRef(ref, issues, `node ${node.id}`);
    }
    if (node.faceSlap?.characterId && !characterIds.has(node.faceSlap.characterId)) {
      issues.push(`node ${node.id} faceSlap character missing: ${node.faceSlap.characterId}`);
    }
    if (node.phoneNotify?.characterId && !characterIds.has(node.phoneNotify.characterId)) {
      issues.push(`node ${node.id} phoneNotify character missing: ${node.phoneNotify.characterId}`);
    }
  }

  for (const event of phoneEvents) {
    if (event.characterId && !characterIds.has(event.characterId)) issues.push(`phone event ${event.id} character missing: ${event.characterId}`);
    if (event.nextEventId && !phoneEventIds.has(event.nextEventId)) issues.push(`phone event ${event.id} nextEventId missing: ${event.nextEventId}`);
    for (const condition of event.triggerConditions || []) {
      for (const ref of collectRefsFromCondition(condition)) checkRef(ref, issues, `phone event ${event.id}`);
    }
    for (const choice of event.choices || []) {
      for (const effect of choice.effects || []) {
        for (const ref of collectRefsFromEffect(effect)) checkRef(ref, issues, `phone event ${event.id} choice`);
      }
    }
  }

  for (const video of videos) {
    if (video.src) {
      const assetPath = path.join(publicDir, video.src.replace(/^\/+/, ''));
      if (!fs.existsSync(assetPath)) issues.push(`missing asset for video ${video.id}: ${video.src}`);
    }
    for (const condition of video.unlockConditions || []) {
      for (const ref of collectRefsFromCondition(condition)) checkRef(ref, issues, `video ${video.id}`);
    }
  }

  const rateTotal = Object.values(gacha.rates || {}).reduce((sum, value) => sum + Number(value), 0);
  if (Math.abs(rateTotal - 1) > 0.0001) issues.push(`gacha rates must sum to 1, got ${rateTotal}`);
  for (const key of ['story_node_complete', 'chapter_complete', 'daily_login', 'first_time_character']) {
    if (typeof rewards[key] !== 'number') issues.push(`reward ${key} must be a number`);
  }

  function checkRef(ref, targetIssues, source) {
    if (ref.type === 'character' && !characterIds.has(ref.id)) targetIssues.push(`${source} character missing: ${ref.id}`);
    if (ref.type === 'node' && !nodeIds.has(ref.id)) targetIssues.push(`${source} node missing: ${ref.id}`);
    if (ref.type === 'phoneEvent' && !phoneEventIds.has(ref.id)) targetIssues.push(`${source} phone event missing: ${ref.id}`);
  }

  // ── 委托：子目标/分幕引用校验（v1.4）──
  try {
    const commissions = readJson(files.commissions).commissions || [];
    addUniqueIssues(commissions, 'id', 'commission', issues);
    for (const c of commissions) {
      if (!characterIds.has(c.target)) issues.push(`commission ${c.id} target missing: ${c.target}`);
      if (!c.graph) continue;
      const gNodes = new Set(c.graph.nodes.map((n) => n.id));
      const checkScene = (scene, label) => {
        if (!scene) return;
        if (!gNodes.has(scene.start)) issues.push(`commission ${c.id} ${label}.start missing node: ${scene.start}`);
        if (scene.stopBefore && !gNodes.has(scene.stopBefore)) issues.push(`commission ${c.id} ${label}.stopBefore missing node: ${scene.stopBefore}`);
      };
      checkScene(c.introScene, 'introScene');
      checkScene(c.finalScene, 'finalScene');
      const objIds = new Set();
      for (const o of c.objectives || []) {
        if (objIds.has(o.id)) issues.push(`commission ${c.id} duplicate objective id: ${o.id}`);
        objIds.add(o.id);
        checkScene(o.scene, `objective ${o.id} scene`);
        if (!Array.isArray(o.need) || o.need.length === 0) issues.push(`commission ${c.id} objective ${o.id} has empty need`);
      }
    }
  } catch (e) {
    issues.push(`failed to validate commissions.json: ${e.message}`);
  }

  return issues;
}

function printStats(content = loadContent()) {
  console.log(JSON.stringify(getStats(content), null, 2));
}

function getStats(content = loadContent()) {
  const rarityCounts = {};
  for (const character of content.characters) rarityCounts[character.rarity] = (rarityCounts[character.rarity] || 0) + 1;
  const nodeTypeCounts = {};
  for (const node of content.story.nodes) nodeTypeCounts[node.type] = (nodeTypeCounts[node.type] || 0) + 1;
  return {
    characters: content.characters.length,
    rarityCounts,
    chapters: content.story.chapters.length,
    storyNodes: content.story.nodes.length,
    nodeTypeCounts,
    phoneEvents: content.phoneEvents.length,
    rewards: Object.keys(content.rewards).length,
    gacha: content.gacha,
    videos: content.videos.length,
  };
}

function storyMermaid(content = loadContent()) {
  const lines = ['flowchart TD'];
  for (const chapter of content.story.chapters) {
    lines.push(`  subgraph ch${chapter.id}["Chapter ${chapter.id}: ${escapeMermaid(chapter.title)}"]`);
    for (const node of content.story.nodes.filter((n) => n.chapterId === chapter.id)) {
      lines.push(`    ${safeId(node.id)}["${escapeMermaid(`${node.id}\\n${node.type}`)}"]`);
    }
    lines.push('  end');
  }
  for (const node of content.story.nodes) {
    if (node.nextNodeId) lines.push(`  ${safeId(node.id)} --> ${safeId(node.nextNodeId)}`);
    for (const choice of node.choices || []) {
      lines.push(`  ${safeId(node.id)} -- "${escapeMermaid(choice.text.slice(0, 24))}" --> ${safeId(choice.nextNodeId)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function safeId(id) {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeMermaid(value) {
  return String(value).replace(/"/g, '\\"').replace(/\|/g, '/');
}

function serve(port = 5174) {
  const hubPath = path.join(root, 'tools', 'content-hub.html');
  const editorPath = path.join(root, 'tools', 'story-composer.html');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    try {
      if (req.method === 'GET' && url.pathname === '/') {
        send(res, 200, fs.readFileSync(hubPath, 'utf8'), 'text/html; charset=utf-8');
        return;
      }
      if (req.method === 'GET' && url.pathname === '/story') {
        const builtEditorPath = path.join(storyEditorDist, 'index.html');
        send(res, 200, fs.readFileSync(fs.existsSync(builtEditorPath) ? builtEditorPath : editorPath, 'utf8'), 'text/html; charset=utf-8');
        return;
      }
      if (req.method === 'GET' && url.pathname.startsWith('/story-dist/')) {
        const rel = decodeURIComponent(url.pathname.replace('/story-dist/', ''));
        const file = path.resolve(storyEditorDist, rel);
        if (!file.startsWith(storyEditorDist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          sendJson(res, { error: 'Not found' }, 404);
          return;
        }
        send(res, 200, fs.readFileSync(file), contentType(file));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/content') {
        sendJson(res, loadContent());
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/assets') {
        sendJson(res, listAssets());
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/story-layout') {
        sendJson(res, loadStoryLayout());
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/stats') {
        sendJson(res, getStats());
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/validate') {
        const issues = validateContent();
        sendJson(res, { ok: issues.length === 0, issues });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/story-graph.mmd') {
        send(res, 200, storyMermaid(), 'text/plain; charset=utf-8');
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/story') {
        readBody(req).then((body) => {
          const story = JSON.parse(body);
          const content = { ...loadContent(), story };
          const issues = validateContent(content);
          if (issues.length) {
            sendJson(res, { ok: false, issues }, 400);
            return;
          }
          writeJson(files.story, story);
          sendJson(res, { ok: true });
        }).catch((error) => sendJson(res, { ok: false, error: String(error) }, 400));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/story-layout') {
        readBody(req).then((body) => {
          saveStoryLayout(JSON.parse(body));
          sendJson(res, { ok: true });
        }).catch((error) => sendJson(res, { ok: false, error: String(error) }, 400));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/characters') {
        readBody(req).then((body) => {
          const characters = JSON.parse(body);
          const content = { ...loadContent(), characters };
          const issues = validateContent(content);
          if (issues.length) {
            sendJson(res, { ok: false, issues }, 400);
            return;
          }
          writeJson(files.characters, { characters });
          sendJson(res, { ok: true });
        }).catch((error) => sendJson(res, { ok: false, error: String(error) }, 400));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/phone-events') {
        readBody(req).then((body) => {
          const phoneEvents = JSON.parse(body);
          const content = { ...loadContent(), phoneEvents };
          const issues = validateContent(content);
          if (issues.length) {
            sendJson(res, { ok: false, issues }, 400);
            return;
          }
          writeJson(files.phone, { phoneEvents });
          sendJson(res, { ok: true });
        }).catch((error) => sendJson(res, { ok: false, error: String(error) }, 400));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/gacha') {
        readBody(req).then((body) => {
          const gacha = JSON.parse(body);
          const content = { ...loadContent(), gacha };
          const issues = validateContent(content);
          if (issues.length) {
            sendJson(res, { ok: false, issues }, 400);
            return;
          }
          writeJson(files.gacha, gacha);
          sendJson(res, { ok: true });
        }).catch((error) => sendJson(res, { ok: false, error: String(error) }, 400));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/rewards') {
        readBody(req).then((body) => {
          const rewards = JSON.parse(body);
          const content = { ...loadContent(), rewards };
          const issues = validateContent(content);
          if (issues.length) {
            sendJson(res, { ok: false, issues }, 400);
            return;
          }
          writeJson(files.rewards, rewards);
          sendJson(res, { ok: true });
        }).catch((error) => sendJson(res, { ok: false, error: String(error) }, 400));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/videos') {
        readBody(req).then((body) => {
          const videos = JSON.parse(body);
          const content = { ...loadContent(), videos };
          const issues = validateContent(content);
          if (issues.length) {
            sendJson(res, { ok: false, issues }, 400);
            return;
          }
          writeJson(files.videos, { videos });
          sendJson(res, { ok: true });
        }).catch((error) => sendJson(res, { ok: false, error: String(error) }, 400));
        return;
      }
      sendJson(res, { error: 'Not found' }, 404);
    } catch (error) {
      sendJson(res, { error: String(error) }, 500);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Content manager: http://127.0.0.1:${port}/`);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res, data, status = 200) {
  send(res, status, JSON.stringify(data, null, 2), 'application/json; charset=utf-8');
}

function send(res, status, body, type) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

function contentType(file) {
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

const command = process.argv[2] || 'validate';
if (command === 'validate') {
  const issues = validateContent();
  if (issues.length) {
    console.error(issues.map((issue) => `- ${issue}`).join('\n'));
    process.exit(1);
  }
  console.log('Content validation passed.');
} else if (command === 'stats') {
  printStats();
} else if (command === 'graph') {
  const out = process.argv[3];
  const graph = storyMermaid();
  if (out) {
    fs.writeFileSync(path.resolve(out), graph, 'utf8');
    console.log(`Wrote ${out}`);
  } else {
    console.log(graph);
  }
} else if (command === 'serve') {
  serve(Number(process.argv[3] || 5174));
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
