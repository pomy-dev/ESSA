import { createClient } from '../../../lib/supabase/server'
import Card from '../../../components/ui/Card'
import Badge from '../../../components/ui/Badge'
import { format } from 'date-fns'
import { History } from 'lucide-react'
import type { Json } from '../../../types/database'

interface PlayerUpdateWithRelations {
  id: string
  created_at: string
  update_reason: string | null
  verification_code_used: string | null
  old_data: Json | null
  new_data: Json | null
  players?: {
    first_name: string
    last_name: string
    student_id: string
    schools?: { name: string } | null
  } | null
  profiles?: {
    full_name: string
    role: string
  } | null
}

export default async function PlayerUpdatesPage() {
  const supabase = await createClient()
  const { data: updates } = await supabase
    .from('player_updates')
    .select(`
      *,
      players(first_name, last_name, student_id, schools(name)),
      profiles!player_updates_updated_by_fkey(full_name, role)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Player Update Audit Log</h1>
        <p className="text-slate-500 mt-1">Track all changes made to student-player records</p>
      </div>

      {updates && updates.length > 0 ? (
        <div className="flex flex-col gap-3">
          {(updates as PlayerUpdateWithRelations[]).map(u => (
            <Card key={u.id} padding={false}>
              <div className="flex items-start gap-4 p-4">
                <div className="p-2.5 bg-amber-100 rounded-xl shrink-0">
                  <History className="text-amber-600" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">
                      {u.players?.first_name} {u.players?.last_name}
                    </span>
                    <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                      {u.players?.student_id}
                    </span>
                    <Badge
                      label={u.profiles?.role === 'school_admin' ? 'School Admin' : 'Teacher'}
                      variant="info"
                    />
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    Updated by <strong>{u.profiles?.full_name}</strong>
                    {u.players?.schools?.name && ` · ${u.players.schools.name}`}
                  </div>
                  {u.update_reason && (
                    <div className="text-sm text-slate-500 mt-0.5">Reason: {u.update_reason}</div>
                  )}
                  {u.verification_code_used && (
                    <div className="text-xs text-slate-400 mt-0.5 font-mono">
                      Verification code used: {u.verification_code_used}
                    </div>
                  )}
                  <div className="text-xs text-slate-400 mt-1">
                    {format(new Date(u.created_at), 'dd MMM yyyy, HH:mm')}
                  </div>
                </div>
                <div className="text-xs text-right shrink-0">
                  {u.old_data && u.new_data && (
                    <details className="text-left">
                      <summary className="cursor-pointer text-blue-600 hover:underline text-xs">View changes</summary>
                      <div className="mt-2 flex gap-3">
                        <div className="bg-red-50 rounded p-2 text-xs font-mono max-w-xs overflow-auto">
                          <div className="font-semibold text-red-600 mb-1">Before</div>
                          <pre>{JSON.stringify(u.old_data, null, 2)}</pre>
                        </div>
                        <div className="bg-green-50 rounded p-2 text-xs font-mono max-w-xs overflow-auto">
                          <div className="font-semibold text-green-600 mb-1">After</div>
                          <pre>{JSON.stringify(u.new_data, null, 2)}</pre>
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-500">No player updates recorded yet.</div>
      )}
    </div>
  )
}
