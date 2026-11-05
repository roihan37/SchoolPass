import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Button, Input, Notice } from '../../components'
import { api, type Role, type SchoolClass, type Student } from '../../lib/api'
import { friendlyError } from '../shared/format'

export function ClassroomPanel({ role, token, userName, onChanged }: { role: Role; token: string; userName: string; onChanged: () => void }) {
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [name, setName] = useState('')
  const [studentName, setStudentName] = useState('')
  const [classCode, setClassCode] = useState('')
  const [newCode, setNewCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const loadClasses = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextClasses, nextStudents] = await Promise.all([
        api.classes(token),
        role === 'TEACHER' ? api.assignedStudents(token) : api.students(token),
      ])
      setClasses(nextClasses)
      setStudents(nextStudents)
    }
    catch (reason) { setError(friendlyError(reason)) }
    finally { setLoading(false) }
  }, [role, token])

  useEffect(() => { void Promise.resolve().then(loadClasses) }, [loadClasses])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    setNewCode('')
    try {
      if (role === 'TEACHER') {
        const created = await api.createClass(token, name)
        setName('')
        setNewCode(created.classCode)
        setSuccess(`Kelas ${created.name} berhasil dibuat. Bagikan kode ini kepada orang tua.`)
      } else {
        const enrolledName = studentName.trim()
        await api.enrollStudent(token, classCode.trim(), enrolledName)
        setClassCode('')
        setStudentName('')
        setSuccess(`${enrolledName} berhasil ditambahkan ke kelas.`)
        onChanged()
      }
      await loadClasses()
    } catch (reason) { setError(friendlyError(reason)) }
    finally { setBusy(false) }
  }

  return <section id="kelas" className="classroom-card" aria-labelledby="classroom-title">
    <div className="classroom-heading"><div><span className="eyebrow">KELAS</span><h3 id="classroom-title">{role === 'TEACHER' ? 'Kelas yang Anda ajar' : 'Kelas anak Anda'}</h3><p>{role === 'TEACHER' ? 'Buat beberapa kelas dan bagikan kode gabung kepada orang tua.' : 'Gabung ke beberapa kelas dengan kode dari guru.'}</p></div></div>
    {error && <Notice>{error} <button type="button" className="notice-action" disabled={loading || busy} onClick={() => { void loadClasses() }}>Coba lagi</button></Notice>}
    {success && <Notice tone="success">{success}</Notice>}
    {newCode && <div className="class-code" role="status"><span>Kode gabung kelas</span><strong>{newCode}</strong><button type="button" onClick={() => { void navigator.clipboard?.writeText(newCode) }}>Salin kode</button></div>}
    <form className="classroom-form" onSubmit={submit}>
      {role === 'TEACHER' ? <><label className="form-control"><span>Nama kelas baru</span><Input value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={80} placeholder="Contoh: Kelas 2A" /></label><Button type="submit" disabled={busy}>{busy ? 'Membuat…' : 'Buat kelas'}</Button></> : <><label className="form-control"><span>Kode kelas</span><Input value={classCode} onChange={event => setClassCode(event.target.value)} required minLength={10} maxLength={128} placeholder="Masukkan kode dari guru" /></label><label className="form-control"><span>Nama anak</span><Input value={studentName} onChange={event => setStudentName(event.target.value)} required minLength={2} maxLength={100} placeholder="Nama lengkap siswa" /></label><Button type="submit" disabled={busy}>{busy ? 'Menggabungkan…' : 'Gabung kelas'}</Button></>}
    </form>
    <div className="classroom-list" aria-live="polite">
      <div className="classroom-item-heading"><h4>{role === 'TEACHER' ? 'Daftar kelas' : 'Kelas yang diikuti'}{!loading && !error && ` (${classes.length})`}</h4><Button variant="quiet" disabled={loading || busy} onClick={() => { void loadClasses() }}>Perbarui</Button></div>
      {loading ? <p className="classroom-state" role="status">Memuat kelas dan daftar siswa…</p> : error ? <p className="classroom-state">Data kelas belum dapat diperbarui. Silakan coba lagi.</p> : classes.length === 0 ? <p className="classroom-state">{role === 'TEACHER' ? 'Anda belum membuat kelas.' : 'Belum bergabung ke kelas. Minta kode kelas kepada guru anak Anda.'}</p> : <ul className="classroom-items">{classes.map(item => {
        const classStudents = students.filter(student => student.classId === item.id)
        return <li className="classroom-item" key={item.id}>
          <div className="classroom-item-heading"><span><strong>{item.name}</strong>{item.teacher && <small>Guru: {item.teacher.name}</small>}</span><span className="classroom-count">{classStudents.length} {role === 'PARENT' ? 'anak Anda' : 'siswa'}</span></div>
          <details className="classroom-roster" open>
            <summary>Lihat data siswa dan orang tua</summary>
            {classStudents.length === 0 ? <p className="classroom-state">Belum ada siswa di kelas ini.</p> : <ul className="roster-list">{classStudents.map(student => <li className="roster-item" key={student.id}><span className="roster-student"><span className="student-avatar" aria-hidden="true">{student.name.slice(0, 1).toUpperCase()}</span><span><strong>{student.name}</strong><small>Siswa</small></span></span><span className="roster-parent"><strong>{role === 'TEACHER' ? student.parent?.name ?? 'Data orang tua belum tersedia' : userName}</strong>{role === 'TEACHER' && student.parent?.email && <a href={`mailto:${student.parent.email}`}>{student.parent.email}</a>}<small>Orang tua</small></span></li>)}</ul>}
          </details>
        </li>
      })}</ul>}
    </div>
  </section>
}
