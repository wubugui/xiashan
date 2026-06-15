# 项目开发规范 · Claude 记忆

## 🚫 部署：未经明确指示，禁止自动部署到云端

**完成游戏迭代后，绝不自动部署到云服务器。** 只有用户在当前对话里**明确说"部署 / 发布 / 上线 / 更新线上"**时，才可以执行部署。

- 部署动作 = 运行 `tools/deploy-to-server.sh`、或通过 SSH 向部署服务器（阿里云轻量，`admin@47.116.0.213`，nginx 监听 8080）推送/重载。
- 改完代码、构建、本地验证都可以照常做；但**不要**顺手把成果推到线上。
- 部署会产生云端流量费用、且面向公网，属于不可随意触发的对外操作 —— 必须等用户开口。

---

## ⚠️ 坐标与布局：禁止硬编码，必须自适应平台

**这是本项目最重要的开发规范，任何情况下不得违反。**

移动端浏览器（iOS Safari、Android Chrome、各类 WebView）的底部安全区、导航栏高度、工具栏高度在不同设备和平台上差异巨大，硬编码像素值（如 `bottom: 56px`、`padding-bottom: 48px`）会导致内容被遮挡或间距错乱。

### 正确做法：使用 CSS 自定义属性

项目内建了两个运行时动态写入的 CSS 变量：

| 变量 | 含义 | 写入方 |
|------|------|--------|
| `--nav-h` | （历史保留）底部导航栏高度。导航栏组件已删除，恒为 `:root` 默认 `0px`，相关工具类继续可用 | 无（`index.css :root` 默认值） |
| `--bar-h` | 页面内底部操作条实际渲染高度 | 各页面用 `useCssVarFromHeight` hook 写入 |

`--bar-h` 由 `useCssVarFromHeight(varName, ref)` 通过 `ResizeObserver` 实时测量元素高度后写入 `document.documentElement`，**随设备、旋转、键盘弹出自动更新**。

### 内置 Tailwind 工具类（优先使用）

```
pb-chrome   → padding-bottom: calc(var(--nav-h) + var(--bar-h) + 1.5rem)
pb-nav      → padding-bottom: calc(var(--nav-h) + 1.5rem)
above-chrome → bottom: calc(var(--nav-h) + var(--bar-h) + 0.75rem)
above-nav    → bottom: calc(var(--nav-h) + 0.75rem)
```

- 页面根容器滚动区域：用 `pb-chrome` 或 `pb-nav`（防止内容被固定底部遮挡）
- Toast / 浮层 / Tooltip 定位：用 `.above-chrome` 或 `.above-nav` 类，或内联 `calc(var(--bar-h, 0px) + var(--nav-h, 0px) + Xpx)`

### 当前页面需要操作条时

在页面底部固定操作条的组件里，必须：
1. 给操作条元素加 `ref`
2. 调用 `useCssVarFromHeight('--bar-h', ref)` 将其高度写入变量
3. 操作条用 `style={{ bottom: 'var(--nav-h, 0px)' }}` 贴在导航栏上方

```tsx
const actionBarRef = useRef<HTMLDivElement>(null);
useCssVarFromHeight('--bar-h', actionBarRef);

// ...
<div ref={actionBarRef} style={{ bottom: 'var(--nav-h, 0px)' }}
     className="fixed left-0 right-0 z-50 ...">
```

### 禁止的写法

```tsx
// ❌ 硬编码 — 不同设备会错位
bottom: 56px
paddingBottom: '80px'
style={{ bottom: '48px' }}
className="pb-[56px]"

// ✅ 正确 — 运行时自适应
style={{ bottom: 'var(--nav-h, 0px)' }}
style={{ bottom: 'calc(var(--bar-h, 0px) + var(--nav-h, 0px) + 8px)' }}
className="above-chrome"
className="pb-chrome"
```

---

## Z-index 分层约定

页内层用 Tailwind 标准值，全屏接管用任意值，严格按下表分配，不得随意选一个"够大的数":

