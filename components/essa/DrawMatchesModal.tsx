'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase/client'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import type { Draw, DrawMatch } from '../../types/database'
import { format } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'

interface School { id: string; name: string; code: string }

interface Props {
  draw: Draw
  schools: School[]
  onClose: () => void
}

export default function DrawMatchesModal({ draw, schools, onClose }: Props) {
  const [matches, setMatches] = useState<DrawMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    home_school_id: '',
    away_school_id: '',
    match_date: '',
    venue: '',
    match_number: '',
  })

  const schoolOptions = schools.map(s => ({ value: s.id, label: `${s.name} (${s.code})` }))

  useEffect(() => {
    const supabase = createClient()
    supabase.from('draw_matches').select('*').eq('draw_id', draw.id).order('match_number').then(({ data }) => {
      setMatches(data ?? [])
      setLoading(false)
    })
  }, [draw.id])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.home_school_id === form.away_school_id) {
      setError('Home and away school must be different')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { data, error: err } = await supabase.from('draw_matches').insert({
      draw_id: draw.id,
      home_school_id: form.home_school_id,
      away_school_id: form.away_school_id,
      match_date: form.match_date,
      venue: form.venue,
      match_number: form.match_number ? parseInt(form.match_number) : null,
      status: 'published',
    }).select().single()
    if (err) setError(err.message)
    else {
      setMatches(m => [...m, data])
      setForm({ home_school_id: '', away_school_id: '', match_date: '', venue: '', match_number: '' })
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('draw_matches').delete().eq('id', id)
    setMatches(m => m.filter(x => x.id !== id))
  }

  const getSchoolName = (id: string) => schools.find(s => s.id === id)?.name ?? id

  return (
    <Modal open onClose={onClose} title={`Matches — ${draw.title}`} size="xl">
      <div className="flex flex-col gap-6">
        {/* Existing matches */}
        <div>
          <h3 className="font-semibold text-slate-700 mb-3 text-sm">Scheduled Matches ({matches.length})</h3>
          {loading ? (
            <p className="text-slate-400 text-sm">Loading...</p>
          ) : matches.length === 0 ? (
            <p className="text-slate-400 text-sm">No matches added yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {matches.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5 text-sm">
                  <div className="flex-1">
                    <span className="font-medium text-slate-800">{getSchoolName(m.home_school_id)}</span>
                    <span className="text-slate-400 mx-2">vs</span>
                    <span className="font-medium text-slate-800">{getSchoolName(m.away_school_id)}</span>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {format(new Date(m.match_date), 'dd MMM yyyy, HH:mm')}
                      {m.venue && ` · ${m.venue}`}
                      {m.match_number && ` · Match #${m.match_number}`}
                      {' · Published'}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(m.id)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add match form */}
        <div className="border-t border-slate-200 pt-4">
          <h3 className="font-semibold text-slate-700 mb-3 text-sm">Add Match</h3>
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Home School"
                value={form.home_school_id}
                onChange={e => setForm(f => ({ ...f, home_school_id: e.target.value }))}
                options={schoolOptions}
                placeholder="Select home school"
                required
              />
              <Select
                label="Away School"
                value={form.away_school_id}
                onChange={e => setForm(f => ({ ...f, away_school_id: e.target.value }))}
                options={schoolOptions}
                placeholder="Select away school"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Match Date & Time"
                type="datetime-local"
                value={form.match_date}
                onChange={e => setForm(f => ({ ...f, match_date: e.target.value }))}
                required
              />
              <Input
                label="Venue"
                value={form.venue}
                onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                placeholder="e.g. ESSA Stadium"
              />
            </div>
            <Input
              label="Match Number (optional)"
              type="number"
              value={form.match_number}
              onChange={e => setForm(f => ({ ...f, match_number: e.target.value }))}
              placeholder="e.g. 1"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" loading={saving}>
              <Plus size={16} /> Add Match
            </Button>
          </form>
        </div>
      </div>
    </Modal>
  )
}
