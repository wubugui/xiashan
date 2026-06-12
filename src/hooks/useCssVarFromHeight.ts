import { useLayoutEffect, type RefObject } from 'react';

/**
 * 把元素的实际渲染高度（含 safe-area padding 等平台差异）写入根节点 CSS 变量，
 * 供浮层用 calc(var(--xxx)) 自动定位——避免对导航栏/操作条高度硬编码。
 * 元素卸载或不存在时变量归零。
 */
export function useCssVarFromHeight(varName: string, ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!el) {
      root.style.setProperty(varName, '0px');
      return () => { root.style.setProperty(varName, '0px'); };
    }
    const update = () => root.style.setProperty(varName, `${el.offsetHeight}px`);
    update();
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
      root.style.setProperty(varName, '0px');
    };
  });
}
