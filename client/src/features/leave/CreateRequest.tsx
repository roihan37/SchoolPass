import { useState, type FormEvent } from 'react'
import { api, type LeaveRequest, type LeaveType, type Student } from '../../lib/api'
import { friendlyError } from '../shared/format'
import { Button, Input, Select } from '../../components'

export function CreateRequest({ students, token, onCreated }: { students: Student[]; token: string; onCreated: (request: LeaveRequest) => void }) {
  const [studentId, setStudentId] = useState('')
  const [absenceDate, setAbsenceDate] = useState('')
  const [type, setType] = useState<LeaveType>('SICK')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  const selectedStudentId = studentId || students[0]?.id || ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess(false)
    setBusy(true)
    try {
      const created = await api.createLeave(token, { studentId: selectedStudentId, absenceDate, type, reason: reason.trim() })
      onCreated(created)
      setReason('')
      setAbsenceDate('')
      setSuccess(true)
    } catch (reason) {
      setError(friendlyError(reason))
    } finally {
      setBusy(false)
    }
  }

  return <section className="create-card" aria-labelledby="create-title">
    <div className="create-intro"><span className="create-icon" aria-hidden="true">＋</span><div><h3 id="create-title">Ajukan izin baru</h3><p>Isi informasi izin untuk anak Anda.</p></div></div>
    {students.length === 0 ? <div className="inline-empty">Belum ada data anak pada akun ini. Hubungi administrasi sekolah.</div> : <form className="request-form" onSubmit={submit}>
      <div className="form-control"><label htmlFor="student">Nama anak</label><Select id="student" value={selectedStudentId} onChange={event => setStudentId(event.target.value)} required>{students.map(student => <option key={student.id} value={student.id}>{student.name} · {student.schoolClass.name}</option>)}</Select></div>
      <div className="form-control"><label htmlFor="absence-date">Tanggal izin</label><Input id="absence-date" type="date" value={absenceDate} onChange={event => setAbsenceDate(event.target.value)} required /></div>
      <div className="form-control"><label htmlFor="leave-type">Jenis izin</label><Select id="leave-type" value={type} onChange={event => setType(event.target.value as LeaveType)}><option value="SICK">Sakit</option><option value="PERMISSION">Keperluan</option></Select></div>
      <div className="form-control form-control-wide"><label htmlFor="reason">Keterangan</label><Input id="reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="Contoh: demam dan perlu istirahat di rumah" maxLength={2000} required /></div>
      <div className="form-submit"><span>{reason.length}/2000 karakter</span><Button type="submit" disabled={busy || students.length === 0}>{busy ? 'Mengirim…' : 'Kirim pengajuan'} <span aria-hidden="true">→</span></Button></div>
      {error && <div className="form-message form-message-error" role="alert">{error}</div>}{success && <div className="form-message form-message-success" role="status">Pengajuan terkirim dan berstatus menunggu.</div>}
    </form>}
  </section>
}

