import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Search, FileText, ArrowRight, Share2,
  Pencil, Trash2, X, ChevronDown, CheckCircle2,
  SendHorizonal, ThumbsUp, ThumbsDown, Clock
} from 'lucide-react'
import { api } from '@/lib/api'
import { generateQuotePDF } from '@/utils/generatePDF'
import ShareModal from '@/components/ShareModal'
import toast from 'react-hot-toast'

type Status = 'draft' | 'sent' | 'accepted' | 'rejected'

const STATUS_OPTIONS: { value: Status; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  { value: 'draft',    label: 'Draft',    icon: <Clock size={13} />,           color: 'text-gray-500',  bg: 'bg-gray-100' },
  { value: 'sent',     label: 'Sent',     icon: <SendHorizonal size={13} />,   color: 'text-blue-600',  bg: 'bg-blue-50'  },
  { value: 'accepted', label: 'Accepted', icon: <ThumbsUp size={13} />,        color: 'text-green-600', bg: 'bg-green-50' },
  { value: 'rejected', label: 'Rejected', icon: <ThumbsDown size={13} />,      color: 'text-red-500',   bg: 'bg-red-50'   },
]

function StatusPill({
  quoteId, current, onChange
}: { quoteId: string; current: Status; onChange: (s: Status) => void }) {
  const [open, setOpen]     = useState(false)
  const [busy, setBusy]     = useState(false)
  const opt = STATUS_OPTIONS.find(s => s.value === current) || STATUS_OPTIONS[0]

  const pick = async (s: Status) => {
    if (s === current) { setOpen(false); return }
    setBusy(true)
    try {
      await api.quotes.updateStatus(quoteId, s)
      onChange(s)
      toast.success(`Marked as ${s}`)
    } catch (err: any) {
      toast.error(err.message || 'Update failed')
    }
    setBusy(false)
    setOpen(false)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all
          ${opt.bg} ${opt.color} hover:opacity-80 disabled:opacity-50 cursor-pointer`}
      >
        {busy
          ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          : opt.icon
        }
        {opt.label}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden w-36">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s.value}
                onClick={() => pick(s.value)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium hover:bg-gray-50 transition-colors
                  ${s.value === current ? 'bg-gray-50' : ''} ${s.color}`}
              >
                {s.icon}
                {s.label}
                {s.value === current && <CheckCircle2 size={11} className="ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function QuotesList() {
  const [quotes, setQuotes]             = useState<any[]>([])
  const [search, setSearch]             = useState('')
  const [loading, setLoading]           = useState(true)
  const [sharing, setSharing]           = useState<{ quote: any; customer: any; pdf: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null)
  const [deleting, setDeleting]         = useState(false)

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
    const quoteObj = { ...q, items: typeof q.items === 'string' ? JSON.parse(q.items) : (q.items || []) }
    setSharing({ quote: quoteObj, customer, pdf: generateQuotePDF(quoteObj, customer) })
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await api.quotes.delete(confirmDelete.id)
      setQuotes(prev => prev.filter(q => q.id !== confirmDelete.id))
      toast.success(`${confirmDelete.quote_number} deleted`)
      setConfirmDelete(null)
    } catch (err: any) {
      toast.error(err.message || 'Delete failed')
    }
    setDeleting(false)
  }

  const handleStatusChange = (id: string, status: Status) => {
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, status } : q))
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">All Quotations</h1>
          <p className="text-gray-500 text-sm mt-0.5">{quotes.length} quote{quotes.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/quotes/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition shadow-md shadow-brand-500/20">
          <Plus size={16} /> New Quote
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by quote number or customer…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition" />
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
              <th className="px-4 py-3 w-24 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
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
              <tr key={q.id} className="hover:bg-gray-50/60 transition-colors group">
                <td className="px-5 py-3.5 font-mono font-semibold text-ink text-xs">{q.quote_number}</td>
                <td className="px-5 py-3.5 text-gray-700">{q.quote_customers?.company_name || '—'}</td>
                <td className="px-5 py-3.5 text-gray-500 text-xs">{fmt(q.date)}</td>
                <td className="px-5 py-3.5 text-gray-500 text-xs">{fmt(q.expiry_date)}</td>
                <td className="px-5 py-3.5 text-right font-semibold text-ink tabular-nums text-sm">
                  Rs.{(q.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                {/* Clickable status pill with dropdown */}
                <td className="px-5 py-3.5 text-center">
                  <StatusPill
                    quoteId={q.id}
                    current={q.status as Status}
                    onChange={s => handleStatusChange(q.id, s)}
                  />
                </td>
                {/* Action buttons — always visible (not just on hover) for usability */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => openShare(q)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-50 transition"
                      title="Share PDF">
                      <Share2 size={14} />
                    </button>
                    <Link to={`/quotes/${q.id}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-ink hover:bg-gray-100 transition"
                      title="Edit">
                      <Pencil size={14} />
                    </Link>
                    <button onClick={() => setConfirmDelete(q)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                      title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Share modal */}
      {sharing && (
        <ShareModal
          quote={sharing.quote}
          customer={sharing.customer}
          pdfBase64={sharing.pdf}
          onClose={() => setSharing(null)}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <button onClick={() => setConfirmDelete(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition text-gray-400">
                <X size={16} />
              </button>
            </div>
            <h2 className="font-semibold text-ink text-lg mb-1">Delete Quotation?</h2>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">{confirmDelete.quote_number}</span>
              {' '}— {confirmDelete.quote_customers?.company_name || 'Unknown customer'}
            </p>
            <p className="text-sm text-gray-400 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 rounded-xl transition">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function fmt(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
