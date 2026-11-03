import { useState } from 'react'
import { api, type LeaveRequest, type Role } from '../../lib/api'
import { friendlyError, formatDate } from '../shared/format'
import { Button, Notice, StatusBadge } from '../../components'

export function RequestDetail({ leave, studentName, role, token, onUpdated }: { leave: LeaveRequest; studentName?: string; role: Role; token: string; onUpdated: (request: LeaveRequest) => void }) {
  const [decisionReason, setDecisionReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function decide(status: 'APPROVED' | 'REJECTED') {
    setError('')
    if (status === 'REJECTED' && !decisionReason.trim()) {
      setError('Alasan penolakan wajib diisi.')
      return
    }
    setBusy(true)
    try {
      onUpdated(await api.decide(token, leave.id, status, decisionReason.trim()))
    } catch (reason) {
      setError(friendlyError(reason))
    } finally {
      setBusy(false)
    }
  }

  return <aside className="detail-panel" aria-label="Detail permintaan">
    <div className="detail-top"><div><div className="eyebrow">RINCIAN IZIN</div><h3>Detail permintaan</h3></div><StatusBadge status={leave.status} /></div>
    <div className="detail-divider" />
    <div className="detail-student"><div className="detail-avatar">{(studentName ?? 'S').slice(0, 1)}</div><div><strong>{studentName ?? `Siswa #${leave.studentId.slice(0, 8)}`}</strong><span>{role === 'PARENT' ? 'Permintaan anak' : 'Permintaan orang tua'}</span></div></div>
    <dl className="detail-list"><div><dt>Tanggal izin</dt><dd>{formatDate(leave.absenceDate)}</dd></div><div><dt>Jenis izin</dt><dd>{leave.type === 'SICK' ? 'Sakit' : 'Keperluan'}</dd></div><div><dt>Diajukan</dt><dd>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(leave.createdAt))}</dd></div><div className="detail-reason"><dt>Keterangan</dt><dd>{leave.reason}</dd></div>{leave.decisionReason && <div className="detail-reason"><dt>Catatan keputusan</dt><dd>{leave.decisionReason}</dd></div>}</dl>
    {role === 'TEACHER' && leave.status === 'PENDING' && <div className="decision-box"><label htmlFor="decision-reason">Catatan keputusan <span>(wajib jika menolak)</span></label><textarea id="decision-reason" className="field textarea" value={decisionReason} onChange={event => setDecisionReason(event.target.value)} maxLength={2000} placeholder="Tulis catatan untuk orang tua" />{error && <Notice>{error}</Notice>}<div className="decision-actions"><Button variant="secondary" disabled={busy} onClick={() => void decide('APPROVED')}>Setujui</Button><Button variant="danger" disabled={busy} onClick={() => void decide('REJECTED')}>Tolak</Button></div></div>}
    {role === 'TEACHER' && leave.status !== 'PENDING' && <div className="decision-closed"><span aria-hidden="true">✓</span>Keputusan telah dikirim. Status ini bersifat final.</div>}
  </aside>
}

