import { useCallback, useEffect, useState } from 'react'
import { api } from './lib/api'
import { Login } from './features/auth/Login'
import { Dashboard } from './features/dashboard/Dashboard'
import type { Session } from './features/shared/types'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [restoring, setRestoring] = useState(() => Boolean(sessionStorage.getItem('schoolpass.accessToken')))
  useEffect(() => {
    const token = sessionStorage.getItem('schoolpass.accessToken')
    if (!token) return
    void api.me(token).then(user => setSession({ token, user })).catch(() => {
      sessionStorage.removeItem('schoolpass.accessToken')
    }).finally(() => setRestoring(false))
  }, [])
  const login = useCallback((next: Session) => {
    sessionStorage.setItem('schoolpass.accessToken', next.token)
    setSession(next)
  }, [])
  const logout = useCallback(() => {
    sessionStorage.removeItem('schoolpass.accessToken')
    setSession(null)
  }, [])
  if (restoring) return <main className="session-loading" aria-live="polite">Memeriksa sesi…</main>
  return session ? <Dashboard session={session} onLogout={logout} /> : <Login onLogin={login} />
}
