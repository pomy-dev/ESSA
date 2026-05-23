import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import ESSANav from '../../components/essa/ESSANAV'

export default async function ESSALayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'essa_admin') redirect('/login')

  return <ESSANav>{children}</ESSANav>
}
