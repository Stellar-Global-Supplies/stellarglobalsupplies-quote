import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, Eye, Share2, ArrowLeft, RefreshCw } from 'lucide-react'
import { addDays, format } from 'date-fns'
import toast from 'react-hot-toast'

import CustomerForm from '@/components/CustomerForm'
import ItemsTable from '@/components/ItemsTable'
import ShareModal from '@/components/ShareModal'
import { Customer, Quote, QuoteItem } from '@/lib/supabase'
import { api } from '@/lib/api'
import { generateQuotePDF } from '@/utils/generatePDF'

const EMPTY_CUSTOMER: Customer = {
  company_name: '', gst_number: '', address: '', city: '',
  pin_code: '', state: '', state_code: '', contact_person: '',
  contact_number: '', email: '',
}

const EMPTY_ITEM: QuoteItem = {
  id: crypto.randomUUID(),
  description: '', hsn_sac: '', quantity: 1, unit: 'NOS', rate: 0, discount: 0, total: 0,
}

function calcTotals(items: QuoteItem[], igstRate: number, cgstRate: number, sgstRate: number) {
  const subTotal = items.reduce((s, i) => s + i.total, 0)
  const igstAmount = (subTotal * igstRate) / 100
  const cgstAmount = (subTotal * cgstRate) / 100
  const sgstAmount = (subTotal * sgstRate) / 100
  return { subTotal, igstAmount, cgstAmount, sgstAmount, grandTotal: subTotal + igstAmount + cgstAmount + sgstAmount }
}

