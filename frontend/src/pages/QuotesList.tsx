import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, FileText, ArrowRight, Share2 } from 'lucide-react'
import { api } from '@/lib/api'
import { generateQuotePDF } from '@/utils/generatePDF'
import ShareModal from '@/components/ShareModal'

export default function QuotesList() {
  const [quotes, setQuotes] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState<{ quote: any; customer: any; pdf: string } | null>(null)

  const load = async (q = '') => {
    setLoading(true)
    try { setQuotes(await api.quotes.list(q)) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const t = setTimeout(() => load(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const openShare = (q: any) => {
    const customer = q.quote_customers || {}
    const quoteObj = { ...q, items: typeof q.items === 'string' ? JSON.parse(q.items) : q.items }
    const pdf = generateQuotePDF(quoteObj, customer)
    setSharing({ quote: quoteObj, customer, pdf })
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">All Quotations</h1>
          <p className="text-gray-500 text-sm mt-0.5">{quotes.length} quote{quotes.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          to="/quotes/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition shadow-md shadow-brand-500/20"
        >
          <Plus size={16} /> New Quote
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by quote number…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quote #</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiry</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Grand Total</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : quotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <FileText size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No quotations found</p>
                </td>
              </tr>
            ) : quotes.map(q => (
              <tr key={q.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-5 py-3.5 font-mono font-medium text-ink">{q.quote_number}</td>
                <td className="px-5 py-3.5 text-gray-700">{q.quote_customers?.company_name || '—'}</td>
                <td className="px-5 py-3.5 text-gray-500">{fmt(q.date)}</td>
                <td className="px-5 py-3.5 text-gray-500">{fmt(q.expiry_date)}</td>
                <td className="px-5 py-3.5 text-right font-semibold text-ink tabular-nums">
                  ₹{(q.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(q.status)}`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openShare(q)}
                      className="p-1.5 hover:bg-brand-50 text-gray-400 hover:text-brand-500 rounded-lg transition"
                      title="Share"
                    >
                      <Share2 size={14} />
                    </button>
                    <Link
                      to={`/quotes/${q.id}`}
                      className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-ink rounded-lg transition"
                      title="Edit"
                    >
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sharing && (
        <ShareModal
          quote={sharing.quote}
          customer={sharing.customer}
          pdfBase64={sharing.pdf}
          onClose={() => setSharing(null)}
        />
      )}
    </div>
  )
}

function fmt(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function statusColor(s: string) {
  return { draft: 'bg-gray-100 text-gray-500', sent: 'bg-blue-50 text-blue-600', accepted: 'bg-green-50 text-green-600', rejected: 'bg-red-50 text-red-600' }[s] || 'bg-gray-100 text-gray-500'
}
