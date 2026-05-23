'use client'
import DashboardLayout from '../../components/ui/DashboardLayout'
import { LayoutDashboard, School, CalendarDays, Megaphone, History } from 'lucide-react'

const navItems = [
  { href: '/essa', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/essa/schools', label: 'Schools', icon: <School size={18} /> },
  { href: '/essa/draws', label: 'Draws & Fixtures', icon: <CalendarDays size={18} /> },
  { href: '/essa/announcements', label: 'Announcements', icon: <Megaphone size={18} /> },
  { href: '/essa/player-updates', label: 'Player Updates', icon: <History size={18} /> },
]

export default function ESSANav({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout
      navItems={navItems}
      title="ESSA"
      subtitle="Sports Management"
      accentColor="bg-blue-800"
    >
      {children}
    </DashboardLayout>
  )
}
