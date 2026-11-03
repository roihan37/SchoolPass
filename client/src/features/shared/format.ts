import { ApiError } from '../../lib/api'

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
}

export function friendlyError(error: unknown) {
  return error instanceof ApiError ? error.message : 'Terjadi kesalahan. Coba lagi.'
}
