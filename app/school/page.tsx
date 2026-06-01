import { createClient } from '../../lib/supabase/server'
import Card from '../../components/ui/Card'
import { Activity, Users, UserCheck, Megaphone } from 'lucide-react'
import { format } from 'date-fns'

export default async function SchoolDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id, full_name')
    .eq('id', user!.id)
    .maybeSingle()

  const schoolId = profile?.school_id
  if (!schoolId) return <div className="text-slate-500">No school assigned to your account.</div>

  const { data: school } = await supabase.from('schools').select('*').eq('id', schoolId).maybeSingle()

  const [activitiesRes, teachersRes, playersRes] = await Promise.all([
    supabase.from('sport_activities').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'teacher'),
    supabase.from('players').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
  ])

  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: draws } = await supabase
    .from('draws')
    .select(`*, draw_matches!inner(home_school_id, away_school_id)`)
    .eq('is_published', true)
    .or(`home_school_id.eq.${schoolId},away_school_id.eq.${schoolId}`, { foreignTable: 'draw_matches' })
    .order('created_at', { ascending: false })
    .limit(5)

  const stats = [
    { label: 'Sport Activities', value: activitiesRes.count ?? 0, icon: <Activity size={22} />, color: 'text-emerald-600 bg-emerald-100' },
    { label: 'Sport Teachers', value: teachersRes.count ?? 0, icon: <Users size={22} />, color: 'text-blue-600 bg-blue-100' },
    { label: 'Registered Players', value: playersRes.count ?? 0, icon: <UserCheck size={22} />, color: 'text-orange-600 bg-orange-100' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-700">{school?.name}</h1>
        <p className="text-slate-500 mt-1">Welcome, {profile?.full_name} · {school?.region} · Code: {school?.code}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${s.color}`}>{s.icon}</div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                <div className="text-sm text-slate-500">{s.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2"><Megaphone size={18} /> Announcements</h2>
          </div>
          {announcements && announcements.length > 0 ? (
            <div className="flex flex-col gap-3">
              {announcements.map((ann: any) => (
                <div key={ann.id} className="border-b border-slate-100 pb-3 last:border-0">
                  <div className="font-medium text-slate-800 text-sm">{ann.title}</div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{ann.content}</p>
                  <div className="text-xs text-slate-400 mt-1">{format(new Date(ann.created_at), 'dd MMM yyyy')}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No announcements at this time.</p>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">My Draws & Fixtures</h2>
          </div>
          {draws && draws.length > 0 ? (
            <div className="flex flex-col gap-3">
              {draws.map((d: any) => (
                <div key={d.id} className="border-b border-slate-100 pb-3 last:border-0">
                  <div className="font-medium text-slate-800 text-sm">{d.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{d.sport} · Stage {d.stage} · {d.season}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No draws assigned to your school yet.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
