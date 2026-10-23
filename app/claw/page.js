'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseClawCommand, HELP } from '../../lib/claw-commands';

const panel={ background:'#0a0820',border:'1px solid #241f4c',borderRadius:10,padding:14 };
const button={background:'#7c5cfc',border:0,color:'#fff',borderRadius:6,padding:'9px 12px',cursor:'pointer'};
const fmt = date => date ? new Date(date).toLocaleString() : '—';

export default function ClawConsole(){
  const [command,setCommand]=useState('');
  const [lines,setLines]=useState([{type:'info',text:'Jules Claw Operations Console — authenticated API control. Type help. No shell is attached.'}]);
  const [jobs,setJobs]=useState([]);
  const [availability,setAvailability]=useState('Checking database…');
  const [busy,setBusy]=useState(false);
  const [details,setDetails]=useState(null);
  const bottom=useRef(null);
  const add=(type,text)=>setLines(old=>[...old.slice(-149),{type,text:String(text),at:new Date().toISOString()}]);
  const refresh=useCallback(async()=>{
    try{
      const response=await fetch('/api/verification',{cache:'no-store'});
      const payload=await response.json();
      if(!response.ok)throw Error(payload.error||'Verification API unavailable');
      setJobs(payload.jobs||[]);
      setAvailability('Verification database responding');
      return payload.jobs||[];
    }catch(error){
      setAvailability('Unavailable: '+error.message);
      throw error;
    }
  },[]);
  useEffect(()=>{
    refresh().catch(()=>{});
    const timer=setInterval(()=>refresh().catch(()=>{}),15000);
    return()=>clearInterval(timer);
  },[refresh]);
  useEffect(()=>{bottom.current?.scrollIntoView({block:'end'});},[lines]);
  async function execute(raw){
    const parsed=parseClawCommand(raw);
    setCommand('');
    if(parsed.type==='clear'){setLines([]);return;}
    add('cmd','$ '+raw);
    if(parsed.type==='invalid'){add('error','BLOCKED — '+parsed.reason);return;}
    if(parsed.type==='help'){HELP.forEach(text=>add('info',text));return;}
    setBusy(true);
    try{
      if(parsed.type==='jobs'||parsed.type==='status'){
        const latest=await refresh();
        if(parsed.type==='jobs'){
          if(!latest.length)add('info','No persisted jobs found.');
          latest.slice(0,20).forEach(j=>add('info',j.id+' | '+j.profile+' | '+j.status+' | '+j.commit_sha?.slice(0,12)));
        }else{
          const counts=latest.reduce((acc,j)=>(acc[j.status]=(acc[j.status]||0)+1,acc),{});
          add('success','Verification DB reachable. Latest '+latest.length+' jobs: '+JSON.stringify(counts)+'. Docker daemon state not directly observed.');
        }
      }else if(parsed.type==='job'){
        const r=await fetch('/api/verification/'+parsed.id,{cache:'no-store'});
        const d=await r.json();if(!r.ok)throw Error(d.error||'Job unavailable');
        setDetails(d.job);
        add('success','Retrieved persisted job '+parsed.id+' — '+d.job.status+'; output in right panel.');
      }else if(parsed.type==='verify'){
        const r=await fetch('/api/verification',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pullRequestUrl:parsed.url,profile:parsed.profile})});
        const d=await r.json();if(!r.ok)throw Error(d.error||'Queue unavailable');
        add('success','Persisted verification job '+d.job.id+' queued for '+d.job.profile+' at '+d.job.commit_sha);
        await refresh();
      }else if(parsed.type==='cancel'){
        const r=await fetch('/api/verification/'+parsed.id,{method:'DELETE'});
        const d=await r.json();if(!r.ok)throw Error(d.error||'Cancellation failed');
        add('success','Cancellation requested: '+parsed.id+'. Worker confirmation may take time.');
        await refresh();
      }
    }catch(e){add('error','API error — '+e.message);}
    finally{setBusy(false);}
  }
  const counts=jobs.reduce((acc,j)=>(acc[j.status]=(acc[j.status]||0)+1,acc),{});
  return <div className="claw-app">
    <style>{`.claw-app{min-height:100vh;background:#050410;color:#f0eef6;font:13px system-ui}.claw-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:13px 18px;background:#0a0820;border-bottom:1px solid #241f4c}.claw-grid{display:grid;grid-template-columns:220px minmax(0,1fr) 280px;gap:12px;padding:12px;height:calc(100vh - 80px);box-sizing:border-box}.claw-col{overflow:auto}.claw-term{display:flex;flex-direction:column;min-height:0}.claw-log{overflow:auto;flex:1;font:12px/1.7 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;padding:15px}.claw-row{display:flex;gap:9px;margin-top:9px}.claw-prompt{width:100%;background:#0e0a2c;border:1px solid #403367;border-radius:6px;color:white;padding:10px;font:12px monospace}.claw-tag{font:11px monospace;color:#5ce1e6}.claw-job{padding:9px;border:1px solid #292355;border-radius:7px;margin-top:8px;overflow-wrap:anywhere}.claw-card{background:#0d0b26;border:1px solid #292355;border-radius:6px;padding:9px;margin-bottom:7px}.claw-pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11px monospace;max-height:220px;overflow:auto;color:#b0abc8}@media(max-width:940px){.claw-grid{display:flex;flex-direction:column;height:auto}.claw-term{min-height:460px}.claw-col{overflow:visible}}`}</style>
    <header className="claw-head">
      <div><a href="/" style={{color:'#9b7fff',textDecoration:'none'}}>← Workspace</a> <strong style={{fontSize:17,marginLeft:12}}>🦞 JULES <span style={{color:'#5ce1e6'}}>CLAW</span></strong><div style={{fontSize:11,color:'#9b94b9'}}>Operations Console · measured verification only</div></div>
      <div className="claw-tag">{availability}</div>
    </header>
    <div className="claw-grid">
      <aside className="claw-col" style={panel}>
        <h3>Execution Boundary</h3>
        <div className="claw-card">✓ PostgreSQL queue: {availability.startsWith('Verification database responding')?'reachable':'unverified'}</div>
        <div className="claw-card">✓ Supported profiles: syntax · node-tests</div>
        <div className="claw-card">✓ Immutable GitHub PR head SHA</div>
        <div className="claw-card" style={{color:'#f87171'}}>✕ Arbitrary shell / SSH / npm commands</div>
        <div className="claw-card" style={{color:'#f87171'}}>✕ Browser Docker daemon / private key access</div>
        <p style={{color:'#a8a3c0',fontSize:11}}>Container safeguards are enforced by the separate verifier worker, not by this console. Runtime Docker health and MCP servers are not claimed without independent checks.</p>
        <h3>Persisted jobs (latest 30)</h3>
        {Object.keys(counts).length ? Object.entries(counts).map(([k,v])=><div className="claw-card" key={k}>{k}: {v}</div>):<p>No jobs returned.</p>}
        <button style={button} disabled={busy} onClick={()=>execute('status')}>Refresh status</button>
      </aside>
      <section className="claw-term" style={{...panel,padding:0,background:'#040310'}}>
        <div style={{padding:12,borderBottom:'1px solid #241f4c',color:'#a8a3c0',fontFamily:'monospace'}}>● ● ●  claw-ops · API-backed console</div>
        <div className="claw-log" role="log" aria-live="polite">{lines.map((line,i)=><div key={i} style={{color:line.type==='error'?'#f87171':line.type==='success'?'#4ade80':line.type==='cmd'?'#5ce1e6':'#b0abc8'}}>{line.text}</div>)}<div ref={bottom}/></div>
        <form onSubmit={e=>{e.preventDefault();if(command.trim()&&!busy)execute(command.trim());}} style={{padding:12,borderTop:'1px solid #241f4c',display:'flex',gap:7}}>
          <span style={{color:'#5ce1e6'}}>claw&gt;</span>
          <input aria-label="Allowlisted command" className="claw-prompt" value={command} onChange={e=>setCommand(e.target.value)} placeholder="help | jobs | verify syntax https://github.com/…/pull/1" maxLength={2048}/>
          <button type="submit" style={button} disabled={busy}>Run</button>
        </form>
        <div style={{padding:'0 12px 12px',display:'flex',gap:8,flexWrap:'wrap'}}>
          {['help','jobs','status'].map(command=><button key={command} style={{...button,background:'#282050'}} disabled={busy} onClick={()=>execute(command)}>{command}</button>)}
        </div>
      </section>
      <aside className="claw-col" style={panel}>
        <h3>Verification evidence</h3>
        {details?<><div className="claw-card"><strong>{details.status}</strong><div>{details.profile}</div><div>{details.commit_sha}</div><div>Exit: {details.exit_code??'not finished'}</div><div>Started: {fmt(details.started_at)}</div><div>Finished: {fmt(details.finished_at)}</div></div><h4>stdout</h4><pre className="claw-pre">{details.stdout||'No stdout recorded'}</pre><h4>stderr</h4><pre className="claw-pre">{details.stderr||'No stderr recorded'}</pre></>:<p style={{color:'#a8a3c0'}}>Use <code>job &lt;uuid&gt;</code> to inspect real persisted output.</p>}
        <h3>Latest jobs</h3>
        {jobs.slice(0,10).map(j=><button key={j.id} className="claw-job" style={{display:'block',width:'100%',background:'#0d0b26',color:'#eee9ff',textAlign:'left',cursor:'pointer'}} onClick={()=>execute('job '+j.id)}><span className="claw-tag">{j.status} · {j.profile}</span><div>{j.id}</div><small>{fmt(j.created_at)}</small></button>)}
        <p style={{fontSize:10,color:'#8b84aa'}}>All rows retrieved from the verification API. No fabricated command output or CPU metrics.</p>
      </aside>
    </div>
  </div>;
}
