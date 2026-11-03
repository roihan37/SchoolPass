import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError, type LeaveRequest, type Role, type Student } from '../../lib/api'
import type { Session } from '../shared/types'
import { formatDate, friendlyError } from '../shared/format'
import { Button, DataTable, Notice, SectionHeading, StatusBadge } from '../../components'
import { CreateRequest } from '../leave/CreateRequest'
import { RequestDetail } from '../leave/RequestDetail'

export function Dashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [students, setStudents] = useState<Student[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const selected = useMemo(() => leaves.find(leave => leave.id === selectedId) ?? null, [leaves, selectedId])

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextLeaves, nextStudents] = await Promise.all([
        api.leaves(session.token),
        session.user.role === 'PARENT' ? api.students(session.token) : Promise.resolve([]),
      ])
      setLeaves(nextLeaves)
      setStudents(nextStudents)
      setSelectedId(current => current && nextLeaves.some(leave => leave.id === current) ? current : nextLeaves[0]?.id ?? null)
    } catch (reason) {
      setError(friendlyError(reason))
      if (reason instanceof ApiError && reason.status === 401) onLogout()
    } finally {
      setLoading(false)
    }
  }, [session.token, session.user.role, onLogout])

  useEffect(() => { void Promise.resolve().then(reload) }, [reload, refresh])

  const role: Role = session.user.role
  const pendingCount = leaves.filter(leave => leave.status === 'PENDING').length
  const studentNames = useMemo(() => new Map(students.map(student => [student.id, student.name])), [students])
  const title = role === 'PARENT' ? 'Ringkasan izin keluarga' : 'Permintaan izin siswa'
  const headingDetail = role === 'PARENT'
    ? 'Ajukan izin dan ikuti kabar terbaru dari sekolah.'
    : 'Tinjau permintaan yang masuk dari keluarga siswa.'

  return <main className="app-shell">
    <aside className="sidebar">
      <a href="#beranda" className="brand"><span className="brand-icon">S</span><span>schoolpass</span></a>
      <div className="sidebar-label">MENU UTAMA</div>
      <div className="nav-item nav-active"><span className="nav-icon" aria-hidden="true">▦</span><span>{role === 'PARENT' ? 'Izin anak' : 'Permintaan'}</span><span className="nav-count">{pendingCount}</span></div>
      <div className="sidebar-bottom"><div className="help-card"><span className="help-icon" aria-hidden="true">?</span><div><strong>Butuh bantuan?</strong><span>Hubungi administrasi sekolah.</span></div></div>
        <div className="profile"><div className="avatar">{session.user.name.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><strong>{session.user.name}</strong><span>{role === 'PARENT' ? 'Orang tua' : 'Guru'}</span></div><button className="logout-button" type="button" onClick={onLogout} aria-label="Keluar">↗</button></div>
      </div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div className="breadcrumb">SchoolPass <span>/</span> {role === 'PARENT' ? 'Izin anak' : 'Permintaan'}</div><div className="topbar-right"><span className="today-label">Portal sekolah</span><div className="avatar avatar-small">{session.user.name.slice(0, 1).toUpperCase()}</div></div></header>
      <div className="content">
        <SectionHeading eyebrow={role === 'PARENT' ? 'PORTAL ORANG TUA' : 'PORTAL GURU'} title={title} detail={headingDetail} action={<Button variant="secondary" onClick={() => setRefresh(value => value + 1)} disabled={loading}><span aria-hidden="true">↻</span> Perbarui</Button>} />
        <section className="summary-row" aria-label="Ringkasan permintaan">
          <div className="summary-card"><span className="summary-icon icon-total" aria-hidden="true">▤</span><div><span className="summary-caption">Total permintaan</span><strong>{loading ? '—' : leaves.length}</strong></div><span className="summary-note">Semua waktu</span></div>
          <div className="summary-card"><span className="summary-icon icon-pending" aria-hidden="true">◷</span><div><span className="summary-caption">Menunggu keputusan</span><strong>{loading ? '—' : pendingCount}</strong></div><span className="summary-note">Perlu ditinjau</span></div>
          <div className="summary-card"><span className="summary-icon icon-approved" aria-hidden="true">✓</span><div><span className="summary-caption">Disetujui</span><strong>{loading ? '—' : leaves.filter(leave => leave.status === 'APPROVED').length}</strong></div><span className="summary-note">Selesai</span></div>
        </section>
        {error && <Notice>{error} <button className="notice-action" type="button" onClick={() => setRefresh(value => value + 1)}>Coba lagi</button></Notice>}
        {role === 'PARENT' && <CreateRequest students={students} token={session.token} onCreated={created => { setLeaves(current => [created, ...current]); setSelectedId(created.id) }} />}
        <section className="list-section">
          <div className="list-heading"><div><h3>{role === 'PARENT' ? 'Riwayat pengajuan' : 'Daftar permintaan'}</h3><p>{role === 'PARENT' ? 'Pantau status izin yang pernah diajukan.' : `${pendingCount} permintaan menunggu keputusan.`}</p></div><span className="record-count">{leaves.length} data</span></div>
          {loading ? <div className="state-panel"><span className="spinner" aria-hidden="true" />Memuat permintaan…</div> : leaves.length === 0 ? <div className="state-panel empty-state"><span className="empty-icon" aria-hidden="true">▤</span><strong>Belum ada permintaan izin</strong><span>{role === 'PARENT' ? 'Formulir pengajuan tersedia di atas.' : 'Permintaan baru akan muncul di sini.'}</span></div> : <DataTable label={role === 'PARENT' ? 'Riwayat pengajuan izin' : 'Daftar permintaan izin'}>
            <thead><tr>{role === 'TEACHER' && <th>Siswa</th>}<th>Tanggal izin</th><th>Jenis</th><th>Alasan</th><th>Status</th><th><span className="sr-only">Detail</span></th></tr></thead>
            <tbody>{leaves.map(leave => <tr key={leave.id} className={selectedId === leave.id ? 'selected-row' : ''}>
              {role === 'TEACHER' && <td><span className="student-cell"><span className="student-avatar">{studentNames.get(leave.studentId)?.slice(0, 1) ?? 'S'}</span>Siswa <small>#{leave.studentId.slice(0, 6)}</small></span></td>}
              <td><span className="date-cell">{formatDate(leave.absenceDate)}</span></td><td>{leave.type === 'SICK' ? 'Sakit' : 'Keperluan'}</td><td className="reason-cell">{leave.reason}</td><td><StatusBadge status={leave.status} /></td><td><button className="row-action" type="button" onClick={() => setSelectedId(leave.id)} aria-label={`Lihat detail izin ${formatDate(leave.absenceDate)}`}>→</button></td>
            </tr>)}</tbody>
          </DataTable>}
        </section>
      </div>
    </section>
    {selected && <RequestDetail key={selected.id} leave={selected} studentName={studentNames.get(selected.studentId)} role={role} token={session.token} onUpdated={updated => { setLeaves(current => current.map(item => item.id === updated.id ? updated : item)); setSelectedId(updated.id) }} />}
    <div className="mobile-logout"><Button variant="quiet" onClick={onLogout}>Keluar dari akun</Button></div>
  </main>
}

