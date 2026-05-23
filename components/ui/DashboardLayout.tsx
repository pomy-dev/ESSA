'use client'
import { type ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { LogOut, Menu, X, Shield } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: ReactNode
}

interface DashboardLayoutProps {
  children: ReactNode
  navItems: NavItem[]
  title: string
  subtitle: string
  accentColor?: string
}

export default function DashboardLayout({
  children,
  navItems,
  title,
  subtitle,
  accentColor = 'bg-blue-700',
}: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const NavLinks = () => (
    <>
      {navItems.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
              ${active
                ? 'bg-white/15 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
          >
            {item.icon}
            {item.label}
          </Link>
        )
      })}
    </>
  )

  return (
    <div className="min-h-screen flex">
      {/* Sidebar - desktop */}
      <aside className={`hidden lg:flex flex-col w-64 ${accentColor} shrink-0`}>
        <div className="px-6 py-5 border-b border-white/20">
          <div className="flex items-center gap-3">
            <Shield className="text-white" size={28} />
            <div>
              <div className="text-white font-bold text-lg leading-tight">{title}</div>
              <div className="text-white/60 text-xs">{subtitle}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          <NavLinks />
        </nav>
        <div className="px-3 py-4 border-t border-white/20">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all w-full"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className={`relative flex flex-col w-72 ${accentColor}`}>
            <div className="px-6 py-5 border-b border-white/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="text-white" size={24} />
                <div className="text-white font-bold">{title}</div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-white/70 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
              <NavLinks />
            </nav>
            <div className="px-3 py-4 border-t border-white/20">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all w-full"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className={`lg:hidden flex items-center justify-between px-4 py-3 ${accentColor} text-white`}>
          <button onClick={() => setMobileOpen(true)}>
            <Menu size={24} />
          </button>
          <div className="font-bold">{title}</div>
          <div className="w-6" />
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
