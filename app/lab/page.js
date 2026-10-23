'use client';
import { useState } from 'react';
import ts from 'typescript';

const card = { background:'#15112e', padding:18, border:'1px solid #332a57', borderRadius:12, marginBottom:16 };
const input = { width:'100%', boxSizing:'border-box', background:'#080714', color:'#f1edff', border:'1px solid #4a3a79', borderRadius:7, padding:10, fontFamily:'monospace' };
const button = { background:'#7c5cfc', color:'white', border:0, borderRadius:8, padding:'9px 15px', cursor:'pointer' };

function executeTrustedSnippet(js, timeout=2500) {
  return new Promise(resolve => {
    const source = `self.onmessage=async e=>{const logs=[];console.log=(...a)=>logs.push(a.map(String).join(' '));try{const value=await (new Function('"use strict"; return (async()=>{'+e.data+'})()'))();self.postMessage({ok:true,value:String(value??''),logs})}catch(error){self.postMessage({ok:false,error:String(error),logs})}}`;
    const blob = URL.createObjectURL(new Blob([source], { type:'text/javascript' }));
    const worker = new Worker(blob);
    let complete = false;
    const finish = value => { if (complete) return; complete=true; clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(blob); resolve(value); };
    const timer = setTimeout(()=>finish({ok:false,error:'Execution exceeded 2.5 seconds'}),timeout);
    worker.onmessage = e => finish(e.data);
    worker.onerror = e => finish({ok:false,error:e.message||'Worker runtime error'});
    worker.postMessage(js);
  });
}

export default function Lab() {
  const [code,setCode]=useState("const message: string = 'Open Jules';\nconsole.log(message);");
  const [result,setResult]=useState('No execution performed.');
  const [busy,setBusy]=useState(false);
  const [repo,setRepo]=useState('CodesbyFebin/Jules-Claw');
  const [ref,setRef]=useState('main');
  const [tree,setTree]=useState(null);
  const [gatewayPrompt,setGatewayPrompt]=useState('');
  const [gatewayResult,setGatewayResult]=useState('');
  async function runCode() {
    setBusy(true);
    try {
      if (/^\s*(?:import|export)\b/m.test(code)) throw Error('Standalone snippets only; imports and exports are not supported.');
      const compiled=ts.transpileModule(code,{fileName:'snippet.ts',reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}});
      if (compiled.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error)) throw Error(ts.flattenDiagnosticMessageText(compiled.diagnostics[0].messageText,'\n'));
      const output=await executeTrustedSnippet(compiled.outputText);
      setResult(JSON.stringify({transpiler:'TypeScript',execution:'browser WebWorker (not a security boundary)',...output},null,2));
    } catch (e) { setResult('Error: '+e.message); } finally { setBusy(false); }
  }
  async function fetchTree() {
    setTree(null);
    try { const r=await fetch('/api/github/tree?repo='+encodeURIComponent(repo)+'&ref='+encodeURIComponent(ref)); const data=await r.json(); if(!r.ok) throw Error(data.error); setTree(data); }
    catch(e) { setTree({ error:e.message }); }
  }
  async function askGateway(e) {
    e.preventDefault(); setGatewayResult('Contacting configured gateway…');
    try { const r=await fetch('/api/gateway/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:gatewayPrompt}]})});const d=await r.json();if(!r.ok) throw Error(d.error);setGatewayResult(JSON.stringify({model:d._openJules?.modelUsed,attempts:d._openJules?.attempts,usage:d.usage||null,response:d.choices?.[0]?.message?.content},null,2)); }
    catch(e){setGatewayResult('Gateway unavailable: '+e.message);}
  }
  return <main style={{ minHeight:'100vh',background:'#090716',color:'#f2effb',padding:24,fontFamily:'system-ui,sans-serif' }}>
    <a href="/" style={{color:'#a990ff'}}>← Open Jules Dashboard</a>
    <h1>Developer Lab <small style={{fontSize:14,color:'#9b7fff'}}>measured results only</small></h1>
    <section style={card}>
      <h2>JS/TS Browser Worker</h2>
      <p style={{color:'#fbbf24'}}>For code you trust only. Browser Workers are not security sandboxes: snippets may make network requests. Use the isolated server verifier for untrusted repository code. Not Node.js, not a native shell.</p>
      <textarea aria-label="Code snippet" rows={9} value={code} onChange={e=>setCode(e.target.value)} style={input}/>
      <p><button style={button} disabled={busy} onClick={runCode}>{busy?'Executing…':'Transpile and execute snippet'}</button></p>
      <pre style={{...input,overflowX:'auto',whiteSpace:'pre-wrap'}}>{result}</pre>
    </section>
    <section style={card}>
      <h2>Live GitHub repository tree</h2>
      <p>Server-side GitHub token, repository allowlist, per-instance budget and maximum 1,000 returned files.</p>
      <input aria-label="Repository" value={repo} onChange={e=>setRepo(e.target.value)} style={input}/>
      <input aria-label="Git ref" value={ref} onChange={e=>setRef(e.target.value)} style={{...input,marginTop:8}}/>
      <p><button style={button} onClick={fetchTree}>Fetch live tree</button></p>
      {tree&&<pre style={{...input,maxHeight:340,overflow:'auto'}}>{JSON.stringify(tree,null,2)}</pre>}
    </section>
    <section style={card}><h2>Real browser SQL</h2><a href="/sql" style={{color:'#a990ff'}}>Open PGlite SQL Lab (JOIN / EXPLAIN ANALYZE)</a></section>
    <section style={card}>
      <h2>Gateway failover probe</h2>
      <form onSubmit={askGateway}><textarea required maxLength={12000} rows={3} value={gatewayPrompt} onChange={e=>setGatewayPrompt(e.target.value)} style={input}/><p><button style={button}>Send real model request</button></p></form>
      <p>Requires server-side GATEWAY_BASE_URL, GATEWAY_API_KEY and GATEWAY_MODELS. Real usage may incur costs.</p>
      <pre style={{...input,whiteSpace:'pre-wrap'}}>{gatewayResult}</pre>
    </section>
  </main>;
}
