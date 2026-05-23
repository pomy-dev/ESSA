import type { ToastMessage } from '../components/ui/Toast'

export function makeToast(type: 'success' | 'error', message: string): ToastMessage {
  return { id: crypto.randomUUID(), type, message }
}
