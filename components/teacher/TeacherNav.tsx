'use client'
import DashboardLayout from '../../components/ui/DashboardLayout'
import { LayoutDashboard, Activity, UserCheck, Users, Settings } from 'lucide-react'

const navItems = [
  { href: '/teacher', label: 'My Activities', icon: <LayoutDashboard size={18} /> },
  { href: '/teacher/players', label: 'Players', icon: <UserCheck size={18} /> },
  { href: '/teacher/squad', label: 'Squad Selection', icon: <Users size={18} /> },
  { href: '/teacher/settings', label: 'Settings', icon: <Settings size={18} /> },
]

export default function TeacherNav({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout
      navItems={navItems}
      title="Teacher"
      subtitle="Sports Coach"
      accentColor="bg-amber-700"
    >
      {children}
    </DashboardLayout>
  )
}
