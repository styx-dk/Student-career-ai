import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react'

const pageCopy:Record<string,[string,string,string]> = {
  '/documents':['YOUR WORK, ALL TOGETHER','My documents','A home for your projects, certificates and everything you’re proud of.'],
  '/profile':['GET TO KNOW YOUR STRENGTHS','My career profile','See the skills and experience growing from your confirmed documents.'],
  '/repository':['EVERY EXPERIENCE COUNTS','My achievements','Keep track of projects, internships, courses and milestones.'],
  '/jobs':['DISCOVER WHAT’S POSSIBLE','Could this role be right for you?','Add a job description to see your strengths and what you could learn next.'],
  '/forecast':['LOOK A LITTLE FURTHER','Explore skill trends','See how demand for a skill has changed and what the forecast suggests.'],
  '/planner':['ONE STEP CLOSER','Plan your next move','Try out learning activities and see how they could help you prepare for a role.'],
  '/resumes':['BRING YOUR STORY TOGETHER','Create a resume that feels like you','Use your confirmed experience to prepare a resume for your next opportunity.'],
  '/settings':['MAKE THIS SPACE YOURS','Your account & preferences','Update your details and the direction you’d like to explore.'],
}
export function PageHeader({eyebrow,title,description,action}:{eyebrow?:string;title:string;description:string;action?:ReactNode}) {
  const {pathname}=useLocation();const copy=pageCopy[pathname]
  return <header className="page-header"><div><p className="eyebrow">{copy?.[0]||eyebrow}</p><h1>{copy?.[1]||title}</h1><p>{copy?.[2]||description}</p></div>{action}</header>
}
export function Card({children,className=''}:{children:ReactNode;className?:string}) { return <section className={`card ${className}`}>{children}</section> }
export function Empty({title,description,action}:{title:string;description:string;action?:ReactNode}) { return <div className="empty"><div className="empty-mark">＋</div><h3>{title}</h3><p>{description}</p>{action}</div> }
export function Spinner(){return <div className="loading"><LoaderCircle size={20}/> Loading…</div>}
export function Status({value}:{value:string}) { const key=value.toLowerCase().replaceAll(' ','_'); return <span className={`status status-${key}`}>{value}</span> }
export function Notice({kind='info',children}:{kind?:'info'|'error'|'success';children:ReactNode}) { const Icon=kind==='error'?AlertCircle:CheckCircle2; return <div className={`notice ${kind}`}><Icon size={18}/><span>{children}</span></div> }
