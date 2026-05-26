'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase/client'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { ToastContainer } from '../../components/ui/Toast'
import { makeToast } from '../../lib/toast'
import type { ToastMessage } from '../../components/ui/Toast'
import { callEdgeFunction } from '../../lib/edge'
import { Plus, School, Search, User } from 'lucide-react'
import { useEffect } from 'react'

interface PlayerPreview {
  id: string
  first_name: string
  last_name: string
  grade: string
  student_id: string
  date_of_birth: string
}


interface SchoolWithAdmin {
  id: string;
  name: string;
  code: string;
  region: string;
  address: string;
  phone: string;
  email: string;
  is_active: boolean;
  created_at: string;
  profiles?: { full_name: string; email: string } | null;
  players?: PlayerPreview[];
}

export default function SchoolsClient({ initialSchools }: { initialSchools: SchoolWithAdmin[] }) {

  const [schools, setSchools] = useState(initialSchools)
  const [playerModal, setPlayerModal] = useState<{ open: boolean, player: PlayerPreview | null }>({ open: false, player: null })
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    schoolName: '', code: '', region: '', address: '', phone: '', email: '',
    adminName: '', adminEmail: '', adminPassword: ''
  })

  const filtered = schools.filter((s: SchoolWithAdmin) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    s.region.toLowerCase().includes(search.toLowerCase())
  )


  function addToast(t: ToastMessage) {
    setToasts(prev => [...prev, t])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    const result = await callEdgeFunction('create_school_with_admin', {
      schoolName: form.schoolName,
      code: form.code,
      region: form.region,
      address: form.address,
      phone: form.phone,
      email: form.email,
      adminName: form.adminName,
      adminEmail: form.adminEmail,
      adminPassword: form.adminPassword,
    })
    if (!result.success) {
      addToast(makeToast('error', result.error || 'Failed to create school'))
      setLoading(false)
      return
    }

    addToast(makeToast('success', `School "${form.schoolName}" created successfully`))
    setShowModal(false)
    setForm({ schoolName: '', code: '', region: '', address: '', phone: '', email: '', adminName: '', adminEmail: '', adminPassword: '' })

    // Refresh, now also fetch players for each school
    const { data } = await supabase
      .from('schools')
      .select('*, profiles!schools_admin_id_fkey(full_name, email), players(id, first_name, last_name, grade, student_id, date_of_birth)')
      .order('name')
    setSchools(data ?? [])
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schools</h1>
          <p className="text-slate-500 mt-1">{schools.length} registered schools</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> Register School
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search schools by name, code or region..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((school: SchoolWithAdmin) => (
          <Card key={school.id}>
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-blue-100 rounded-lg shrink-0">
                <School className="text-blue-600" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900 text-sm truncate">{school.name}</h3>
                  <Badge label={school.is_active ? 'Active' : 'Inactive'} variant={school.is_active ? 'success' : 'neutral'} />
                </div>
                <div className="text-xs text-slate-500 mt-1 flex gap-2">
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{school.code}</span>
                  <span>{school.region}</span>
                </div>
                {school.email && <div className="text-xs text-slate-500 mt-1">{school.email}</div>}
                {school.profiles && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <div className="text-xs text-slate-600 font-medium">Admin: {school.profiles.full_name}</div>
                    <div className="text-xs text-slate-400">{school.profiles.email}</div>
                  </div>
                )}
                {/* Player cards */}
                {school.players && school.players.length > 0 && (
                  <div className="mt-4">
                    <div className="font-semibold text-xs text-slate-700 mb-2">Players</div>
                    <div className="flex flex-wrap gap-2">
                      {school.players.map((player: PlayerPreview) => (
                        <div
                          key={player.id}
                          className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1 cursor-pointer hover:bg-blue-50 border border-slate-200"
                          onClick={() => setPlayerModal({ open: true, player })}
                        >
                          <User size={16} className="text-blue-400" />
                          <span className="text-xs font-medium text-slate-800">{player.first_name} {player.last_name}</span>
                          <span className="text-xs text-slate-500">{player.grade}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            No schools found. Register a school to get started.
          </div>
        )}
      </div>
      {/* Player profile modal */}
      <Modal open={playerModal.open} onClose={() => setPlayerModal({ open: false, player: null })} title="Player Profile" size="md">
        {playerModal.player && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <User size={32} className="text-blue-500" />
              <div>
                <div className="font-semibold text-lg text-slate-900">{playerModal.player.first_name} {playerModal.player.last_name}</div>
                <div className="text-xs text-slate-500">Grade: {playerModal.player.grade}</div>
                <div className="text-xs text-slate-500">Student ID: {playerModal.player.student_id}</div>
                <div className="text-xs text-slate-500">DOB: {playerModal.player.date_of_birth}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Register New School" size="lg">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="School Name" value={form.schoolName} onChange={e => setForm(f => ({ ...f, schoolName: e.target.value }))} required />
            </div>
            <Input label="School Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. SWZ001" required />
            <Input label="Region" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} placeholder="e.g. Hhohho" required />
            <div className="col-span-2">
              <Input label="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <Input label="Phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <Input label="School Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="font-semibold text-slate-700 mb-3 text-sm">School Administrator Account</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Input label="Admin Full Name" value={form.adminName} onChange={e => setForm(f => ({ ...f, adminName: e.target.value }))} required />
              </div>
              <Input label="Admin Email" type="email" value={form.adminEmail} onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))} required />
              <Input label="Temporary Password" type="password" value={form.adminPassword} onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))} placeholder="Min. 8 characters" required />
            </div>
            <p className="text-xs text-slate-400 mt-2">Admin will be prompted to change their password on first login.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>Register School</Button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  );
}
