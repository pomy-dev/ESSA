'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase/client'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { ToastContainer } from '../../components/ui/Toast'
import { makeToast } from '../../lib/toast'
import type { ToastMessage } from '../../components/ui/Toast'
import type { Player } from '../../types/database'
import { format } from 'date-fns'
import { Users, Printer, CheckCircle, XCircle, Star, Trash2 } from 'lucide-react'
import SquadPrintView from './SquadPrintView'

interface Match {
  id: string
  draw_id: string
  match_date: string
  venue: string
  match_number: number | null
  draws: { id: string; title: string; sport: string; stage: number; season: string }
  home_school: { id: string; name: string; code: string }
  away_school: { id: string; name: string; code: string }
}

interface Activity { id: string; name: string }
interface SquadPlayer {
  id: string
  player_id: string
  position: string
  jersey_number: number | null
  is_captain: boolean
  school_verified: boolean
  players: Player
}

const POSITIONS_SOCCER = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Substitute']
const POSITIONS_NETBALL = ['GS', 'GA', 'WA', 'C', 'WD', 'GD', 'GK', 'Substitute']
const POSITIONS_GENERAL = ['Player', 'Captain', 'Substitute', 'Reserve']

export default function SquadClient({
  matches, players, activities, schoolId, teacherId, teacherName
}: {
  matches: Match[]
  players: Player[]
  activities: Activity[]
  schoolId: string
  teacherId: string
  teacherName: string
}) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [selectedActivity, setSelectedActivity] = useState('')
  const [squadId, setSquadId] = useState<string | null>(null)
  const [squadBarcode, setSquadBarcode] = useState('')
  const [squadPlayers, setSquadPlayers] = useState<SquadPlayer[]>([])
  const [isFinalized, setIsFinalized] = useState(false)
  const [loadingSquad, setLoadingSquad] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [saving, setSaving] = useState(false)
  const [addForm, setAddForm] = useState({ player_id: '', position: '', jersey_number: '', is_captain: false })

  function addToast(t: ToastMessage) { setToasts(prev => [...prev, t]) }

  const activityOptions = activities.map(a => ({ value: a.id, label: a.name }))

  const getSport = () => selectedMatch?.draws?.sport ?? ''
  const posOptions = () => {
    const sport = getSport().toLowerCase()
    if (sport === 'soccer') return POSITIONS_SOCCER.map(p => ({ value: p, label: p }))
    if (sport === 'netball') return POSITIONS_NETBALL.map(p => ({ value: p, label: p }))
    return POSITIONS_GENERAL.map(p => ({ value: p, label: p }))
  }

  const getOpponent = (match: Match) =>
    match.home_school.id === schoolId ? match.away_school : match.home_school

  const getRole = (match: Match) =>
    match.home_school.id === schoolId ? 'Home' : 'Away'

  async function loadSquad() {
    if (!selectedMatch || !selectedActivity) return
    setLoadingSquad(true)
    const supabase = createClient()

    const { data: squad } = await supabase
      .from('squads')
      .select('*')
      .eq('draw_match_id', selectedMatch.id)
      .eq('school_id', schoolId)
      .maybeSingle()

    if (squad) {
      setSquadId(squad.id)
      setSquadBarcode(squad.squad_barcode)
      setIsFinalized(squad.is_finalized)
      const { data: sp } = await supabase
        .from('squad_players')
        .select('*, players(*)')
        .eq('squad_id', squad.id)
        .order('jersey_number')
      setSquadPlayers((sp as SquadPlayer[]) ?? [])
    } else {
      setSquadId(null)
      setSquadBarcode('')
      setSquadPlayers([])
      setIsFinalized(false)
    }
    setLoadingSquad(false)
  }

  useEffect(() => { loadSquad() }, [selectedMatch, selectedActivity])

  async function ensureSquad(): Promise<string | null> {
    if (squadId) return squadId
    const supabase = createClient()
    const { data, error } = await supabase
      .from('squads')
      .insert({ draw_match_id: selectedMatch!.id, school_id: schoolId, activity_id: selectedActivity, selected_by: teacherId })
      .select()
      .single()
    if (error) { addToast(makeToast('error', error.message)); return null }
    setSquadId(data.id)
    setSquadBarcode(data.squad_barcode)
    return data.id
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const sid = await ensureSquad()
    if (!sid) { setSaving(false); return }

    const supabase = createClient()
    const player = players.find(p => p.id === addForm.player_id)

    const { data, error } = await supabase
      .from('squad_players')
      .insert({
        squad_id: sid,
        player_id: addForm.player_id,
        position: addForm.position,
        jersey_number: addForm.jersey_number ? parseInt(addForm.jersey_number) : null,
        is_captain: addForm.is_captain,
        school_verified: player?.is_verified ?? false,
        added_by: teacherId,
      })
      .select('*, players(*)')
      .single()

    if (error) {
      addToast(makeToast('error', error.message.includes('unique') ? 'Player already in squad' : error.message))
    } else {
      setSquadPlayers(prev => [...prev, data as SquadPlayer])
      addToast(makeToast('success', 'Player added to squad'))
      setAddForm({ player_id: '', position: '', jersey_number: '', is_captain: false })
      setShowAddModal(false)
    }
    setSaving(false)
  }

  async function handleRemovePlayer(spId: string) {
    const supabase = createClient()
    await supabase.from('squad_players').delete().eq('id', spId)
    setSquadPlayers(prev => prev.filter(p => p.id !== spId))
  }

  async function handleFinalize() {
    if (!squadId) return
    const supabase = createClient()
    await supabase.from('squads').update({ is_finalized: true }).eq('id', squadId)
    setIsFinalized(true)
    addToast(makeToast('success', 'Squad finalized and saved'))
  }

  const alreadySelected = squadPlayers.map(sp => sp.player_id)
  const availablePlayers = players.filter(p => !alreadySelected.includes(p.id))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Squad Selection</h1>
        <p className="text-slate-500 mt-1">Select your team for an assigned draw match</p>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Select Match</label>
            <select
              className="px-3 py-2 rounded-lg border border-slate-300 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedMatch?.id ?? ''}
              onChange={e => {
                const m = matches.find(x => x.id === e.target.value) ?? null
                setSelectedMatch(m)
              }}
            >
              <option value="">-- Choose a match --</option>
              {matches.map(m => (
                <option key={m.id} value={m.id}>
                  vs {getOpponent(m).name} · {format(new Date(m.match_date), 'dd MMM yyyy')} · {m.draws.sport}
                </option>
              ))}
            </select>
          </div>
          <Select
            label="Sport Activity"
            value={selectedActivity}
            onChange={e => setSelectedActivity(e.target.value)}
            options={activityOptions}
            placeholder="Select activity"
          />
        </div>
      </Card>

      {selectedMatch && selectedActivity && (
        <>
          {/* Match info */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-slate-900">
                  {selectedMatch.home_school.name} <span className="text-slate-400">vs</span> {selectedMatch.away_school.name}
                </div>
                <div className="text-sm text-slate-500 mt-0.5">
                  {selectedMatch.draws.title} · Stage {selectedMatch.draws.stage} · {selectedMatch.draws.season}
                </div>
                <div className="text-sm text-slate-500">
                  {format(new Date(selectedMatch.match_date), 'EEEE, dd MMMM yyyy HH:mm')}
                  {selectedMatch.venue && ` · ${selectedMatch.venue}`}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Your team: <Badge label={getRole(selectedMatch)} variant="info" />
                </div>
              </div>
              {isFinalized && (
                <Badge label="Squad Finalized" variant="success" />
              )}
            </div>
          </Card>

          {/* Squad list */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Users size={18} /> Squad ({squadPlayers.length} players)
              </h2>
              <div className="flex gap-2">
                {!isFinalized && (
                  <Button variant="outline" onClick={() => setShowAddModal(true)}>+ Add Player</Button>
                )}
                {squadPlayers.length > 0 && (
                  <>
                    {!isFinalized && (
                      <Button variant="secondary" onClick={handleFinalize}>Finalize Squad</Button>
                    )}
                    <Button onClick={() => setShowPrint(true)}>
                      <Printer size={16} /> Print / QR
                    </Button>
                  </>
                )}
              </div>
            </div>

            {loadingSquad ? (
              <div className="text-slate-400 text-sm">Loading squad...</div>
            ) : squadPlayers.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-1">
                  <div className="col-span-1">#</div>
                  <div className="col-span-4">Player</div>
                  <div className="col-span-2">Student ID</div>
                  <div className="col-span-2">Grade</div>
                  <div className="col-span-2">Position</div>
                  <div className="col-span-1">Status</div>
                </div>
                {squadPlayers.map(sp => (
                  <div key={sp.id} className="grid grid-cols-12 gap-2 items-center bg-white rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                    <div className="col-span-1 font-mono text-slate-500">{sp.jersey_number ?? '—'}</div>
                    <div className="col-span-4">
                      <div className="font-medium text-slate-900 flex items-center gap-1">
                        {sp.players.first_name} {sp.players.last_name}
                        {sp.is_captain && <Star size={12} className="text-amber-500 fill-amber-500" />}
                      </div>
                    </div>
                    <div className="col-span-2 font-mono text-xs text-slate-500">{sp.players.student_id}</div>
                    <div className="col-span-2 text-xs text-slate-500">{sp.players.grade}</div>
                    <div className="col-span-2 text-xs">{sp.position}</div>
                    <div className="col-span-1 flex items-center justify-between">
                      {sp.school_verified
                        ? <CheckCircle size={16} className="text-green-500" />
                        : <XCircle size={16} className="text-red-400" />
                      }
                      {!isFinalized && (
                        <button onClick={() => handleRemovePlayer(sp.id)} className="text-red-400 hover:text-red-600 ml-1">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-4 px-1">
                  <span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-500" /> Verified student</span>
                  <span className="flex items-center gap-1"><XCircle size={12} className="text-red-400" /> Verification pending</span>
                  <span className="flex items-center gap-1"><Star size={12} className="text-amber-500 fill-amber-500" /> Captain</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                No players selected yet. Add players to build your squad.
              </div>
            )}
          </div>
        </>
      )}

      {/* Add player modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Player to Squad">
        <form onSubmit={handleAddPlayer} className="flex flex-col gap-4">
          <Select
            label="Player"
            value={addForm.player_id}
            onChange={e => setAddForm(f => ({ ...f, player_id: e.target.value }))}
            options={availablePlayers.map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name} (${p.student_id}) - ${p.grade}` }))}
            placeholder="Select player"
            required
          />
          <Select
            label="Position"
            value={addForm.position}
            onChange={e => setAddForm(f => ({ ...f, position: e.target.value }))}
            options={posOptions()}
            placeholder="Select position"
            required
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Jersey Number (optional)</label>
            <input
              type="number"
              value={addForm.jersey_number}
              onChange={e => setAddForm(f => ({ ...f, jersey_number: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-slate-300 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={1}
              max={99}
            />
          </div>
          <label className="flex items-center gap-2 text-gray-700 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={addForm.is_captain}
              onChange={e => setAddForm(f => ({ ...f, is_captain: e.target.checked }))}
            />
            <span>Captain</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add to Squad</Button>
          </div>
        </form>
      </Modal>

      {/* Print view */}
      {showPrint && selectedMatch && (
        <SquadPrintView
          match={selectedMatch}
          squadPlayers={squadPlayers}
          schoolId={schoolId}
          teacherName={teacherName}
          barcode={squadBarcode}
          onClose={() => setShowPrint(false)}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  )
}
