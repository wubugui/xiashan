export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^(https?:|data:|blob:)/.test(path)) return path;

  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
}

export function assetCssBackground(value?: string | null): string | undefined {
  if (!value) return undefined;

  return value.replace(/url\((['"]?)(\/[^'")]+)\1\)/g, (_match, _quote, path: string) => {
    return `url("${assetUrl(path)}")`;
  });
}
