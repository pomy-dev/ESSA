import { createClient } from '../../../lib/supabase/server'
import PlayersClient from '../../../components/schools/PlayersClient'

export default async function PlayersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('school_id, role').eq('id', user!.id).maybeSingle()
  const schoolId = profile?.school_id
  if (!schoolId) return <div className="text-slate-500">No school assigned.</div>

  const [{ data: players }, { data: activities }, { data: enrollments }] = await Promise.all([
    supabase
      .from('players')
      .select('*')
      .eq('school_id', schoolId)
      .order('last_name'),
    supabase
      .from('sport_activities')
      .select('id, name')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('player_activity')
      .select('player_id, activity_id'),
  ])

  return (
    <PlayersClient
      initialPlayers={players ?? []}
      initialActivities={activities ?? []}
      initialEnrollments={enrollments ?? []}
      schoolId={schoolId}
      currentUserId={user!.id}
    />
  )
}
