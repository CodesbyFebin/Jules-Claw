'use client';

import { useState, useEffect, useCallback } from 'react';

const styles = {
  app: { display: 'flex', height: '100vh', overflow: 'hidden' },
  sidebar: { width: 260, background: '#0a0818', borderRight: '1px solid #21262d', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  logo: { color: '#9b7fff', fontFamily: 'monospace', fontSize: 18, fontWeight: 700, marginBottom: 16 },
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
  main: { flex: 1, display: 'flex', flexDirection: 'column', background: '#0f0c22' },
  header: { padding: '12px 20px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  content: { flex: 1, overflow: 'auto', padding: 20 },
  card: { background: '#15112e', border: '1px solid #30363d', borderRadius: 8, padding: 16, marginBottom: 12 },
  input: { width: '100%', background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', padding: 10, borderRadius: 6, fontFamily: 'inherit' },
  btn: { background: '#7c5cfc', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
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
  const [nextPageToken, setNextPageToken] = useState('');
  const [activityNextPageToken, setActivityNextPageToken] = useState('');
  const [deskItems, setDeskItems] = useState([]);
  const [deskTitle, setDeskTitle] = useState('');
  const [deskDetail, setDeskDetail] = useState('');
  const [deskStatus, setDeskStatus] = useState('note');
  const [deskReady, setDeskReady] = useState(false);
  const [prEvidence, setPrEvidence] = useState({});
  const [verificationJobs, setVerificationJobs] = useState([]);
  const [verificationProfile, setVerificationProfile] = useState('syntax');
  const [swarmPrompt, setSwarmPrompt] = useState('');
  const [swarmResult, setSwarmResult] = useState(null);
  const [swarmBusy, setSwarmBusy] = useState(false);

  const loadSources = useCallback(async () => {
    try {
      const r = await fetch('/api/sources');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Unable to load sources');
      setSources(d.sources || []);
    } catch (e) { setError(e.message); }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const r = await fetch('/api/sessions');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Unable to load sessions');
      setSessions(d.sessions || []);
      setNextPageToken(d.nextPageToken || '');
    } catch (e) { setError(e.message); }
  }, []);

  const loadDesk = useCallback(async () => {
    try {
      const r = await fetch('/api/desk');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Desk unavailable');
      setDeskItems(d.items || []);
      setDeskReady(true);
    } catch (e) { setDeskReady(false); setError(e.message); }
  }, []);

  async function runAdvisorySwarm(e) {
    e.preventDefault();
    setError('');
    setSwarmBusy(true);
    setSwarmResult(null);
    try {
      const r = await fetch('/api/swarm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: swarmPrompt, confirmCost: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gateway review unavailable');
      setSwarmResult(d);
    } catch (e) { setError(e.message); }
    finally { setSwarmBusy(false); }
  }

  const loadVerificationJobs = useCallback(async () => {
    try {
      const r = await fetch('/api/verification');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Unable to retrieve verification jobs');
      setVerificationJobs(d.jobs || []);
    } catch (e) { setError(e.message); }
  }, []);

  async function enqueueVerification(url) {
    setError('');
    try {
      const r = await fetch('/api/verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pullRequestUrl: url, profile: verificationProfile }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Unable to enqueue verification');
      await loadVerificationJobs();
      setView('verification');
    } catch (e) { setError(e.message); }
  }

  async function cancelVerification(id) {
    try {
      const r = await fetch('/api/verification/' + encodeURIComponent(id), { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Unable to cancel');
      await loadVerificationJobs();
    } catch (e) { setError(e.message); }
  }

  async function verifyPullRequest(url) {
    setPrEvidence(v => ({ ...v, [url]: { loading: true } }));
    try {
      const r = await fetch('/api/github/evidence?url=' + encodeURIComponent(url));
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Unable to fetch PR checks');
      setPrEvidence(v => ({ ...v, [url]: d }));
    } catch (e) { setPrEvidence(v => ({ ...v, [url]: { error: e.message } })); }
  }

  async function saveDesk(e) {
    e.preventDefault();
    setError('');
    try {
      const r = await fetch('/api/desk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: deskTitle, detail: deskDetail, status: deskStatus }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not save desk entry');
      setDeskTitle('');
      setDeskDetail('');
      await loadDesk();
    } catch (e) { setError(e.message); }
  }

  const loadSession = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        fetch(`/api/sessions/${encodeURIComponent(String(id).split('/').pop())}`).then(r => r.json()),
        fetch(`/api/sessions/${encodeURIComponent(String(id).split('/').pop())}/activities`).then(r => r.json()),
      ]);
      if (s.error || a.error) throw new Error(s.error || a.error);
      setSelected(s);
      setActivities(a.activities || []);
      setActivityNextPageToken(a.nextPageToken || '');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { loadSources(); loadSessions(); }, [loadSources, loadSessions]);

  useEffect(() => {
    if (!selected?.name || ['COMPLETED', 'FAILED'].includes(selected.state)) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadSession(selected.name); }, 5000);
    return () => clearInterval(t);
  }, [selected?.name, selected?.state, loadSession]);

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
      if (d.name) loadSession(d.name);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function approve() {
    if (!selected?.name) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/sessions/${encodeURIComponent(selected.name?.split('/').pop() || selected.id)}/approve`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json()).error);
      await loadSession(selected.name);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!selected?.name || !msg.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/sessions/${encodeURIComponent(selected.name?.split('/').pop() || selected.id)}/message`, {
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
    <div className="open-jules-app" style={styles.app}>
      <aside className="open-jules-sidebar" style={styles.sidebar}>
        <div style={{ ...styles.logo, display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
          <img src="/icon.webp" alt="Jules Claw mark" width="32" height="32" style={{ borderRadius: 8 }} />
          <span>JULES <span style={{ color: '#5ce1e6' }}>CLAW</span></span>
        </div>
        <div style={{ color: '#8d84a8', fontSize: 11, marginBottom: 15, letterSpacing: 0.8 }}>AUTONOMOUS CODING CONTROL PLANE</div>
        <button style={styles.navBtn(view === 'new')} onClick={() => setView('new')}>New Task</button>
        <button style={styles.navBtn(view === 'sessions')} onClick={() => { setView('sessions'); loadSessions(); }}>Sessions</button>
        <button style={styles.navBtn(view === 'sources')} onClick={() => setView('sources')}>Sources</button>
        <button style={styles.navBtn(view === 'desk')} onClick={() => { setView('desk'); loadDesk(); }}>Desk / Evidence</button>
        <button style={styles.navBtn(view === 'verification')} onClick={() => { setView('verification'); loadVerificationJobs(); }}>Verification Jobs</button>
        <button style={styles.navBtn(view === 'swarm')} onClick={() => setView('swarm')}>Advisory Swarm</button>
        <a href="/lab" style={{ ...styles.navBtn(false), display: 'block', textDecoration: 'none' }}>Developer Lab</a>
        <a href="/claw" style={{ ...styles.navBtn(false), display: 'block', textDecoration: 'none' }}>Claw Operations</a>
        <button style={styles.navBtn(view === 'addons')} onClick={() => setView('addons')}>Integrations</button>
        <div style={{ marginTop: 'auto', fontSize: 12, color: '#8b949e' }}>
          Jules API · AGENTS.md · Plan approval
        </div>
      </aside>

      <main className="open-jules-main" style={styles.main}>
        <header style={styles.header}>
          <div style={{ fontWeight: 600 }}>Jules Claw · Coding Operations</div>
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
                <div key={s.id || s.name} style={{ ...styles.card, cursor: 'pointer' }} onClick={() => { setSelected(s); loadSession(s.name); setView('detail'); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{s.title || s.prompt?.slice(0, 60) || 'Untitled'}</strong>
                    <span style={styles.state(s.state)}>{s.state}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#8b949e', marginTop: 4 }}>{s.id || s.name}</div>
                </div>
              ))}
              {!sessions.length && <div style={styles.card}>No sessions yet.</div>}
              {nextPageToken && <button style={styles.btnSecondary} onClick={async () => { try { const r = await fetch(`/api/sessions?pageToken=${encodeURIComponent(nextPageToken)}`); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Unable to load more sessions'); setSessions(v => [...v, ...(d.sessions || [])]); setNextPageToken(d.nextPageToken || ''); } catch (e) { setError(e.message); } }}>Load more sessions</button>}
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
                    {a.artifacts?.map((art, j) => art.changeSet?.gitPatch?.unidiffPatch && (
                      <pre key={j} style={{ ...styles.mono, background: '#010409', padding: 8, overflow: 'auto', maxHeight: 200 }}>{art.changeSet.gitPatch.unidiffPatch}</pre>
                    ))}
                  </div>
                ))}
                {activityNextPageToken && <button style={styles.btnSecondary} onClick={async () => { try { const id = selected.name.split('/').pop(); const r = await fetch(`/api/sessions/${encodeURIComponent(id)}/activities?pageToken=${encodeURIComponent(activityNextPageToken)}`); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Unable to load activities'); setActivities(v => [...v, ...(d.activities || [])]); setActivityNextPageToken(d.nextPageToken || ''); } catch (e) { setError(e.message); } }}>Load older activities</button>}
                {!activities.length && <div>No activities yet.</div>}
              </div>

              {selected.outputs?.map((output, i) => output.pullRequest?.url && <div key={i} style={styles.card}><h3>Pull request</h3><a href={output.pullRequest.url} target="_blank" rel="noreferrer" style={{ color: '#58a6ff' }}>{output.pullRequest.title || output.pullRequest.url}</a><div style={{ marginTop: 10 }}><button style={styles.btnSecondary} onClick={() => verifyPullRequest(output.pullRequest.url)}>Fetch live GitHub CI evidence</button> <select aria-label="Verification profile" style={{ ...styles.input, width: 140 }} value={verificationProfile} onChange={e => setVerificationProfile(e.target.value)}><option value="syntax">JS syntax</option><option value="node-tests">Node tests</option></select> <button style={styles.btnSecondary} onClick={() => enqueueVerification(output.pullRequest.url)}>Queue isolated check</button></div>{prEvidence[output.pullRequest.url]?.loading && <p>Checking GitHub…</p>}{prEvidence[output.pullRequest.url]?.error && <p style={{ color: '#f87171' }}>{prEvidence[output.pullRequest.url].error}</p>}{prEvidence[output.pullRequest.url]?.sha && <div style={{ marginTop: 8, fontSize: 12 }}><div>PR head: {prEvidence[output.pullRequest.url].sha.slice(0, 12)}</div><div>Combined status: {prEvidence[output.pullRequest.url].status}</div>{prEvidence[output.pullRequest.url].checks.map(c => <div key={c.id} style={{ marginTop: 6 }}>{c.name}: {c.conclusion || c.status} — <a href={c.url} target="_blank" rel="noreferrer" style={{ color: '#58a6ff' }}>GitHub evidence</a></div>)}</div>}</div>)}
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

          {view === 'swarm' && (
            <div>
              <h2>Six-role Gateway Review</h2>
              <p style={{ color: '#a8a3c0', fontSize: 13 }}>Real gateway calls when enabled: Architect → Coder → Debugger / Security / Verifier → Manager. This is analysis only, with no file writes or executed tests. Six provider calls may incur charges.</p>
              <form onSubmit={runAdvisorySwarm} style={styles.card}>
                <textarea style={{ ...styles.input, minHeight: 110 }} value={swarmPrompt} onChange={e => setSwarmPrompt(e.target.value)} placeholder="Describe a coding task for six-role advisory review…" required maxLength={3000} />
                <button style={{ ...styles.btn, marginTop: 12 }} disabled={swarmBusy}>{swarmBusy ? 'Calling configured models…' : 'Run six-role review (uses gateway)'}</button>
              </form>
              {swarmResult && <div>
                <div style={styles.card}>Actual API calls: {swarmResult.actualCalls} · Reported tokens: {swarmResult.reportedTokens ?? 'Unavailable'}<p>{swarmResult.notice}</p></div>
                {swarmResult.stages.map((stage, i) => <div key={i} style={styles.card}>
                  <h3>{stage.role} · {stage.model}</h3>
                  <div style={{ fontSize: 12, color: '#a8a3c0' }}>Measured request latency: {stage.latencyMs}ms</div>
                  <pre style={{ ...styles.mono, maxHeight: 400, overflow: 'auto' }}>{stage.text}</pre>
                </div>)}
              </div>}
            </div>
          )}

          {view === 'verification' && (
            <div>
              <h2>Isolated Verification Jobs</h2>
              <p style={{ color: '#a8a3c0', fontSize: 13 }}>Only results from the separate Docker verifier are shown. Queued jobs stay queued until a worker is online. No simulated passes.</p>
              <button style={styles.btnSecondary} onClick={loadVerificationJobs}>Refresh job states</button>
              {verificationJobs.map(job => <div key={job.id} style={{ ...styles.card, marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong>{job.repo_owner}/{job.repo_name} · {job.profile}</strong>
                  <span style={styles.state(job.status === 'passed' ? 'COMPLETED' : job.status === 'failed' || job.status === 'infra_failure' ? 'FAILED' : '')}>{job.status}</span>
                </div>
                <p style={styles.mono}>{job.commit_sha.slice(0, 12)} · {job.created_at}</p>
                {job.exit_code !== null && <p>Actual process exit code: {job.exit_code}</p>}
                {job.stdout && <pre style={{ ...styles.mono, maxHeight: 160, overflow: 'auto' }}>{job.stdout}</pre>}
                {job.stderr && <pre style={{ ...styles.mono, maxHeight: 160, overflow: 'auto', color: '#f87171' }}>{job.stderr}</pre>}
                {['queued','running'].includes(job.status) && <button style={styles.btnSecondary} onClick={() => cancelVerification(job.id)}>Request cancellation</button>}
              </div>)}
              {!verificationJobs.length && <div style={styles.card}>No verification jobs recorded. Open a Jules-generated PR to queue a check.</div>}
            </div>
          )}

          {view === 'desk' && (
            <div>
              <h2>Desk / Evidence Journal</h2>
              <p style={{ color: '#a8a3c0', fontSize: 13 }}>Persistent, manually entered engineering notes. These are not automatically verified test results.</p>
              <form onSubmit={saveDesk} style={styles.card}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <input style={styles.input} placeholder="Entry title" value={deskTitle} onChange={e => setDeskTitle(e.target.value)} required maxLength={160} />
                  <textarea style={{ ...styles.input, minHeight: 90 }} placeholder="Evidence, findings or next steps" value={deskDetail} onChange={e => setDeskDetail(e.target.value)} required maxLength={4000} />
                  <select style={styles.input} value={deskStatus} onChange={e => setDeskStatus(e.target.value)}>
                    <option value="note">Note</option>
                    <option value="blocked">Blocked</option>
                    <option value="review">Needs review</option>
                  </select>
                  <button type="submit" style={styles.btn}>Save persistent entry</button>
                </div>
              </form>
              {!deskReady && <div style={styles.card}>Desk requires a configured PostgreSQL database and migration.</div>}
              {deskItems.map(item => <div key={item.id} style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{item.title}</strong><span style={styles.state('')}>{item.status}</span>
                </div>
                <p style={styles.mono}>{item.detail}</p>
                <div style={{ fontSize: 11, color: '#a8a3c0' }}>{item.created_at}</div>
              </div>)}
            </div>
          )}

          {view === 'addons' && (
            <div>
              <h2>Integration readiness</h2><p style={{ color: '#a8a3c0' }}>Only the Google Jules provider is wired to execute coding tasks. All other harnesses remain unavailable until independently integrated and tested.</p>
              <div style={styles.card}>
                <h3>Gateway / Router</h3>
                <p>LiteLLM / Bifrost / Portkey style OpenAI-compatible proxy. Point Jules or local agents at your own router for cost, failover, and free models.</p>
                <code>POST /api/gateway/chat</code> (stub — wire to LiteLLM)
              </div>
              <div style={styles.card}>
                <h3>Memory</h3>
                <p>Mem0 / OpenMemory / Graphiti style long-term memory. Persistent memory integration is not configured. Use the separate Desk journal for manually entered notes.</p>
                <code>GET/POST /api/memory</code>
              </div>
              <div style={styles.card}>
                <h3>Grok Bot + OpenClaw</h3>
                <p>Persistent routines and multi-channel local assistant hooks. Not integrated; no active agent or bot status is available.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
