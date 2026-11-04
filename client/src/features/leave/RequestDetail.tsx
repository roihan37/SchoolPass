import { useEffect, useState } from 'react'
import { api, ApiError, type AttachmentMetadata, type LeaveRequest, type Role } from '../../lib/api'
import { friendlyError, formatDate } from '../shared/format'
import { Button, Notice, StatusBadge } from '../../components'

export function RequestDetail({ leave, studentName, role, token, onUpdated }: { leave: LeaveRequest; studentName?: string; role: Role; token: string; onUpdated: (request: LeaveRequest) => void }) {
  const [decisionReason, setDecisionReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attachment, setAttachment] = useState<AttachmentMetadata | null>(null)
  const [attachmentChecked, setAttachmentChecked] = useState(false)
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const [attachmentError, setAttachmentError] = useState('')
  const [attachmentMessage, setAttachmentMessage] = useState('')

  async function loadAttachment() {
    try {
      const result = await api.attachmentUrl(token, leave.id)
      const { url: _url, expiresIn: _expiresIn, ...metadata } = result
      setAttachment(metadata)
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 404) setAttachment(null)
      else setAttachmentError(friendlyError(reason))
    } finally {
      setAttachmentChecked(true)
    }
  }

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const result = await api.attachmentUrl(token, leave.id)
        const { url: _url, expiresIn: _expiresIn, ...metadata } = result
        if (active) setAttachment(metadata)
      } catch (reason) {
        if (!active) return
        if (reason instanceof ApiError && reason.status === 404) setAttachment(null)
        else setAttachmentError(friendlyError(reason))
      } finally {
        if (active) setAttachmentChecked(true)
      }
    })()
    return () => { active = false }
  }, [leave.id, token])

  async function uploadAttachment(file: File | undefined) {
    if (!file) return
    setAttachmentError('')
    setAttachmentMessage('')
    if (file.size > 5 * 1024 * 1024) {
      setAttachmentError('Ukuran lampiran maksimal 5 MB.')
      return
    }
    setAttachmentBusy(true)
    try {
      await api.uploadAttachment(token, leave.id, file)
      setAttachmentMessage('Lampiran berhasil diunggah.')
      await loadAttachment()
    } catch (reason) {
      setAttachmentError(friendlyError(reason))
    } finally {
      setAttachmentBusy(false)
    }
  }

  async function downloadAttachment() {
    setAttachmentError('')
    setAttachmentBusy(true)
    try {
      const download = await api.attachmentUrl(token, leave.id)
      window.location.assign(download.url)
    } catch (reason) {
      setAttachmentError(friendlyError(reason))
    } finally {
      setAttachmentBusy(false)
    }
  }

  function formatFileSize(size: number) {
    return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

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
    <section className="attachment-box" aria-labelledby="attachment-title">
      <div className="attachment-heading"><div><h4 id="attachment-title">Lampiran</h4><p>Dokumen pendukung pengajuan</p></div>{attachmentChecked && attachment && <span className="attachment-ready">Tersedia</span>}</div>
      {!attachmentChecked ? <p className="attachment-note">Memeriksa lampiran…</p> : attachment ? <div className="attachment-file"><span className="attachment-file-icon" aria-hidden="true">▤</span><div className="attachment-file-info"><strong title={attachment.fileName}>{attachment.fileName}</strong><span>{attachment.mimeType} · {formatFileSize(attachment.fileSize)}</span></div><Button variant="secondary" disabled={attachmentBusy} onClick={() => void downloadAttachment()}>{attachmentBusy ? '…' : 'Unduh'}</Button></div> : attachmentError ? <p className="attachment-note">Lampiran belum dapat diperiksa. <button className="notice-action" type="button" onClick={() => { setAttachmentError(''); void loadAttachment() }}>Coba lagi</button></p> : role === 'PARENT' && leave.status === 'PENDING' ? <div className="form-control"><label htmlFor="detail-attachment">Belum ada lampiran <span className="optional-label">(PDF/JPG/PNG, maks. 5 MB)</span></label><input id="detail-attachment" className="field file-field" type="file" accept="application/pdf,image/jpeg,image/png" disabled={attachmentBusy} onChange={event => { void uploadAttachment(event.target.files?.[0]); event.target.value = '' }} /></div> : <p className="attachment-note">Tidak ada lampiran pada pengajuan ini.</p>}
      {attachmentError && <Notice>{attachmentError}</Notice>}{attachmentMessage && <Notice tone="success">{attachmentMessage}</Notice>}
    </section>
    {role === 'TEACHER' && leave.status === 'PENDING' && <div className="decision-box"><label htmlFor="decision-reason">Catatan keputusan <span>(wajib jika menolak)</span></label><textarea id="decision-reason" className="field textarea" value={decisionReason} onChange={event => setDecisionReason(event.target.value)} maxLength={2000} placeholder="Tulis catatan untuk orang tua" />{error && <Notice>{error}</Notice>}<div className="decision-actions"><Button variant="secondary" disabled={busy} onClick={() => void decide('APPROVED')}>Setujui</Button><Button variant="danger" disabled={busy} onClick={() => void decide('REJECTED')}>Tolak</Button></div></div>}
    {role === 'TEACHER' && leave.status !== 'PENDING' && <div className="decision-closed"><span aria-hidden="true">✓</span>Keputusan telah dikirim. Status ini bersifat final.</div>}
  </aside>
}

