import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { QuoteItem } from '@/lib/supabase'
import { api } from '@/lib/api'

const UNITS = ['NOS', 'KG', 'MTR', 'SQM', 'CFT', 'LTR', 'SET', 'PCS', 'LOT', 'BOX']

type SkuResult = { sku: string; material_type: string; hsn_sac: string | null }
type Props = { items: QuoteItem[]; onChange: (items: QuoteItem[]) => void }

function newItem(): QuoteItem {
  return {
    id: crypto.randomUUID(),
    description: '', hsn_sac: '', quantity: 1, unit: 'NOS', rate: 0, discount: 0, total: 0,
  }
}

function calcTotal(i: QuoteItem) {
  const base = i.quantity * i.rate
  return base - (base * i.discount) / 100
}

// ── SKU search dropdown — rendered in a portal so it never gets clipped ──────
function SkuDropdown({
  results, loading, query, onPick, anchorRef,
}: {
  results: SkuResult[]
  loading: boolean
  query: string
  onPick: (r: SkuResult) => void
  anchorRef: React.RefObject<HTMLDivElement>
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setPos({
      top:   rect.bottom + window.scrollY + 4,
      left:  rect.left   + window.scrollX,
      width: Math.max(rect.width, 320),
    })
  }, [query])

  if (!query.trim()) return null

  return (
    <div
      style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
    >
      {loading && (
        <div className="px-4 py-3 text-xs text-gray-400">Searching SKUs…</div>
      )}
      {!loading && results.length === 0 && (
        <div className="px-4 py-3 text-xs text-gray-400">No matching SKU — type freely</div>
      )}
      {results.map(r => (
        <button
          key={r.sku}
          onMouseDown={e => { e.preventDefault(); onPick(r) }}
          className="w-full text-left px-4 py-2.5 hover:bg-brand-50 border-b border-gray-100 last:border-0 transition-colors"
        >
          <p className="text-sm font-semibold text-ink">{r.sku}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-500">{r.material_type}</span>
            {r.hsn_sac && (
              <span className="text-xs font-mono text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                HSN {r.hsn_sac}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Per-row description/SKU cell ─────────────────────────────────────────────
function DescCell({ value, onSelect, onChange }: {
  value: string
  onSelect: (r: SkuResult) => void
  onChange: (v: string) => void
}) {
  const [query, setQuery]       = useState(value)
  const [results, setResults]   = useState<SkuResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [open, setOpen]         = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)

  // Sync when parent resets (e.g. load existing quote)
  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    if (!query.trim() || !open) { setResults([]); return }
    setLoading(true)
    const t = setTimeout(async () => {
      try { setResults(await api.skus.search(query)) } catch {}
      setLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query, open])

  const pick = (r: SkuResult) => {
    const desc = r.material_type ? `${r.sku}\n${r.material_type}` : r.sku
    setQuery(desc)
    setOpen(false)
    onSelect(r)
  }

  const handleChange = (v: string) => {
    setQuery(v)
    onChange(v)
    setOpen(true)
  }

  return (
    <div ref={anchorRef} className="relative w-full">
      <Search size={11} className="absolute left-2 top-3 text-gray-300 pointer-events-none" />
      <textarea
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        rows={2}
        className="w-full pl-6 pr-2 py-1.5 border border-transparent hover:border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-md outline-none text-sm resize-none transition"
        placeholder="Search SKU or type…"
      />
      {open && (
        <SkuDropdown
          results={results}
          loading={loading}
          query={query}
          onPick={pick}
          anchorRef={anchorRef}
        />
      )}
    </div>
  )
}

// ── Number input ─────────────────────────────────────────────────────────────
function Num({ value, onChange, step = '0.01', min = '0', max = '100', className = '' }: {
  value: number; onChange: (v: number) => void; step?: string; min?: string; max?: string; className?: string
}) {
  return (
    <input
      type="number" min={min} max={max} step={step} value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className={`w-full px-2 py-1.5 border border-transparent hover:border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-md outline-none text-sm text-right transition ${className}`}
    />
  )
}

// ── Main table ────────────────────────────────────────────────────────────────
export default function ItemsTable({ items, onChange }: Props) {
  const update = (id: string, patch: Partial<QuoteItem>) => {
    onChange(items.map(item => {
      if (item.id !== id) return item
      const u = { ...item, ...patch }
      u.total = calcTotal(u)
      return u
    }))
  }

  const handleSkuSelect = (id: string, r: SkuResult) => {
    update(id, {
      description: r.material_type ? `${r.sku}\n${r.material_type}` : r.sku,
      hsn_sac: r.hsn_sac || '',
    })
  }

  const addRow = () => onChange([...items, newItem()])
  const remove = (id: string) => { if (items.length > 1) onChange(items.filter(i => i.id !== id)) }

  return (
    <div>
      {/* 
        Key fix: NO overflow-x-auto on the table wrapper — instead we use 
        a layout where each row is a CSS grid so columns never clip the dropdown.
        The dropdown itself renders via absolute positioning relative to document.
      */}
      <div className="rounded-xl border border-gray-200 overflow-visible">
        {/* Header */}
        <div className="grid bg-brand-500 rounded-t-xl text-white text-xs font-semibold"
          style={{ gridTemplateColumns: '28px 28px 1fr 90px 70px 70px 80px 70px 80px 32px' }}>
          <div className="px-2 py-3" />
          <div className="px-2 py-3 text-center">#</div>
          <div className="px-3 py-3">Item / SKU Description</div>
          <div className="px-2 py-3 text-center">HSN/SAC</div>
          <div className="px-2 py-3 text-right">Qty</div>
          <div className="px-2 py-3 text-center">Unit</div>
          <div className="px-2 py-3 text-right">Rate (₹)</div>
          <div className="px-2 py-3 text-right">Disc%</div>
          <div className="px-2 py-3 text-right">Total (₹)</div>
          <div className="px-2 py-3" />
        </div>

        {/* Rows */}
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`grid items-start border-t border-gray-100 group ${idx % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'}`}
            style={{ gridTemplateColumns: '28px 28px 1fr 90px 70px 70px 80px 70px 80px 32px' }}
          >
            {/* Drag handle */}
            <div className="px-1 py-3 text-gray-300 cursor-grab flex items-start justify-center pt-3.5">
              <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                <circle cx="3" cy="3" r="1.5"/><circle cx="7" cy="3" r="1.5"/>
                <circle cx="3" cy="7" r="1.5"/><circle cx="7" cy="7" r="1.5"/>
                <circle cx="3" cy="11" r="1.5"/><circle cx="7" cy="11" r="1.5"/>
              </svg>
            </div>

            {/* # */}
            <div className="px-1 py-3 text-gray-400 text-xs text-center font-mono pt-3.5">{idx + 1}</div>

            {/* Description + SKU search */}
            <div className="px-2 py-2">
              <DescCell
                value={item.description}
                onChange={v => update(item.id, { description: v })}
                onSelect={r => handleSkuSelect(item.id, r)}
              />
            </div>

            {/* HSN/SAC */}
            <div className="px-2 py-2">
              <input
                type="text"
                value={item.hsn_sac}
                onChange={e => update(item.id, { hsn_sac: e.target.value })}
                className="w-full px-2 py-1.5 border border-transparent hover:border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-md outline-none text-xs transition text-center font-mono"
                placeholder="73181500"
              />
            </div>

            {/* Qty */}
            <div className="px-2 py-2">
              <Num value={item.quantity} onChange={v => update(item.id, { quantity: v })} />
            </div>

            {/* Unit */}
            <div className="px-2 py-2">
              <select
                value={item.unit}
                onChange={e => update(item.id, { unit: e.target.value })}
                className="w-full px-1 py-1.5 border border-transparent hover:border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-md outline-none text-sm bg-transparent transition"
              >
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>

            {/* Rate */}
            <div className="px-2 py-2">
              <Num value={item.rate} onChange={v => update(item.id, { rate: v })} />
            </div>

            {/* Discount */}
            <div className="px-2 py-2">
              <Num value={item.discount} onChange={v => update(item.id, { discount: v })} step="0.5" max="100" />
            </div>

            {/* Total */}
            <div className="px-2 py-3.5 text-right text-sm font-semibold text-brand-700 tabular-nums">
              {item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>

            {/* Delete */}
            <div className="px-1 py-3 flex justify-center pt-3.5">
              <button
                onClick={() => remove(item.id)}
                disabled={items.length === 1}
                className="p-1 text-gray-200 hover:text-red-400 disabled:opacity-0 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}

        {/* Last row rounded corners */}
        <div className="rounded-b-xl overflow-hidden h-1" />
      </div>

      <button
        onClick={addRow}
        className="mt-3 flex items-center gap-2 px-4 py-2 text-sm text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors font-medium"
      >
        <Plus size={15} />
        Add line item
      </button>
    </div>
  )
}
