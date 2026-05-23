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
import { Plus, Activity, User } from 'lucide-react'

interface ActivityWithTeacher {
  id: string
  name: string
  category: string
  teacher_id: string | null
  is_active: boolean
  profiles?: { full_name: string; email: string } | null
}

interface Teacher { id: string; full_name: string; email: string }

const sportOptions = [
  { value: 'Soccer', label: 'Soccer' }, { value: 'Netball', label: 'Netball' },
  { value: 'Basketball', label: 'Basketball' }, { value: 'Athletics', label: 'Athletics' },
  { value: 'Swimming', label: 'Swimming' }, { value: 'Cricket', label: 'Cricket' },
  { value: 'Tennis', label: 'Tennis' }, { value: 'Volleyball', label: 'Volleyball' },
  { value: 'Rugby', label: 'Rugby' }, { value: 'Other', label: 'Other' },
]

export default function ActivitiesClient({
  initialActivities, teachers, schoolId
}: { initialActivities: ActivityWithTeacher[], teachers: Teacher[], schoolId: string }) {
  const [activities, setActivities] = useState(initialActivities)
  const [showModal, setShowModal] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [editActivity, setEditActivity] = useState<ActivityWithTeacher | null>(null)

  const [form, setForm] = useState({ name: '', category: 'team', teacher_id: '' })

  const teacherOptions = teachers.map(t => ({ value: t.id, label: t.full_name }))

  function addToast(t: ToastMessage) { setToasts(prev => [...prev, t]) }

  function openCreate() {
    setEditActivity(null)
    setForm({ name: '', category: 'team', teacher_id: '' })
    setShowModal(true)
  }

  function openEdit(a: ActivityWithTeacher) {
    setEditActivity(a)
    setForm({ name: a.name, category: a.category, teacher_id: a.teacher_id ?? '' })
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const payload = {
      name: form.name,
      category: form.category as 'team' | 'individual',
      teacher_id: form.teacher_id || null,
      school_id: schoolId,
    }

    if (editActivity) {
      const { data, error } = await supabase.from('sport_activities').update(payload).eq('id', editActivity.id).select('*, profiles!sport_activities_teacher_id_fkey(full_name, email)').single()
      if (error) addToast(makeToast('error', error.message))
      else { setActivities(a => a.map(x => x.id === editActivity.id ? data : x)); addToast(makeToast('success', 'Activity updated')) }
    } else {
      const { data, error } = await supabase.from('sport_activities').insert({ ...payload, is_active: true }).select('*, profiles!sport_activities_teacher_id_fkey(full_name, email)').single()
      if (error) addToast(makeToast('error', error.message))
      else { setActivities(a => [...a, data]); addToast(makeToast('success', 'Activity added')) }
    }
    setShowModal(false)
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sport Activities</h1>
          <p className="text-slate-500 mt-1">{activities.length} activities at your school</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Add Activity</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activities.map(a => (
          <Card key={a.id}>
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-emerald-100 rounded-lg shrink-0">
                <Activity className="text-emerald-600" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900 text-sm">{a.name}</h3>
                  <Badge label={a.category} variant="info" />
                  <Badge label={a.is_active ? 'Active' : 'Inactive'} variant={a.is_active ? 'success' : 'neutral'} />
                </div>
                {a.profiles ? (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                    <User size={12} />
                    <span>{a.profiles.full_name}</span>
                  </div>
                ) : (
                  <div className="text-xs text-amber-600 mt-2">No teacher assigned</div>
                )}
                <button onClick={() => openEdit(a)} className="text-xs text-blue-600 hover:underline mt-2 block">Edit</button>
              </div>
            </div>
          </Card>
        ))}
        {activities.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">No activities yet. Add your first sport activity.</div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editActivity ? 'Edit Activity' : 'Add Sport Activity'}>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Select
            label="Sport"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            options={sportOptions}
            placeholder="Select sport"
            required
          />
          <Select
            label="Category"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            options={[{ value: 'team', label: 'Team Sport' }, { value: 'individual', label: 'Individual Sport' }]}
          />
          <Select
            label="Assigned Teacher"
            value={form.teacher_id}
            onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}
            options={teacherOptions}
            placeholder="Select teacher (optional)"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>{editActivity ? 'Save Changes' : 'Add Activity'}</Button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  )
}
