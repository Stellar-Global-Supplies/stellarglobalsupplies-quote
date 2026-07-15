import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle, Download, X, Loader2, FileText } from 'lucide-react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

const INDIAN_STATES: Record<string, string> = {
  'andhra pradesh': '28', 'arunachal pradesh': '12', 'assam': '18',
  'bihar': '10', 'chhattisgarh': '22', 'goa': '30', 'gujarat': '24',
  'haryana': '06', 'himachal pradesh': '02', 'jharkhand': '20',
  'karnataka': '29', 'kerala': '32', 'madhya pradesh': '23',
  'maharashtra': '27', 'manipur': '14', 'meghalaya': '17',
  'mizoram': '15', 'nagaland': '13', 'odisha': '21', 'punjab': '03',
  'rajasthan': '08', 'sikkim': '11', 'tamil nadu': '33', 'telangana': '36',
  'tripura': '16', 'uttar pradesh': '09', 'uttarakhand': '05',
  'west bengal': '19', 'delhi': '07', 'jammu & kashmir': '01',
  'ladakh': '38', 'puducherry': '34',
}

type ParsedRow = {
  company_name: string
  gst_number: string
  address: string
  city: string
  pin_code: string
  state: string
  state_code: string
  contact_person: string
  contact_number: string
  email: string
  _rowIndex: number
  _error?: string
}

type ImportResult = {
  company_name: string
  status: 'saved' | 'skipped' | 'error'
  message?: string
}

// ── CSV parser — handles quoted fields with embedded newlines ─────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuote = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { field += '"'; i += 2; continue }
      inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      row.push(field.trim()); field = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field.trim()); field = ''
      if (row.some(c => c)) rows.push(row)
      row = []
    } else {
      field += ch
    }
    i++
  }
  if (field || row.length) { row.push(field.trim()); if (row.some(c => c)) rows.push(row) }
  return rows
}

// ── Detect if file matches the SGS Customer Master format ────────────────────
function isSGSFormat(rows: string[][]): boolean {
  return rows.some(r => r.some(c => c.includes('CUSTOMER MASTER')))
}

// ── Parse SGS Customer Master CSV ────────────────────────────────────────────
function parseSGSFormat(rows: string[][]): ParsedRow[] {
  const results: ParsedRow[] = []

  // Each customer record spans one row with 8 columns:
  // [0] company header, [1] SGS address, [2] "CUSTOMER MASTER",
  // [3] "Sr. No.", [4] "Customer Details", [5] "TAX & Other Details",
  // [6] "Contacts Details", [7] Sr number, [8] address block, [9] tax block, [10] contact block
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (!r[7] || isNaN(Number(r[7]))) continue // must have a serial number

    const addrBlock    = (r[8] || '').replace(/\r/g, '\n')
    const contactBlock = (r[10] || '')

    // Parse address block — first non-empty line = company name
    const addrLines = addrBlock.split('\n').map(l => l.trim()).filter(Boolean)
    if (!addrLines.length) continue

    const company_name = addrLines[0]

    // State, city, pin are usually last 3 meaningful lines
    const pin_code  = addrLines[addrLines.length - 1] || ''
    const city      = addrLines[addrLines.length - 2] || ''
    const state     = addrLines[addrLines.length - 3] || ''
    const state_code = INDIAN_STATES[state.toLowerCase()] || ''

    // Everything in between = address
    const addrParts = addrLines.slice(1, addrLines.length - 3)
    const address = addrParts.join(', ')

    // Parse contact block
    const mobile  = extractField(contactBlock, 'Mobile')
    const email   = extractField(contactBlock, 'Email')
    const contact = extractField(contactBlock, 'Contact Person')

    // GST not in old CSV — use placeholder so unique constraint passes
    const slug = company_name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
    const gst_number = `IMPORT_${state_code || 'XX'}_${slug}`

    const row: ParsedRow = {
      company_name,
      gst_number,
      address,
      city,
      pin_code,
      state,
      state_code,
      contact_person: contact,
      contact_number: mobile,
      email,
      _rowIndex: Number(r[7]),
    }

    if (!company_name) row._error = 'Missing company name'
    results.push(row)
  }
  return results
}

