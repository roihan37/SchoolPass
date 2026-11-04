import { useState, type FormEvent } from 'react'
import { api, type LeaveRequest, type LeaveType, type Student } from '../../lib/api'
import { friendlyError } from '../shared/format'
import { Button, Input, Select } from '../../components'

export function CreateRequest({ students, token, onCreated }: { students: Student[]; token: string; onCreated: (request: LeaveRequest) => void }) {
  const [studentId, setStudentId] = useState('')
  const [absenceDate, setAbsenceDate] = useState('')
  const [type, setType] = useState<LeaveType>('SICK')
  const [reason, setReason] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedStudentId = studentId || students[0]?.id || ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (file && file.size > 5 * 1024 * 1024) {
      setError('Ukuran lampiran maksimal 5 MB.')
      return
    }
    setBusy(true)
    try {
      const created = await api.createLeave(token, { studentId: selectedStudentId, absenceDate, type, reason: reason.trim() })
      if (file) {
        try {
          await api.uploadAttachment(token, created.id, file)
          setMessage('Pengajuan dan lampiran berhasil dikirim.')
        } catch (uploadError) {
          setMessage(`Pengajuan tersimpan, tetapi lampiran gagal diunggah: ${friendlyError(uploadError)} Pilih pengajuan ini untuk mencoba lagi.`)
        }
      } else {
        setMessage('Pengajuan terkirim dan berstatus menunggu.')
      }
      onCreated(created)
      setReason('')
      setAbsenceDate('')
      setFile(null)
      const fileInput = document.getElementById('attachment') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
    } catch (reason) {
      setError(friendlyError(reason))
    } finally {
      setBusy(false)
    }
  }

  return <section className="create-card" aria-labelledby="create-title">
    <div className="create-intro"><span className="create-icon" aria-hidden="true">＋</span><div><h3 id="create-title">Ajukan izin baru</h3><p>Isi informasi izin untuk anak Anda.</p></div></div>
    {students.length === 0 ? <div className="inline-empty">Belum ada data anak pada akun ini. Hubungi administrasi sekolah.</div> : <form className="request-form" onSubmit={submit} aria-busy={busy}>
      <div className="form-control"><label htmlFor="student">Nama anak</label><Select id="student" value={selectedStudentId} onChange={event => setStudentId(event.target.value)} required>{students.map(student => <option key={student.id} value={student.id}>{student.name} · {student.schoolClass.name}</option>)}</Select></div>
      <div className="form-control"><label htmlFor="absence-date">Tanggal izin</label><Input id="absence-date" type="date" value={absenceDate} onChange={event => setAbsenceDate(event.target.value)} required /></div>
      <div className="form-control"><label htmlFor="leave-type">Jenis izin</label><Select id="leave-type" value={type} onChange={event => setType(event.target.value as LeaveType)}><option value="SICK">Sakit</option><option value="PERMISSION">Keperluan</option></Select></div>
      <div className="form-control form-control-wide"><label htmlFor="reason">Keterangan</label><Input id="reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="Contoh: demam dan perlu istirahat di rumah" maxLength={2000} required /></div>
      <div className="form-control form-control-wide"><label htmlFor="attachment">Lampiran <span className="optional-label">(opsional, PDF/JPG/PNG, maks. 5 MB)</span></label><Input id="attachment" className="file-field" type="file" accept="application/pdf,image/jpeg,image/png" onChange={event => { setError(''); setFile(event.target.files?.[0] ?? null) }} /></div>
      <div className="form-submit"><span>{reason.length}/2000 karakter</span><Button type="submit" disabled={busy || students.length === 0}>{busy ? 'Mengirim…' : 'Kirim pengajuan'} <span aria-hidden="true">→</span></Button></div>
      {error && <div className="form-message form-message-error" role="alert">{error}</div>}{message && <div className={`form-message ${message.startsWith('Pengajuan tersimpan') ? 'form-message-error' : 'form-message-success'}`} role="status">{message}</div>}
    </form>}
  </section>
}

