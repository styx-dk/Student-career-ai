import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, Upload, UserRound, BriefcaseBusiness, FolderOpen, CheckCircle2, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { DocumentItem } from '../types'
import { Card, Notice, Spinner, Status } from '../components/UI'

export function Dashboard(){
  const [docs,setDocs]=useState<DocumentItem[]>()
  const [error,setError]=useState('')
  useEffect(()=>{api<DocumentItem[]>('/documents').then(setDocs).catch(e=>setError(e.message))},[])
  const confirmed=docs?.filter(d=>d.is_confirmed).length||0
  const review=docs?.filter(d=>d.processing_status==='needs_review').length||0
  return <div className="student-home"><div className="home-intro"><p className="eyebrow">A LITTLE PROGRESS, EVERY DAY</p><h1>Your future. Your direction.</h1><p>A space for everything you’re learning, building and becoming.</p></div>
    <section className="home-hero"><div><span className="hero-tag">YOUR CAREER STARTS HERE</span><h2>You have more to offer<br/>than you think.</h2><p>Turn your projects, certificates and experiences into a profile that tells your story.</p><Link className="primary" to="/documents"><Upload size={17}/>Add your work <ArrowRight size={17}/></Link></div><div className="journey-art" aria-hidden="true"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><div className="journey-center"><UserRound size={42}/><b>Your potential</b></div><span className="journey-bubble bubble-one"><CheckCircle2 size={19}/>Skills</span><span className="journey-bubble bubble-two"><FolderOpen size={19}/>Projects</span><span className="journey-bubble bubble-three"><BriefcaseBusiness size={19}/>Possibilities</span></div></section>
    <div className="section-heading"><div><p className="eyebrow">MAKE YOURSELF AT HOME</p><h2>Three steps to a clearer path</h2></div></div>
    <div className="journey-cards">{[{to:'/documents',Icon:Upload,n:'01',title:'Bring your work together',text:'Upload certificates, project reports and internship letters.',cta:'Open my documents'},{to:'/profile',Icon:UserRound,n:'02',title:'Discover your strengths',text:'Review your skills and build a profile from your real experience.',cta:'See my profile'},{to:'/jobs',Icon:BriefcaseBusiness,n:'03',title:'Find your next step',text:'Explore a role, understand the gaps and create a plan.',cta:'Explore a role'}].map(({to,Icon,n,title,text,cta})=><Link to={to} className="journey-card" key={n}><div className="journey-card-top"><span><Icon size={22}/></span><small>{n}</small></div><h3>{title}</h3><p>{text}</p><b>{cta}<ArrowUpRight size={16}/></b></Link>)}</div>
    {error&&<Notice kind="error">{error}</Notice>}
    {!docs&&!error?<Spinner/>:docs&&<div className="home-bottom"><Card><div className="card-head"><div><p className="eyebrow">YOUR STORY SO FAR</p><h2>Recent documents</h2></div><Link to="/documents">View all <ArrowRight size={16}/></Link></div>{docs.length?docs.slice(0,4).map(d=><Link to="/documents" className="home-file" key={d.id}><span className="file-icon"><FolderOpen size={20}/></span><span><b>{d.display_name}</b><small>{new Date(d.created_at).toLocaleDateString()}</small></span><Status value={d.processing_status.replaceAll('_',' ')}/></Link>):<div className="home-zero"><FolderOpen size={30}/><h3>Your first upload is a great place to start.</h3><p>Even one project or certificate can help your profile grow.</p><Link to="/documents">Upload a document <ArrowRight size={15}/></Link></div>}</Card><Card className="progress-card"><p className="eyebrow">SMALL WINS ADD UP</p><h2>Your progress</h2><div><FolderOpen size={19}/><span>Documents uploaded</span><b>{docs.length}</b></div><div><Clock3 size={19}/><span>Waiting for review</span><b>{review}</b></div><div><CheckCircle2 size={19}/><span>Confirmed documents</span><b>{confirmed}</b></div><Link className="secondary wide" to={review?'/documents':'/profile'}>{review?'Review your documents':'Visit your profile'}<ArrowRight size={15}/></Link></Card></div>}
  </div>
}
