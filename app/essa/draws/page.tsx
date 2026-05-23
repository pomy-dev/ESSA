import { createClient } from '../../../lib/supabase/server'
import DrawsClient from '../../../components/essa/DrawsClient'

export default async function DrawsPage() {
  const supabase = await createClient()
  const [{ data: draws }, { data: schools }] = await Promise.all([
    supabase.from('draws').select('*').order('created_at', { ascending: false }),
    supabase.from('schools').select('id, name, code').eq('is_active', true).order('name'),
  ])
  return <DrawsClient initialDraws={draws ?? []} schools={schools ?? []} />
}