export default function QuoteEditor() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const today  = format(new Date(), 'yyyy-MM-dd')
  const expiry = format(addDays(new Date(), 15), 'yyyy-MM-dd')

  const [customer, setCustomer]     = useState<Customer>(EMPTY_CUSTOMER)
  const [customerId, setCustomerId] = useState<string | undefined>()
  const [items, setItems]           = useState<QuoteItem[]>([{ ...EMPTY_ITEM }])
  const [quoteNumber, setQuoteNumber] = useState('')
  const [date, setDate]             = useState(today)
  const [expiryDate, setExpiryDate] = useState(expiry)
  const [notes, setNotes]           = useState('')
  const [igstRate, setIgstRate]     = useState(0)
  const [cgstRate, setCgstRate]     = useState(9)
  const [sgstRate, setSgstRate]     = useState(9)
  const [saving, setSaving]         = useState(false)
  const [pdfB64, setPdfB64]         = useState<string | null>(null)
  const [showShare, setShowShare]   = useState(false)
  const [savedQuote, setSavedQuote] = useState<Quote | null>(null)

  const totals = calcTotals(items, igstRate, cgstRate, sgstRate)

  const buildPayload = () => ({
    // Customer travels with the quote — Lambda upserts it automatically
    customer,
    quote_number: quoteNumber || undefined,
    date,
    expiry_date: expiryDate,
    items,
    sub_total: totals.subTotal,
    igst_rate: igstRate,
    cgst_rate: cgstRate,
    sgst_rate: sgstRate,
    igst_amount: totals.igstAmount,
    cgst_amount: totals.cgstAmount,
    sgst_amount: totals.sgstAmount,
    grand_total: totals.grandTotal,
    notes,
    status: 'draft' as const,
  })

  const validate = () => {
    if (!customer.company_name.trim()) { toast.error('Enter customer company name'); return false }
    if (!customer.gst_number.trim())   { toast.error('Enter customer GST number'); return false }
    if (!customer.address.trim())      { toast.error('Enter customer address'); return false }
    if (items.every(i => !i.description.trim())) { toast.error('Add at least one item'); return false }
    return true
  }

  // Save — customer auto-saved inside the same API call
  const handleSave = async (): Promise<Quote | null> => {
    if (!validate()) return null
    setSaving(true)
    try {
      const res = await api.quotes.save(buildPayload())
      const saved: Quote = {
        ...buildPayload(),
        quote_number: res.quote.quote_number || quoteNumber,
        customer_id: res.customer_id,
        id: res.quote.id,
        status: 'draft',
        // Rebuild proper shape for PDF
        sub_total: totals.subTotal,
        igst_amount: totals.igstAmount,
        cgst_amount: totals.cgstAmount,
        sgst_amount: totals.sgstAmount,
        grand_total: totals.grandTotal,
      }
      if (res.quote.quote_number) setQuoteNumber(res.quote.quote_number)
      if (res.customer_id) setCustomerId(res.customer_id)
      setSavedQuote(saved)
      toast.success(`Quote ${saved.quote_number} saved — customer auto-saved too`)
      return saved
    } catch (err: any) {
      toast.error(err.message || 'Save failed')
      return null
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = () => {
    if (!customer.company_name) { toast.error('Enter customer name first'); return }
    const q: Quote = {
      ...buildPayload(),
      quote_number: quoteNumber || 'DRAFT',
      customer_id: customerId || '',
      sub_total: totals.subTotal,
      igst_amount: totals.igstAmount,
      cgst_amount: totals.cgstAmount,
      sgst_amount: totals.sgstAmount,
      grand_total: totals.grandTotal,
      status: 'draft',
    }
    const b64 = generateQuotePDF(q, customer)
    const win = window.open()
    win?.document.write(
      `<html><body style="margin:0"><iframe src="data:application/pdf;base64,${b64}" width="100%" height="100%" style="border:none;height:100vh"></iframe></body></html>`
    )
  }

  const handleShare = async () => {
    const quote = await handleSave()
    if (!quote) return
    const b64 = generateQuotePDF(quote, customer)
    setPdfB64(b64)
    setShowShare(true)
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="font-semibold text-ink text-lg">
                {isEdit ? `Edit ${quoteNumber}` : 'New Quotation'}
              </h1>
              <p className="text-xs text-gray-400">
                Customer details are saved automatically when you save the quote
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handlePreview}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:border-gray-300 rounded-lg transition">
              <Eye size={15} /> Preview
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-ink hover:bg-dark rounded-lg transition disabled:opacity-50">
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              Save
            </button>
            <button onClick={handleShare}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition">
              <Share2 size={15} /> Share
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-3 gap-6">

        {/* LEFT: Customer + Meta */}
        <div className="col-span-1 space-y-4">

          {/* Quote meta */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Quotation Info</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">
                  Quote Number
                </label>
                <input value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)}
                  placeholder="Auto-assigned on save"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm font-mono placeholder:text-gray-300" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Expiry Date</label>
                <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
              </div>
            </div>
          </div>

          {/* Customer — search existing or fill new, saves automatically */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Customer</h2>
              {customerId && (
                <span className="text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full font-medium">
                  ✓ Existing
                </span>
              )}
              {!customerId && customer.company_name && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                  New — will save on quote save
                </span>
              )}
            </div>
            <CustomerForm
              value={customer}
              onChange={c => { setCustomer(c); setCustomerId(undefined) }}
              savedId={customerId}
              onSavedIdChange={setCustomerId}
            />
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Notes / Terms</h2>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm resize-none"
              placeholder="Delivery time, payment terms, special conditions…" />
          </div>
        </div>

        {/* RIGHT: Items + Totals */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Line Items</h2>
            <ItemsTable items={items} onChange={setItems} />
          </div>

          {/* Tax + Totals */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-8">
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Tax Rates</h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'IGST %', value: igstRate, set: setIgstRate },
                    { label: 'CGST %', value: cgstRate, set: setCgstRate },
                    { label: 'SGST %', value: sgstRate, set: setSgstRate },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
                      <input type="number" min="0" max="28" step="0.5" value={value}
                        onChange={e => set(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">IGST for inter-state · CGST+SGST for intra-state (Maharashtra)</p>
              </div>

              <div className="w-72 shrink-0 space-y-2 text-sm">
                <TRow label="Sub Total" value={totals.subTotal} />
                {igstRate > 0 && <TRow label={`IGST ${igstRate}%`} value={totals.igstAmount} />}
                {cgstRate > 0 && <TRow label={`CGST ${cgstRate}%`} value={totals.cgstAmount} />}
                {sgstRate > 0 && <TRow label={`SGST ${sgstRate}%`} value={totals.sgstAmount} />}
                <div className="border-t border-gray-200 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-ink text-base">Grand Total</span>
                    <span className="font-bold text-brand-600 text-xl tabular-nums">
                      ₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bank info panel */}
          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-brand-700 uppercase tracking-wider mb-2">Bank Details (printed on PDF)</h2>
            <p className="text-sm text-brand-800 font-medium">IDFC First Bank · Pimpri Branch</p>
            <p className="text-xs text-brand-600 mt-0.5">A/C: 75618555569 (Current) · IFSC: IDFB0041356</p>
          </div>
        </div>
      </div>

      {showShare && savedQuote && pdfB64 && (
        <ShareModal quote={savedQuote} customer={customer} pdfBase64={pdfB64} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}

function TRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-gray-600">
      <span>{label}</span>
      <span className="tabular-nums">₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
    </div>
  )
}
