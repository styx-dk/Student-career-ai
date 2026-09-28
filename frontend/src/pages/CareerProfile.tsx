import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Card, Empty, Notice, PageHeader, Spinner } from '../components/UI'

type EvidenceProfile={summary:string|null;skills:{name:string;sources:{record_id:string;title:string;document_id:string|null}[]}[];records:{id:string;title:string;type:string;summary:string;organization:string|null;start_date:string|null;skills:string[];details:{accomplishments?:string[]}}[]}
export function CareerProfile(){
  const [data,setData]=useState<EvidenceProfile>();const [error,setError]=useState('');const [busy,setBusy]=useState(false)
  const load=()=>api<EvidenceProfile>('/profile/evidence').then(setData)
  useEffect(()=>{load().catch(e=>setError(e.message))},[])
  async function regenerate(){setBusy(true);setError('');try{await api('/profile/summary',{method:'POST'});await load()}catch(e){setError(e instanceof Error?e.message:'Could not generate summary')}finally{setBusy(false)}}
  return <><PageHeader eyebrow="Built from your uploads" title="My career profile" description="Your confirmed experience, skills and progress, with the evidence behind each detail." action={<Link className="primary" to="/documents">Open my drive</Link>}/>{error&&<Notice kind="error">{error}</Notice>}{!data?(!error&&<Spinner/>):!data.records.length?<Empty title="Your story starts with evidence" description="Upload a document, review its analysis and confirm it. Your profile will grow here." action={<Link className="primary" to="/documents">Upload your first document</Link>}/>:<>
  <Card><div className="card-head"><div><p className="eyebrow">Profile summary</p><h2>What your evidence says about you</h2></div><button className="secondary" disabled={busy} onClick={regenerate}>{busy?'Writing…':'Refresh AI summary'}</button></div><p className="profile-narrative">{data.summary}</p><small>AI wording should be reviewed. The confirmed records below remain the source for your profile.</small></Card>
  <div className="career-profile-grid"><Card><p className="eyebrow">Skills with sources</p><h2>{data.skills.length} documented skills</h2>{data.skills.map(s=><div className="skill-evidence" key={s.name}><b>{s.name}</b>{s.sources.map(source=><Link key={source.record_id} to="/documents">{source.title}</Link>)}</div>)}</Card><Card><p className="eyebrow">Career history</p><h2>{data.records.length} confirmed records</h2>{data.records.map(r=><article className="career-event" key={r.id}><small>{r.start_date||'Date not provided'} · {r.type}</small><h3>{r.title}</h3>{r.organization&&<b>{r.organization}</b>}<p>{r.summary}</p><div className="chips">{r.skills.map(s=><span key={s}>{s}</span>)}</div></article>)}</Card></div>
  </>}</>
}
