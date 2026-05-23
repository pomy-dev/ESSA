import { redirect } from 'next/navigation'
import { createClient } from '../lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) redirect('/login')

  switch (profile.role) {
    case 'essa_admin': redirect('/essa')
    case 'school_admin': redirect('/school')
    case 'teacher': redirect('/teacher')
    default: redirect('/login')
  }
}
