import { useEffect, useState } from 'react'
import { Search, Users, Building2, Phone, Mail, MapPin } from 'lucide-react'
import { api } from '@/lib/api'

export default function CustomersList() {
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async (q = '') => {
    setLoading(true)
    try { setCustomers(await api.customers.list(q)) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const t = setTimeout(() => load(search), 300)
    return () => clearTimeout(t)
  }, [search])

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Customers</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Quote customers — auto-filled when creating new quotes
        </p>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by company name…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16">
          <Users size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No customers yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Customers are saved automatically when you create a quotation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {customers.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-brand-300 hover:shadow-card-hover transition-all">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-brand-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{c.company_name}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{c.gst_number}</p>
                </div>
              </div>

              <div className="space-y-1.5 text-sm text-gray-500">
                {c.address && (
                  <div className="flex items-start gap-2">
                    <MapPin size={13} className="shrink-0 mt-0.5 text-gray-400" />
                    <span className="line-clamp-2 text-xs">{c.address}{c.city ? `, ${c.city}` : ''} — {c.state} {c.pin_code}</span>
                  </div>
                )}
                {c.contact_number && (
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-gray-400" />
                    <span className="text-xs">{c.contact_number}</span>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="text-gray-400" />
                    <span className="text-xs truncate">{c.email}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">State code: {c.state_code}</span>
                <span className="text-xs text-brand-600 font-medium">
                  {c.contact_person || ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
