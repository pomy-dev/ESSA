'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Shield, QrCode } from 'lucide-react'

export default function RefereeHomePage() {
  const router = useRouter()
  const [code, setCode] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim()) router.push(`/referee/${code.trim()}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4">
            <QrCode className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">ESSA Referee</h1>
          <p className="text-slate-300 mt-1 text-sm">Squad Verification System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Verify Squad</h2>
          <p className="text-sm text-slate-500 mb-6">
            Enter the barcode number from the printed squad list, or scan the QR code to be directed here automatically.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Squad Barcode"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Enter barcode or scan QR"
              className="font-mono"
              required
            />
            <Button type="submit" size="lg" className="w-full">
              Verify Squad
            </Button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          This is a read-only verification view for referees
        </p>
      </div>
    </div>
  )
}
