import { createClient } from '../../../lib/supabase/server'
import ActivitiesClient from '../../../components/schools/ActivitiesClient'

export default async function ActivitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user!.id).maybeSingle()
  const schoolId = profile?.school_id

  if (!schoolId) return <div className="text-slate-500">No school assigned.</div>

  const [{ data: activities }, { data: teachers }] = await Promise.all([
    supabase.from('sport_activities').select('*, profiles!sport_activities_teacher_id_fkey(full_name, email)').eq('school_id', schoolId).order('name'),
    supabase.from('profiles').select('id, full_name, email').eq('school_id', schoolId).eq('role', 'teacher'),
  ])

  return <ActivitiesClient initialActivities={activities ?? []} teachers={teachers ?? []} schoolId={schoolId} />
}
