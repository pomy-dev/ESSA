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
  Activity,
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
} from 'lucide-react'
import { format, isPast } from 'date-fns'
import type { Announcement, Draw, DrawMatch, Player, Profile, SportActivity } from '../../types/database'

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

type PlayerWithSchool = Player & { schools?: { name: string; code: string } | null }
type UpdateRow = {
  id: string
  created_at: string
  update_reason: string | null
  old_data: unknown
  new_data: unknown
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

export type ESSAWorkbenchView = 'members' | 'schools' | 'matches' | 'announcements' | 'players' | 'updates'

const tabs: { id: ESSAWorkbenchView; label: string; icon: ReactNode }[] = [
  { id: 'members', label: 'Members', icon: <Users size={16} /> },
  { id: 'schools', label: 'Schools', icon: <School size={16} /> },
  { id: 'matches', label: 'Matches', icon: <CalendarDays size={16} /> },
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
  const [tab] = useState<ESSAWorkbenchView>(props.initialTab ?? 'members')
  const [profiles, setProfiles] = useState(props.profiles)
  const [players, setPlayers] = useState(props.players)
  const [draws, setDraws] = useState(props.draws)
  const [announcements, setAnnouncements] = useState(props.announcements)
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

  const selected = useMemo(() => {
    if (tab === 'members') return profiles.find(p => p.id === selectedId) ?? profiles[0]
    if (tab === 'schools') return props.schools.find(s => s.id === selectedId) ?? props.schools[0]
    if (tab === 'matches') return props.matches.find(m => m.id === selectedId) ?? props.matches[0]
    if (tab === 'announcements') return announcements.find(a => a.id === selectedId) ?? announcements[0]
    if (tab === 'players') return players.find(p => p.id === selectedId) ?? players[0]
    return props.updates.find(u => u.id === selectedId) ?? props.updates[0]
  }, [announcements, players, profiles, props.matches, props.schools, props.updates, selectedId, tab])

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

  const seasonChampion = props.championSchool || 'No finalized squads yet'
  const middleTitle = tabs.find(t => t.id === tab)?.label

  return (
    <div className="h-[calc(100vh-3rem)] min-h-[720px] flex flex-col gap-4">
      {props.showStats !== false && <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Trophy className="text-amber-600" size={24} />
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Season Champion Stat</div>
              <div className="font-bold text-slate-900">{seasonChampion}</div>
            </div>
          </div>
        </div>
        <Stat label="Registered Schools" value={props.schools.length} icon={<School size={22} />} color="text-blue-600 bg-blue-100" />
        <Stat label="Published Matches" value={props.matches.filter(m => m.status === 'published').length} icon={<CalendarDays size={22} />} color="text-orange-600 bg-orange-100" />
        <Stat label="Pending Players" value={players.filter(p => p.essa_verification_status === 'pending').length} icon={<ShieldCheck size={22} />} color="text-green-600 bg-green-100" />
      </div>}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4 min-h-0 flex-1">
        <section className="bg-white border border-slate-200 rounded-lg min-h-0 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">{middleTitle}</h2>
            {tab === 'members' && (
              <Button size="sm" onClick={() => setMemberModal(true)}><Plus size={14} /> Add</Button>
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
              />
            ))}
            {tab === 'matches' && props.matches.map(m => (
              <ListButton key={m.id} active={selectedId === m.id} onClick={() => setSelectedId(m.id)} title={`${m.home_school?.name ?? 'Home'} vs ${m.away_school?.name ?? 'Away'}`} meta={`${m.draws?.sport ?? ''} - ${format(new Date(m.match_date), 'dd MMM yyyy HH:mm')} - ${m.status}`} />
            ))}
            {tab === 'announcements' && announcements.map(a => (
              <ListButton key={a.id} active={selectedId === a.id} onClick={() => setSelectedId(a.id)} title={a.title} meta={a.expires_at ? `Expires ${format(new Date(a.expires_at), 'dd MMM yyyy HH:mm')}` : 'No expiry set'} />
            ))}
            {tab === 'players' && players.map(p => (
              <ListButton key={p.id} active={selectedId === p.id} onClick={() => setSelectedId(p.id)} title={`${p.first_name} ${p.last_name}`} meta={`${p.schools?.name ?? 'School'} - ${p.student_id} - ${p.essa_verification_status}`} />
            ))}
            {tab === 'updates' && props.updates.map(u => (
              <ListButton key={u.id} active={selectedId === u.id} onClick={() => setSelectedId(u.id)} title={`${u.players?.first_name ?? ''} ${u.players?.last_name ?? ''}`} meta={format(new Date(u.created_at), 'dd MMM yyyy HH:mm')} />
            ))}
          </div>
        </section>

        <main className="bg-white border border-slate-200 rounded-lg min-h-0 overflow-auto p-5">
          {tab === 'members' && selected && <MemberDetail profile={selected as Profile} schools={props.schools} onSave={updateProfile} />}
          {tab === 'schools' && selected && <SchoolDetail school={selected as SchoolRow} activities={props.activities} profiles={profiles} players={players} />}
          {tab === 'matches' && selected && <MatchDetail match={selected as Props['matches'][number]} squads={props.squads} squadPlayers={props.squadPlayers} schools={props.schools} draws={draws} onDeleteDraw={deleteExpiredDraw} />}
          {tab === 'announcements' && selected && <AnnouncementDetail announcement={selected as Announcement} onSave={updateAnnouncement} onDelete={deleteExpiredAnnouncement} />}
          {tab === 'players' && selected && <PlayerDetail player={selected as PlayerWithSchool} onVerify={verifyPlayer} onReject={setRejectPlayer} />}
          {tab === 'updates' && selected && <UpdateDetail update={selected as UpdateRow} />}
          {!selected && <div className="text-slate-500 text-sm">Select a record to view details.</div>}
        </main>
      </div>

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

function SchoolListItem({ school, active, expanded, onSelect, onToggle, activities, profiles, players }: {
  school: SchoolRow
  active: boolean
  expanded: boolean
  onSelect: () => void
  onToggle: () => void
  activities: SportActivity[]
  profiles: Profile[]
  players: PlayerWithSchool[]
}) {
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
        <div className="pb-3 pl-9 pr-3 text-xs text-slate-600 flex flex-col gap-2">
          <div>
            <div className="font-semibold text-slate-700">Sports / Activities</div>
            {activities.map(a => <div key={a.id}>{a.name} - {players.length} players - fixtures shown in Matches</div>)}
            {activities.length === 0 && <div>No activities listed</div>}
          </div>
          <div>
            <div className="font-semibold text-slate-700">Coaches / Admins</div>
            {profiles.map(p => <div key={p.id}>{p.full_name} ({roleLabel(p.role)})</div>)}
          </div>
        </div>
      )}
    </div>
  )
}

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

