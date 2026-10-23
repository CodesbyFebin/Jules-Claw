'use client';

import { useState, useEffect, useCallback } from 'react';

const styles = {
  app: { display: 'flex', height: '100vh', overflow: 'hidden' },
  sidebar: { width: 260, background: '#010409', borderRight: '1px solid #21262d', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  logo: { color: '#00ff00', fontFamily: 'monospace', fontSize: 18, fontWeight: 700, marginBottom: 16 },
  navBtn: (active) => ({
    background: active ? '#161b22' : 'transparent',
    color: '#e6edf3',
    border: '1px solid #30363d',
    padding: '8px 12px',
    borderRadius: 6,
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: 14,
  }),
  main: { flex: 1, display: 'flex', flexDirection: 'column', background: '#0d1117' },
  header: { padding: '12px 20px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  content: { flex: 1, overflow: 'auto', padding: 20 },
  card: { background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16, marginBottom: 12 },
  input: { width: '100%', background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', padding: 10, borderRadius: 6, fontFamily: 'inherit' },
  btn: { background: '#238636', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
  btnSecondary: { background: '#21262d', color: '#e6edf3', border: '1px solid #30363d', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' },
  state: (s) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 12,
    background: s === 'COMPLETED' ? '#1f6b4a' : s === 'FAILED' ? '#E85D4C' : s === 'AWAITING_PLAN_APPROVAL' ? '#d4a24a' : '#30363d',
    color: '#fff',
  }),
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, whiteSpace: 'pre-wrap' },
};

export default function Home() {
  const [view, setView] = useState('new');
  const [sources, setSources] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activities, setActivities] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [source, setSource] = useState('');
  const [branch, setBranch] = useState('main');
  const [title, setTitle] = useState('');
  const [requirePlan, setRequirePlan] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSources = useCallback(async () => {
    try {
      const r = await fetch('/api/sources');
      const d = await r.json();
      setSources(d.sources || []);
    } catch (e) { setError(e.message); }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const r = await fetch('/api/sessions');
      const d = await r.json();
      setSessions(d.sessions || []);
    } catch (e) { setError(e.message); }
  }, []);

  const loadSession = useCallback(async (id) => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        fetch(`/api/sessions/${id}`).then(r => r.json()),
        fetch(`/api/sessions/${id}/activities`).then(r => r.json()),
      ]);
      setSelected(s);
      setActivities(a.activities || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { loadSources(); loadSessions(); }, [loadSources, loadSessions]);

  useEffect(() => {
    if (!selected?.id) return;
    const t = setInterval(() => loadSession(selected.id), 4000);
    return () => clearInterval(t);
  }, [selected?.id, loadSession]);

  async function createSession(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, title, source: source || undefined, branch, requirePlanApproval: requirePlan }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setPrompt('');
      setTitle('');
      await loadSessions();
      setView('sessions');
      if (d.id) loadSession(d.id);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function approve() {
    if (!selected?.id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/sessions/${selected.id}/approve`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json()).error);
      await loadSession(selected.id);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!selected?.id || !msg) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/sessions/${selected.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: msg }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setMsg('');
      await loadSession(selected.id);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>OPEN JULES</div>
        <button style={styles.navBtn(view === 'new')} onClick={() => setView('new')}>New Task</button>
        <button style={styles.navBtn(view === 'sessions')} onClick={() => { setView('sessions'); loadSessions(); }}>Sessions</button>
        <button style={styles.navBtn(view === 'sources')} onClick={() => setView('sources')}>Sources</button>
        <button style={styles.navBtn(view === 'addons')} onClick={() => setView('addons')}>Addons</button>
        <div style={{ marginTop: 'auto', fontSize: 12, color: '#8b949e' }}>
          Jules API · AGENTS.md · Plan approval
        </div>
      </aside>

      <main style={styles.main}>
        <header style={styles.header}>
          <div style={{ fontWeight: 600 }}>Asynchronous Coding Agent</div>
          <div style={{ fontSize: 13, color: '#8b949e' }}>jules.googleapis.com/v1alpha</div>
        </header>

        <div style={styles.content}>
          {error && <div style={{ ...styles.card, borderColor: '#E85D4C', color: '#E85D4C' }}>{error}</div>}

          {view === 'new' && (
            <form onSubmit={createSession} style={styles.card}>
              <h2 style={{ marginTop: 0 }}>New Jules Session</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                <input style={styles.input} placeholder="Title (optional)" value={title} onChange={e => setTitle(e.target.value)} />
                <textarea style={{ ...styles.input, minHeight: 120 }} placeholder="Describe the task clearly..." value={prompt} onChange={e => setPrompt(e.target.value)} required />
                <select style={styles.input} value={source} onChange={e => setSource(e.target.value)}>
                  <option value="">Repoless / no source</option>
                  {sources.map(s => <option key={s.name} value={s.name}>{s.githubRepo?.owner}/{s.githubRepo?.repo} ({s.name})</option>)}
                </select>
                <input style={styles.input} placeholder="Branch" value={branch} onChange={e => setBranch(e.target.value)} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={requirePlan} onChange={e => setRequirePlan(e.target.checked)} />
                  Require plan approval
                </label>
                <button type="submit" style={styles.btn} disabled={loading}>{loading ? 'Creating…' : 'Start Session'}</button>
              </div>
            </form>
          )}

          {view === 'sessions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Sessions</h2>
                <button style={styles.btnSecondary} onClick={loadSessions}>Refresh</button>
              </div>
              {sessions.map(s => (
                <div key={s.id || s.name} style={{ ...styles.card, cursor: 'pointer' }} onClick={() => { setSelected(s); loadSession(s.id || s.name?.split('/').pop()); setView('detail'); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{s.title || s.prompt?.slice(0, 60) || 'Untitled'}</strong>
                    <span style={styles.state(s.state)}>{s.state}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#8b949e', marginTop: 4 }}>{s.id || s.name}</div>
                </div>
              ))}
              {!sessions.length && <div style={styles.card}>No sessions yet.</div>}
            </div>
          )}

          {view === 'detail' && selected && (
            <div>
              <button style={styles.btnSecondary} onClick={() => setView('sessions')}>← Back</button>
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0 }}>{selected.title || 'Session'}</h2>
                  <span style={styles.state(selected.state)}>{selected.state}</span>
                </div>
                <p style={styles.mono}>{selected.prompt}</p>
                {selected.state === 'AWAITING_PLAN_APPROVAL' && (
                  <button style={styles.btn} onClick={approve} disabled={loading}>Approve Plan</button>
                )}
                {selected.url && <a href={selected.url} target="_blank" rel="noreferrer" style={{ color: '#58a6ff' }}>Open in Jules</a>}
              </div>

              <div style={styles.card}>
                <h3>Activities</h3>
                {activities.map((a, i) => (
                  <div key={i} style={{ borderTop: '1px solid #30363d', padding: '8px 0' }}>
                    <div style={{ fontSize: 12, color: '#8b949e' }}>{a.originator} · {a.createTime}</div>
                    <div>{a.description}</div>
                    {a.artifacts?.map((art, j) => art.changeSet?.gitPatch && (
                      <pre key={j} style={{ ...styles.mono, background: '#010409', padding: 8, overflow: 'auto', maxHeight: 200 }}>{art.changeSet.gitPatch.unidiffPatch}</pre>
                    ))}
                  </div>
                ))}
                {!activities.length && <div>No activities yet.</div>}
              </div>

              <form onSubmit={sendMessage} style={styles.card}>
                <textarea style={{ ...styles.input, minHeight: 60 }} placeholder="Send message / feedback to Jules..." value={msg} onChange={e => setMsg(e.target.value)} />
                <button type="submit" style={{ ...styles.btn, marginTop: 8 }} disabled={loading}>Send</button>
              </form>
            </div>
          )}

          {view === 'sources' && (
            <div>
              <h2>Connected Sources</h2>
              {sources.map(s => (
                <div key={s.name} style={styles.card}>
                  <strong>{s.githubRepo?.owner}/{s.githubRepo?.repo}</strong>
                  <div style={{ fontSize: 13, color: '#8b949e' }}>{s.name}</div>
                </div>
              ))}
              {!sources.length && <div style={styles.card}>No sources. Connect GitHub in Jules web app first.</div>}
            </div>
          )}

          {view === 'addons' && (
            <div>
              <h2>Addons (from Open Source AI Stack)</h2>
              <div style={styles.card}>
                <h3>Gateway / Router</h3>
                <p>LiteLLM / Bifrost / Portkey style OpenAI-compatible proxy. Point Jules or local agents at your own router for cost, failover, and free models.</p>
                <code>POST /api/gateway/chat</code> (stub — wire to LiteLLM)
              </div>
              <div style={styles.card}>
                <h3>Memory</h3>
                <p>Mem0 / OpenMemory / Graphiti style long-term memory. Store session outcomes, AGENTS.md patterns, and user preferences.</p>
                <code>GET/POST /api/memory</code>
              </div>
              <div style={styles.card}>
                <h3>Grok Bot + OpenClaw</h3>
                <p>Persistent routines and multi-channel local assistant hooks. Open Jules bot already created for backend continuity.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
