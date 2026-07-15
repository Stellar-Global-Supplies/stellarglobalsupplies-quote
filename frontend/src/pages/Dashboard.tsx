import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileText, Users, TrendingUp, ArrowRight, Clock } from 'lucide-react'
import { api } from '@/lib/api'

export default function Dashboard() {
  const [quotes, setQuotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.quotes.list().then(q => { setQuotes(q); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const total = quotes.reduce((s, q) => s + (q.grand_total || 0), 0)
  const recent = quotes.slice(0, 5)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Stellar Global Supplies — Quote Manager</p>
        </div>
        <Link
          to="/quotes/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition shadow-md shadow-brand-500/20"
        >
          <Plus size={16} />
          New Quotation
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<FileText size={20} className="text-brand-500" />}
          label="Total Quotes"
          value={quotes.length}
          sub="All time"
        />
        <StatCard
          icon={<TrendingUp size={20} className="text-brand-500" />}
          label="Total Value"
          value={`₹${(total / 1000).toFixed(1)}K`}
          sub="Grand total across all"
        />
        <StatCard
          icon={<Clock size={20} className="text-brand-500" />}
          label="This Month"
          value={quotes.filter(q => {
            const d = new Date(q.created_at || '')
            const now = new Date()
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
          }).length}
          sub="Quotes generated"
        />
      </div>

      {/* Recent quotes */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="font-semibold text-ink">Recent Quotations</h2>
          <Link to="/quotes" className="text-sm text-brand-600 hover:underline flex items-center gap-1">
            View all <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No quotes yet</p>
            <p className="text-gray-400 text-sm mt-1">Create your first quotation to get started</p>
            <Link to="/quotes/new" className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-600 font-medium hover:underline">
              <Plus size={14} /> New Quote
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recent.map(q => (
              <Link
                key={q.id}
                to={`/quotes/${q.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-brand-500" />
                  </div>
                  <div>
                    <p className="font-medium text-ink text-sm">{q.quote_number}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {q.quote_customers?.company_name || '—'} · {formatDate(q.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-sm text-ink">
                      ₹{(q.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <StatusBadge status={q.status} />
                  </div>
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/quotes/new" className="bg-brand-500 hover:bg-brand-600 text-white rounded-2xl p-5 transition group">
          <Plus size={24} className="mb-3" />
          <p className="font-semibold">Create Quotation</p>
          <p className="text-brand-100 text-sm mt-1">Generate a new quote PDF</p>
        </Link>
        <Link to="/customers" className="bg-white border border-gray-200 hover:border-brand-300 rounded-2xl p-5 transition group">
          <Users size={24} className="text-brand-500 mb-3" />
          <p className="font-semibold text-ink">Manage Customers</p>
          <p className="text-gray-500 text-sm mt-1">View and edit saved customer data</p>
        </Link>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: any; sub: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-500',
    sent: 'bg-blue-50 text-blue-600',
    accepted: 'bg-green-50 text-green-600',
    rejected: 'bg-red-50 text-red-600',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || map.draft}`}>
      {status}
    </span>
  )
}

function formatDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
