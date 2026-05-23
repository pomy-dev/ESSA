import { createClient } from '../../../lib/supabase/server'
import SquadClient from '../../../components/teacher/SquadClient'

export default async function SquadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('school_id, full_name').eq('id', user!.id).maybeSingle()
  const schoolId = profile?.school_id
  if (!schoolId) return <div className="text-slate-500">No school assigned.</div>

  // Get activities this teacher looks after
  const { data: activities } = await supabase
    .from('sport_activities')
    .select('id, name')
    .eq('teacher_id', user!.id)
    .eq('is_active', true)

  // Get matches for this school from published draws
  const { data: matches } = await supabase
    .from('draw_matches')
    .select(`
      *,
      draws(id, title, sport, stage, season, is_published),
      home_school:schools!draw_matches_home_school_id_fkey(id, name, code),
      away_school:schools!draw_matches_away_school_id_fkey(id, name, code)
    `)
    .or(`home_school_id.eq.${schoolId},away_school_id.eq.${schoolId}`)
    .order('match_date')

  const publishedMatches = matches?.filter((m: any) => m.draws?.is_published) ?? []

  // Get players enrolled in teacher's activities
  const activityIds = activities?.map(a => a.id) ?? []
  const { data: enrollments } = activityIds.length > 0
    ? await supabase.from('player_activity').select('player_id, activity_id').in('activity_id', activityIds)
    : { data: [] }

  const playerIds = [...new Set(enrollments?.map(e => e.player_id) ?? [])]
  const { data: players } = playerIds.length > 0
    ? await supabase.from('players').select('*').in('id', playerIds).eq('school_id', schoolId)
    : { data: [] }

  return (
    <SquadClient
      matches={publishedMatches}
      players={players ?? []}
      activities={activities ?? []}
      schoolId={schoolId}
      teacherId={user!.id}
      teacherName={profile?.full_name ?? ''}
    />
  )
}
