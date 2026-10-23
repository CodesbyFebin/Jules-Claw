'use client';
import { useRef, useState } from 'react';
const box={ background:'#15112e', color:'#eee9ff', border:'1px solid #403367', borderRadius:9, padding:12, width:'100%',boxSizing:'border-box',fontFamily:'monospace' };
export default function SqlLab(){
 const db=useRef(null);
 const [query,setQuery]=useState("SELECT s.title, a.name FROM sessions s INNER JOIN swarm_agents a ON s.agent_id=a.id ORDER BY s.id;");
 const [output,setOutput]=useState('Click Initialize to start real in-memory PGlite. No production data is loaded.');
 const [ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false);
 async function initialize(){
  setBusy(true);
  try{
   const {PGlite}=await import('@electric-sql/pglite');
   db.current=new PGlite();
   await db.current.exec("CREATE TABLE sessions(id integer PRIMARY KEY, title text NOT NULL, agent_id integer); CREATE TABLE swarm_agents(id integer PRIMARY KEY, name text NOT NULL); INSERT INTO swarm_agents VALUES (1,'Architect'),(2,'Verifier'); INSERT INTO sessions VALUES (1,'Fixture: review architecture',1),(2,'Fixture: verify patch',2);");
   setReady(true);setOutput('Initialized real in-memory PostgreSQL-compatible engine with explicitly labeled fixture rows.');
  }catch(e){setOutput('Initialization error: '+e.message);}finally{setBusy(false);}
 }
 async function run(){
  if(!db.current)return;
  setBusy(true);
  try{const rows=await db.current.exec(query);setOutput(JSON.stringify(rows,null,2));}
  catch(e){setOutput('SQL error: '+e.message);}
  finally{setBusy(false);}
 }
 return <main style={{background:'#090716',color:'#eee9ff',minHeight:'100vh',padding:26,fontFamily:'system-ui'}}>
  <a href="/lab" style={{color:'#a990ff'}}>← Developer Lab</a><h1>PGlite SQL Lab</h1>
  <p>Real SQL execution in a browser-local, memory-only database. Tables contain explicit fixtures, never live coding sessions or a production PostgreSQL database. Restarting the page loses data.</p>
  <button disabled={busy||ready} onClick={initialize}>Initialize PGlite</button>
  <p>Try <code>EXPLAIN ANALYZE SELECT * FROM sessions;</code> or a JOIN. SQL here only affects this disposable local database.</p>
  <textarea value={query} rows={5} onChange={e=>setQuery(e.target.value)} style={box} aria-label="SQL query"/>
  <p><button disabled={!ready||busy} onClick={run}>Run actual SQL</button></p>
  <pre style={{...box,whiteSpace:'pre-wrap',overflow:'auto'}}>{output}</pre>
 </main>;
}
