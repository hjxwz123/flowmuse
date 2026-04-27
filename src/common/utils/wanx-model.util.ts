export type WanxVideoModelKind = 't2v' | 'i2v' | 'r2v';

export const WANX_VIDEO_MODEL_KINDS: WanxVideoModelKind[] = ['t2v', 'i2v', 'r2v'];

export function isWanxProvider(provider?: string | null): boolean {
  const normalizedProvider = String(provider ?? '').trim().toLowerCase();
  return normalizedProvider.includes('wanx') || normalizedProvider.includes('wanxiang');
}

export function parseWanxVideoModelKey(modelKey?: string | null): {
  baseModelKey: string;
  kind: WanxVideoModelKind;
} | null {
  const normalizedModelKey = String(modelKey ?? '').trim();
  const match = normalizedModelKey.match(/^([^/]+)-(t2v|i2v|r2v)$/i);
  if (!match) return null;

  const baseModelKey = match[1]?.trim();
  const kind = match[2]?.toLowerCase() as WanxVideoModelKind | undefined;
  if (!baseModelKey || !kind) return null;

  return {
    baseModelKey,
    kind,
  };
}

export function resolveWanxVideoModelKind(modelKey?: string | null): WanxVideoModelKind | null {
  return parseWanxVideoModelKey(modelKey)?.kind ?? null;
}

export function resolveWanxVideoBaseModelKey(modelKey?: string | null): string {
  const normalizedModelKey = String(modelKey ?? '').trim();
  const shorthandMatch = normalizedModelKey.match(/^(.+?)-(?:t2v|i2v|r2v)(?:\/(?:t2v|i2v|r2v))+$/i);
  if (shorthandMatch?.[1]?.trim()) return shorthandMatch[1].trim();
  return parseWanxVideoModelKey(normalizedModelKey)?.baseModelKey ?? normalizedModelKey;
}

export function buildWanxVideoModelKey(baseModelKey: string, kind: WanxVideoModelKind): string {
  return `${baseModelKey.trim()}-${kind}`;
}

export function resolveWanxSiblingVideoModelKey(modelKey: string | null | undefined, kind: WanxVideoModelKind): string | null {
  const parsed = parseWanxVideoModelKey(modelKey);
  if (!parsed) return null;
  return buildWanxVideoModelKey(parsed.baseModelKey, kind);
}
