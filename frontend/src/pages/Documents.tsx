import { useEffect, useRef, useState } from 'react'
import { Download, FileUp, FolderPlus, Folder as FolderIcon, Search, X, ChevronRight, Sparkles, FileText, CheckCircle2, Clock3, ArrowUpRight, LayoutGrid, List, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { DocumentItem } from '../types'
import { Card, Empty, Notice, PageHeader, Spinner, Status } from '../components/UI'
import './drive.css'

type Folder = {id:string;name:string;parent_id:string|null}
type Analysis = {title:string;summary:string;document_type:string;organization:string|null;start_date:string|null;end_date:string|null;skills:string[];mentioned_skills:string[];accomplishments:string[];uncertainties:string[]}
type FileItem = DocumentItem & {document_type:string;folder_id:string|null;extraction?:Analysis;confirmed_result?:Analysis}

export function Documents() {
  const [docs,setDocs]=useState<FileItem[]>([])
  const [folders,setFolders]=useState<Folder[]>([])
  const [folder,setFolder]=useState<string|null>(null)
  const [search,setSearch]=useState('')
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState('')
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [selected,setSelected]=useState<FileItem|null>(null)
  const [draft,setDraft]=useState<Analysis|null>(null)
  const [folderDialog,setFolderDialog]=useState(false)
  const [folderName,setFolderName]=useState('')
  const [filter,setFilter]=useState('all')
  const [view,setView]=useState<'grid'|'list'>('grid')
  const [dragging,setDragging]=useState(false)
  const input=useRef<HTMLInputElement>(null)
  async function load(){const [d,f]=await Promise.all([api<FileItem[]>('/documents'),api<Folder[]>('/folders')]);setDocs(d);setFolders(f)}
  useEffect(()=>{load().catch(e=>setError(e.message)).finally(()=>setLoading(false))},[])
  async function task(label:string,fn:()=>Promise<void>){setBusy(label);setError('');setMessage('');try{await fn()}catch(e){setError(e instanceof Error?e.message:'Request failed')}finally{setBusy('')}}
  function open(doc:FileItem){setSelected(doc);setDraft(doc.confirmed_result||doc.extraction||null)}
  async function analyze(doc:FileItem){const next=await api<FileItem>(`/documents/${doc.id}/process`,{method:'POST'});open(next);await load()}
  async function upload(files:FileList|null){if(!files)return;const batch=Array.from(files);await task('Uploading and analyzing…',async()=>{
    const failures:string[]=[]
    for(const file of batch){try{const form=new FormData();form.append('file',file);if(folder)form.append('folder_id',folder);const doc=await api<FileItem>('/documents',{method:'POST',body:form});await load();await analyze(doc)}catch(e){failures.push(`${file.name}: ${e instanceof Error?e.message:'Failed'}`)}}
    await load();if(failures.length)throw new Error(failures.join(' · '));setMessage('Analysis is ready. Review the document details before adding them to your profile.')
  })}
  async function review(decision:'accept'|'reject'){if(!selected)return;await task('Saving review…',async()=>{
    await api(`/documents/${selected.id}/review`,{method:'POST',body:JSON.stringify({decision,corrected_result:draft})})
    setSelected(null);await load()
    setMessage(decision==='accept'?'Confirmed. Your career profile and skill evidence have been updated.':'Draft rejected. Your existing confirmed profile is unchanged.')
    if(decision==='accept'){try{await api('/profile/summary',{method:'POST'})}catch{setMessage('Confirmed and saved. AI profile wording is temporarily unavailable; the factual profile is up to date.')}}
  })}
  const current=folders.find(f=>f.id===folder)
  const visible=docs.filter(d=>(search||d.folder_id===folder)&&`${d.display_name} ${d.extraction?.summary||''}`.toLowerCase().includes(search.toLowerCase())&&(filter==='all'||(filter==='review'?d.processing_status==='needs_review':filter==='confirmed'?d.is_confirmed:filter==='failed'?d.processing_status==='failed':true)))
  const childFolders=folders.filter(f=>f.parent_id===folder)
  const reviewed=docs.filter(d=>d.is_confirmed).length
  const awaiting=docs.filter(d=>d.processing_status==='needs_review').length
  return <div className="career-drive"><PageHeader eyebrow="Your personal career workspace" title="A home for your next chapter." description="Bring your work together. Discover the skills behind it." action={<button className="primary" disabled={!!busy} onClick={()=>input.current?.click()}><FileUp/>Upload documents</button>}/>
    <input ref={input} hidden multiple type="file" accept=".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png,.webp" onChange={e=>{void upload(e.target.files);e.target.value=''}}/>
    {error&&<Notice kind="error">{error}</Notice>}{message&&<Notice kind="success">{message}</Notice>}{busy&&<Notice>{busy}</Notice>}
    <div className="drive-overview"><div className="drive-welcome"><div><span className="welcome-tag"><Sparkles size={14}/> FROM DOCUMENTS TO POSSIBILITIES</span><h2>Your experience tells a story.<br/>Let’s bring it to life.</h2><p>Projects, certificates, internships — every milestone helps build a clearer picture of your potential.</p><Link to="/profile">Explore my career profile <ArrowUpRight size={17}/></Link></div><div className="paper-art" aria-hidden="true"><div className="paper-back"/><div className="paper-front"><div className="paper-symbol"><FileText size={28}/></div><i/><i/><i/><div className="paper-tags"><span>Skills</span><span>Experience</span></div></div><div className="paper-check"><CheckCircle2 size={22}/> Your story, connected</div></div></div><div className="drive-numbers"><div><span className="number-icon blue"><FileText size={19}/></span><b>{docs.length}</b><span>Documents in your drive</span></div><div><span className="number-icon amber"><Clock3 size={19}/></span><b>{awaiting}</b><span>Ready for your review</span></div><div><span className="number-icon green"><ShieldCheck size={19}/></span><b>{reviewed}</b><span>Confirmed milestones</span></div></div></div>
    <div className="drive-body"><section className="drive-library"><div className="library-top"><div className="drive-breadcrumb"><button onClick={()=>{setFolder(null);setSearch('')}}>My drive</button>{current&&<><ChevronRight size={14}/><button onClick={()=>setFolder(current.parent_id)}>…</button><ChevronRight size={14}/><b>{current.name}</b></>}</div><button className="secondary" disabled={!!busy} onClick={()=>setFolderDialog(true)}><FolderPlus size={16}/>New folder</button></div>
    <div className="search drive-search"><Search size={18}/><input aria-label="Search documents" placeholder="Search your documents and summaries…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    {loading?<Spinner/>:<>{!search&&<><div className="section-caption"><h2>Folders</h2><span>{childFolders.length} folders</span></div><div className="folder-grid">{childFolders.map((f,i)=><button key={f.id} className={`folder-tile folder-color-${i%3}`} onClick={()=>{setFolder(f.id);setFilter('all')}}><FolderIcon size={27}/><b>{f.name}</b><span>{docs.filter(d=>d.folder_id===f.id).length} documents</span><ChevronRight size={15}/></button>)}{!childFolders.length&&<button className="folder-create" onClick={()=>setFolderDialog(true)}><FolderPlus size={22}/><span>Create your first folder</span></button>}</div></>}
    <div className="section-caption"><h2>{search?'Search results':'Documents'} <span>{visible.length}</span></h2><div className="view-switch"><button aria-label="Grid view" aria-pressed={view==='grid'} className={view==='grid'?'active':''} onClick={()=>setView('grid')}><LayoutGrid size={16}/></button><button aria-label="List view" aria-pressed={view==='list'} className={view==='list'?'active':''} onClick={()=>setView('list')}><List size={16}/></button></div></div>
    <div className="drive-filters">{[['all','All files'],['review','Needs review'],['confirmed','Confirmed'],['failed','Needs attention']].map(([value,label])=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{label}</button>)}</div>
    {visible.length?<div className={`drive-files ${view}`}>{visible.map(doc=><button className="drive-file" key={doc.id} onClick={()=>open(doc)}><div className="document-cover"><FileText size={32}/><span>{doc.document_type||doc.original_filename.split('.').pop()}</span></div><div className="document-info"><b>{doc.display_name}</b><p>{doc.extraction?.summary||'Open to analyze your document and discover its career details.'}</p><small>{(doc.file_size/1024).toFixed(1)} KB · {new Date(doc.created_at).toLocaleDateString()}</small></div><Status value={doc.processing_status.replaceAll('_',' ')}/></button>)}</div>:<div className="drive-empty"><div className="empty-folder"><FolderIcon size={34}/></div><h3>{filter==='all'&&!search?'Your next milestone belongs here':'No documents match this view'}</h3><p>{filter==='all'&&!search?'Add a certificate, project report or internship letter. We’ll help you turn it into a meaningful career profile.':'Try another filter or search term to find your files.'}</p>{filter==='all'&&!search&&<button className="secondary" disabled={!!busy} onClick={()=>input.current?.click()}><FileUp size={16}/>Add a document</button>}</div>}</>}
    </section><aside className="drive-rail"><div className={`upload-panel ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);if(!busy)void upload(e.dataTransfer.files)}}><div className="upload-orbit"><FileUp size={28}/></div><h2>One upload.<br/>A little more you.</h2><p>Drop your documents here<br/>or choose files to get started.</p><button className="primary wide" disabled={!!busy} onClick={()=>input.current?.click()}>Browse files</button><small>PDF, Word, PowerPoint, text & images</small><div className="upload-privacy"><ShieldCheck size={14}/> Private to your account</div></div><div className="how-it-works"><span className="eyebrow">A little help along the way</span><h3>From upload to insight</h3><ol><li><b>Bring your evidence</b><p>Add work you’re proud of.</p></li><li><b>Discover the details</b><p>AI summarizes your work and skills.</p></li><li><b>Make it yours</b><p>Review and confirm to grow your profile.</p></li></ol><small>File content is sent to your configured AI provider for analysis.</small></div><Link className="profile-shortcut" to="/profile"><span>See your story taking shape<b>My career profile</b></span><ArrowUpRight size={20}/></Link></aside></div>
    {folderDialog&&<div className="modal-backdrop"><section className="modal folder-dialog" role="dialog" aria-modal="true" aria-labelledby="folder-heading"><div className="card-head"><div className="folder-dialog-icon"><FolderPlus size={26}/></div><button className="icon" aria-label="Close folder dialog" onClick={()=>setFolderDialog(false)}><X size={20}/></button></div><h2 id="folder-heading">A place for your milestones</h2><p>Create a folder inside {current?.name||'My drive'} to keep related documents together.</p><form onSubmit={e=>{e.preventDefault();void task('Creating folder…',async()=>{await api('/folders',{method:'POST',body:JSON.stringify({name:folderName.trim(),parent_id:folder})});await load();setFolderDialog(false);setFolderName('')})}}><label>Folder name<input autoFocus required maxLength={160} placeholder="e.g. Projects, Certifications, Internships" value={folderName} onChange={e=>setFolderName(e.target.value)}/></label>{error&&<Notice kind="error">{error}</Notice>}<div className="button-row"><button type="button" className="secondary" onClick={()=>setFolderDialog(false)}>Cancel</button><button className="primary" disabled={!!busy||!folderName.trim()}>Create folder</button></div></form></section></div>}
    {selected&&<div className="modal-backdrop"><section className="modal drive-detail" role="dialog" aria-modal="true" aria-label="Document details"><div className="card-head"><div><p className="eyebrow">Document details</p><h2>{selected.display_name}</h2></div><button className="icon" aria-label="Close" disabled={!!busy} onClick={()=>setSelected(null)}><X/></button></div>
      {error&&<Notice kind="error">{error}</Notice>}{busy&&<Notice>{busy}</Notice>}{selected.extraction_error&&<Notice kind="error">{selected.extraction_error}</Notice>}
      <div className="button-row"><button className="secondary" disabled={!!busy} onClick={()=>void task('Opening original…',async()=>{const r=await api<{url:string}>(`/documents/${selected.id}/download`);window.open(r.url,'_blank','noopener')})}><Download/>Original file</button><button className="secondary" disabled={!!busy} onClick={()=>void task('Analyzing…',()=>analyze(selected))}>Reanalyze</button></div>
      <label>File name<input value={selected.display_name} onChange={e=>setSelected({...selected,display_name:e.target.value})}/></label><label>Folder<select value={selected.folder_id||''} onChange={e=>setSelected({...selected,folder_id:e.target.value||null})}><option value="">My drive</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><button className="secondary" disabled={!!busy} onClick={()=>void task('Saving file details…',async()=>{await api(`/documents/${selected.id}`,{method:'PATCH',body:JSON.stringify({display_name:selected.display_name,folder_id:selected.folder_id})});await load();setMessage('File details saved.')})}>Save file details</button>
      {draft?<><hr/><p className="eyebrow">{selected.is_confirmed?'Confirmed details':'AI draft — review before confirming'}</p><form onSubmit={e=>{e.preventDefault();void review('accept')}}>
        <label>Title<input required maxLength={240} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
        <label>Document type<select value={draft.document_type} onChange={e=>setDraft({...draft,document_type:e.target.value})}>{['project','internship','certification','workshop','achievement','education','other'].map(t=><option key={t}>{t}</option>)}</select></label>
        <label>Document summary<textarea required rows={5} value={draft.summary} onChange={e=>setDraft({...draft,summary:e.target.value})}/></label>
        <label>Organization<input value={draft.organization||''} onChange={e=>setDraft({...draft,organization:e.target.value||null})}/></label>
        <div className="form-grid"><label>Start / issue date<input type="date" value={draft.start_date||''} onChange={e=>setDraft({...draft,start_date:e.target.value||null})}/></label><label>End date<input type="date" value={draft.end_date||''} onChange={e=>setDraft({...draft,end_date:e.target.value||null})}/></label></div>
        <label>Demonstrated skills (comma separated)<input value={draft.skills.join(', ')} onChange={e=>setDraft({...draft,skills:e.target.value.split(',').map(s=>s.trim())})}/></label>
        <label>Accomplishments (one per line)<textarea value={draft.accomplishments.join('\n')} onChange={e=>setDraft({...draft,accomplishments:e.target.value.split('\n')})}/></label>
        {!!draft.mentioned_skills.length&&<Notice>Topics mentioned, not counted as skills: {draft.mentioned_skills.join(', ')}</Notice>}
        {!!draft.uncertainties.length&&<Notice>Check these details: {draft.uncertainties.join(' · ')}</Notice>}
        <div className="button-row">{!selected.is_confirmed&&<button type="button" className="secondary" disabled={!!busy} onClick={()=>void review('reject')}>Reject draft</button>}<button className="primary" disabled={!!busy}>Confirm & update profile</button></div>
      </form></>:<Empty title="Summary not available yet" description="Analyze this document to extract a summary and career details."/>}
      <button className="secondary danger wide" disabled={!!busy} onClick={()=>{if(confirm('Delete this file and its extracted career evidence? Your profile summary will be rebuilt.'))void task('Deleting…',async()=>{await api(`/documents/${selected.id}`,{method:'DELETE'});setSelected(null);await load()})}}>Delete document and its evidence</button>
    </section></div>}
  </div>
}
