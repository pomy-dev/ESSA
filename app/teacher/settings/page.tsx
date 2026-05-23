'use client'
import { useState } from 'react'
import { createClient } from '../../../lib/supabase/client'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import { ToastContainer } from '../../../components/ui/Toast'
import { makeToast } from '../../../lib/toast'
import type { ToastMessage } from '../../../components/ui/Toast'
import { Lock } from 'lucide-react'

export default function TeacherSettingsPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setToasts(t => [...t, makeToast('error', 'Password must be at least 8 characters')])
      return
    }
    if (password !== confirm) {
      setToasts(t => [...t, makeToast('error', 'Passwords do not match')])
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setToasts(t => [...t, makeToast('error', error.message)])
    else {
      setToasts(t => [...t, makeToast('success', 'Password updated')])
      setPassword('')
      setConfirm('')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
      </div>
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-amber-100 rounded-xl">
            <Lock className="text-amber-600" size={20} />
          </div>
          <h2 className="font-semibold text-slate-800">Change Password</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="New Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <Input label="Confirm Password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          <Button type="submit" loading={loading}>Update Password</Button>
        </form>
      </Card>
      <ToastContainer toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  )
}
