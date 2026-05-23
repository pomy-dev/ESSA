'use client'
import DashboardLayout from '../../components/ui/DashboardLayout'
import { LayoutDashboard, Activity, Users, UserCheck, Settings } from 'lucide-react'

const navItems = [
  { href: '/school', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/school/activities', label: 'Sport Activities', icon: <Activity size={18} /> },
  { href: '/school/teachers', label: 'Teachers', icon: <Users size={18} /> },
  { href: '/school/players', label: 'Players', icon: <UserCheck size={18} /> },
  { href: '/school/settings', label: 'Settings', icon: <Settings size={18} /> },
]

export default function SchoolNav({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout
      navItems={navItems}
      title="School Admin"
      subtitle="ESSA Member School"
      accentColor="bg-emerald-800"
    >
      {children}
    </DashboardLayout>
  )
}