| 值 | 用途 |
|----|------|
| `z-10` ~ `z-20` | 场景内元素（热点标记、装饰层） |
| `z-30` | sticky 顶栏 |
| `z-40` | 页面级弹窗（热点事件面板等） |
| `z-50` | Toast、底部操作条 |
| `z-[60]` | 全页委托剧场（CommissionTheater） |
| `z-[100]` | 抽卡动画、FaceSlap 特效 |
| `z-[150]` ~ `z-[200]` | 教学引导浮层（hint / full overlay） |
| `z-[300]` | 视频播放器、故事阅读器、重置确认弹窗 |
| `z-[9999]` | LoadingScreen、系统级通知条 |

---

## 每日限频操作

用 `tryDailyAction(key)` 防止同一天重复触发。key 统一格式：

```
动作类别:目标ID            →  browser_intel:{commissionId}
动作类别:子类型:目标ID     →  interact:{type}:{characterId}
```

已有前缀：`browser_intel` / `browser_affinity` / `interact` / `stage` / `minigame`

---

## Zustand Store 规范

- 持久化 store 必须用 `createJSONStorage(() => safeStorage)`（不裸用 localStorage，避免隐私模式崩溃）
- 每次修改 store 字段结构：**必须** bump `version` + 在 `migrate` 中处理旧版本
- `merge` 函数负责同版本数据校验，丢弃类型不符字段，不得直接展开存档覆盖

---

## 引擎函数规范（src/engine/）

- 严格纯函数，**不得**在引擎内直接读写任何 store
- 返回描述性结构供调用方使用，例如 `{ text, cls, delta, combo }`
- 调用方（页面组件或 store action）负责把结果 dispatch 到 store

---

## 背景图系统

- 所有场景/角色背景统一在 `src/lib/pageBackdrops.ts` 的 `SCENE_BACKDROPS` 字典里维护
- 每条目提供 `image`（横屏）和 `mobileImage`（竖屏）两个路径
- 页面通过 `backdropForLocation(locId)` / `backdropForCharacter(charId)` 查找，**禁止**在 JSX 里裸写背景路径

---

## 语言约定

- 所有面向玩家的字符串、枚举值、类型字面量一律使用**中文**（`'焦虑' | '平静'`、`'委托' | '地图'`）
- 英文只用于技术命名（函数名、变量名、Tailwind 类名、React/TS 关键字）
- 不引入 i18n 库，不做多语言，注释也用中文

---

## 稀有度样式：集中查表

稀有度（N / R / SR / SSR）的颜色、渐变、发光效果在组件内用 lookup 对象统一管理：

```ts
const rarityColor = { SSR: 'text-yellow-300', SR: 'text-purple-300', R: 'text-slate-300', N: 'text-slate-400' };
```

**禁止**在 JSX 里写多层三元链 `rarity === 'SSR' ? '...' : rarity === 'SR' ? '...' : ...`

---

## 图片资源格式与路径

- 角色立绘 / 头像：**PNG**（需要透明背景）
- 场景背景：**JPG**（无需透明，体积更小）
- 路径规范：
  - `/characters/face/{id}/{expression}.png`（立绘，表情名如 `smile` / `calm` / `shy`）
  - `/characters/face/{id}/avatar.png`（头像圆图）
  - `/bg/{scene}-{编号}.jpg`（背景图）

---

## 项目概览

**二十五时便利屋** — React + TypeScript + Vite，移动端竖屏优先的轻度叙事游戏。

### 技术栈
- React 18 + TypeScript
- Zustand（状态管理：`usePlayerStore` 持久，`useShopStore` 局内）
- Framer Motion（动画与过渡）
- Tailwind CSS

### 核心状态
- `usePlayerStore`（持久化）：灵石、角色、好感、新手引导步骤 `tutorialStep` 等
- `useShopStore`（局内，每日）：时间/精力/口碑/资金/信任、委托、路线、手牌

### 关键约定
- 资源路径统一使用 `assetUrl(path)` / `assetCssBackground(path)`，不得裸写路径字符串
- 条件判断（委托解锁/视频解锁）统一走 `evaluateAll(conditions, conditionState)`
- 纯逻辑放 `src/engine/`，UI 不内联业务计算
- 新增角色/委托/视频内容走 JSON 数据文件，不改 TS 代码
