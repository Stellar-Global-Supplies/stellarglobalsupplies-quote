import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, GripVertical, Search } from 'lucide-react'
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

function calcTotal(item: QuoteItem): number {
  const base = item.quantity * item.rate
  return base - (base * item.discount) / 100
}

// ── Per-row SKU autocomplete ──────────────────────────────────────────────────
function SkuCell({
  value, onSelect
}: {
  value: string
  onSelect: (sku: SkuResult) => void
}) {
  const [input, setInput] = useState(value)
  const [results, setResults] = useState<SkuResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Sync if parent resets
  useEffect(() => { setInput(value) }, [value])

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!input.trim()) { setResults([]); return }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const data = await api.skus.search(input)
        setResults(data)
      } catch {}
      setLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [input])

  const pick = (sku: SkuResult) => {
    setInput(sku.sku)
    setOpen(false)
    setResults([])
    onSelect(sku)
  }

  return (
    <div className="relative min-w-[220px]" ref={ref}>
      <div className="relative">
        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
        <textarea
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true) }}
          onFocus={() => input && setOpen(true)}
          rows={2}
          className="w-full pl-6 pr-2 py-1.5 border border-transparent hover:border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-md outline-none text-sm resize-none transition"
          placeholder="Search SKU or type description…"
        />
      </div>

      {open && (input.trim().length > 0) && (
        <div className="absolute z-50 left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {loading && (
            <div className="px-3 py-2.5 text-xs text-gray-400">Searching SKUs…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2.5 text-xs text-gray-400">No matching SKU — continue typing freely</div>
          )}
          {results.map(r => (
            <button
              key={r.sku}
              onMouseDown={() => pick(r)}
              className="w-full text-left px-3 py-2.5 hover:bg-brand-50 border-b border-gray-100 last:border-0 transition-colors"
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
      )}
    </div>
  )
}

// ── Main table ────────────────────────────────────────────────────────────────
export default function ItemsTable({ items, onChange }: Props) {
  const update = (id: string, patch: Partial<QuoteItem>) => {
    onChange(items.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, ...patch }
      updated.total = calcTotal(updated)
      return updated
    }))
  }

  const handleSkuSelect = (id: string, sku: SkuResult) => {
    // Fill description = sku name, material_type sub-line, and hsn_sac
    const description = sku.material_type
      ? `${sku.sku}\n${sku.material_type}`
      : sku.sku
    update(id, {
      description,
      hsn_sac: sku.hsn_sac || '',
    })
  }

  const addRow = () => onChange([...items, newItem()])
  const remove = (id: string) => {
    if (items.length === 1) return
    onChange(items.filter(i => i.id !== id))
  }

  const num = (id: string, field: keyof QuoteItem) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      update(id, { [field]: parseFloat(e.target.value) || 0 })

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-500 text-white">
              <th className="px-2 py-2.5 w-6"></th>
              <th className="px-2 py-2.5 text-center text-xs font-semibold w-7">#</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Item / SKU Description</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold w-28">HSN / SAC</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold w-20">Qty</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold w-20">Unit</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold w-24">Rate (₹)</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold w-20">Disc %</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold w-28">Total (₹)</th>
              <th className="px-2 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <tr key={item.id} className={`hover:bg-gray-50/50 group ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                <td className="px-2 py-2 text-gray-300 cursor-grab">
                  <GripVertical size={14} />
                </td>
                <td className="px-2 py-2 text-gray-400 text-center font-mono text-xs font-medium">
                  {idx + 1}
                </td>

                {/* SKU / Description cell */}
                <td className="px-3 py-2">
                  <SkuCell
                    value={item.description}
                    onSelect={sku => handleSkuSelect(item.id, sku)}
                  />
                </td>

                {/* HSN/SAC — auto-filled from SKU, still editable */}
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.hsn_sac}
                    onChange={e => update(item.id, { hsn_sac: e.target.value })}
                    className="w-full px-2 py-1.5 border border-transparent hover:border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-md outline-none text-sm transition text-center font-mono"
                    placeholder="73181500"
                  />
                </td>

                <td className="px-3 py-2">
                  <input type="number" min="0" step="0.01" value={item.quantity}
                    onChange={num(item.id, 'quantity')}
                    className="w-full px-2 py-1.5 border border-transparent hover:border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-md outline-none text-sm text-right transition" />
                </td>

                <td className="px-3 py-2">
                  <select value={item.unit} onChange={e => update(item.id, { unit: e.target.value })}
                    className="w-full px-2 py-1.5 border border-transparent hover:border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-md outline-none text-sm bg-transparent transition">
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </td>

                <td className="px-3 py-2">
                  <input type="number" min="0" step="0.01" value={item.rate}
                    onChange={num(item.id, 'rate')}
                    className="w-full px-2 py-1.5 border border-transparent hover:border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-md outline-none text-sm text-right transition" />
                </td>

                <td className="px-3 py-2">
                  <input type="number" min="0" max="100" step="0.5" value={item.discount}
                    onChange={num(item.id, 'discount')}
                    className="w-full px-2 py-1.5 border border-transparent hover:border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-md outline-none text-sm text-right transition" />
                </td>

                <td className="px-3 py-2 text-right font-semibold text-brand-700 tabular-nums text-sm">
                  ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>

                <td className="px-2 py-2">
                  <button onClick={() => remove(item.id)} disabled={items.length === 1}
                    className="p-1 text-gray-300 hover:text-red-400 disabled:opacity-20 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={addRow}
        className="mt-3 flex items-center gap-2 px-4 py-2 text-sm text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors font-medium">
        <Plus size={15} />
        Add line item
      </button>
    </div>
  )
}
