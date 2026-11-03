import { useCallback, useState } from 'react'
import { Login } from './features/auth/Login'
import { Dashboard } from './features/dashboard/Dashboard'
import type { Session } from './features/shared/types'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const logout = useCallback(() => setSession(null), [])
  return session ? <Dashboard session={session} onLogout={logout} /> : <Login onLogin={setSession} />
}
