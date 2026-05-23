import { createClient } from '../../../lib/supabase/server'
import AnnouncementsClient from '../../../components/essa/Announcements'

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const [{ data: announcements }, { data: schools }] = await Promise.all([
    supabase.from('announcements').select('*').order('created_at', { ascending: false }),
    supabase.from('schools').select('id, name').eq('is_active', true).order('name'),
  ])
  return <AnnouncementsClient initialAnnouncements={announcements ?? []} schools={schools ?? []} />
}
