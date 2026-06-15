// 宣传片素材驱动脚本。两种模式：
//   node tools/promo.mjs probe   → 启竖屏窗口，打印内容区在屏幕上的物理像素裁剪矩形
//   node tools/promo.mjs drive   → 同样窗口位置，预置存档 + 开声音 + 跑完整演出流程（供 ffmpeg 录制）
import { chromium } from 'playwright';

const MODE = process.argv[2] || 'drive';
const BASE = 'http://localhost:5199';

// 窗口即视口（1:1 清晰渲染）。宽度被 Chrome 最小窗口钳到 ~500，高度尽量拉满。
const WIN = { x: 60, y: 26, w: 500, h: 776 };

const SEED = {
  state: {
    tutorialStep: -1, spiritStones: 99999, reputation: 5, normalTickets: 20,
    supplyPityCounter: 14, hintTokens: 3, freeHints: { date: '', used: 0 },
    minigameCompanion: null, currentChapterId: 1, currentNodeId: 'ch1_01',
    completedNodes: [], flags: [], ownedCharacters: [], affinityMap: {},
    relationshipStages: {}, dailyActions: {}, dupeCount: {}, bondShards: 0,
    rateUpUntil: {}, coldUntil: {}, totalGachaCount: 0, pityCounter: 0,
    gachaHistory: [], phoneMessages: [], phoneCallLog: [],
    unreadCounts: { wechat: 0, sms: 0, call: 0 }, triggeredEventIds: [],
  },
  version: 6,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const browser = await chromium.launch({
  headless: false,
  args: [
    `--window-position=${WIN.x},${WIN.y}`,
    `--window-size=${WIN.w},${WIN.h}`,
    '--autoplay-policy=no-user-gesture-required',
    '--disable-infobars',
    // 注意：绝不要加 --mute-audio（即使 =false），Chromium 把它当布尔开关，存在即静音
  ],
});
const ctx = await browser.newContext({ viewport: null });
const page = await ctx.newPage();

// 预置存档 + 藏开发按钮/滚动条（应用 JS 之前注入）
await page.addInitScript((seed) => {
  localStorage.setItem('xiashan-player-store', JSON.stringify(seed));
  const css = document.createElement('style');
  css.textContent = `
    [aria-label="打开开发者 GM 面板"]{display:none!important;visibility:hidden!important}
    ::-webkit-scrollbar{width:0!important;height:0!important}
    *{scrollbar-width:none!important}
  `;
  (document.head || document.documentElement).appendChild(css);
  // React 可能重新挂载 GM 按钮，持续移除
  setInterval(() => {
    document.querySelectorAll('button,[role=button]').forEach((b) => {
      const al = b.getAttribute && b.getAttribute('aria-label');
      if ((al && al.includes('GM')) || (b.textContent || '').includes('F2 GM')) b.remove();
    });
  }, 400);
}, SEED);

page.on('console', (m) => { if (m.type() === 'error') log('PAGE-ERR:', m.text().slice(0, 160)); });

if (MODE === 'hold') {
  // 挂住窗口在抽卡页（画面有辨识度），便于外部 screencapture 量内容矩形
  await page.goto(BASE + '/#/', { waitUntil: 'networkidle' });
  await sleep(1000);
  const mute = page.getByText('静音进入', { exact: false }).first();
  if (await mute.count()) await mute.click().catch(() => {});
  await sleep(600);
  await page.goto(BASE + '/#/gacha', { waitUntil: 'networkidle' });
  await sleep(1500);
  const g = await page.evaluate(() => ({
    sx: window.screenX, sy: window.screenY, ow: window.outerWidth, oh: window.outerHeight,
    iw: window.innerWidth, ih: window.innerHeight, dpr: window.devicePixelRatio,
  }));
  log('GEOM', JSON.stringify(g));
  log('HOLDING — window kept open. Ctrl-C to release.');
  await sleep(600000);
  await browser.close();
  process.exit(0);
}

if (MODE === 'probe') {
  await page.goto(BASE + '/#/', { waitUntil: 'networkidle' });
  await sleep(1200);
  const g = await page.evaluate(() => ({
    sx: window.screenX, sy: window.screenY,
    ow: window.outerWidth, oh: window.outerHeight,
    iw: window.innerWidth, ih: window.innerHeight,
    dpr: window.devicePixelRatio,
  }));
  // Chrome 的窗口装饰全在顶部；左右边框≈0
  const cropX = Math.round((g.sx + (g.ow - g.iw) / 2) * g.dpr);
  const cropY = Math.round((g.sy + (g.oh - g.ih)) * g.dpr);
  const cropW = Math.round(g.iw * g.dpr);
  const cropH = Math.round(g.ih * g.dpr);
  log('GEOM', JSON.stringify(g));
  log('CROP', JSON.stringify({ cropX, cropY, cropW, cropH }));
  // 偶数化（h264 要求宽高为偶数）
  const ev = (v) => v - (v % 2);
  log('CROP_FFMPEG', `${ev(cropW)}:${ev(cropH)}:${cropX}:${cropY}`);
  await browser.close();
  process.exit(0);
}

// ───────── DRIVE：完整演出流程 ─────────
const step = async (name, fn) => {
  try { await fn(); log('✓', name); }
  catch (e) { log('✗', name, String(e).slice(0, 120)); }
};
const clickText = async (t, ms = 1200) => {
  const el = page.getByText(t, { exact: false }).first();
  if (await el.count()) { await el.click({ timeout: 4000 }).catch(() => {}); }
  await sleep(ms);
};
const clickSel = async (sel, ms = 1200) => {
  const el = page.locator(sel).first();
  if (await el.count()) { await el.click({ timeout: 4000 }).catch(() => {}); }
  await sleep(ms);
};
const tapCenter = async (ms = 1400) => {
  await page.mouse.click(WIN.w / 2, WIN.h / 2).catch(() => {});
  await sleep(ms);
};

// ───────── GACHA：聚焦「抽到 SSR + 播放语音」 ─────────
if (MODE === 'gacha') {
  const hideGM = async () => { await page.addStyleTag({ content: '[aria-label="打开开发者 GM 面板"]{display:none!important}' }).catch(() => {}); };
  log('=== GACHA SSR 展示（2.5s 后开始）===');
  await page.goto(BASE + '/#/', { waitUntil: 'networkidle' });
  await sleep(2500);
  await step('开声音进入', async () => {
    await clickText('开启声音进入', 1800);
    await sleep(800);
  });
  await step('进抽卡页', async () => { await page.goto(BASE + '/#/gacha', { waitUntil: 'networkidle' }); await hideGM(); await sleep(1800); });
  // 等"收下羁绊"出现 = 立绘卡已揭晓（对录制时动画变慢免疫）
  const waitReveal = async (timeout = 25000) => {
    await page.getByText('收下羁绊', { exact: false }).first().waitFor({ state: 'visible', timeout }).catch(() => {});
  };
  await step('单抽→SSR+语音', async () => {
    await clickText('单抽', 800);
    await waitReveal();         // 蓄力→剪影→白闪→立绘卡揭晓
    await sleep(13000);         // 长 HOLD：录制时动画变慢，确保立绘卡常驻且 SSR 语音录入
    await tapCenter(2200);      // 收下羁绊
    await sleep(1200);
  });
  await step('十连→全SSR', async () => {
    await page.goto(BASE + '/#/gacha', { waitUntil: 'networkidle' }); await hideGM(); await sleep(1200);
    await clickText('十连', 800);
    await waitReveal();         // 第一张立绘卡揭晓
    await sleep(4500);          // HOLD 第一张
    await tapCenter(3500);      // 翻到下一张
    await sleep(3500);
    await tapCenter(2500);
    await sleep(1500);
  });
  log('=== GACHA 完成 ===');
  await sleep(1000);
  await browser.close();
  process.exit(0);
}

log('=== DRIVE 开始（3 秒后进入，给录制留头）===');
await page.goto(BASE + '/#/', { waitUntil: 'networkidle' });
await sleep(3000);

// 1) 开声音进入（用户手势解锁音频）
await step('开声音进入', async () => { await clickText('开启声音进入', 2600); });

// 2) 首页停留（品牌/标题）
await step('首页停留', async () => { await sleep(2200); });

// 3) 抽卡页
await step('进抽卡页', async () => { await page.goto(BASE + '/#/gacha', { waitUntil: 'networkidle' }); await sleep(1800); });

// 4) 十连（保底=14 → 必出角色：蓄力→剪影→白闪→立绘揭晓）
await step('十连演出', async () => {
  await clickText('十连', 1600);
  await sleep(5200);            // 完整蓄力+揭晓动画
  await tapCenter(2400);        // 收下羁绊 / 推进到第 2 个
  await tapCenter(2400);
  await tapCenter(1800);        // 卡组汇总
  await sleep(1600);
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(1000);
});

// 5) 单抽（非人物开箱演出小爽点）
await step('单抽开箱', async () => {
  await page.goto(BASE + '/#/gacha', { waitUntil: 'networkidle' }); await sleep(1000);
  await clickText('单抽', 3200);
  await tapCenter(1600);
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(800);
});

// 6) Shop：开始营业 → 委托剧场（AVG 演出）
await step('进店开始营业', async () => {
  await page.goto(BASE + '/#/shop', { waitUntil: 'networkidle' }); await sleep(1400);
  await clickSel('[data-tut="btn-start-day"]', 1800);
});
await step('委托tab接单', async () => {
  await clickSel('[data-tut="tab-commission"]', 1400);
  await clickText('接单', 1800);     // 接下第一单
});
await step('委托剧场演出', async () => {
  // 接单后可能需要点一下进入剧场；剧场内点击推进对白
  await tapCenter(2600);
  await tapCenter(2600);
  await tapCenter(2600);
  await tapCenter(2200);
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(1000);
});

// 7) 跑图：地图 tab → 选路线 → 打热点
await step('跑图地图', async () => {
  await clickSel('[data-tut="tab-map"]', 1400);
  const route = page.locator('[data-tut^="route-"]').first();
  if (await route.count()) { await route.click({ timeout: 4000 }).catch(() => {}); }
  await sleep(1800);
  const spot = page.locator('[data-tut^="spot-"]').first();
  if (await spot.count()) { await spot.click({ timeout: 4000 }).catch(() => {}); }
  await sleep(2200);
});

log('=== DRIVE 完成 ===');
await sleep(1200);
await browser.close();
process.exit(0);
