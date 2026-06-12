# 项目开发规范 · Claude 记忆

## ⚠️ 坐标与布局：禁止硬编码，必须自适应平台

**这是本项目最重要的开发规范，任何情况下不得违反。**

移动端浏览器（iOS Safari、Android Chrome、各类 WebView）的底部安全区、导航栏高度、工具栏高度在不同设备和平台上差异巨大，硬编码像素值（如 `bottom: 56px`、`padding-bottom: 48px`）会导致内容被遮挡或间距错乱。

### 正确做法：使用 CSS 自定义属性

项目内建了两个运行时动态写入的 CSS 变量：

| 变量 | 含义 | 写入方 |
|------|------|--------|
| `--nav-h` | 底部导航栏实际渲染高度（含系统 safe area） | `NavBar.tsx` |
| `--bar-h` | 页面内底部操作条实际渲染高度 | 各页面用 `useCssVarFromHeight` hook 写入 |

这两个变量由 `useCssVarFromHeight(varName, ref)` 通过 `ResizeObserver` 实时测量元素高度后写入 `document.documentElement`，**随设备、旋转、键盘弹出自动更新**。

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
