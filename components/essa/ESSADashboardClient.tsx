'use client'
import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createClient } from '../../lib/supabase/client'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import { ToastContainer } from '../ui/Toast'
import { makeToast } from '../../lib/toast'
import type { ToastMessage } from '../ui/Toast'
import { callEdgeFunction } from '../../lib/edge'
import {
  Activity, Search,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  History,
  Megaphone,
  Plus,
  School,
  ShieldCheck,
  Trophy,
  Users,
  XCircle,
  Filter,
  User,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Hash,
} from 'lucide-react'
import { format, isPast } from 'date-fns'
import type { Announcement, Draw, DrawMatch, Player, Profile, SportActivity } from '../../types/database'

import DrawsClient from './DrawsClient'
import AnnouncementsClient from './Announcements'

type SchoolRow = {
  id: string
  name: string
  code: string
  region: string
  address: string
  phone: string
  email: string
  admin_id: string | null
  is_active: boolean
}

type SquadRow = {
  id: string
  draw_match_id: string
  school_id: string
  is_finalized: boolean
  squad_barcode: string
  profiles?: { full_name: string } | null
}

type SquadPlayerRow = {
  id: string
  squad_id: string
  position: string
  jersey_number: number | null
  is_captain: boolean
  players?: Pick<Player, 'id' | 'first_name' | 'last_name' | 'student_id' | 'grade' | 'essa_verification_status'> | null
}

type PlayerWithSchool = Player & { schools?: { name: string; code: string; } | null, sport_activity_id?: string | null }
type UpdateRow = {
  id: string
  created_at: string
  update_reason: string | null
  old_data: unknown
  new_data: unknown
  verification_code?: string
  changed_by?: string
  profiles?: { full_name: string; email: string } | null
  players?: { first_name: string; last_name: string; student_id: string; schools?: { name: string } | null } | null
}

interface Props {
  currentUserId: string
  profiles: Profile[]
  schools: SchoolRow[]
  activities: SportActivity[]
  players: PlayerWithSchool[]
  draws: Draw[]
  matches: (DrawMatch & {
    draws?: Pick<Draw, 'id' | 'title' | 'sport' | 'season' | 'stage' | 'is_published' | 'ends_at'> | null
    home_school?: { id: string; name: string; code: string } | null
    away_school?: { id: string; name: string; code: string } | null
  })[]
  squads: SquadRow[]
  squadPlayers: SquadPlayerRow[]
  announcements: Announcement[]
  updates: UpdateRow[]
  championSchool: string
  initialTab?: ESSAWorkbenchView
  showStats?: boolean
}

interface PlayerPreview {
  id: string
  first_name: string
  last_name: string
  grade: string
  student_id: string
  date_of_birth: string
  parent_name?: string
  parent_phone?: string
  essa_verification_status?: string
}

interface CoachAssignment {
  id: string
  sport_activity_id: string
  profile_id: string
  profiles?: { full_name: string; email: string; phone: string; role: string }
}

export type ESSAWorkbenchView = 'members' | 'schools' | 'matches' | 'announcements' | 'players' | 'updates'

const tabs: { id: ESSAWorkbenchView; label: string; icon: ReactNode }[] = [
  { id: 'members', label: 'Members', icon: <Users size={16} /> },
  { id: 'schools', label: 'Schools', icon: <School size={16} /> },
  { id: 'matches', label: 'Draws & Fixtures', icon: <CalendarDays size={16} /> },
  { id: 'announcements', label: 'Announcements', icon: <Megaphone size={16} /> },
  { id: 'players', label: 'Player Verification', icon: <ShieldCheck size={16} /> },
  { id: 'updates', label: 'Player Updates', icon: <History size={16} /> },
]

function roleLabel(role: Profile['role']) {
  return role === 'essa_admin' ? 'ESSA Member' : role === 'school_admin' ? 'School Admin' : role === 'teacher' ? 'Coach / Teacher' : 'Referee'
}

function statusBadge(status: Player['essa_verification_status']) {
  if (status === 'verified') return <Badge label="Verified" variant="success" />
  if (status === 'rejected') return <Badge label="Rejected" variant="error" />
  return <Badge label="Pending ESSA" variant="warning" />
}