// ── Parse generic flat CSV ────────────────────────────────────────────────────
// Expected columns: company_name, gst_number, address, city, pin_code,
//                   state, state_code, contact_person, contact_number, email
function parseGenericFormat(rows: string[][]): ParsedRow[] {
  if (rows.length < 2) return []
  const headers = rows[0].map(h => h.toLowerCase().trim().replace(/\s+/g, '_'))
  const col = (name: string) => headers.indexOf(name)

  return rows.slice(1).map((r, idx) => {
    const get = (name: string) => (r[col(name)] || '').trim()
    const state = get('state')
    const state_code = get('state_code') || INDIAN_STATES[state.toLowerCase()] || ''
    const gst = get('gst_number') || get('gstin') || `IMPORT_${state_code}_${get('company_name').replace(/\W/g,'').slice(0,10).toUpperCase()}`

    return {
      company_name:   get('company_name'),
      gst_number:     gst,
      address:        get('address'),
      city:           get('city'),
      pin_code:       get('pin_code') || get('pincode') || get('pin'),
      state,
      state_code,
      contact_person: get('contact_person'),
      contact_number: get('contact_number') || get('mobile') || get('phone'),
      email:          get('email'),
      _rowIndex:      idx + 2,
      _error:         !get('company_name') ? 'Missing company_name' : undefined,
    }
  })
}

