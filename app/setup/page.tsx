'use client'
import { useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Shield, CheckCircle } from 'lucide-react'

export default function SetupPage() {
  const [form, setForm] = useState({ essaName: '', essaEmail: '', essaPassword: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.essaPassword !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)

    let resp: Response
    try {
      resp = await fetch('/api/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'setup_essa_admin',
          essaName: form.essaName,
          essaEmail: form.essaEmail,
          essaPassword: form.essaPassword,
        }),
      })
    } catch {
      setError('Could not reach the setup API route.')
      setLoading(false)
      return
    }

    // The edge function performs the privileged setup after checking that no ESSA admin exists.
    if (!resp.ok) {
      const data = await resp.json()
      setError(data.error || 'Setup failed')
    } else {
      setDone(true)
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <CheckCircle className="text-green-500 mx-auto mb-4" size={48} />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Setup Complete!</h1>
          <p className="text-slate-500 mb-6">ESSA admin account created. You can now log in.</p>
          <a href="/login" className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">ESSA Setup</h1>
          <p className="text-blue-200 mt-1 text-sm">Create the ESSA Administrator account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Full Name" value={form.essaName} onChange={e => setForm(f => ({ ...f, essaName: e.target.value }))} placeholder="ESSA Administrator" required />
            <Input label="Email" type="email" value={form.essaEmail} onChange={e => setForm(f => ({ ...f, essaEmail: e.target.value }))} placeholder="admin@essa.sz" required />
            <Input label="Password" type="password" value={form.essaPassword} onChange={e => setForm(f => ({ ...f, essaPassword: e.target.value }))} required />
            <Input label="Confirm Password" type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required />
            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}
            <Button type="submit" loading={loading} size="lg" className="w-full">Create ESSA Admin</Button>
          </form>
        </div>
      </div>
    </div>
  )
}
