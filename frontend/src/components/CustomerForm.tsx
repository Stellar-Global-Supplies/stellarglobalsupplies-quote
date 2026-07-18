import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, User } from 'lucide-react'
import { Customer } from '@/lib/supabase'
import { api } from '@/lib/api'

const INDIAN_STATES = [
  { name: 'Andhra Pradesh', code: '28' }, { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Assam', code: '18' }, { name: 'Bihar', code: '10' },
  { name: 'Chhattisgarh', code: '22' }, { name: 'Goa', code: '30' },
  { name: 'Gujarat', code: '24' }, { name: 'Haryana', code: '06' },
  { name: 'Himachal Pradesh', code: '02' }, { name: 'Jharkhand', code: '20' },
  { name: 'Karnataka', code: '29' }, { name: 'Kerala', code: '32' },
  { name: 'Madhya Pradesh', code: '23' }, { name: 'Maharashtra', code: '27' },
  { name: 'Manipur', code: '14' }, { name: 'Meghalaya', code: '17' },
  { name: 'Mizoram', code: '15' }, { name: 'Nagaland', code: '13' },
  { name: 'Odisha', code: '21' }, { name: 'Punjab', code: '03' },
  { name: 'Rajasthan', code: '08' }, { name: 'Sikkim', code: '11' },
  { name: 'Tamil Nadu', code: '33' }, { name: 'Telangana', code: '36' },
  { name: 'Tripura', code: '16' }, { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' }, { name: 'West Bengal', code: '19' },
  { name: 'Delhi', code: '07' }, { name: 'Jammu & Kashmir', code: '01' },
  { name: 'Ladakh', code: '38' }, { name: 'Puducherry', code: '34' },
]

type Props = {
  value: Customer
  onChange: (c: Customer) => void
  savedId?: string
  onSavedIdChange?: (id: string | undefined) => void
}

export default function CustomerForm({ value, onChange, savedId, onSavedIdChange }: Props) {
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<Customer[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Auto-fill state code from GST number
  useEffect(() => {
    if (value.gst_number && value.gst_number.length >= 2) {
      const code = value.gst_number.substring(0, 2)
      const state = INDIAN_STATES.find(s => s.code === code)
      if (state && value.state !== state.name) {
        onChange({ ...value, state: state.name, state_code: code })
      }
    }
  }, [value.gst_number])

  // Search existing customers
  useEffect(() => {
    if (!search.trim()) { setSuggestions([]); return }
    setLoadingSuggestions(true)
    const timer = setTimeout(async () => {
      try {
        const data = await api.customers.list(search)
        setSuggestions(data)
      } catch {}
      setLoadingSuggestions(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectCustomer = (c: Customer) => {
    onChange(c)
    if (onSavedIdChange) onSavedIdChange(c.id)
    setSearch(c.company_name)
    setShowDropdown(false)
    setSuggestions([])
  }

  const clearCustomer = () => {
    onChange({
      company_name: '', gst_number: '', address: '', city: '',
      pin_code: '', state: '', state_code: '', contact_person: '',
      contact_number: '', email: ''
    })
    if (onSavedIdChange) onSavedIdChange(undefined)
    setSearch('')
  }

  const set = (field: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    onChange({ ...value, [field]: e.target.value })
    if (onSavedIdChange) onSavedIdChange(undefined) // mark as modified
  }

  return (
    <div className="space-y-4">
      {/* Search existing */}
      <div className="relative" ref={dropdownRef}>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          Search Existing Customer
        </label>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDropdown(true) }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Type company name to reuse saved customer…"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition text-sm"
          />
          {savedId && (
            <button onClick={clearCustomer} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-600 hover:underline">
              Clear
            </button>
          )}
        </div>

        {showDropdown && (search || suggestions.length > 0) && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            {loadingSuggestions && (
              <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>
            )}
            {!loadingSuggestions && suggestions.length === 0 && search && (
              <div className="px-4 py-3 text-sm text-gray-500">No saved customers found — fill in below</div>
            )}
            {suggestions.map(c => (
              <button
                key={c.id}
                onMouseDown={() => selectCustomer(c)}
                className="w-full text-left px-4 py-3 hover:bg-brand-50 transition-colors border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <User size={14} className="text-brand-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-ink">{c.company_name}</p>
                    <p className="text-xs text-gray-500">{c.gst_number} · {c.city}, {c.state}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {savedId ? '✓ Customer loaded — edit if needed' : 'Customer Details'}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Company Name *" value={value.company_name} onChange={set('company_name')} placeholder="Instant Procurement Services Pvt. Ltd." />
          </div>

          <Field label="GST Number" value={value.gst_number} onChange={set('gst_number')} placeholder="27AADCI9794D1Z6" upper />
          <Field label="State Code" value={value.state_code} onChange={set('state_code')} placeholder="27" readOnly />

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Address *</label>
            <textarea
              value={value.address}
              onChange={set('address') as any}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition text-sm resize-none"
              placeholder="Plot No, Street, Industrial Area…"
            />
          </div>

          <Field label="City" value={value.city} onChange={set('city')} placeholder="Pune" />
          <Field label="PIN Code" value={value.pin_code} onChange={set('pin_code')} placeholder="411026" />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">State *</label>
            <div className="relative">
              <select
                value={value.state}
                onChange={set('state')}
                className="w-full appearance-none px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition text-sm bg-white pr-8"
              >
                <option value="">Select state…</option>
                {INDIAN_STATES.map(s => (
                  <option key={s.code} value={s.name}>{s.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <Field label="Contact Number" value={value.contact_number || ''} onChange={set('contact_number')} placeholder="8554098977" />
          <Field label="Contact Person" value={value.contact_person || ''} onChange={set('contact_person')} placeholder="Name" />
          <Field label="Email" value={value.email || ''} onChange={set('email')} placeholder="buyer@company.com" type="email" />
        </div>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, readOnly, upper, type = 'text'
}: {
  label: string; value: string; onChange: (e: any) => void
  placeholder?: string; readOnly?: boolean; upper?: boolean; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        style={upper ? { textTransform: 'uppercase' } : {}}
        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition ${
          readOnly
            ? 'bg-gray-50 border-gray-100 text-gray-500 cursor-default'
            : 'border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
        }`}
      />
    </div>
  )
}
