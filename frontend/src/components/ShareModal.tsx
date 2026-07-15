import { useState } from 'react'
import { X, Mail, Share2, Download, Send, Loader2, CheckCircle } from 'lucide-react'
import { Quote, Customer } from '@/lib/supabase'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

type Props = {
  quote: Quote
  customer: Customer
  pdfBase64: string
  onClose: () => void
}

export default function ShareModal({ quote, customer, pdfBase64, onClose }: Props) {
  const [emailTo, setEmailTo] = useState(customer.email || '')
  const [emailCc, setEmailCc] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const filename = `${quote.quote_number.replace(/\//g, '-')}.pdf`
  const pdfDataUri = `data:application/pdf;base64,${pdfBase64}`

  // ── Download PDF ────────────────────────────────────────────────────────────
  const downloadPDF = () => {
    const a = document.createElement('a')
    a.href = pdfDataUri
    a.download = filename
    a.click()
    toast.success('PDF downloaded')
  }

  // ── Native share (Web Share API) ────────────────────────────────────────────
  const [sharing, setSharing] = useState(false)

  const nativeShare = async () => {
    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))
    const file = new File([pdfBytes], filename, { type: 'application/pdf' })

    // Web Share API level 2 — shares the actual PDF file
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      setSharing(true)
      try {
        await navigator.share({
          files: [file],
          title: `Quotation ${quote.quote_number}`,
          text: `Dear ${customer.company_name}, please find attached quotation ${quote.quote_number} from Stellar Global Supplies. Grand Total: ₹${quote.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Valid till ${formatDate(quote.expiry_date)}.`,
        })
        toast.success('Shared!')
      } catch (err: any) {
        if (err?.name !== 'AbortError') toast.error('Share failed')
      }
      setSharing(false)
    } else {
      // Fallback: download (desktop browsers that don't support file sharing)
      downloadPDF()
      toast('PDF downloaded — attach it to share manually', { icon: '📎' })
    }
  }

  // ── Gmail send ──────────────────────────────────────────────────────────────
  const sendEmail = async () => {
    if (!emailTo) { toast.error('Enter recipient email'); return }
    setSendingEmail(true)
    try {
      const bodyHtml = emailTemplate(quote, customer)
      const ccList = emailCc ? emailCc.split(',').map(e => e.trim()).filter(Boolean) : []
      await api.email.send({
        to: emailTo,
        cc: ccList,
        subject: `Quotation ${quote.quote_number} — Stellar Global Supplies`,
        bodyHtml,
        pdfBase64,
        filename,
      })
      setEmailSent(true)
      toast.success('Email sent successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email')
    }
    setSendingEmail(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-ink">Share Quotation</h2>
            <p className="text-xs text-gray-500 mt-0.5">{quote.quote_number}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2.5 px-4 py-3 border-2 border-gray-200 hover:border-brand-500 hover:bg-brand-50 rounded-xl transition group"
            >
              <Download size={18} className="text-gray-400 group-hover:text-brand-500 transition" />
              <div className="text-left">
                <p className="text-sm font-medium text-ink">Download PDF</p>
                <p className="text-xs text-gray-500">Save to device</p>
              </div>
            </button>

            <button
              onClick={nativeShare}
              disabled={sharing}
              className="flex items-center gap-2.5 px-4 py-3 border-2 border-gray-200 hover:border-brand-500 hover:bg-brand-50 rounded-xl transition group disabled:opacity-50"
            >
              {sharing
                ? <Loader2 size={18} className="text-brand-500 animate-spin" />
                : <Share2 size={18} className="text-gray-400 group-hover:text-brand-500 transition" />
              }
              <div className="text-left">
                <p className="text-sm font-medium text-ink">Share PDF</p>
                <p className="text-xs text-gray-500">WhatsApp, Telegram, Drive…</p>
              </div>
            </button>
          </div>

          {/* Email section */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Mail size={15} className="text-brand-500" />
              <p className="text-sm font-semibold text-ink">Send via Gmail</p>
            </div>

            {emailSent ? (
              <div className="flex items-center gap-2 text-green-600 py-2">
                <CheckCircle size={16} />
                <span className="text-sm font-medium">Email sent successfully!</span>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">To *</label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={e => setEmailTo(e.target.value)}
                    placeholder="buyer@company.com"
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">CC (comma-separated)</label>
                  <input
                    type="text"
                    value={emailCc}
                    onChange={e => setEmailCc(e.target.value)}
                    placeholder="cc@company.com, other@company.com"
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
                  />
                </div>
                <button
                  onClick={sendEmail}
                  disabled={sendingEmail}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white text-sm font-semibold rounded-lg transition"
                >
                  {sendingEmail ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {sendingEmail ? 'Sending…' : 'Send Email with PDF'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function emailTemplate(quote: Quote, customer: Customer): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; }
  .header { background: #00B98E; padding: 24px; text-align: center; }
  .header h1 { color: white; margin: 0; font-size: 20px; }
  .header p { color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px; }
  .body { padding: 28px 24px; }
  .info-box { background: #f8fffe; border: 1px solid #e0f5f0; border-radius: 8px; padding: 16px; margin: 20px 0; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e9f5f2; }
  .row:last-child { border-bottom: none; font-weight: bold; font-size: 16px; color: #00B98E; }
  .label { color: #64748b; font-size: 13px; }
  .value { font-size: 13px; font-weight: 500; }
  .footer { background: #f8fafc; padding: 20px 24px; text-align: center; }
  .footer p { color: #64748b; font-size: 12px; margin: 4px 0; }
  .footer a { color: #00B98E; text-decoration: none; }
</style></head>
<body>
<div class="header">
  <h1>STELLAR GLOBAL SUPPLIES</h1>
  <p>Survey No. 169, Talawade, Pune – 411062 | GST: 27CLMPG9051Q1ZA</p>
</div>
<div class="body">
  <p>Dear <strong>${customer.company_name}</strong>,</p>
  <p>Thank you for your enquiry. Please find attached our quotation as requested.</p>

  <div class="info-box">
    <div class="row"><span class="label">Quotation No.</span><span class="value">${quote.quote_number}</span></div>
    <div class="row"><span class="label">Date</span><span class="value">${formatDate(quote.date)}</span></div>
    <div class="row"><span class="label">Valid Until</span><span class="value">${formatDate(quote.expiry_date)}</span></div>
    <div class="row"><span class="label">Sub Total</span><span class="value">₹${quote.sub_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
    <div class="row"><span class="label">GST (CGST + SGST)</span><span class="value">₹${(quote.cgst_amount + quote.sgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
    <div class="row"><span class="label">Grand Total</span><span class="value">₹${quote.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
  </div>

  <p>We look forward to your positive response. Please feel free to contact us for any clarifications.</p>
  <p>Warm regards,<br><strong>Stellar Global Supplies</strong></p>
</div>
<div class="footer">
  <p>📞 <a href="tel:+919637655556">+91 9637655556</a> &nbsp;|&nbsp; ✉️ <a href="mailto:stellarglobalsupplies@gmail.com">stellarglobalsupplies@gmail.com</a></p>
  <p>Survey No. 169, Gala No. 3, Pandurang Industrial Complex, Talawade, Pune – 411062</p>
</div>
</body>
</html>`
}
