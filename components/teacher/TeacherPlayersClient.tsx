'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase/client'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { ToastContainer } from '../../components/ui/Toast'
import { makeToast } from '../../lib/toast'
import type { ToastMessage } from '../../components/ui/Toast'
import type { Player } from '../../types/database'
import { Plus, Search, UserPlus, AlertCircle } from 'lucide-react'

const GRADES = ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']

interface Activity { id: string; name: string }
interface Enrollment { player_id: string; activity_id: string }

export default function TeacherPlayersClient({
  players, activities, enrollments, schoolId, currentUserId
}: {
  players: Player[]
  activities: Activity[]
  enrollments: Enrollment[]
  schoolId: string
  currentUserId: string
}) {
  const [allPlayers, setAllPlayers] = useState(players)
  const [allEnrollments, setAllEnrollments] = useState(enrollments)
  const [search, setSearch] = useState('')
  const [filterActivity, setFilterActivity] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [editPlayer, setEditPlayer] = useState<Player | null>(null)
  const [verifyStep, setVerifyStep] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [enrollActivityId, setEnrollActivityId] = useState('')
  const [enrollPlayerId, setEnrollPlayerId] = useState('')

  const [form, setForm] = useState({
    first_name: '', last_name: '', date_of_birth: '', student_id: '',
    enrollment_year: new Date().getFullYear().toString(), grade: '', parent_name: '', parent_phone: '',
    bank_receipt_url: '', school_receipt_url: '',
  })

  function addToast(t: ToastMessage) { setToasts(prev => [...prev, t]) }

  const activityOptions = activities.map(a => ({ value: a.id, label: a.name }))

  const filteredPlayers = allPlayers.filter(p => {
    const matchesSearch = `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      p.student_id.toLowerCase().includes(search.toLowerCase())
    const matchesActivity = !filterActivity || allEnrollments.some(e => e.player_id === p.id && e.activity_id === filterActivity)
    return matchesSearch && matchesActivity
  })

  function openEdit(p: Player) {
    // generate verification code randomly
    p.verification_code = Math.floor(Math.random() * 1000000).toString()
    const code = p.verification_code

    setEditPlayer(p)
    setVerifyStep(true)
    setVerifyCode(code) // For demo purposes, in real app this should be handled securely
    setForm({ first_name: p.first_name, last_name: p.last_name, date_of_birth: p.date_of_birth, student_id: p.student_id, enrollment_year: p.enrollment_year.toString(), grade: p.grade, parent_name: p.parent_name, parent_phone: p.parent_phone, bank_receipt_url: p.bank_receipt_url, school_receipt_url: p.school_receipt_url })
    setShowAddModal(true)
  }

  function openCreate() {
    setEditPlayer(null)
    setVerifyStep(false)
    setVerifyCode('')
    setForm({ first_name: '', last_name: '', date_of_birth: '', student_id: '', enrollment_year: new Date().getFullYear().toString(), grade: '', parent_name: '', parent_phone: '', bank_receipt_url: '', school_receipt_url: '' })
    setShowAddModal(true)
  }

  async function handleVerifyCode() {
    if (!editPlayer) return
    if (verifyCode !== editPlayer.verification_code) {
      addToast(makeToast('error', 'Invalid verification code'))
      return
    }
    setVerifyStep(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const payload = {
      first_name: form.first_name, last_name: form.last_name, date_of_birth: form.date_of_birth,
      student_id: form.student_id, enrollment_year: parseInt(form.enrollment_year),
      grade: form.grade, parent_name: form.parent_name, parent_phone: form.parent_phone,
      bank_receipt_url: form.bank_receipt_url, school_receipt_url: form.school_receipt_url,
      school_id: schoolId, is_verified: false, essa_verification_status: 'pending' as const, essa_rejection_reason: '',
    }

    if (editPlayer) {
      const oldData = { first_name: editPlayer.first_name, last_name: editPlayer.last_name, student_id: editPlayer.student_id, grade: editPlayer.grade, bank_receipt_url: editPlayer.bank_receipt_url, school_receipt_url: editPlayer.school_receipt_url }
      const { data, error } = await supabase.from('players').update(payload).eq('id', editPlayer.id).select().single()
      if (error) addToast(makeToast('error', error.message))
      else {
        await supabase.from('player_updates').insert({ player_id: editPlayer.id, updated_by: currentUserId, update_reason: 'Updated by teacher', old_data: oldData, new_data: payload, verification_code_used: verifyCode })
        setAllPlayers(prev => prev.map(p => p.id === editPlayer.id ? data : p))
        addToast(makeToast('success', 'Player updated'))
        setShowAddModal(false)
      }
    } else {
      const vCode = `ESSA-${schoolId.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
      const { data, error } = await supabase.from('players').insert({ ...payload, registered_by: currentUserId, verification_code: vCode }).select().single()
      if (error) addToast(makeToast('error', error.message))
      else {
        setAllPlayers(prev => [...prev, data])
        addToast(makeToast('success', `Player added. Verification code: ${vCode}`))
        setShowAddModal(false)
      }
    }
    setLoading(false)
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('player_activity').insert({ player_id: enrollPlayerId, activity_id: enrollActivityId })
    if (error) addToast(makeToast('error', error.message.includes('unique') ? 'Player already enrolled in this activity' : error.message))
    else {
      setAllEnrollments(prev => [...prev, { player_id: enrollPlayerId, activity_id: enrollActivityId }])
      addToast(makeToast('success', 'Player enrolled in activity'))
      setShowEnrollModal(false)
    }
    setLoading(false)
  }

  const getPlayerActivities = (playerId: string) =>
    allEnrollments.filter(e => e.player_id === playerId).map(e => activities.find(a => a.id === e.activity_id)?.name).filter(Boolean)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Players</h1>
          <p className="text-slate-500 mt-1">{allPlayers.length} players at school</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEnrollModal(true)}><UserPlus size={16} /> Enroll in Activity</Button>
          <Button onClick={openCreate}><Plus size={16} /> Add Player</Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <Select value={filterActivity} onChange={e => setFilterActivity(e.target.value)} options={activityOptions} placeholder="All activities" className="w-48" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredPlayers.map(p => {
          const acts = getPlayerActivities(p.id)
          return (
            <Card key={p.id} padding={false}>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 font-semibold text-amber-700 text-sm">
                    {p.first_name[0]}{p.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 text-sm">{p.first_name} {p.last_name}</h3>
                      <Badge
                        label={p.essa_verification_status === 'verified' ? 'Verified' : p.essa_verification_status === 'rejected' ? 'Rejected' : 'Pending'}
                        variant={p.essa_verification_status === 'verified' ? 'success' : p.essa_verification_status === 'rejected' ? 'error' : 'warning'}
                      />
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      <span className="font-mono">{p.student_id}</span> · {p.grade} · {p.enrollment_year}
                    </div>
                    {p.essa_rejection_reason && (
                      <div className="text-xs text-red-600 mt-1">{p.essa_rejection_reason}</div>
                    )}
                    {acts.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {acts.map(a => <span key={a} className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">{a}</span>)}
                      </div>
                    )}
                    <button onClick={() => openEdit(p)} className="text-xs text-blue-600 hover:underline mt-2 block">Edit</button>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
        {filteredPlayers.length === 0 && <div className="col-span-full text-center py-12 text-slate-500">No players found.</div>}
      </div>

      {/* Add/Edit Player Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title={editPlayer ? 'Update Player' : 'Add Player'} size="lg">
        {editPlayer && verifyStep ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 bg-amber-50 rounded-lg p-4 border border-amber-200">
              <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-amber-800">Verification Required</p>
                <p className="text-sm text-amber-700 mt-1">Enter the verification code for <strong>{editPlayer.first_name} {editPlayer.last_name}</strong>.</p>
              </div>
            </div>
            <Input label="Verification Code" value={verifyCode} onChange={e => setVerifyCode(e.target.value.toUpperCase())} className="font-mono" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button onClick={handleVerifyCode}>Verify & Continue</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required />
              <Input label="Last Name" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required />
              <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} required />
              <Input label="Student ID" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} required />
              <Input label="Enrollment Year" type="number" value={form.enrollment_year} onChange={e => setForm(f => ({ ...f, enrollment_year: e.target.value }))} required />
              <Select label="Grade" value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} options={GRADES.map(g => ({ value: g, label: g }))} placeholder="Select" required />
              <Input label="Parent Name" value={form.parent_name} onChange={e => setForm(f => ({ ...f, parent_name: e.target.value }))} />
              <Input label="Parent Phone" type="tel" value={form.parent_phone} onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))} />
              <Input
                label="Student Bank Receipt"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setForm(f => ({ ...f, bank_receipt_url: e.target.files?.[0]?.name ?? '' }))}
                hint={form.bank_receipt_url || 'PDF, JPG or PNG'}
              />
              <Input
                label="School Receipt"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setForm(f => ({ ...f, school_receipt_url: e.target.files?.[0]?.name ?? '' }))}
                hint={form.school_receipt_url || 'PDF, JPG or PNG'}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button type="submit" loading={loading}>{editPlayer ? 'Update' : 'Add Player'}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Enroll player in activity */}
      <Modal open={showEnrollModal} onClose={() => setShowEnrollModal(false)} title="Enroll Player in Activity">
        <form onSubmit={handleEnroll} className="flex flex-col gap-4">
          <Select
            label="Player"
            value={enrollPlayerId}
            onChange={e => setEnrollPlayerId(e.target.value)}
            options={allPlayers.map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name} (${p.student_id})` }))}
            placeholder="Select player"
            required
          />
          <Select
            label="Activity"
            value={enrollActivityId}
            onChange={e => setEnrollActivityId(e.target.value)}
            options={activityOptions}
            placeholder="Select activity"
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowEnrollModal(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>Enroll</Button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  )
}
