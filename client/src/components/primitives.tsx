import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import type { LeaveStatus } from '../lib/api'
import { Button as ShadcnButton } from './ui/button'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger' }

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <ShadcnButton variant={variant} size="sm" className={`button button-${variant} ${className}`} {...props} />
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`field ${className}`} {...props} />
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`field ${className}`} {...props} />
}

const statusLabels: Record<LeaveStatus, string> = {
  PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak',
}

export function StatusBadge({ status }: { status: LeaveStatus }) {
  return <span className={`status status-${status.toLowerCase()}`}><span aria-hidden="true" />{statusLabels[status]}</span>
}

export function DataTable({ children, label }: { children: ReactNode; label: string }) {
  return <div className="table-wrap"><table aria-label={label}>{children}</table></div>
}

export function Notice({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' }) {
  return <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}

export function SectionHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="section-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p>{detail}</p></div>{action}</div>
}
