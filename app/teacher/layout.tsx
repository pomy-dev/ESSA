import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import TeacherNav from '../../components/teacher/TeacherNav'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'teacher') redirect('/login')

  return <TeacherNav>{children}</TeacherNav>
}
