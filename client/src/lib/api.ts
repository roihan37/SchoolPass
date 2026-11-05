export type Role = 'PARENT' | 'TEACHER'
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type LeaveType = 'SICK' | 'PERMISSION'

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

export interface Student {
  id: string
  name: string
  classId: string
  schoolClass: { id: string; name: string }
  parent?: { name: string; email: string }
}

export interface LeaveRequest {
  id: string
  studentId: string
  submittedById: string
  absenceDate: string
  type: LeaveType
  reason: string
  status: LeaveStatus
  reviewedById: string | null
  decisionReason: string | null
  reviewedAt: string | null
  createdAt: string
}

export interface AttachmentMetadata {
  id: string
  fileName: string
  mimeType: string
  fileSize: number
}

export interface AttachmentDownload extends AttachmentMetadata {
  url: string
  expiresIn: number
}

export interface Notification {
  id: string
  leaveRequestId: string
  type: string
  message: string
  studentName: string
  leaveType: LeaveType
  readAt: string | null
  createdAt: string
}

export interface DashboardSummary {
  totals: { total: number; pending: number; approved: number; rejected: number }
  classes: Array<{ classId: string; className: string; total: number; pending: number; approved: number; rejected: number }>
}

export interface SchoolClass { id: string; name: string; teacher?: { name: string }; _count?: { students: number } }
export interface CreatedClass { id: string; name: string; classCode: string }
export interface EnrolledStudent { id: string; name: string; classId: string }

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  let response: Response
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(`Tidak dapat terhubung ke API (${API_BASE}). Pastikan server berjalan.`, 0)
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const body = payload as { message?: string | string[] }
    const message = Array.isArray(body?.message)
      ? body.message.join('. ')
      : body?.message
    const fallback: Record<number, string> = {
      400: 'Data belum valid. Periksa kembali isian.',
      401: 'Sesi berakhir atau email dan password tidak sesuai. Silakan masuk lagi.',
      403: 'Akun ini tidak memiliki akses untuk tindakan tersebut.',
      404: 'Data tidak ditemukan atau Anda tidak memiliki akses.',
      409: 'Permintaan sudah ada atau sudah diputuskan.',
    }
    throw new ApiError(message ?? fallback[response.status] ?? `Permintaan gagal (${response.status}).`, response.status)
  }
  return payload as T
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: User }>('/auth/login', undefined, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (body: { name: string; email: string; password: string; role: Role }) =>
    request<{ accessToken: string; user: User }>('/auth/register', undefined, { method: 'POST', body: JSON.stringify(body) }),
  classes: (token: string) => request<SchoolClass[]>('/classes/mine', token),
  createClass: (token: string, name: string) => request<CreatedClass>('/classes', token, { method: 'POST', body: JSON.stringify({ name }) }),
  enrollStudent: (token: string, classCode: string, studentName: string) => request<EnrolledStudent>('/classes/enroll', token, { method: 'POST', body: JSON.stringify({ classCode, studentName }) }),
  me: (token: string) => request<User>('/auth/me', token),
  students: (token: string) => request<Student[]>('/students/mine', token),
  assignedStudents: (token: string) => request<Student[]>('/students/assigned', token),
  dashboardSummary: (token: string) => request<DashboardSummary>('/dashboard/summary', token),
  notifications: (token: string) => request<Notification[]>('/notifications', token),
  leaves: (token: string) => request<LeaveRequest[]>('/leave-requests', token),
  createLeave: (token: string, body: { studentId: string; absenceDate: string; type: LeaveType; reason: string }) =>
    request<LeaveRequest>('/leave-requests', token, { method: 'POST', body: JSON.stringify(body) }),
  decide: (token: string, id: string, status: Exclude<LeaveStatus, 'PENDING'>, decisionReason: string) =>
    request<LeaveRequest>(`/leave-requests/${id}/decision`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...(decisionReason ? { decisionReason } : {}) }),
    }),
  uploadAttachment: (token: string, id: string, file: File) => {
    const body = new FormData()
    body.append('file', file)
    return request<AttachmentMetadata>(`/leave-requests/${id}/attachment`, token, { method: 'POST', body })
  },
  attachmentUrl: (token: string, id: string) =>
    request<AttachmentDownload>(`/leave-requests/${id}/attachment-url`, token),
}
