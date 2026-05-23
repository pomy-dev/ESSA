import { createClient } from '../../../lib/supabase/server'
import TeachersClient from '../../../components/schools/TeachersClient'

export default async function TeachersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user!.id).maybeSingle()
  const schoolId = profile?.school_id
  if (!schoolId) return <div className="text-slate-500">No school assigned.</div>

  const { data: teachers } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, must_change_password, created_at')
    .eq('school_id', schoolId)
    .eq('role', 'teacher')
    .order('full_name')

  return <TeachersClient initialTeachers={teachers ?? []} schoolId={schoolId} />
}
