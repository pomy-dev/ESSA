import { createClient } from '../../lib/supabase/server'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import { Activity, Users, User } from 'lucide-react'

export default async function TeacherDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, school_id')
    .eq('id', user!.id)
    .maybeSingle()

  const { data: school } = await supabase
    .from('schools')
    .select('name, code')
    .eq('id', profile?.school_id ?? '')
    .maybeSingle()

  const { data: activities } = await supabase
    .from('sport_activities')
    .select('*')
    .eq('teacher_id', user!.id)
    .eq('is_active', true)
    .order('name')

  const activityIds = activities?.map(a => a.id) ?? []
  const { data: playerActivities } = activityIds.length > 0
    ? await supabase
      .from('player_activity')
      .select('player_id, activity_id')
      .in('activity_id', activityIds)
    : { data: [] }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-700">My Activities</h1>
        <p className="text-slate-500 mt-1">
          {profile?.full_name} · {school?.name ?? 'Unknown School'} · {school?.code}
        </p>
      </div>

      {activities && activities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activities.map(a => {
            const playerCount = playerActivities?.filter(pa => pa.activity_id === a.id).length ?? 0
            return (
              <Card key={a.id}>
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-100 rounded-xl shrink-0">
                    <Activity className="text-amber-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{a.name}</h3>
                      <Badge label={a.category} variant="info" />
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-sm text-slate-500">
                      <Users size={14} />
                      <span>{playerCount} players enrolled</span>
                    </div>
                    <a href="/teacher/players" className="text-xs text-blue-600 hover:underline mt-1.5 block">
                      Manage players →
                    </a>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <div className="flex items-center gap-3 text-slate-500">
            <Activity size={20} />
            <p>No sport activities assigned to you yet. Contact your school admin.</p>
          </div>
        </Card>
      )}
    </div>
  )
}
