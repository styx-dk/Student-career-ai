import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Compass, Home, FolderOpen, UserRound, Award, BriefcaseBusiness, TrendingUp, Route, FileText, Settings, LogOut, Menu, X, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { LucideIcon } from 'lucide-react'

const groups: {name:string;items:[string,LucideIcon,string][]}[] = [
  {name:'YOUR SPACE',items:[['/dashboard',Home,'Home'],['/documents',FolderOpen,'My documents'],['/profile',UserRound,'My profile'],['/repository',Award,'My achievements']]},
  {name:'YOUR NEXT CHAPTER',items:[['/jobs',BriefcaseBusiness,'Explore a role'],['/forecast',TrendingUp,'Skill trends'],['/planner',Route,'My action plan'],['/resumes',FileText,'My resumes']]},
]

export function Layout(){
  const [open,setOpen]=useState(false)
  const {session}=useAuth()
  const location=useLocation()
  const name=session?.user.user_metadata?.full_name||session?.user.email?.split('@')[0]||'Student'
  const title=groups.flatMap(g=>g.items).find(([path])=>path===location.pathname)?.[2]||'Settings'
  return <div className="shell student-shell">
    <a href="#workspace-content" className="skip-link">Skip to content</a>
    {open&&<button className="nav-scrim" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
    <aside className={`sidebar ${open?'open':''}`}>
      <Link className="brand" to="/dashboard"><span className="brand-mark"><Compass size={25}/></span><span><b>Career Compass</b><small>Find your own direction.</small></span></Link>
      <button className="icon mobile nav-close" aria-label="Close navigation" onClick={()=>setOpen(false)}><X/></button>
      <nav aria-label="Main navigation">{groups.map(group=><div className="nav-group" key={group.name}><span className="nav-label">{group.name}</span>{group.items.map(([to,Icon,label])=><NavLink key={to} to={to} onClick={()=>setOpen(false)}><Icon size={19}/>{label}<span className="nav-active-dot"/></NavLink>)}</div>)}</nav>
      <div className="sidebar-note"><span className="small-label">ONE STEP AT A TIME</span><b>Your future starts with what you do today.</b><Link to="/documents">Add your latest work <ArrowUpRight size={15}/></Link></div>
      <NavLink className="settings-link" to="/settings" onClick={()=>setOpen(false)}><Settings size={18}/>Settings</NavLink>
      <div className="account"><span className="avatar">{String(name)[0].toUpperCase()}</span><div><b>{name}</b><small>Student workspace</small></div><button className="icon" aria-label="Sign out" onClick={()=>supabase.auth.signOut()}><LogOut size={17}/></button></div>
    </aside>
    <main><div className="topbar"><button className="icon mobile" aria-label="Open navigation" onClick={()=>setOpen(true)}><Menu/></button><span className="topbar-title">{title}</span><div className="topbar-right"><span className="workspace-label"><span/>Your personal workspace</span><Link to="/settings" aria-label="Account settings" className="avatar">{String(name)[0].toUpperCase()}</Link></div></div><div id="workspace-content" className="page" key={location.pathname}><Outlet/></div></main>
  </div>
}
