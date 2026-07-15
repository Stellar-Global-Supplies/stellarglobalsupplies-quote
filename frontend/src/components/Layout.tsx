import { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { FileText, PlusSquare, LogOut, LayoutDashboard, Upload } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

const NAV = [
  { to: '/',               icon: LayoutDashboard, label: 'Dashboard',        end: true  },
  { to: '/quotes/new',     icon: PlusSquare,      label: 'New Quote',        end: false },
  { to: '/quotes',         icon: FileText,        label: 'All Quotes',       end: false },
  { to: '/import',         icon: Upload,          label: 'Import Customers', end: false },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
    toast.success('Signed out')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="w-52 flex flex-col shrink-0" style={{ background: '#0f1a14' }}>

        <div className="px-5 py-5 border-b border-white/10">
          <img src="/logo.png" alt="SGS" className="h-8 object-contain" />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <p className="text-xs text-gray-500 px-3 mb-2 truncate">{user?.email}</p>
          <button onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
