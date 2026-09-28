import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'

type AuthState = { session: Session|null; loading:boolean; configured:boolean }
const AuthContext = createContext<AuthState>({session:null, loading:true, configured:supabaseConfigured})

export function AuthProvider({children}:{children:ReactNode}) {
  const [session,setSession]=useState<Session|null>(null); const [loading,setLoading]=useState(true)
  useEffect(()=>{ supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next)); return ()=>data.subscription.unsubscribe() },[])
  return <AuthContext.Provider value={{session,loading,configured:supabaseConfigured}}>{children}</AuthContext.Provider>
}
export const useAuth=()=>useContext(AuthContext)

