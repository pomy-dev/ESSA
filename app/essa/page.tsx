import { createClient } from '../../lib/supabase/server'
import Card from '../../components/ui/Card'
import { School, Users, CalendarDays, Megaphone } from 'lucide-react'

export default async function ESSADashboard() {
  const supabase = await createClient()
  const [schoolsRes, teachersRes, drawsRes, announcementsRes] = await Promise.all([
    supabase.from('schools').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
    supabase.from('draws').select('id', { count: 'exact', head: true }),
    supabase.from('announcements').select('id', { count: 'exact', head: true }).eq('is_published', true),
  ])

  const stats = [
    { label: 'Registered Schools', value: schoolsRes.count ?? 0, icon: <School size={24} />, color: 'text-blue-600 bg-blue-100' },
    { label: 'Sport Teachers', value: teachersRes.count ?? 0, icon: <Users size={24} />, color: 'text-green-600 bg-green-100' },
    { label: 'Tournament Draws', value: drawsRes.count ?? 0, icon: <CalendarDays size={24} />, color: 'text-orange-600 bg-orange-100' },
    { label: 'Active Announcements', value: announcementsRes.count ?? 0, icon: <Megaphone size={24} />, color: 'text-red-600 bg-red-100' },
  ]

  const { data: recentSchools } = await supabase
    .from('schools')
    .select('id, name, code, region, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: recentDraws } = await supabase
    .from('draws')
    .select('id, title, sport, stage, season, is_published, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ESSA Dashboard</h1>
        <p className="text-slate-500 mt-1">Eswatini Schools Association — Sports Management Overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            <h2 className="font-semibold text-slate-800">Recent Schools</h2>
            <a href="/essa/schools" className="text-sm text-blue-600 hover:underline">View all</a>
          </div>
          {recentSchools && recentSchools.length > 0 ? (
            <div className="flex flex-col gap-3">
              {recentSchools.map(school => (
                <div key={school.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <div className="font-medium text-slate-800 text-sm">{school.name}</div>
                    <div className="text-xs text-slate-500">{school.code} · {school.region}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No schools registered yet.</p>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Recent Draws</h2>
            <a href="/essa/draws" className="text-sm text-blue-600 hover:underline">View all</a>
          </div>
          {recentDraws && recentDraws.length > 0 ? (
            <div className="flex flex-col gap-3">
              {recentDraws.map(draw => (
                <div key={draw.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <div className="font-medium text-slate-800 text-sm">{draw.title}</div>
                    <div className="text-xs text-slate-500">{draw.sport} · Stage {draw.stage} · {draw.season}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${draw.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {draw.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No draws created yet.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