export default function ESSADashboardClient(props: Props) {
  const [tab, setTab] = useState<ESSAWorkbenchView>(props.initialTab ?? 'members')
  const [search, setSearch] = useState('')

  // Draws & Fixtures navigation
  const [selectedDrawId, setSelectedDrawId] = useState<string | null>(null)
  const [expandedDraws, setExpandedDraws] = useState<string[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [showAddMatchModal, setShowAddMatchModal] = useState(false)
  const [selectedDrawForMatch, setSelectedDrawForMatch] = useState<Draw | null>(null)

  // Player filters
  const [playerFilterSchool, setPlayerFilterSchool] = useState<string>('all')
  const [playerFilterStatus, setPlayerFilterStatus] = useState<string>('all')
  const [playerSearch, setPlayerSearch] = useState('')

  // Update filters
  const [updateFilterSchool, setUpdateFilterSchool] = useState<string>('all')
  const [updateFilterDate, setUpdateFilterDate] = useState<string>('')

  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false)

  const [profiles, setProfiles] = useState(props.profiles)
  const [players, setPlayers] = useState(props.players)
  const [draws, setDraws] = useState(props.draws)
  const [matches, setMatches] = useState(props.matches)
  const [announcements, setAnnouncements] = useState(props.announcements)
  const [updates, setUpdates] = useState(props.updates)

  const initialIds: Record<ESSAWorkbenchView, string | undefined> = {
    members: props.profiles[0]?.id,
    schools: props.schools[0]?.id,
    matches: props.matches[0]?.id,
    announcements: props.announcements[0]?.id,
    players: props.players[0]?.id,
    updates: props.updates[0]?.id,
  }
  const [selectedId, setSelectedId] = useState<string | null>(initialIds[props.initialTab ?? 'members'] ?? null)
  const [expandedSchools, setExpandedSchools] = useState<string[]>([])
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [memberModal, setMemberModal] = useState(false)
  const [memberForm, setMemberForm] = useState({ memberName: '', memberEmail: '', memberPassword: '', phone: '' })
  const [rejectPlayer, setRejectPlayer] = useState<PlayerWithSchool | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerPreview | null>(null)
  const [playerModalOpen, setPlayerModalOpen] = useState(false)

  const [schools, setSchools] = useState([...props.schools])
  const [schoolModal, setSchoolModal] = useState(false)
  const [form, setForm] = useState({
    schoolName: '', code: '', region: '', address: '', phone: '', email: '',
    adminName: '', adminEmail: '', adminPassword: ''
  })

  const [coachAssignments, setCoachAssignments] = useState<CoachAssignment[]>([])

  const selected = useMemo(() => {
    if (tab === 'members') return profiles.find(p => p.id === selectedId) ?? profiles[0]
    if (tab === 'schools') return props.schools.find(s => s.id === selectedId) ?? props.schools[0]
    if (tab === 'matches') {
      if (selectedMatchId) return matches.find(m => m.id === selectedMatchId) ?? matches[0]
      return matches[0]
    }
    if (tab === 'announcements') return announcements.find(a => a.id === selectedId) ?? announcements[0]
    if (tab === 'players') return players.find(p => p.id === selectedId) ?? players[0]
    return updates.find(u => u.id === selectedId) ?? updates[0]
  }, [announcements, players, profiles, props.schools, matches, updates, selectedId, tab, selectedMatchId])

  const filteredPlayers = useMemo(() => {
    return players.filter(p => {
      const matchesSchool = playerFilterSchool === 'all' || p.school_id === playerFilterSchool
      const matchesStatus = playerFilterStatus === 'all' || p.essa_verification_status === playerFilterStatus
      const matchesSearch = !playerSearch ||
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(playerSearch.toLowerCase()) ||
        p.student_id.toLowerCase().includes(playerSearch.toLowerCase())
      return matchesSchool && matchesStatus && matchesSearch
    })
  }, [players, playerFilterSchool, playerFilterStatus, playerSearch])

  const filteredUpdates = useMemo(() => {
    return updates.filter(u => {
      const matchesSchool = updateFilterSchool === 'all' || u.players?.schools?.name === updateFilterSchool
      const matchesDate = !updateFilterDate ||
        format(new Date(u.created_at), 'yyyy-MM-dd') === updateFilterDate
      return matchesSchool && matchesDate
    })
  }, [updates, updateFilterSchool, updateFilterDate])

  function addToast(t: ToastMessage) {
    setToasts(prev => [...prev, t])
  }

  async function createMember(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await callEdgeFunction('create_essa_member', memberForm)
    if (!result.success) {
      addToast(makeToast('error', result.error || 'Failed to create member'))
    } else {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('*').in('role', ['essa_admin', 'school_admin']).order('full_name')
      setProfiles(data ?? [])
      setMemberModal(false)
      setMemberForm({ memberName: '', memberEmail: '', memberPassword: '', phone: '' })
      addToast(makeToast('success', 'ESSA member created'))
    }
    setSaving(false)
  }

  async function updateProfile(profile: Profile, patch: Partial<Profile>) {
    const supabase = createClient()
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', profile.id).select().single()
    if (error) addToast(makeToast('error', error.message))
    else {
      setProfiles(prev => prev.map(p => p.id === profile.id ? data : p))
      addToast(makeToast('success', 'Member details updated'))
    }
  }

  async function verifyPlayer(player: PlayerWithSchool, status: 'verified' | 'rejected', reason = '') {
    const supabase = createClient()
    const patch = {
      essa_verification_status: status,
      essa_rejection_reason: status === 'rejected' ? reason : '',
      essa_verified_by: props.currentUserId,
      essa_verified_at: new Date().toISOString(),
      is_verified: status === 'verified',
    }
    const { data, error } = await supabase.from('players').update(patch).eq('id', player.id).select('*, schools(name, code)').single()
    if (error) addToast(makeToast('error', error.message))
    else {
      setPlayers(prev => prev.map(p => p.id === player.id ? data : p))
      setRejectPlayer(null)
      setRejectReason('')
      addToast(makeToast('success', status === 'verified' ? 'Player verified' : 'Player rejected'))
    }
  }

  async function deleteExpiredDraw(draw: Draw) {
    if (!draw.ends_at || !isPast(new Date(draw.ends_at))) return
    const supabase = createClient()
    const { error } = await supabase.from('draws').delete().eq('id', draw.id)
    if (error) addToast(makeToast('error', error.message))
    else {
      setDraws(prev => prev.filter(d => d.id !== draw.id))
      addToast(makeToast('success', 'Expired draw deleted'))
    }
  }

  async function updateAnnouncement(ann: Announcement, patch: Partial<Announcement>) {
    const supabase = createClient()
    const { data, error } = await supabase.from('announcements').update(patch).eq('id', ann.id).select().single()
    if (error) addToast(makeToast('error', error.message))
    else {
      setAnnouncements(prev => prev.map(a => a.id === ann.id ? data : a))
      addToast(makeToast('success', 'Announcement updated'))
    }
  }

  async function deleteExpiredAnnouncement(ann: Announcement) {
    if (!ann.expires_at || !isPast(new Date(ann.expires_at))) return
    const supabase = createClient()
    const { error } = await supabase.from('announcements').delete().eq('id', ann.id)
    if (error) addToast(makeToast('error', error.message))
    else {
      setAnnouncements(prev => prev.filter(a => a.id !== ann.id))
      addToast(makeToast('success', 'Expired announcement deleted'))
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
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
      setSaving(false)
      return
    }

    addToast(makeToast('success', `School "${form.schoolName}" created successfully`))
    setSchoolModal(false)
    setForm({ schoolName: '', code: '', region: '', address: '', phone: '', email: '', adminName: '', adminEmail: '', adminPassword: '' })

    const { data } = await supabase
      .from('schools')
      .select('*, profiles!schools_admin_id_fkey(full_name, email), players(id, first_name, last_name, grade, student_id, date_of_birth)')
      .order('name')
    setSchools(data ?? [])
    setSaving(false)
  }

  const seasonChampion = props.championSchool || 'No finalized squads yet'

  const filteredSchools = props.schools.filter((s: SchoolRow) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    s.region.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-[calc(100vh-3rem)] min-h-[720px] flex flex-col gap-4">

      {props.showStats !== false && tab === 'members' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Trophy className="text-amber-600" size={24} />
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Season Champion</div>
                <div className="font-bold text-slate-900">{seasonChampion}</div>
              </div>
            </div>
          </div>
          <Stat label="Registered Schools" value={props.schools.length} icon={<School size={22} />} color="text-blue-600 bg-blue-100" />
          <Stat label="Published Matches" value={matches.filter(m => m.status === 'published').length} icon={<CalendarDays size={22} />} color="text-orange-600 bg-orange-100" />
          <Stat label="Pending Players" value={players.filter(p => p.essa_verification_status === 'pending').length} icon={<ShieldCheck size={22} />} color="text-green-600 bg-green-100" />
        </div>
      ) : (
        tab === 'schools' && (
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
        )
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4 min-h-0 flex-1">
        <section className="bg-white border border-slate-200 rounded-lg min-h-0 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">
              {tab === 'members' && 'Members'}
              {tab === 'schools' && 'Schools'}
              {tab === 'matches' && 'Draws & Fixtures'}
              {tab === 'announcements' && 'Announcements'}
              {tab === 'players' && 'Players'}
              {tab === 'updates' && 'Updates'}
            </h2>
            {tab === 'members' && (
              <Button size="sm" onClick={() => setMemberModal(true)}><Plus size={14} /></Button>
            )}
            {tab === 'schools' && (
              <Button size="sm" onClick={() => setSchoolModal(true)}><Plus size={14} /></Button>
            )}
            {tab === 'matches' && (
              <Button size="sm" onClick={() => setShowAnnouncementsModal(true)}><Plus size={14} /></Button>
            )}
            {tab === 'announcements' && (
              <Button size="sm" onClick={() => setShowAnnouncementsModal(true)}><Plus size={14} /></Button>
            )}
          </div>

          <div className="overflow-auto p-2 flex flex-col gap-1">
            {tab === 'members' && profiles.map(p => (
              <ListButton key={p.id} active={selectedId === p.id} onClick={() => setSelectedId(p.id)} title={p.full_name} meta={`${roleLabel(p.role)} - ${p.email}`} />
            ))}

            {tab === 'schools' && props.schools.map(s => (
              <SchoolListItem
                key={s.id}
                school={s}
                active={selectedId === s.id}
                expanded={expandedSchools.includes(s.id)}
                onSelect={() => setSelectedId(s.id)}
                onToggle={() => setExpandedSchools(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                activities={props.activities.filter(a => a.school_id === s.id)}
                profiles={profiles.filter(p => p.school_id === s.id)}
                players={players.filter(p => p.school_id === s.id)}
                onViewPlayer={(player) => {
                  setSelectedPlayer(player)
                  setPlayerModalOpen(true)
                }}
              />
            ))}

            {tab === 'matches' && draws.map(draw => (
              <DrawListItem
                key={draw.id}
                draw={draw}
                matches={matches.filter(m => m.draw_id === draw.id)}
                expanded={expandedDraws.includes(draw.id)}
                onToggle={() => {
                  setExpandedDraws(prev =>
                    prev.includes(draw.id)
                      ? prev.filter(id => id !== draw.id)
                      : [...prev, draw.id]
                  )
                  setSelectedDrawId(draw.id)
                }}
                onSelectMatch={(matchId) => {
                  setSelectedMatchId(matchId)
                  setSelectedDrawId(draw.id)
                }}
                selectedMatchId={selectedMatchId}
                onAddMatch={() => {
                  setSelectedDrawForMatch(draw)
                  setShowAddMatchModal(true)
                }}
              />
            ))}

            {tab === 'announcements' && announcements.map(a => (
              <ListButton key={a.id} active={selectedId === a.id} onClick={() => setSelectedId(a.id)} title={a.title} meta={a.expires_at ? `Expires ${format(new Date(a.expires_at), 'dd MMM yyyy HH:mm')}` : 'No expiry set'} />
            ))}

            {tab === 'players' && (
              <div className="flex flex-col gap-3 p-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search by name or student ID..."
                    value={playerSearch}
                    onChange={e => setPlayerSearch(e.target.value)}
                    className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-slate-200"
                  />
                </div>
                <select
                  value={playerFilterSchool}
                  onChange={e => setPlayerFilterSchool(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded border border-slate-200"
                >
                  <option value="all">All Schools</option>
                  {props.schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select
                  value={playerFilterStatus}
                  onChange={e => setPlayerFilterStatus(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded border border-slate-200"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
                <div className="text-xs text-slate-500 mt-1">{filteredPlayers.length} players</div>
              </div>
            )}
            {tab === 'players' && filteredPlayers.map(p => (
              <ListButton
                key={p.id}
                active={selectedId === p.id}
                onClick={() => setSelectedId(p.id)}
                title={`${p.first_name} ${p.last_name}`}
                meta={`${p.schools?.name ?? 'School'} - ${p.student_id}`}
              />
            ))}

            {tab === 'updates' && (
              <div className="flex flex-col gap-3 p-2">
                <select
                  value={updateFilterSchool}
                  onChange={e => setUpdateFilterSchool(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded border border-slate-200"
                >
                  <option value="all">All Schools</option>
                  {props.schools.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={updateFilterDate}
                  onChange={e => setUpdateFilterDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded border border-slate-200"
                />
                <div className="text-xs text-slate-500 mt-1">{filteredUpdates.length} updates</div>
              </div>
            )}
            {tab === 'updates' && filteredUpdates.map(u => (
              <ListButton
                key={u.id}
                active={selectedId === u.id}
                onClick={() => setSelectedId(u.id)}
                title={`${u.players?.first_name ?? ''} ${u.players?.last_name ?? ''}`}
                meta={`${format(new Date(u.created_at), 'dd MMM yyyy HH:mm')} - ${u.profiles?.full_name || 'System'}`}
              />
            ))}
          </div>
        </section>

        <main className="bg-white border border-slate-200 rounded-lg min-h-0 overflow-auto p-5">
          {tab === 'members' && selected && <MemberDetail profile={selected as Profile} schools={filteredSchools} onSave={updateProfile} />}
          {tab === 'schools' && selected && (
            <SchoolDetail
              school={selected as SchoolRow}
              activities={props.activities}
              profiles={profiles}
              players={players}
              coachAssignments={coachAssignments}
              onViewPlayer={(player) => {
                setSelectedPlayer(player)
                setPlayerModalOpen(true)
              }}
            />
          )}
          {tab === 'matches' && selectedMatchId && (
            <MatchDetail
              match={matches.find(m => m.id === selectedMatchId)!}
              squads={props.squads}
              squadPlayers={props.squadPlayers}
              schools={props.schools}
              draws={draws}
              onDeleteDraw={deleteExpiredDraw}
            />
          )}
          {tab === 'matches' && !selectedMatchId && selectedDrawId && (
            <div className="text-slate-500 text-sm">Select a match from the draw to view details.</div>
          )}
          {tab === 'announcements' && selected && <AnnouncementDetail announcement={selected as Announcement} onSave={updateAnnouncement} onDelete={deleteExpiredAnnouncement} />}
          {tab === 'players' && selected && <PlayerDetail player={selected as PlayerWithSchool} onVerify={verifyPlayer} onReject={setRejectPlayer} />}
          {tab === 'updates' && selected && <UpdateDetail update={selected as UpdateRow} />}
          {!selected && tab !== 'matches' && <div className="text-slate-500 text-sm">Select a record to view details.</div>}
        </main>
      </div>

      {/* Add Match Modal */}
      <Modal open={showAddMatchModal} onClose={() => setShowAddMatchModal(false)} title="Add Match to Draw" size="lg">
        {selectedDrawForMatch && (
          <DrawMatchesModalContent
            draw={selectedDrawForMatch}
            schools={props.schools}
            onMatchAdded={(newMatch) => {
              setMatches([...matches, newMatch])
              setShowAddMatchModal(false)
              addToast(makeToast('success', 'Match added successfully'))
            }}
            onClose={() => setShowAddMatchModal(false)}
          />
        )}
      </Modal>

      {/* Player Profile Modal */}
      <Modal open={playerModalOpen} onClose={() => setPlayerModalOpen(false)} title="Player Profile" size="md">
        {selectedPlayer && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <User size={32} className="text-blue-600" />
              </div>
              <div>
                <div className="font-bold text-lg text-slate-900">{selectedPlayer.first_name} {selectedPlayer.last_name}</div>
                <div className="text-sm text-slate-500">Student ID: {selectedPlayer.student_id}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Grade" value={selectedPlayer.grade} />
              <Info label="Date of Birth" value={format(new Date(selectedPlayer.date_of_birth), 'dd MMM yyyy')} />
              {selectedPlayer.parent_name && <Info label="Parent Name" value={selectedPlayer.parent_name} />}
              {selectedPlayer.parent_phone && <Info label="Parent Phone" value={selectedPlayer.parent_phone} />}
              {selectedPlayer.essa_verification_status && (
                <div className="col-span-2">
                  <Info label="Verification Status" value={selectedPlayer.essa_verification_status} />
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Existing Modals... */}
      <Modal open={memberModal} onClose={() => setMemberModal(false)} title="Create ESSA Member">
        <form onSubmit={createMember} className="flex flex-col gap-4">
          <Input label="Full Name" value={memberForm.memberName} onChange={e => setMemberForm(f => ({ ...f, memberName: e.target.value }))} required />
          <Input label="Email" type="email" value={memberForm.memberEmail} onChange={e => setMemberForm(f => ({ ...f, memberEmail: e.target.value }))} required />
          <Input label="Phone" value={memberForm.phone} onChange={e => setMemberForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label="Temporary Password" type="password" value={memberForm.memberPassword} onChange={e => setMemberForm(f => ({ ...f, memberPassword: e.target.value }))} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setMemberModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Member</Button>
          </div>
        </form>
      </Modal>

      <Modal open={schoolModal} onClose={() => setSchoolModal(false)} title="Register New School" size="lg">
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
            <Button type="button" variant="outline" onClick={() => setSchoolModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Register School</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showAnnouncementsModal} onClose={() => setShowAnnouncementsModal(false)} title="Create Draw" size="xl">
        <DrawsClient initialDraws={props.draws} schools={props.schools} />
      </Modal>

      <Modal open={!!rejectPlayer} onClose={() => setRejectPlayer(null)} title="Reject Player Verification">
        <form onSubmit={e => { e.preventDefault(); if (rejectPlayer) verifyPlayer(rejectPlayer, 'rejected', rejectReason) }} className="flex flex-col gap-4">
          <div className="text-sm text-slate-600">Explain why this player is rejected. The school side will see this note.</div>
          <textarea className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" rows={4} value={rejectReason} onChange={e => setRejectReason(e.target.value)} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRejectPlayer(null)}>Cancel</Button>
            <Button type="submit" variant="danger">Reject Player</Button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  )
}

// New DrawListItem component
function DrawListItem({ draw, matches, expanded, onToggle, onSelectMatch, selectedMatchId, onAddMatch }: {
  draw: Draw
  matches: any[]
  expanded: boolean
  onToggle: () => void
  onSelectMatch: (matchId: string) => void
  selectedMatchId: string | null
  onAddMatch: () => void
}) {
  return (
    <div className="rounded-md border border-slate-200 mb-2">
      <div className="flex items-center">
        <button onClick={onToggle} className="p-2 text-slate-500">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1 py-2 pr-3">
          <div className="font-medium text-sm text-slate-900">{draw.title}</div>
          <div className="text-xs text-slate-500">{draw.sport} - Stage {draw.stage} - {draw.season}</div>
        </div>
        <Button size="sm" variant="outline" onClick={onAddMatch} className="mr-2">
          <Plus size={12} /> Match
        </Button>
      </div>
      {expanded && (
        <div className="pb-2 pl-9 pr-3 flex flex-col gap-1">
          {matches.map(match => (
            <button
              key={match.id}
              onClick={() => onSelectMatch(match.id)}
              className={`text-left px-2 py-1.5 rounded text-sm transition-colors ${selectedMatchId === match.id
                ? 'bg-blue-50 text-blue-700'
                : 'hover:bg-slate-50 text-slate-700'
                }`}
            >
              <div className="font-medium">{match.home_school?.name} vs {match.away_school?.name}</div>
              <div className="text-xs text-slate-500">{format(new Date(match.match_date), 'dd MMM yyyy HH:mm')}</div>
            </button>
          ))}
          {matches.length === 0 && (
            <div className="text-xs text-slate-400 py-2">No matches added yet. Click + to add.</div>
          )}
        </div>
      )}
    </div>
  )
}

// New DrawMatchesModalContent component
function DrawMatchesModalContent({ draw, schools, onMatchAdded, onClose }: {
  draw: Draw
  schools: SchoolRow[]
  onMatchAdded: (match: any) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    home_school_id: '',
    away_school_id: '',
    match_date: '',
    venue: '',
    match_number: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const schoolOptions = schools.map(s => ({ value: s.id, label: `${s.name} (${s.code})` }))

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (form.home_school_id === form.away_school_id) {
      setError('Home and away school must be different')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { data, error: err } = await supabase.from('draw_matches').insert({
      draw_id: draw.id,
      home_school_id: form.home_school_id,
      away_school_id: form.away_school_id,
      match_date: form.match_date,
      venue: form.venue,
      match_number: form.match_number ? parseInt(form.match_number) : null,
      status: 'published',
    }).select(`
      *,
      draws(id, title, sport, season, stage, is_published, ends_at),
      home_school:schools!draw_matches_home_school_id_fkey(id, name, code),
      away_school:schools!draw_matches_away_school_id_fkey(id, name, code)
    `).single()

    if (err) setError(err.message)
    else {
      onMatchAdded(data)
      setForm({ home_school_id: '', away_school_id: '', match_date: '', venue: '', match_number: '' })
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleAdd} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Home School"
          value={form.home_school_id}
          onChange={(e: any) => setForm(f => ({ ...f, home_school_id: e.target.value }))}
          options={schoolOptions}
          placeholder="Select home school"
          required
        />
        <Select
          label="Away School"
          value={form.away_school_id}
          onChange={(e: any) => setForm(f => ({ ...f, away_school_id: e.target.value }))}
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
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading}>Add Match</Button>
      </div>
    </form>
  )
}

function Stat({ label, value, icon, color = 'text-slate-600 bg-slate-100' }: { label: string; value: number; icon?: ReactNode; color?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center gap-3">
        {icon && <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>}
        <div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  )
}

function ListButton({ active, onClick, title, meta }: { active: boolean; onClick: () => void; title: string; meta: string }) {
  return (
    <button onClick={onClick} className={`text-left px-3 py-2 rounded-md ${active ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}>
      <div className="font-medium text-sm text-slate-900 truncate">{title}</div>
      <div className="text-xs text-slate-500 truncate">{meta}</div>
    </button>
  )
}

function SchoolListItem({ school, active, expanded, onSelect, onToggle, activities, profiles, players, onViewPlayer }: {
  school: SchoolRow
  active: boolean
  expanded: boolean
  onSelect: () => void
  onToggle: () => void
  activities: SportActivity[]
  profiles: Profile[]
  players: PlayerWithSchool[]
  onViewPlayer: (player: PlayerPreview) => void
}) {
  const admin = profiles.find(p => p.role === 'school_admin')

  return (
    <div className={`rounded-md ${active ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}>
      <div className="flex items-center">
        <button onClick={onToggle} className="p-2 text-slate-500">{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
        <button onClick={onSelect} className="flex-1 text-left py-2 pr-3">
          <div className="font-medium text-sm text-slate-900 truncate">{school.name}</div>
          <div className="text-xs text-slate-500">{school.code} - {players.length} total players</div>
        </button>
      </div>
      {expanded && (
        <div className="pb-3 pl-9 pr-3 text-xs text-slate-600 flex flex-col gap-3">
          <div>
            <div className="font-semibold text-slate-700 mb-1">School Admin</div>
            {admin ? (
              <div className="text-sm">
                <div>{admin.full_name}</div>
                <div className="text-slate-500">{admin.email}</div>
              </div>
            ) : (
              <div>No admin assigned</div>
            )}
          </div>
          <div>
            <div className="font-semibold text-slate-700 mb-1">Sports / Activities</div>
            <div className="grid grid-cols-2 gap-1">
              {activities.map(a => <div key={a.id}>{a.name}</div>)}
            </div>
            {activities.length === 0 && <div>No activities listed</div>}
          </div>
          <div>
            <div className="font-semibold text-slate-700 mb-1">Coaches / Teachers</div>
            {profiles.filter(p => p.role !== 'school_admin').map(p => (
              <div key={p.id}>{p.full_name} ({roleLabel(p.role)})</div>
            ))}
          </div>
          <div>
            <div className="font-semibold text-slate-700 mb-2">Players ({players.length})</div>
            <div className="grid grid-cols-2 gap-2">
              {players.slice(0, 6).map(p => (
                <button
                  key={p.id}
                  onClick={() => onViewPlayer(p)}
                  className="text-left p-2 bg-slate-50 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <div className="font-medium text-slate-800 text-xs">{p.first_name} {p.last_name}</div>
                  <div className="text-slate-500 text-xs">{p.grade} - {p.student_id}</div>
                  <div className="mt-1">{statusBadge(p.essa_verification_status)}</div>
                </button>
              ))}
              {players.length > 6 && (
                <div className="text-xs text-blue-600 mt-1">+{players.length - 6} more players</div>
              )}
              {players.length === 0 && <div>No players registered</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// function SchoolDetail({ school, activities, profiles, players, coachAssignments, onViewPlayer }: {
//   school: SchoolRow
//   activities: SportActivity[]
//   profiles: Profile[]
//   players: PlayerWithSchool[]
//   coachAssignments: CoachAssignment[]
//   onViewPlayer: (player: PlayerPreview) => void
// }) {
//   const schoolActivities = activities.filter(a => a.school_id === school.id)
//   const schoolProfiles = profiles.filter(p => p.school_id === school.id)
//   const admin = schoolProfiles.find(p => p.role === 'school_admin')
//   const coaches = schoolProfiles.filter(p => p.role !== 'school_admin')

//   // Create a map of activity to coach
//   const activityCoachMap = new Map()
//   coachAssignments.forEach(assignment => {
//     const coach = coaches.find(c => c.id === assignment.profile_id)
//     if (coach) {
//       activityCoachMap.set(assignment.sport_activity_id, coach)
//     }
//   })

//   const activitiesWithCoaches = schoolActivities.map(activity => ({
//     ...activity,
//     coach: activityCoachMap.get(activity.id) || null
//   }))

//   return (
//     <div className="flex flex-col gap-6">
//       <Header title={school.name} subtitle={`${school.code} - ${school.region}`} />

//       <div className="grid grid-cols-3 gap-3">
//         <Stat label="Activities" value={schoolActivities.length} />
//         <Stat label="Coaches / Teachers" value={coaches.length} />
//         <Stat label="Total Players" value={players.length} />
//       </div>

//       {/* School Admin Section */}
//       <Section title="School Administrator">
//         {admin ? (
//           <div className="bg-slate-50 rounded-lg p-4">
//             <div className="flex items-center gap-3">
//               <div className="p-2 bg-blue-100 rounded-full">
//                 <User size={20} className="text-blue-600" />
//               </div>
//               <div>
//                 <div className="font-semibold text-slate-900">{admin.full_name}</div>
//                 <div className="text-sm text-slate-500">{admin.email}</div>
//                 {admin.phone && <div className="text-sm text-slate-500">{admin.phone}</div>}
//               </div>
//             </div>
//           </div>
//         ) : (
//           <div className="text-slate-500">No administrator assigned</div>
//         )}
//       </Section>

//       {/* Sports/Activities Table */}
//       <Section title="Sports & Activities">
//         <table className="w-full text-sm">
//           <thead className="bg-slate-50">
//             <tr>
//               <th className="text-left p-2 font-medium text-slate-700">Sport/Activity</th>
//               <th className="text-left p-2 font-medium text-slate-700">Category</th>
//               <th className="text-left p-2 font-medium text-slate-700">Players</th>
//             </tr>
//           </thead>
//           <tbody>
//             {schoolActivities.map(a => (
//               <tr key={a.id} className="border-b border-slate-100">
//                 <td className="p-2">{a.name}</td>
//                 <td className="p-2">{a.category || '-'}</td>
//                 <td className="p-2">{players.filter(p => p.sport_activity_id === a.id).length || 0}</td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//         {schoolActivities.length === 0 && <div className="text-slate-500">No activities registered</div>}
//       </Section>

//       {/* Coaches/Teachers Table */}
//       <Section title="Coaches & Teachers">
//         <table className="w-full text-sm">
//           <thead className="bg-slate-50">
//             <tr>
//               <th className="text-left p-2 font-medium text-slate-700">Name</th>
//               <th className="text-left p-2 font-medium text-slate-700">Role</th>
//               <th className="text-left p-2 font-medium text-slate-700">Email</th>
//               <th className="text-left p-2 font-medium text-slate-700">Phone</th>
//             </tr>
//           </thead>
//           <tbody>
//             {coaches.map(p => (
//               <tr key={p.id} className="border-b border-slate-100">
//                 <td className="p-2">{p.full_name}</td>
//                 <td className="p-2">{roleLabel(p.role)}</td>
//                 <td className="p-2">{p.email}</td>
//                 <td className="p-2">{p.phone || '-'}</td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//         {coaches.length === 0 && <div className="text-slate-500">No coaches or teachers assigned</div>}
//       </Section>

//       {/* Players Cards */}
//       <Section title="Players">
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
//           {players.map(player => (
//             <button
//               key={player.id}
//               onClick={() => onViewPlayer(player)}
//               className="text-left p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
//             >
//               <div className="flex items-start justify-between">
//                 <div>
//                   <div className="font-semibold text-slate-900">{player.first_name} {player.last_name}</div>
//                   <div className="text-xs text-slate-500 mt-1">Grade: {player.grade}</div>
//                   <div className="text-xs text-slate-500">Student ID: {player.student_id}</div>
//                 </div>
//                 {statusBadge(player.essa_verification_status)}
//               </div>
//             </button>
//           ))}
//         </div>
//         {players.length === 0 && <div className="text-slate-500">No players registered</div>}
//       </Section>
//     </div>
//   )
// }

function SchoolDetail({ school, activities, profiles, players, coachAssignments, onViewPlayer }: {
  school: SchoolRow
  activities: SportActivity[]
  profiles: Profile[]
  players: PlayerWithSchool[]
  coachAssignments: CoachAssignment[]
  onViewPlayer: (player: PlayerPreview) => void
}) {
  const schoolActivities = activities.filter(a => a.school_id === school.id)
  const schoolProfiles = profiles.filter(p => p.school_id === school.id)
  const admin = schoolProfiles.find(p => p.role === 'school_admin')
  const coaches = schoolProfiles.filter(p => p.role !== 'school_admin')

  const activityCoachMap = new Map()
  coachAssignments.forEach(assignment => {
    const coach = coaches.find(c => c.id === assignment.profile_id)
    if (coach) {
      activityCoachMap.set(assignment.sport_activity_id, coach)
    }
  })

  const activitiesWithCoaches = schoolActivities.map(activity => ({
    ...activity,
    coach: activityCoachMap.get(activity.id) || null
  }))

  return (
    <div className="flex flex-col gap-6">
      <Header title={school.name} subtitle={`${school.code} - ${school.region}`} />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Activities" value={schoolActivities.length} />
        <Stat label="Coaches / Teachers" value={coaches.length} />
        <Stat label="Total Players" value={players.length} />
      </div>

      {/* School Admin Section */}
      <Section title="School Administrator">
        {admin ? (
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <User size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-slate-900">{admin.full_name}</div>
                <div className="text-sm text-slate-500">{admin.email}</div>
                {admin.phone && <div className="text-sm text-slate-500">{admin.phone}</div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-slate-500">No administrator assigned</div>
        )}
      </Section>

      {/* Sports/Activities Table with Coach Assignment */}
      <Section title="Sports & Activities">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 font-medium text-slate-700">Sport/Activity</th>
                <th className="text-left p-3 font-medium text-slate-700">Category</th>
                <th className="text-left p-3 font-medium text-slate-700">Coach/Teacher</th>
                <th className="text-left p-3 font-medium text-slate-700">Players</th>
              </tr>
            </thead>
            <tbody>
              {activitiesWithCoaches.map(activity => (
                <tr key={activity.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-medium text-slate-800">{activity.name}</td>
                  <td className="p-3 text-slate-600">{activity.category || '-'}</td>
                  <td className="p-3">
                    {activity.coach ? (
                      <div>
                        <div className="font-medium text-slate-800">{activity.coach.full_name}</div>
                        <div className="text-xs text-slate-500">{activity.coach.email}</div>
                      </div>
                    ) : (
                      <span className="text-amber-600 text-xs">Not assigned</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                      {players.filter(p => p.sport_activity_id === activity.id).length}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {schoolActivities.length === 0 && (
          <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg">
            No activities registered for this school
          </div>
        )}
      </Section>

      {/* Players Cards */}
      <Section title="Players">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {players.map(player => (
            <button
              key={player.id}
              onClick={() => onViewPlayer(player)}
              className="text-left p-3 border border-slate-200 rounded-lg hover:shadow-md hover:border-blue-200 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{player.first_name} {player.last_name}</div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span>{player.grade}</span>
                    <span>•</span>
                    <span>{player.student_id}</span>
                  </div>
                  {player.sport_activity_id && (
                    <div className="text-xs text-blue-600 mt-1">
                      {activities.find(a => a.id === player.sport_activity_id)?.name || 'Unknown'}
                    </div>
                  )}
                </div>
                <div className="ml-2">
                  {statusBadge(player.essa_verification_status)}
                </div>
              </div>
            </button>
          ))}
        </div>
        {players.length === 0 && (
          <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg">
            No players registered for this school
          </div>
        )}
      </Section>
    </div>
  )
}

// function SchoolDetail({ school, activities, profiles, players, coachAssignments, onViewPlayer }: {
//   school: SchoolRow
//   activities: SportActivity[]
//   profiles: Profile[]
//   players: PlayerWithSchool[]
//   coachAssignments: CoachAssignment[]
//   onViewPlayer: (player: PlayerPreview) => void
// }) {
//   const schoolActivities = activities.filter(a => a.school_id === school.id)
//   const schoolProfiles = profiles.filter(p => p.school_id === school.id)
//   const admin = schoolProfiles.find(p => p.role === 'school_admin')
//   const coaches = schoolProfiles.filter(p => p.role !== 'school_admin')

//   // Create a map of activity to coach
//   const activityCoachMap = new Map()
//   coachAssignments.forEach(assignment => {
//     const coach = coaches.find(c => c.id === assignment.profile_id)
//     if (coach) {
//       activityCoachMap.set(assignment.sport_activity_id, coach)
//     }
//   })

//   const activitiesWithCoaches = schoolActivities.map(activity => ({
//     ...activity,
//     coach: activityCoachMap.get(activity.id) || null
//   }))
// }

function MemberDetail({ profile, schools, onSave }: { profile: Profile; schools: SchoolRow[]; onSave: (profile: Profile, patch: Partial<Profile>) => void }) {
  const [form, setForm] = useState({ full_name: profile.full_name, email: profile.email, phone: profile.phone })
  const school = schools.find(s => s.id === profile.school_id)
  return (
    <div className="flex flex-col gap-5">
      <Header title={profile.full_name} subtitle={`${roleLabel(profile.role)}${school ? ` - ${school.name}` : ''}`} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <Input label="Full Name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
        <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
      </div>
      <Button className="w-fit" onClick={() => onSave(profile, form)}>Save Profile</Button>
    </div>
  )
}

function MatchDetail({ match, squads, squadPlayers, schools, draws, onDeleteDraw }: {
  match: Props['matches'][number]
  squads: SquadRow[]
  squadPlayers: SquadPlayerRow[]
  schools: SchoolRow[]
  draws: Draw[]
  onDeleteDraw: (draw: Draw) => void
}) {
  const draw = draws.find(d => d.id === match.draw_id)
  const matchSquads = squads.filter(s => s.draw_match_id === match.id && s.is_finalized)
  return (
    <div className="flex flex-col gap-5">
      <Header title={`${match.home_school?.name ?? 'Home'} vs ${match.away_school?.name ?? 'Away'}`} subtitle={`${match.draws?.title ?? ''} - ${match.status}`} />
      <div className="text-sm text-slate-600">{format(new Date(match.match_date), 'EEEE, dd MMMM yyyy HH:mm')} {match.venue && `- ${match.venue}`}</div>
      {draw?.ends_at && isPast(new Date(draw.ends_at)) && <Button variant="danger" className="w-fit" onClick={() => onDeleteDraw(draw)}>Delete Expired Draw</Button>}
      <Section title="Finalized Squads">
        {matchSquads.map(squad => {
          const school = schools.find(s => s.id === squad.school_id)
          const players = squadPlayers.filter(sp => sp.squad_id === squad.id)
          return (
            <div key={squad.id} className="border border-slate-200 rounded-lg p-3 mb-3">
              <div className="font-semibold text-slate-900">{school?.name ?? 'School'} <Badge label="Finalized" variant="success" /></div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {players.map(sp => <div key={sp.id} className="text-sm text-slate-700">{sp.jersey_number ?? '-'} {sp.players?.first_name} {sp.players?.last_name} - {sp.position}</div>)}
                {players.length === 0 && <div className="text-sm text-slate-500">No players in squad.</div>}
              </div>
            </div>
          )
        })}
        {matchSquads.length === 0 && <div className="text-sm text-slate-500">No finalized squad has been submitted for this match yet.</div>}
      </Section>
    </div>
  )
}

function AnnouncementDetail({ announcement, onSave, onDelete }: { announcement: Announcement; onSave: (ann: Announcement, patch: Partial<Announcement>) => void; onDelete: (ann: Announcement) => void }) {
  const [form, setForm] = useState({ title: announcement.title, content: announcement.content, expires_at: announcement.expires_at?.slice(0, 16) ?? '' })
  const expired = !!announcement.expires_at && isPast(new Date(announcement.expires_at))
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <Header title={announcement.title} subtitle={expired ? 'Expired' : announcement.is_published ? 'Published' : 'Draft'} />
      <Input label="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
      <textarea className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" rows={7} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
      <Input label="Expires At" type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
      <div className="flex gap-2">
        <Button onClick={() => onSave(announcement, { title: form.title, content: form.content, expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null })}>Update</Button>
        {expired && <Button variant="danger" onClick={() => onDelete(announcement)}>Delete Expired</Button>}
      </div>
    </div>
  )
}

function PlayerDetail({ player, onVerify, onReject }: { player: PlayerWithSchool; onVerify: (p: PlayerWithSchool, status: 'verified' | 'rejected') => void; onReject: (p: PlayerWithSchool) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <Header title={`${player.first_name} ${player.last_name}`} subtitle={`${player.schools?.name ?? 'School'} - ${player.student_id}`} />
      <div>{statusBadge(player.essa_verification_status)}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <Info label="Grade" value={player.grade} />
        <Info label="Enrollment Year" value={String(player.enrollment_year)} />
        <Info label="Date of Birth" value={format(new Date(player.date_of_birth), 'dd MMM yyyy')} />
        <Info label="Parent" value={`${player.parent_name || 'Not set'} ${player.parent_phone || ''}`} />
        <Info label="Bank Receipt" value={player.bank_receipt_url || 'Not entered'} />
        <Info label="School Receipt" value={player.school_receipt_url || 'Not entered'} />
        {player.essa_rejection_reason && <Info label="Rejection Reason" value={player.essa_rejection_reason} />}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => onVerify(player, 'verified')}><CheckCircle size={16} /> Verify</Button>
        <Button variant="danger" onClick={() => onReject(player)}><XCircle size={16} /> Reject</Button>
      </div>
    </div>
  )
}

function UpdateDetail({ update }: { update: UpdateRow }) {
  return (
    <div className="flex flex-col gap-5">
      <Header
        title={`${update.players?.first_name ?? ''} ${update.players?.last_name ?? ''}`}
        subtitle={`${update.players?.schools?.name ?? 'Player update'}`}
      />

      <div className="bg-slate-50 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <User size={14} className="text-slate-500" />
          <span className="font-medium text-slate-700">Changed by:</span>
          <span className="text-slate-600">{update.profiles?.full_name || 'System'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar size={14} className="text-slate-500" />
          <span className="font-medium text-slate-700">Date & Time:</span>
          <span className="text-slate-600">{format(new Date(update.created_at), 'dd MMM yyyy HH:mm:ss')}</span>
        </div>
        {update.verification_code && (
          <div className="flex items-center gap-2 text-sm">
            <Hash size={14} className="text-slate-500" />
            <span className="font-medium text-slate-700">Verification Code:</span>
            <span className="text-slate-600 font-mono">{update.verification_code}</span>
          </div>
        )}
        {update.update_reason && (
          <div className="flex items-start gap-2 text-sm">
            <span className="font-medium text-slate-700">Reason:</span>
            <span className="text-slate-600">{update.update_reason}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="font-semibold text-red-700 mb-2 flex items-center gap-2">
            <span className="text-red-600">Old Data</span>
          </div>
          <pre className="bg-red-50 text-red-900 rounded-lg p-3 text-xs overflow-auto max-h-96">
            {JSON.stringify(update.old_data, null, 2)}
          </pre>
        </div>
        <div>
          <div className="font-semibold text-green-700 mb-2 flex items-center gap-2">
            <span className="text-green-600">New Data</span>
          </div>
          <pre className="bg-green-50 text-green-900 rounded-lg p-3 text-xs overflow-auto max-h-96">
            {JSON.stringify(update.new_data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><Activity size={16} /> {title}</h2>
      <div>{children}</div>
    </section>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-medium text-slate-900 break-words">{value}</div>
    </div>
  )
}

// Helper Select component
function Select({ label, value, onChange, options, placeholder, required }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={onChange}
        required={required}
        className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">{placeholder}</option>
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
