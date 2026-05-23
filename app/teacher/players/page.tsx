import { createClient } from '../../../lib/supabase/server'
import TeacherPlayersClient from '../../../components/teacher/TeacherPlayersClient'

export default async function TeacherPlayersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user!.id).maybeSingle()
  const schoolId = profile?.school_id
  if (!schoolId) return <div className="text-slate-500">No school assigned.</div>

  const { data: activities } = await supabase
    .from('sport_activities')
    .select('id, name')
    .eq('teacher_id', user!.id)
    .eq('is_active', true)

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('school_id', schoolId)
    .order('last_name')

  const activityIds = activities?.map(a => a.id) ?? []
  const { data: enrollments } = activityIds.length > 0
    ? await supabase.from('player_activity').select('player_id, activity_id').in('activity_id', activityIds)
    : { data: [] }

  return (
    <TeacherPlayersClient
      players={players ?? []}
      activities={activities ?? []}
      enrollments={enrollments ?? []}
      schoolId={schoolId}
      currentUserId={user!.id}
    />
  )
}
