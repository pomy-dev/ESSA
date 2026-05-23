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
import type { Announcement } from '../../types/database'
import { Plus, Megaphone, Globe } from 'lucide-react'
import { format } from 'date-fns'

interface School { id: string; name: string }

export default function AnnouncementsClient({ initialAnnouncements, schools }: { initialAnnouncements: Announcement[], schools: School[] }) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [showModal, setShowModal] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSchools, setSelectedSchools] = useState<string[]>([])

  const [form, setForm] = useState({ title: '', content: '' })

  function addToast(t: ToastMessage) { setToasts(prev => [...prev, t]) }

  function toggleSchool(id: string) {
    setSelectedSchools(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('announcements').insert({
      title: form.title,
      content: form.content,
      is_published: false,
      target_schools: selectedSchools,
      created_by: user!.id,
    }).select().single()

    if (error) addToast(makeToast('error', error.message))
    else {
      setAnnouncements(a => [data, ...a])
      addToast(makeToast('success', 'Announcement created'))
      setShowModal(false)
      setForm({ title: '', content: '' })
      setSelectedSchools([])
    }
    setLoading(false)
  }

  async function togglePublish(ann: Announcement) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('announcements')
      .update({ is_published: !ann.is_published })
      .eq('id', ann.id)
      .select().single()
    if (error) addToast(makeToast('error', error.message))
    else {
      setAnnouncements(a => a.map(x => x.id === ann.id ? data : x))
      addToast(makeToast('success', data.is_published ? 'Announcement published' : 'Announcement unpublished'))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
          <p className="text-slate-500 mt-1">Publish notices to schools</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Announcement
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {announcements.map(ann => (
          <Card key={ann.id} padding={false}>
            <div className="flex items-start gap-4 p-4">
              <div className="p-2.5 bg-red-100 rounded-xl shrink-0 mt-0.5">
                <Megaphone className="text-red-600" size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900">{ann.title}</h3>
                  <Badge label={ann.is_published ? 'Published' : 'Draft'} variant={ann.is_published ? 'success' : 'warning'} />
                  {ann.target_schools.length === 0 && (
                    <span className="flex items-center gap-1 text-xs text-blue-600"><Globe size={12} /> All Schools</span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-1 line-clamp-2">{ann.content}</p>
                <div className="text-xs text-slate-400 mt-1">{format(new Date(ann.created_at), 'dd MMM yyyy')}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => togglePublish(ann)}>
                {ann.is_published ? 'Unpublish' : 'Publish'}
              </Button>
            </div>
          </Card>
        ))}
        {announcements.length === 0 && (
          <div className="text-center py-16 text-slate-500">No announcements yet.</div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Announcement" size="lg">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input label="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Content</label>
            <textarea
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={5}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">
              Target Schools <span className="text-slate-400 font-normal">(leave empty for all schools)</span>
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">
              {schools.map(s => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedSchools.includes(s.id)}
                    onChange={() => toggleSchool(s.id)}
                    className="rounded"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>Create Announcement</Button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  )
}
