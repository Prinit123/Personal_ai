// src/routes/search.ts — Web search via Brave Search API or DuckDuckGo fallback
import { Router } from 'express';

const router = Router();

interface SearchResult {
  title:   string;
  url:     string;
  snippet: string;
  source:  string;
}

// ─── Brave Search ─────────────────────────────────────────────────────────────

async function braveSearch(query: string, count = 8): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY not configured');

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Brave Search API error ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  const web  = data?.web?.results ?? [];

  return web.map((r: any): SearchResult => ({
    title:   r.title || '',
    url:     r.url || '',
    snippet: r.description || r.extra_snippets?.[0] || '',
    source:  'brave',
  }));
}

// ─── DuckDuckGo Instant Answer fallback ───────────────────────────────────────

async function ddgSearch(query: string): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`DuckDuckGo error ${res.status}`);
  const data = await res.json() as any;

  const results: SearchResult[] = [];

  if (data.AbstractText) {
    results.push({
      title:   data.Heading || query,
      url:     data.AbstractURL || '',
      snippet: data.AbstractText,
      source:  'duckduckgo',
    });
  }

  const related: any[] = data.RelatedTopics ?? [];
  for (const t of related.slice(0, 6)) {
    if (t.Text && t.FirstURL) {
      results.push({
        title:   t.Text.slice(0, 80),
        url:     t.FirstURL,
        snippet: t.Text,
        source:  'duckduckgo',
      });
    }
  }

  return results;
}

// ─── POST /api/search ─────────────────────────────────────────────────────────

router.post('/search', async (req, res) => {
  const { query, count = 8 } = req.body;

  if (!query?.trim()) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const startTime = Date.now();
  let results: SearchResult[] = [];
  let provider = 'none';
  let warning: string | undefined;

  try {
    if (process.env.BRAVE_SEARCH_API_KEY) {
      results  = await braveSearch(query, count);
      provider = 'brave';
    } else {
      results  = await ddgSearch(query);
      provider = 'duckduckgo';
      warning  = 'Using DuckDuckGo Instant Answers (limited results). Add BRAVE_SEARCH_API_KEY to .env for full web search.';
    }
  } catch (err: any) {
    // Try DDG as last resort
    try {
      results  = await ddgSearch(query);
      provider = 'duckduckgo-fallback';
      warning  = `Primary search failed (${err.message}). Showing DuckDuckGo results.`;
    } catch {
      return res.status(503).json({
        error: `Search unavailable: ${err.message}`,
        results: [],
        provider: 'none',
      });
    }
  }

  res.json({
    query,
    results,
    provider,
    warning,
    elapsedMs: Date.now() - startTime,
    retrievedAt: new Date().toISOString(),
  });
});

export default router;
