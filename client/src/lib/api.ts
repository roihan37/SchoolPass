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

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001/api/v1'

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
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
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
  students: (token: string) => request<Student[]>('/students/mine', token),
  leaves: (token: string) => request<LeaveRequest[]>('/leave-requests', token),
  createLeave: (token: string, body: { studentId: string; absenceDate: string; type: LeaveType; reason: string }) =>
    request<LeaveRequest>('/leave-requests', token, { method: 'POST', body: JSON.stringify(body) }),
  decide: (token: string, id: string, status: Exclude<LeaveStatus, 'PENDING'>, decisionReason: string) =>
    request<LeaveRequest>(`/leave-requests/${id}/decision`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...(decisionReason ? { decisionReason } : {}) }),
    }),
}
