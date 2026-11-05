import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import type { Session } from '../shared/types'
import { friendlyError } from '../shared/format'
import { Button, Input, Notice } from '../../components'

export function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<'PARENT' | 'TEACHER'>('PARENT')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = mode === 'login'
        ? await api.login(email, password)
        : await api.register({ name, email, password, role })
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
      <div className="login-form-wrap"><div className="eyebrow">{mode === 'login' ? 'PORTAL SEKOLAH' : 'MULAI BERSAMA SCHOOLPASS'}</div><h2>{mode === 'login' ? 'Masuk ke akun Anda' : 'Daftar akun baru'}</h2><p className="muted">{mode === 'login' ? 'Gunakan akun orang tua atau guru yang sudah terdaftar.' : 'Pilih peran Anda untuk membuat akun orang tua atau guru.'}</p>
        {error && <Notice>{error}</Notice>}
        <form onSubmit={submit} className="form-stack" aria-busy={busy}>
          {mode === 'register' && <>
            <label className="form-label" htmlFor="name">Nama lengkap</label><Input id="name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={100} placeholder="Nama Anda" />
            <label className="form-label label-spaced" htmlFor="role">Daftar sebagai</label><select id="role" className="field" value={role} onChange={event => setRole(event.target.value as 'PARENT' | 'TEACHER')}><option value="PARENT">Orang tua</option><option value="TEACHER">Guru</option></select>
          </>}
          <label className="form-label" htmlFor="email">Email</label><Input id="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} placeholder="nama@sekolah.id" />
          <label className="form-label label-spaced" htmlFor="password">Kata sandi</label><Input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} required minLength={8} maxLength={256} placeholder="Minimal 8 karakter" />
          <Button type="submit" disabled={busy} className="submit-button">{busy ? 'Memproses…' : mode === 'login' ? 'Masuk' : 'Daftar'} <span aria-hidden="true">→</span></Button>
        </form>
        <div className="auth-switch"><span>{mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}</span><button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Daftar sekarang' : 'Masuk ke akun'}</button></div>
        <div className="login-help"><span className="help-icon" aria-hidden="true">i</span>Akun demo memakai data fiktif dari seed lokal.</div>
      </div>
      <footer className="login-footer">SchoolPass <span>•</span> Portal izin siswa</footer>
    </section>
  </main>
}