function extractField(block: string, label: string): string {
  const pattern = new RegExp(`${label}\\s*[-–]\\s*([^\\n]+)`, 'i')
  const m = block.match(pattern)
  if (!m) return ''
  return m[1].trim().replace(/\s+/g, ' ')
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImportCustomers() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed]     = useState<ParsedRow[]>([])
  const [results, setResults]   = useState<ImportResult[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone]         = useState(false)
  const [fileName, setFileName] = useState('')

  const handleFile = (file: File) => {
    setFileName(file.name)
    setParsed([]); setResults([]); setDone(false)

    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      const result = isSGSFormat(rows) ? parseSGSFormat(rows) : parseGenericFormat(rows)
      setParsed(result)
      if (result.length === 0) toast.error('No customer rows found — check file format')
      else toast.success(`Parsed ${result.length} customers — review and import`)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) handleFile(file)
    else toast.error('Please drop a CSV file')
  }

  const removeRow = (idx: number) => setParsed(p => p.filter((_, i) => i !== idx))

  const handleImport = async () => {
    const valid = parsed.filter(r => !r._error && r.company_name)
    if (!valid.length) { toast.error('No valid rows to import'); return }

    setImporting(true)
    const res: ImportResult[] = []

    for (const row of valid) {
      try {
        await api.customers.save(row)
        res.push({ company_name: row.company_name, status: 'saved' })
      } catch (err: any) {
        const msg = err.message || 'Unknown error'
        // Duplicate GST = skip gracefully
        if (msg.includes('duplicate') || msg.includes('unique')) {
          res.push({ company_name: row.company_name, status: 'skipped', message: 'Already exists' })
        } else {
          res.push({ company_name: row.company_name, status: 'error', message: msg })
        }
      }
    }

    setResults(res)
    setImporting(false)
    setDone(true)
    const saved   = res.filter(r => r.status === 'saved').length
    const skipped = res.filter(r => r.status === 'skipped').length
    const errors  = res.filter(r => r.status === 'error').length
    toast.success(`Done — ${saved} saved, ${skipped} skipped, ${errors} errors`)
  }

  const downloadTemplate = () => {
    const csv = [
      'company_name,gst_number,address,city,pin_code,state,state_code,contact_person,contact_number,email',
      '"Example Pvt. Ltd.","27AABCE1234F1Z5","Plot 12, MIDC Pune","Pune","411019","Maharashtra","27","John Doe","9999999999","john@example.com"',
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'quote_customers_template.csv'
    a.click()
  }

  const saved   = results.filter(r => r.status === 'saved').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const errors  = results.filter(r => r.status === 'error').length
  const valid   = parsed.filter(r => !r._error)
  const invalid = parsed.filter(r => r._error)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Import Customers</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Upload your SGS Customer Master CSV or any flat CSV with customer columns
          </p>
        </div>
        <button onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 text-sm text-brand-600 border border-brand-200 hover:bg-brand-50 rounded-xl transition font-medium">
          <Download size={15} /> Download template CSV
        </button>
      </div>

      {/* Drop zone */}
      {!parsed.length && !done && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 hover:border-brand-400 rounded-2xl p-14 text-center cursor-pointer transition-colors group"
        >
          <Upload size={32} className="text-gray-300 group-hover:text-brand-400 mx-auto mb-3 transition-colors" />
          <p className="font-semibold text-gray-600 group-hover:text-brand-600 transition-colors">
            Drop your CSV here or click to browse
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Supports SGS Customer Master format or generic flat CSV
          </p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      )}

      {/* Preview table */}
      {parsed.length > 0 && !done && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-brand-500" />
                <span className="font-semibold text-ink text-sm">{fileName}</span>
                <span className="text-xs text-gray-400">{parsed.length} rows parsed</span>
              </div>
              <div className="flex items-center gap-3">
                {invalid.length > 0 && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-medium">
                    {invalid.length} with issues
                  </span>
                )}
                <span className="text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full font-medium">
                  {valid.length} ready to import
                </span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Address</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">City</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">State</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">PIN</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Mobile</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-3 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsed.map((row, idx) => (
                    <tr key={idx} className={`${row._error ? 'bg-red-50' : 'hover:bg-gray-50'} group`}>
                      <td className="px-3 py-2 text-gray-400 font-mono">{row._rowIndex}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-ink">{row.company_name || <span className="text-red-400">—</span>}</p>
                        {row._error && <p className="text-red-500 text-xs mt-0.5">{row._error}</p>}
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate" title={row.address}>{row.address}</td>
                      <td className="px-3 py-2 text-gray-600">{row.city}</td>
                      <td className="px-3 py-2 text-gray-600">{row.state} <span className="text-gray-400">({row.state_code})</span></td>
                      <td className="px-3 py-2 font-mono text-gray-600">{row.pin_code}</td>
                      <td className="px-3 py-2 text-gray-600">{row.contact_number}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate">{row.email}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeRow(idx)}
                          className="p-1 text-gray-300 hover:text-red-400 transition opacity-0 group-hover:opacity-100">
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notice about GST placeholders */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">GST numbers not found in this file</p>
              <p className="mt-0.5 text-amber-700">
                Your Customer Master CSV predates GST. Placeholder IDs will be inserted so records save without errors.
                Update real GST numbers later by editing each customer from the quote form.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleImport} disabled={importing || valid.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white font-semibold rounded-xl transition">
              {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {importing ? 'Importing…' : `Import ${valid.length} customers`}
            </button>
            <button onClick={() => { setParsed([]); setFileName('') }}
              className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition">
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Results */}
      {done && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-green-600">{saved}</p>
              <p className="text-sm text-green-700 mt-1 font-medium">Saved</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-amber-600">{skipped}</p>
              <p className="text-sm text-amber-700 mt-1 font-medium">Already existed</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-red-500">{errors}</p>
              <p className="text-sm text-red-600 mt-1 font-medium">Errors</p>
            </div>
          </div>

          {/* Row-level results */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-ink text-sm">Import Results</p>
            </div>
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-ink">{r.company_name}</span>
                  <div className="flex items-center gap-2">
                    {r.message && <span className="text-xs text-gray-400">{r.message}</span>}
                    {r.status === 'saved' && <CheckCircle size={15} className="text-green-500" />}
                    {r.status === 'skipped' && <AlertCircle size={15} className="text-amber-500" />}
                    {r.status === 'error' && <AlertCircle size={15} className="text-red-500" />}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      r.status === 'saved'   ? 'bg-green-50 text-green-600' :
                      r.status === 'skipped' ? 'bg-amber-50 text-amber-600' :
                                               'bg-red-50 text-red-500'
                    }`}>{r.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => { setParsed([]); setResults([]); setDone(false); setFileName('') }}
            className="px-4 py-2.5 text-sm text-brand-600 hover:bg-brand-50 rounded-xl transition font-medium border border-brand-200">
            Import another file
          </button>
        </div>
      )}
    </div>
  )
}
