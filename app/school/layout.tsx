import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import SchoolNav from '../../components/schools/SchoolNav'

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'school_admin') redirect('/login')

  return <SchoolNav>{children}</SchoolNav>
}
