import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Layout } from './components/Layout'
import { AuthPage } from './pages/Auth'
import { Dashboard } from './pages/Dashboard'
import { Repository } from './pages/Repository'
import { Documents } from './pages/Documents'
import { Jobs } from './pages/Jobs'
import { Forecast } from './pages/Forecast'
import { Planner } from './pages/Planner'
import { Resumes } from './pages/Resumes'
import { Settings } from './pages/Settings'
import { Spinner } from './components/UI'
import { CareerProfile } from './pages/CareerProfile'

function Protected(){const {session,loading}=useAuth();if(loading)return <div className="center"><Spinner/></div>;return session?<Layout/>:<Navigate to="/auth" replace/>}
export default function App(){return <Routes><Route path="/auth" element={<AuthPage/>}/><Route element={<Protected/>}><Route path="/profile" element={<CareerProfile/>}/><Route path="/dashboard" element={<Dashboard/>}/><Route path="/repository" element={<Repository/>}/><Route path="/documents" element={<Documents/>}/><Route path="/jobs" element={<Jobs/>}/><Route path="/forecast" element={<Forecast/>}/><Route path="/planner" element={<Planner/>}/><Route path="/resumes" element={<Resumes/>}/><Route path="/settings" element={<Settings/>}/></Route><Route path="*" element={<Navigate to="/documents" replace/>}/></Routes>}
