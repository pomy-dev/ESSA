'use client'
import { useEffect } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

export interface ToastMessage {
  id: string
  type: 'success' | 'error'
  message: string
}

interface ToastProps {
  toast: ToastMessage
  onDismiss: (id: string) => void
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white animate-fade-in
      ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {toast.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
      <span>{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="ml-2 opacity-70 hover:opacity-100">
        <X size={16} />
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  )
}
