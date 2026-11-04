import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import type { Session } from '../shared/types'
import { friendlyError } from '../shared/format'
import { Button, Input, Notice } from '../../components'

export function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api.login(email, password)
      setPassword('')
      onLogin({ token: result.accessToken, user: result.user })
    } catch (reason) {
      setError(friendlyError(reason))
    } finally {
      setBusy(false)
    }
  }

  return <main className="login-layout">
    <section className="login-story" aria-label="Tentang SchoolPass">
      <div className="brand brand-light"><span className="brand-icon">S</span><span>schoolpass</span></div>
      <div className="story-copy"><span className="story-kicker">KOMUNIKASI SEKOLAH, LEBIH MUDAH</span><h1>Hari sekolah berjalan lebih tenang.</h1><p>Kelola izin siswa dengan alur yang jelas untuk keluarga dan guru.</p></div>
      <div className="story-bottom"><span className="story-dot" /> Satu tempat untuk setiap kabar penting</div>
      <div className="story-decoration" aria-hidden="true">✳</div>
    </section>
    <section className="login-panel">
      <div className="login-form-wrap"><div className="eyebrow">SELAMAT DATANG</div><h2>Masuk ke akun Anda</h2><p className="muted">Gunakan akun orang tua atau guru yang terdaftar.</p>
        {error && <Notice>{error}</Notice>}
        <form onSubmit={submit} className="form-stack" aria-busy={busy}>
          <label className="form-label" htmlFor="email">Email</label><Input id="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} placeholder="nama@sekolah.id" />
          <label className="form-label label-spaced" htmlFor="password">Kata sandi</label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} maxLength={256} placeholder="Masukkan kata sandi" />
          <Button type="submit" disabled={busy} className="submit-button">{busy ? 'Memeriksa…' : 'Masuk'} <span aria-hidden="true">→</span></Button>
        </form>
        <div className="login-help"><span className="help-icon" aria-hidden="true">i</span>Akun demo memakai data fiktif dari seed lokal.</div>
      </div>
      <footer className="login-footer">SchoolPass <span>•</span> Portal izin siswa</footer>
    </section>
  </main>
}

