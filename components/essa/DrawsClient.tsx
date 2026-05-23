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
import type { Draw } from '../../types/database'
import { Plus, CalendarDays, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import DrawMatchesModal from './DrawMatchesModal'

interface School { id: string; name: string; code: string }

const sportOptions = [
  { value: 'Soccer', label: 'Soccer' },
  { value: 'Netball', label: 'Netball' },
  { value: 'Basketball', label: 'Basketball' },
  { value: 'Athletics', label: 'Athletics' },
  { value: 'Swimming', label: 'Swimming' },
  { value: 'Cricket', label: 'Cricket' },
  { value: 'Tennis', label: 'Tennis' },
  { value: 'Volleyball', label: 'Volleyball' },
]

const stageOptions = [
  { value: '1', label: 'Stage 1 — First Round' },
  { value: '2', label: 'Stage 2 — Quarter Finals' },
  { value: '3', label: 'Stage 3 — Finals' },
]

export default function DrawsClient({ initialDraws, schools }: { initialDraws: Draw[], schools: School[] }) {
  const [draws, setDraws] = useState(initialDraws)
  const [showModal, setShowModal] = useState(false)
  const [selectedDraw, setSelectedDraw] = useState<Draw | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    title: '', sport: '', stage: '', season: new Date().getFullYear().toString(), description: '',
  })

  function addToast(t: ToastMessage) { setToasts(prev => [...prev, t]) }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('draws').insert({
      title: form.title,
      sport: form.sport,
      stage: parseInt(form.stage) as 1 | 2 | 3,
      season: form.season,
      description: form.description,
      is_published: false,
      created_by: user!.id,
    }).select().single()

    if (error) {
      addToast(makeToast('error', error.message))
    } else {
      setDraws(d => [data, ...d])
      addToast(makeToast('success', 'Draw created successfully'))
      setShowModal(false)
      setForm({ title: '', sport: '', stage: '', season: new Date().getFullYear().toString(), description: '' })
    }
    setLoading(false)
  }

  async function togglePublish(draw: Draw) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('draws')
      .update({ is_published: !draw.is_published })
      .eq('id', draw.id)
      .select()
      .single()
    if (error) {
      addToast(makeToast('error', error.message))
    } else {
      setDraws(d => d.map(x => x.id === draw.id ? data : x))
      addToast(makeToast('success', data.is_published ? 'Draw published to schools' : 'Draw unpublished'))
    }
  }

  const stageLabel = (s: number) => ['', 'Stage 1', 'Stage 2', 'Stage 3 (Final)'][s]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Draws & Fixtures</h1>
          <p className="text-slate-500 mt-1">Manage tournament draws and match schedules</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> Create Draw
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {draws.map(draw => (
          <Card key={draw.id} padding={false}>
            <div className="flex items-center gap-4 p-4">
              <div className="p-3 bg-orange-100 rounded-xl shrink-0">
                <CalendarDays className="text-orange-600" size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900">{draw.title}</h3>
                  <Badge label={draw.is_published ? 'Published' : 'Draft'} variant={draw.is_published ? 'success' : 'warning'} />
                </div>
                <div className="text-sm text-slate-500 mt-0.5">
                  {draw.sport} · {stageLabel(draw.stage)} · {draw.season}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Created {format(new Date(draw.created_at), 'dd MMM yyyy')}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => togglePublish(draw)}>
                  {draw.is_published ? 'Unpublish' : 'Publish'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSelectedDraw(draw)}>
                  Matches <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {draws.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            No draws created yet. Create the first draw to get started.
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create Tournament Draw">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input label="Draw Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. ESSA Soccer Championship 2025" required />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Sport" value={form.sport} onChange={e => setForm(f => ({ ...f, sport: e.target.value }))} options={sportOptions} placeholder="Select sport" required />
            <Select label="Stage" value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} options={stageOptions} placeholder="Select stage" required />
          </div>
          <Input label="Season / Year" value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))} required />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm placeholder:text-gray-400 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional notes about this draw..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>Create Draw</Button>
          </div>
        </form>
      </Modal>

      {selectedDraw && (
        <DrawMatchesModal
          draw={selectedDraw}
          schools={schools}
          onClose={() => setSelectedDraw(null)}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  )
}
