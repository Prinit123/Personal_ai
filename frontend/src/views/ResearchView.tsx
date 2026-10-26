// src/views/ResearchView.tsx — Web Search & Research
import { useState } from 'react';
import { Search, Globe, ExternalLink, Clock, RefreshCw, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, streamChat } from '../api/client';
import type { SearchResult, SearchResponse } from '../types';

export default function ResearchView() {
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState<SearchResult[]>([]);
  const [summary,    setSummary]    = useState('');
  const [provider,   setProvider]   = useState('');
  const [warning,    setWarning]    = useState('');
  const [elapsed,    setElapsed]    = useState(0);
  const [retrievedAt, setRetrievedAt] = useState('');
  const [phase,      setPhase]      = useState<'idle'|'searching'|'summarizing'|'done'|'error'>('idle');
  const [copied,     setCopied]     = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setPhase('searching');
    setResults([]);
    setSummary('');
    setWarning('');

    try {
      const res = await api.post<SearchResponse>('/api/search', { query, count: 8 });
      setResults(res.results);
      setProvider(res.provider);
      setWarning(res.warning ?? '');
      setElapsed(res.elapsedMs);
      setRetrievedAt(res.retrievedAt);
      setPhase('summarizing');

      // Stream summary from AI
      const snippets = res.results.slice(0, 6)
        .map((r, i) => `[${i+1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
        .join('\n\n');

      const systemPrompt = `You are Nilesh, a research assistant. Summarize the web search results below for the user's query. 
Cite sources using [number] format. Distinguish facts from uncertain claims. 
Be concise, accurate, and clearly note when information may be outdated.`;

      const userMsg = `Query: "${query}"\n\nSearch Results:\n${snippets}\n\nProvide a comprehensive, well-organized summary with citations.`;

      await streamChat({
        message: userMsg,
        model: 'gemini-online',
        provider: 'auto',
        history: [{ role: 'system', content: systemPrompt }],
        onChunk: (chunk) => setSummary(prev => prev + chunk),
        onDone: () => setPhase('done'),
        onError: (err) => {
          setSummary(`*Note: AI summarization failed (${err}). Please review the source results below.*`);
          setPhase('done');
        },
      });
    } catch (err: any) {
      setWarning(`Search failed: ${err.message}`);
      setPhase('error');
    }
  }

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">🌐 Web Research</div>
          <div className="page-subtitle">Search the web and get AI-summarized answers with citations</div>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Search the web… e.g. 'latest React 19 features' or 'how to deploy Node.js to Heroku'"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={!query.trim() || phase === 'searching' || phase === 'summarizing'}
          >
            {phase === 'searching' || phase === 'summarizing'
              ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> {phase === 'searching' ? 'Searching…' : 'Summarizing…'}</>
              : <><Search size={13} /> Search</>
            }
          </button>
        </div>

        {warning && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--amber)', padding: '6px 10px', background: 'rgba(245,158,11,0.1)', borderRadius: 6 }}>
            ⚠️ {warning}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="overflow-y-auto flex-1" style={{ padding: '16px 24px' }}>
        {phase === 'idle' && (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <div className="empty-state-title">Web Research</div>
            <div className="empty-state-desc">
              Type a query to search the web. Nilesh will find sources and provide a summarized answer with citations.
              <br /><br />
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Tip: Add BRAVE_SEARCH_API_KEY to .env for better search results.
              </span>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, alignItems: 'start' }}>
            {/* Sources */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Globe size={13} />
                {results.length} sources
                {provider && <span className="badge badge-gray">{provider}</span>}
                {elapsed > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{elapsed}ms</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.map((r, i) => (
                  <div key={i} className="search-result-card">
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>[{i+1}]</div>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="search-result-title"
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {r.title.slice(0, 60)} <ExternalLink size={10} />
                    </a>
                    <div className="search-result-url">{r.url}</div>
                    <div className="search-result-snippet">{r.snippet.slice(0, 160)}…</div>
                  </div>
                ))}
              </div>
              {retrievedAt && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={9} /> Retrieved: {new Date(retrievedAt).toLocaleString()}
                  <br />⚠️ Search results are not independently verified. Always check sources.
                </div>
              )}
            </div>

            {/* AI Summary */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                <span>🤖 AI Summary</span>
                {summary && (
                  <button className="btn-icon" onClick={handleCopySummary} title="Copy summary">
                    {copied ? <Check size={12} color="var(--emerald)" /> : <Copy size={12} />}
                  </button>
                )}
              </div>
              <div className="card" style={{ minHeight: 100 }}>
                {phase === 'summarizing' && !summary && (
                  <div className="typing-dots"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>
                )}
                {summary && (
                  <div className="md-body" style={{ fontSize: 13 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                    {phase === 'summarizing' && <span className="cursor-blink" />}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
