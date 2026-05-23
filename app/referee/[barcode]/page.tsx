import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { CheckCircle, XCircle, Star, Shield } from 'lucide-react'
import type { Database } from '../../../types/database'

// Public page — uses service role to read squad details without auth
async function getSquadData(barcode: string) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: squad } = await supabase
    .from('squads')
    .select(`
      *,
      schools!squads_school_id_fkey(name, code, region),
      sport_activities(name),
      profiles!squads_selected_by_fkey(full_name),
      draw_matches(
        match_date,
        venue,
        match_number,
        draws(title, sport, stage, season),
        home_school:schools!draw_matches_home_school_id_fkey(id, name, code),
        away_school:schools!draw_matches_away_school_id_fkey(id, name, code)
      )
    `)
    .eq('squad_barcode', barcode)
    .maybeSingle()

  if (!squad) return null

  const { data: squadPlayers } = await supabase
    .from('squad_players')
    .select('*, players(*)')
    .eq('squad_id', squad.id)
    .order('jersey_number')

  return { squad, squadPlayers: squadPlayers ?? [] }
}

export default async function RefereeSquadPage({ params }: { params: Promise<{ barcode: string }> }) {
  const { barcode } = await params
  const result = await getSquadData(barcode)

  if (!result) notFound()

  const { squad, squadPlayers } = result
  const match = (squad as any).draw_matches
  const school = (squad as any).schools
  const activity = (squad as any).sport_activities
  const teacher = (squad as any).profiles
  const homeSchool = match?.home_school
  const awaySchool = match?.away_school
  const draw = match?.draws

  const opponent = school.id === homeSchool?.id ? awaySchool : homeSchool
  const role = school.id === homeSchool?.id ? 'Home' : 'Away'

  const verifiedCount = (squadPlayers as any[]).filter(sp => sp.school_verified).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={28} className="text-blue-400" />
            <div>
              <div className="font-bold text-lg">ESSA Referee Verification</div>
              <div className="text-slate-400 text-sm">Official squad verification — read only</div>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-sm font-semibold ${(squad as any).is_finalized ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black'}`}>
            {(squad as any).is_finalized ? 'Squad Finalized' : 'Draft Squad'}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
        {/* Match summary */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Match Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex gap-2"><span className="text-slate-500 w-28">Draw</span><span className="font-medium">{draw?.title}</span></div>
            <div className="flex gap-2"><span className="text-slate-500 w-28">Sport</span><span className="font-medium">{draw?.sport}</span></div>
            <div className="flex gap-2"><span className="text-slate-500 w-28">Stage</span><span className="font-medium">Stage {draw?.stage} — {draw?.season}</span></div>
            <div className="flex gap-2"><span className="text-slate-500 w-28">Date</span><span className="font-medium">{match?.match_date ? format(new Date(match.match_date), 'EEEE, dd MMMM yyyy HH:mm') : '—'}</span></div>
            {match?.venue && <div className="flex gap-2"><span className="text-slate-500 w-28">Venue</span><span className="font-medium">{match.venue}</span></div>}
            {match?.match_number && <div className="flex gap-2"><span className="text-slate-500 w-28">Match #</span><span className="font-medium">{match.match_number}</span></div>}
          </div>

          <div className="mt-4 flex items-center justify-center gap-6 bg-slate-50 rounded-xl p-4">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-800">{school?.name}</div>
              <div className="text-xs text-slate-500 font-mono">{school?.code}</div>
              <div className="text-xs text-blue-600 mt-0.5">{role}</div>
            </div>
            <div className="text-2xl text-slate-300 font-bold">vs</div>
            <div className="text-center">
              <div className="text-lg font-bold text-slate-700">{opponent?.name}</div>
              <div className="text-xs text-slate-500 font-mono">{opponent?.code}</div>
            </div>
          </div>
        </div>

        {/* School & teacher info */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Submitting Team</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><div className="text-slate-500 text-xs">School</div><div className="font-semibold">{school?.name}</div></div>
            <div><div className="text-slate-500 text-xs">Code</div><div className="font-mono">{school?.code}</div></div>
            <div><div className="text-slate-500 text-xs">Region</div><div className="font-medium">{school?.region}</div></div>
            <div><div className="text-slate-500 text-xs">Sport Activity</div><div className="font-medium">{activity?.name}</div></div>
          </div>
          {teacher && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">Squad selected by: </span>
              <span className="font-semibold">{teacher.full_name}</span>
            </div>
          )}
        </div>

        {/* Squad summary */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Squad Players ({(squadPlayers as any[]).length})</h2>
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <CheckCircle size={16} /> {verifiedCount} Verified
              </span>
              <span className="flex items-center gap-1 text-red-500 font-medium">
                <XCircle size={16} /> {(squadPlayers as any[]).length - verifiedCount} Not verified
              </span>
            </div>
          </div>

          {(squadPlayers as any[]).length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-4 text-slate-500 font-medium w-10">#</th>
                  <th className="text-left py-2 pr-4 text-slate-500 font-medium">Player</th>
                  <th className="text-left py-2 pr-4 text-slate-500 font-medium">Student ID</th>
                  <th className="text-left py-2 pr-4 text-slate-500 font-medium">Grade</th>
                  <th className="text-left py-2 pr-4 text-slate-500 font-medium">Year</th>
                  <th className="text-left py-2 pr-4 text-slate-500 font-medium">Position</th>
                  <th className="text-left py-2 text-slate-500 font-medium">Verified</th>
                </tr>
              </thead>
              <tbody>
                {(squadPlayers as any[]).map((sp, idx) => (
                  <tr key={sp.id} className={`border-b border-slate-100 ${sp.school_verified ? '' : 'bg-red-50'}`}>
                    <td className="py-3 pr-4 font-mono text-slate-600 text-xs">{sp.jersey_number ?? idx + 1}</td>
                    <td className="py-3 pr-4">
                      <span className="font-semibold text-slate-900">
                        {sp.players.first_name} {sp.players.last_name}
                      </span>
                      {sp.is_captain && <Star size={12} className="inline ml-1 text-amber-500 fill-amber-500" />}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600">{sp.players.student_id}</td>
                    <td className="py-3 pr-4 text-slate-600">{sp.players.grade}</td>
                    <td className="py-3 pr-4 text-slate-600">{sp.players.enrollment_year}</td>
                    <td className="py-3 pr-4 text-slate-600">{sp.position}</td>
                    <td className="py-3">
                      {sp.school_verified
                        ? <span className="flex items-center gap-1 text-green-600 font-semibold text-xs"><CheckCircle size={14} /> Yes</span>
                        : <span className="flex items-center gap-1 text-red-500 font-semibold text-xs"><XCircle size={14} /> No</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-slate-400">No players in this squad.</p>
          )}
        </div>

        <div className="text-center text-xs text-slate-400">
          Barcode: <span className="font-mono">{barcode}</span> · ESSA Sports Management System
        </div>
      </div>
    </div>
  )
}