function SchoolDetail({ school, activities, profiles, players }: { school: SchoolRow; activities: SportActivity[]; profiles: Profile[]; players: PlayerWithSchool[] }) {
  const schoolActivities = activities.filter(a => a.school_id === school.id)
  const schoolProfiles = profiles.filter(p => p.school_id === school.id)
  const schoolPlayers = players.filter(p => p.school_id === school.id)
  return (
    <div className="flex flex-col gap-5">
      <Header title={school.name} subtitle={`${school.code} - ${school.region}`} />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Activities" value={schoolActivities.length} />
        <Stat label="Coaches / Admins" value={schoolProfiles.length} />
        <Stat label="Total Players" value={schoolPlayers.length} />
      </div>
      <Section title="Sports / Activities">
        {schoolActivities.map(a => <div key={a.id} className="border-b border-slate-100 py-2 text-sm">{a.name} <span className="text-slate-500">- {a.category}</span></div>)}
      </Section>
      <Section title="Coaches And School Admins">
        {schoolProfiles.map(p => <div key={p.id} className="border-b border-slate-100 py-2 text-sm">{p.full_name} <span className="text-slate-500">- {roleLabel(p.role)}</span></div>)}
      </Section>
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
    <div className="flex flex-col gap-4">
      <Header title={`${update.players?.first_name ?? ''} ${update.players?.last_name ?? ''}`} subtitle={update.players?.schools?.name ?? 'Player update'} />
      <div className="text-sm text-slate-600">{update.update_reason}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <pre className="bg-red-50 text-red-900 rounded-lg p-3 text-xs overflow-auto">{JSON.stringify(update.old_data, null, 2)}</pre>
        <pre className="bg-green-50 text-green-900 rounded-lg p-3 text-xs overflow-auto">{JSON.stringify(update.new_data, null, 2)}</pre>
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
      <h2 className="font-semibold text-slate-800 mb-2 flex items-center gap-2"><Activity size={16} /> {title}</h2>
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
