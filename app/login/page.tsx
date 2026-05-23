'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase/client'
import { useRouter } from 'next/navigation'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Shield } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, must_change_password')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profileError) {
      setError(`Unable to load account profile: ${profileError.message}`)
      setLoading(false)
      return
    }

    if (!profile) {
      setError('Account not configured. Contact your administrator.')
      setLoading(false)
      return
    }

    if (profile.must_change_password) {
      router.push('/change-password')
      return
    }

    switch (profile.role) {
      case 'essa_admin': router.push('/essa'); break
      case 'school_admin': router.push('/school'); break
      case 'teacher': router.push('/teacher'); break
      default: router.push('/login')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">ESSA Sports</h1>
          <p className="text-blue-200 mt-1 text-sm">Eswatini Schools Association</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@school.edu.sz"
              autoComplete="email"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-blue-300 text-xs mt-6">
          Access is managed by ESSA administrators
        </p>
      </div>
    </div>
  )
}
