import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError, type DashboardSummary, type LeaveRequest, type Notification, type Role, type Student } from '../../lib/api'
import type { Session } from '../shared/types'
import { formatDate, friendlyError } from '../shared/format'
import { Button, DataTable, Notice, SectionHeading, StatusBadge } from '../../components'
import { CreateRequest } from '../leave/CreateRequest'
import { RequestDetail } from '../leave/RequestDetail'
import { ClassroomPanel } from '../classroom/ClassroomPanel'

export function Dashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [students, setStudents] = useState<Student[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(session.user.role === 'PARENT')
  const [notificationsError, setNotificationsError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeNav, setActiveNav] = useState<'requests' | 'classes'>(() => window.location.hash === '#kelas' ? 'classes' : 'requests')
  const [refresh, setRefresh] = useState(0)
  const selected = useMemo(() => leaves.find(leave => leave.id === selectedId) ?? null, [leaves, selectedId])

  useEffect(() => {
    const syncNavigation = () => setActiveNav(window.location.hash === '#kelas' ? 'classes' : 'requests')
    window.addEventListener('hashchange', syncNavigation)
    return () => window.removeEventListener('hashchange', syncNavigation)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextLeaves, nextStudents] = await Promise.all([
        api.leaves(session.token),
        session.user.role === 'PARENT' ? api.students(session.token) : api.assignedStudents(session.token),
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

  useEffect(() => {
    if (session.user.role === 'TEACHER') {
      void api.dashboardSummary(session.token).then(setSummary).catch(reason => {
        setSummary(null)
        if (reason instanceof ApiError && reason.status === 401) onLogout()
      })
    } else {
      void api.notifications(session.token).then(setNotifications).catch(reason => {
        setNotificationsError(friendlyError(reason))
        if (reason instanceof ApiError && reason.status === 401) onLogout()
      }).finally(() => setNotificationsLoading(false))
    }
  }, [session.token, session.user.role, refresh, onLogout])

  const role: Role = session.user.role
  const pendingCount = role === 'TEACHER' && summary ? summary.totals.pending : leaves.filter(leave => leave.status === 'PENDING').length
  const totalCount = role === 'TEACHER' && summary ? summary.totals.total : leaves.length
  const approvedCount = role === 'TEACHER' && summary ? summary.totals.approved : leaves.filter(leave => leave.status === 'APPROVED').length
  const studentNames = useMemo(() => new Map(students.map(student => [student.id, student.name])), [students])
  const title = activeNav === 'classes' ? 'Kelas & siswa' : role === 'PARENT' ? 'Ringkasan izin keluarga' : 'Permintaan izin siswa'
  const refreshDashboard = () => {
    setNotificationsLoading(role === 'PARENT')
    setNotificationsError('')
    setRefresh(value => value + 1)
  }
  const headingDetail = activeNav === 'classes'
    ? role === 'TEACHER' ? 'Kelola kelas, lihat daftar siswa, dan hubungi orang tua.' : 'Lihat kelas anak Anda dan bergabung dengan kode dari guru.'
    : role === 'PARENT'
    ? 'Ajukan izin dan ikuti kabar terbaru dari sekolah.'
    : 'Tinjau permintaan yang masuk dari keluarga siswa.'

  return <main className="app-shell">
    <aside className="sidebar">
      <a href="#permintaan" onClick={() => setActiveNav('requests')} className="brand"><span className="brand-icon">S</span><span>schoolpass</span></a>
      <nav aria-label="Navigasi utama">
        <div className="sidebar-label">MENU UTAMA</div>
        <a href="#permintaan" className={`nav-item${activeNav === 'requests' ? ' nav-active' : ''}`} aria-current={activeNav === 'requests' ? 'page' : undefined} onClick={() => setActiveNav('requests')}><span className="nav-icon" aria-hidden="true">▦</span><span>{role === 'PARENT' ? 'Izin anak' : 'Permintaan'}</span><span className="nav-count" aria-label={`${pendingCount} menunggu`}>{pendingCount}</span></a>
        <a href="#kelas" className={`nav-item${activeNav === 'classes' ? ' nav-active' : ''}`} aria-current={activeNav === 'classes' ? 'page' : undefined} onClick={() => setActiveNav('classes')}><span className="nav-icon" aria-hidden="true">▤</span><span>Kelas & siswa</span></a>
      </nav>
      <div className="sidebar-bottom"><div className="help-card"><span className="help-icon" aria-hidden="true">?</span><div><strong>Butuh bantuan?</strong><span>Hubungi administrasi sekolah.</span></div></div>
        <div className="profile"><div className="avatar">{session.user.name.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><strong>{session.user.name}</strong><span>{role === 'PARENT' ? 'Orang tua' : 'Guru'}</span></div><button className="logout-button" type="button" onClick={onLogout} aria-label="Keluar">↗</button></div>
      </div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div className="breadcrumb">SchoolPass <span>/</span> {activeNav === 'classes' ? 'Kelas & siswa' : role === 'PARENT' ? 'Izin anak' : 'Permintaan'}</div><div className="topbar-right">{role === 'PARENT' && <details className="notification-menu"><summary aria-label={`Notifikasi, ${notifications.length} item`}><span aria-hidden="true">♧</span><span>Notifikasi</span>{notifications.length > 0 && <b>{notifications.length}</b>}</summary><div className="notification-panel"><strong>Notifikasi</strong>{notificationsLoading ? <p role="status">Memuat notifikasi…</p> : notificationsError ? <p role="alert">{notificationsError} <button className="notice-action" type="button" onClick={refreshDashboard}>Coba lagi</button></p> : notifications.length === 0 ? <p>Belum ada notifikasi.</p> : <ul>{notifications.map(item => <li key={item.id}><div className="notification-context"><strong>{item.studentName}</strong><span>{item.leaveType === 'SICK' ? 'Sakit' : 'Keperluan'}</span></div><span>{item.message}</span><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></li>)}</ul>}</div></details>}<span className="today-label">Portal sekolah</span><div className="avatar avatar-small" aria-hidden="true">{session.user.name.slice(0, 1).toUpperCase()}</div></div></header>
      <div className="content">
        <SectionHeading eyebrow={role === 'PARENT' ? 'PORTAL ORANG TUA' : 'PORTAL GURU'} title={title} detail={headingDetail} action={activeNav === 'requests' && <Button variant="secondary" onClick={refreshDashboard} disabled={loading}><span aria-hidden="true">↻</span> Perbarui</Button>} />
        {activeNav === 'classes' ? <ClassroomPanel role={role} token={session.token} userName={session.user.name} onChanged={refreshDashboard} /> : <>
        <section className="summary-row" aria-label="Ringkasan permintaan">
          <div className="summary-card"><span className="summary-icon icon-total" aria-hidden="true">▤</span><div><span className="summary-caption">Total permintaan</span><strong>{loading ? '—' : totalCount}</strong></div><span className="summary-note">Semua waktu</span></div>
          <div className="summary-card"><span className="summary-icon icon-pending" aria-hidden="true">◷</span><div><span className="summary-caption">Menunggu keputusan</span><strong>{loading ? '—' : pendingCount}</strong></div><span className="summary-note">Perlu ditinjau</span></div>
          <div className="summary-card"><span className="summary-icon icon-approved" aria-hidden="true">✓</span><div><span className="summary-caption">Disetujui</span><strong>{loading ? '—' : approvedCount}</strong></div><span className="summary-note">Selesai</span></div>
        </section>
        {error && <Notice>{error} <button className="notice-action" type="button" onClick={() => setRefresh(value => value + 1)}>Coba lagi</button></Notice>}
        {role === 'PARENT' && students.length > 0 && <CreateRequest students={students} token={session.token} onCreated={created => { setLeaves(current => [created, ...current]); setSelectedId(created.id) }} />}
        <section id="permintaan" className="list-section">
          <div className="list-heading"><div><h3>{role === 'PARENT' ? 'Riwayat pengajuan' : 'Daftar permintaan'}</h3><p>{role === 'PARENT' ? 'Pantau status izin yang pernah diajukan.' : `${pendingCount} permintaan menunggu keputusan.`}</p></div><span className="record-count">{leaves.length} data</span></div>
          {loading ? <div className="state-panel" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" />Memuat permintaan…</div> : leaves.length === 0 ? <div className="state-panel empty-state"><span className="empty-icon" aria-hidden="true">▤</span><strong>Belum ada permintaan izin</strong><span>{role === 'PARENT' ? students.length > 0 ? 'Formulir pengajuan tersedia di atas.' : 'Gabung kelas dan tambahkan anak Anda terlebih dahulu.' : 'Permintaan baru akan muncul di sini.'}</span>{role === 'PARENT' && students.length === 0 && <a href="#kelas" className="button button-secondary" onClick={() => setActiveNav('classes')}>Gabung kelas</a>}</div> : <DataTable label={role === 'PARENT' ? 'Riwayat pengajuan izin' : 'Daftar permintaan izin'}>
            <thead><tr>{role === 'TEACHER' && <th>Siswa</th>}<th>Tanggal izin</th><th>Jenis</th><th>Alasan</th><th>Status</th><th><span className="sr-only">Detail</span></th></tr></thead>
            <tbody>{leaves.map(leave => <tr key={leave.id} className={selectedId === leave.id ? 'selected-row' : ''}>
              {role === 'TEACHER' && <td><span className="student-cell"><span className="student-avatar">{studentNames.get(leave.studentId)?.slice(0, 1) ?? 'S'}</span>{studentNames.get(leave.studentId) ?? 'Siswa tidak ditemukan'}</span></td>}
              <td><span className="date-cell">{formatDate(leave.absenceDate)}</span></td><td>{leave.type === 'SICK' ? 'Sakit' : 'Keperluan'}</td><td className="reason-cell">{leave.reason}</td><td><StatusBadge status={leave.status} /></td><td><button className="row-action" type="button" onClick={() => setSelectedId(leave.id)} aria-label={`Lihat detail izin ${formatDate(leave.absenceDate)}`}>→</button></td>
            </tr>)}</tbody>
          </DataTable>}
        </section>
        </>}
      </div>
    </section>
    {activeNav === 'requests' && selected && <RequestDetail key={selected.id} leave={selected} studentName={studentNames.get(selected.studentId)} role={role} token={session.token} onUpdated={updated => { setLeaves(current => current.map(item => item.id === updated.id ? updated : item)); setSelectedId(updated.id) }} />}
    <div className="mobile-logout"><Button variant="quiet" onClick={onLogout}>Keluar dari akun</Button></div>
  </main>
}

