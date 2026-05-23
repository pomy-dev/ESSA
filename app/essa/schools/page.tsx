import { createClient } from '../../../lib/supabase/server'
import SchoolsClient from '../../../components/essa/SchoolsClient'

export default async function SchoolsPage() {
  const supabase = await createClient()
  const { data: schools } = await supabase
    .from('schools')
    .select('*, profiles!schools_admin_id_fkey(full_name, email)')
    .order('name')

  return <SchoolsClient initialSchools={schools ?? []} />
}
