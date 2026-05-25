import { createClient } from '../../lib/supabase/server'
import ESSADashboardClient, { type ESSAWorkbenchView } from '../../components/essa/ESSADashboardClient'

export default async function EssaWorkbenchPage({
  view = 'members',
  showStats = view === 'members',
}: {
  view?: ESSAWorkbenchView
  showStats?: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    profilesRes,
    schoolsRes,
    activitiesRes,
    playersRes,
    drawsRes,
    matchesRes,
    squadsRes,
    squadPlayersRes,
    announcementsRes,
    updatesRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').in('role', ['essa_admin', 'school_admin', 'teacher']).order('full_name'),
    supabase.from('schools').select('*').eq('is_active', true).order('name'),
    supabase.from('sport_activities').select('*').eq('is_active', true).order('name'),
    supabase.from('players').select('*, schools(name, code)').order('created_at', { ascending: false }),
    supabase.from('draws').select('*').order('created_at', { ascending: false }),
    supabase
      .from('draw_matches')
      .select(`
        *,
        draws(id, title, sport, season, stage, is_published, ends_at),
        home_school:schools!draw_matches_home_school_id_fkey(id, name, code),
        away_school:schools!draw_matches_away_school_id_fkey(id, name, code)
      `)
      .order('match_date', { ascending: false }),
    supabase.from('squads').select('*, profiles!squads_selected_by_fkey(full_name)').order('created_at', { ascending: false }),
    supabase.from('squad_players').select('*, players(id, first_name, last_name, student_id, grade, essa_verification_status)').order('jersey_number'),
    supabase.from('announcements').select('*').order('created_at', { ascending: false }),
    supabase
      .from('player_updates')
      .select('*, players(first_name, last_name, student_id, schools(name))')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const finalizedSquads = squadsRes.data?.filter(s => s.is_finalized) ?? []
  const championCounts = finalizedSquads.reduce<Record<string, number>>((acc, squad) => {
    acc[squad.school_id] = (acc[squad.school_id] ?? 0) + 1
    return acc
  }, {})
  const championSchoolId = Object.entries(championCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  const championSchool = schoolsRes.data?.find(s => s.id === championSchoolId)?.name ?? ''

  return (
    <ESSADashboardClient
      currentUserId={user!.id}
      profiles={profilesRes.data ?? []}
      schools={schoolsRes.data ?? []}
      activities={activitiesRes.data ?? []}
      players={playersRes.data ?? []}
      draws={drawsRes.data ?? []}
      matches={matchesRes.data ?? []}
      squads={squadsRes.data ?? []}
      squadPlayers={squadPlayersRes.data ?? []}
      announcements={announcementsRes.data ?? []}
      updates={updatesRes.data ?? []}
      championSchool={championSchool}
      initialTab={view}
      showStats={showStats}
    />
  )
}
