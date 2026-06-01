'use client'
import { useState } from 'react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { ToastContainer } from '../../components/ui/Toast'
import { makeToast } from '../../lib/toast'
import type { ToastMessage } from '../../components/ui/Toast'
import { callEdgeFunction } from '../../lib/edge'
import { createClient } from '../../lib/supabase/client'
import { Plus, User } from 'lucide-react'

interface Teacher {
  id: string
  full_name: string
  email: string
  phone: string
  must_change_password: boolean
  created_at: string
}

export default function TeachersClient({ initialTeachers, schoolId }: { initialTeachers: Teacher[], schoolId: string }) {
  const [teachers, setTeachers] = useState(initialTeachers)
  const [showModal, setShowModal] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ teacherName: '', teacherEmail: '', teacherPassword: '' })

  function addToast(t: ToastMessage) { setToasts(prev => [...prev, t]) }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const result = await callEdgeFunction('create_teacher', {
      teacherName: form.teacherName,
      teacherEmail: form.teacherEmail,
      teacherPassword: form.teacherPassword,
      schoolId,
    })
    if (!result.success) {
      addToast(makeToast('error', result.error || 'Failed to create teacher'))
    } else {
      addToast(makeToast('success', `Teacher "${form.teacherName}" created`))
      setShowModal(false)
      setForm({ teacherName: '', teacherEmail: '', teacherPassword: '' })
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('id, full_name, email, phone, must_change_password, created_at').eq('school_id', schoolId).eq('role', 'teacher').order('full_name')
      setTeachers(data ?? [])
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-700">Sport Teachers</h1>
          <p className="text-slate-500 mt-1">{teachers.length} teachers at your school</p>
        </div>
        <Button onClick={() => setShowModal(true)}><Plus size={16} /> Add Teacher</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {teachers.map(t => (
          <Card key={t.id}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <User className="text-blue-600" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">{t.full_name}</h3>
                  {t.must_change_password && <Badge label="Password reset required" variant="warning" />}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{t.email}</div>
                {t.phone && <div className="text-xs text-slate-400">{t.phone}</div>}
              </div>
            </div>
          </Card>
        ))}
        {teachers.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">No teachers yet. Add sport teachers to your school.</div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Sport Teacher">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input label="Full Name" value={form.teacherName} onChange={e => setForm(f => ({ ...f, teacherName: e.target.value }))} required />
          <Input label="Email" type="email" value={form.teacherEmail} onChange={e => setForm(f => ({ ...f, teacherEmail: e.target.value }))} required />
          <Input label="Temporary Password" type="password" value={form.teacherPassword} onChange={e => setForm(f => ({ ...f, teacherPassword: e.target.value }))} placeholder="Min. 8 characters" required />
          <p className="text-xs text-slate-400">Teacher will be prompted to change their password on first login.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>Add Teacher</Button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  )
}
