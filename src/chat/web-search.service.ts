import { BadRequestException, Injectable, Logger } from '@nestjs/common';

export type WebSearchHit = {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  publishedAt: string | null;
  score: number | null;
};

type SearchOptions = {
  baseUrl: string;
  query: string;
  language: string;
  categories: string;
  safeSearch: number;
  timeRange: '' | 'day' | 'week' | 'month' | 'year';
  topK: number;
  timeoutMs: number;
  page?: number;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_all, hex: string) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code)) return '';
      return String.fromCodePoint(code);
    })
    .replace(/&#(\d+);/g, (_all, num: string) => {
      const code = Number.parseInt(num, 10);
      if (!Number.isFinite(code)) return '';
      return String.fromCodePoint(code);
    });
}

function toDomain(value: string) {
  try {
    return new URL(value).hostname || '';
  } catch {
    return '';
  }
}

@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  async search(options: SearchOptions): Promise<WebSearchHit[]> {
    const query = normalizeWhitespace(options.query || '');
    if (!query) return [];

    const base = (options.baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) {
      throw new BadRequestException('SearXNG 地址未配置');
    }

    const endpoint = /\/search$/i.test(base) ? base : `${base}/search`;
    const params = new URLSearchParams({
      q: query,
      format: 'json',
    });

    const language = normalizeWhitespace(options.language || '');
    if (language) params.set('language', language);

    const categories = normalizeWhitespace(options.categories || '');
    if (categories) params.set('categories', categories);

    params.set('safesearch', String(Math.max(0, Math.min(2, Math.trunc(options.safeSearch)))));

    const timeRange = (options.timeRange || '').trim().toLowerCase();
    if (timeRange && ['day', 'week', 'month', 'year'].includes(timeRange)) {
      params.set('time_range', timeRange);
    }

    const page = Math.max(1, Math.min(10, Math.trunc(options.page ?? 1)));
    if (page > 1) {
      params.set('pageno', String(page));
    }

    const timeoutMs = Math.max(1000, Math.min(30_000, Math.trunc(options.timeoutMs)));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${endpoint}?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new BadRequestException(`联网搜索失败（HTTP ${response.status}）`);
      }

      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!payload || typeof payload !== 'object' || !Array.isArray(payload.results)) {
        return [];
      }

      const out: WebSearchHit[] = [];
      const dedup = new Set<string>();
      const limit = Math.max(1, Math.min(50, Math.trunc(options.topK)));

      for (const item of payload.results) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const row = item as Record<string, unknown>;

        const url = typeof row.url === 'string' ? row.url.trim() : '';
        if (!url || dedup.has(url)) continue;

        const titleRaw = typeof row.title === 'string' ? row.title : '';
        const snippetRaw = typeof row.content === 'string' ? row.content : '';
        const title = normalizeWhitespace(titleRaw || '未命名来源').slice(0, 200);
        const snippet = normalizeWhitespace(snippetRaw).slice(0, 900);
        const domain = toDomain(url);
        const publishedAt = typeof row.publishedDate === 'string' ? row.publishedDate.trim() : null;
        const score = typeof row.score === 'number' && Number.isFinite(row.score) ? row.score : null;

        dedup.add(url);
        out.push({
          title,
          url,
          domain,
          snippet,
          publishedAt: publishedAt || null,
          score,
        });

        if (out.length >= limit) break;
      }

      return out;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BadRequestException('联网搜索超时');
      }
      this.logger.error('Web search failed', error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('联网搜索失败');
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchPageContent(
    url: string,
    options: {
      maxChars: number;
      timeoutMs: number;
    },
  ): Promise<string> {
    const target = (url || '').trim();
    if (!target) return '';

    const timeoutMs = Math.max(1000, Math.min(30_000, Math.trunc(options.timeoutMs)));
    const maxChars = Math.max(200, Math.min(5000, Math.trunc(options.maxChars)));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(target, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)',
          Accept: 'text/html, text/plain;q=0.9, application/xhtml+xml;q=0.8, */*;q=0.3',
        },
        signal: controller.signal,
      });

      if (!response.ok) return '';

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (
        contentType &&
        !contentType.includes('text/html') &&
        !contentType.includes('text/plain') &&
        !contentType.includes('application/xhtml+xml')
      ) {
        return '';
      }

      const raw = await response.text().catch(() => '');
      if (!raw) return '';

      if (contentType.includes('text/plain')) {
        return normalizeWhitespace(raw).slice(0, maxChars);
      }

      const withoutScripts = raw
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
      const stripped = withoutScripts.replace(/<[^>]+>/g, ' ');
      const decoded = decodeHtmlEntities(stripped);
      return normalizeWhitespace(decoded).slice(0, maxChars);
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        this.logger.warn(`Fetch page content failed: ${target}`);
      }
      return '';
    } finally {
      clearTimeout(timer);
    }
  }
}
