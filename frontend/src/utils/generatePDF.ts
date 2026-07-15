import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Quote, Customer } from '@/lib/supabase'
import { LOGO_BASE64 } from '@/utils/logoBase64'

const SGS = {
  name: 'STELLAR GLOBAL SUPPLIES',
  address: 'Survey No. 169, Gala No. - 3, Pandurang Industrial Complex,',
  address2: 'Rupeenagar, Talawade, Pune - 411062. MAHARASHTRA (INDIA)',
  mobile: 'Mob. : 9637655556',
  email: 'Email : stellarglobalsupplies@gmail.com',
  stateCode: 'State Code : 27',
  gst: 'GST No. : 27CLMPG9051Q1ZA',
  bank: 'IDFC First Bank',
  branch: 'Pimpri',
  account: '75618555569',
  ifsc: 'IDFB0041356',
  accountType: 'Current Account',
}

// Brand colors (RGB)
const GREEN: [number, number, number] = [26, 92, 58]
const GOLD:  [number, number, number] = [201, 168, 76]
const WHITE: [number, number, number] = [255, 255, 255]

function toWords(amount: number): string {
  const a = [
    '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT',
    'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN',
    'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
  ]
  const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']

  function inWords(n: number): string {
    if (n < 20) return a[n]
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '')
    if (n < 1000) return a[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 ? ' ' + inWords(n % 100) : '')
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' THOUSAND' + (n % 1000 ? ' ' + inWords(n % 1000) : '')
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' LAKH' + (n % 100000 ? ' ' + inWords(n % 100000) : '')
    return inWords(Math.floor(n / 10000000)) + ' CRORE' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '')
  }

  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)
  let words = 'RUPEES ' + inWords(rupees)
  if (paise > 0) words += ' AND ' + inWords(paise) + ' PAISE'
  return words + ' ONLY'
}

export function generateQuotePDF(quote: Quote, customer: Customer): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const margin = 10

  // ── TITLE BAR (green background) ──────────────────────────────────────────
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, W, 14, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('QUOTATION', W / 2, 9.5, { align: 'center' })

  // ── HEADER: LOGO + COMPANY INFO ────────────────────────────────────────────
  // Logo (left side of header)
  try {
    // Logo dimensions: 400x144 → scale to fit ~45mm wide, ~16mm tall
    doc.addImage(LOGO_BASE64, 'PNG', margin, 16, 45, 16)
  } catch (_) {
    // fallback: text logo
    doc.setTextColor(...GREEN)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('STELLAR GLOBAL SUPPLIES', margin, 26)
  }

  // Company details (right side of header)
  doc.setTextColor(60, 60, 60)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  const infoX = W - margin
  doc.text(SGS.address,  infoX, 19, { align: 'right' })
  doc.text(SGS.address2, infoX, 23, { align: 'right' })
  doc.text(SGS.mobile,   infoX, 27, { align: 'right' })
  doc.text(SGS.email,    infoX, 31, { align: 'right' })
  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text(`${SGS.stateCode}   |   ${SGS.gst}`, infoX, 35, { align: 'right' })

  // Gold divider line under header
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.8)
  doc.line(margin, 38, W - margin, 38)

  // ── CUSTOMER + QUOTATION INFO (two-column) ─────────────────────────────────
  const midX = W / 2

  // Light green bg for info band
  doc.setFillColor(240, 248, 243)
  doc.rect(margin, 39, W - 2 * margin, 52, 'F')

  // Vertical divider
  doc.setDrawColor(200, 220, 210)
  doc.setLineWidth(0.3)
  doc.line(midX, 39, midX, 91)

  // Left: Customer heading
  doc.setFillColor(...GREEN)
  doc.rect(margin, 39, midX - margin, 7, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('CUSTOMER DETAILS', margin + 3, 44)

  // Left: Customer data
  doc.setTextColor(30, 45, 37)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text(customer.company_name, margin + 3, 52)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(60, 80, 70)
  const addrLines = doc.splitTextToSize(customer.address, 88)
  let y = 57
  addrLines.forEach((line: string) => { doc.text(line, margin + 3, y); y += 4 })
  if (customer.city)     { doc.text(customer.city, margin + 3, y); y += 4 }
  if (customer.pin_code) { doc.text(customer.pin_code, margin + 3, y); y += 4 }
  doc.text(customer.state, margin + 3, y); y += 4
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GREEN)
  doc.text(`GST: ${customer.gst_number}`, margin + 3, y)

  // Right: Quote heading
  doc.setFillColor(...GREEN)
  doc.rect(midX, 39, W - margin - midX, 7, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('QUOTATION DETAILS', midX + 3, 44)

  // Right: Quote data
  const labelX = midX + 3
  const valX   = W - margin - 3
  let qy = 52

  const qRow = (label: string, val: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(80, 100, 90)
    doc.text(label, labelX, qy)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 45, 37)
    doc.text(val, valX, qy, { align: 'right' })
    qy += 6
  }

  qRow('Quotation No. :', quote.quote_number)
  qRow('Date :', formatDate(quote.date))
  qRow('Expiry Date :', formatDate(quote.expiry_date))
  if (customer.contact_number) qRow('Contact :', customer.contact_number)

  // Gold divider before table
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.6)
  doc.line(margin, 92, W - margin, 92)

  // ── ITEMS TABLE ────────────────────────────────────────────────────────────
  const tableBody = quote.items.map((item, idx) => [
    idx + 1,
    item.description,
    item.hsn_sac,
    `${item.quantity.toFixed(2)} ${item.unit}`,
    `₹${item.rate.toFixed(2)}`,
    `${item.discount}%`,
    `₹${item.total.toFixed(2)}`,
  ])

  autoTable(doc, {
    startY: 92,
    head: [['S.N.', 'Item Name / Description', 'HSN/SAC', 'Quantity', 'Rate', 'Dis%', 'Total']],
    body: tableBody,
    margin: { left: margin, right: margin },
    tableWidth: W - 2 * margin,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [220, 235, 228],
      lineWidth: 0.2,
      textColor: [30, 45, 37],
    },
    headStyles: {
      fillColor: GREEN,
      textColor: WHITE,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 253, 250],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 65 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 24 },
      4: { halign: 'right', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 12 },
      6: { halign: 'right', cellWidth: 20 },
    },
    theme: 'grid',
  })

  const afterTable = (doc as any).lastAutoTable.finalY || 200

  // ── BANK + TOTALS ──────────────────────────────────────────────────────────
  const totalsStartY = afterTable + 4
  const totalsX = midX + 2

  // Section backgrounds
  doc.setFillColor(240, 248, 243)
  doc.rect(margin, totalsStartY, midX - margin, 38, 'F')
  doc.setFillColor(248, 253, 250)
  doc.rect(midX, totalsStartY, W - margin - midX, 38, 'F')

  // Bank details
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...GREEN)
  doc.text('BANK DETAILS', margin + 3, totalsStartY + 6)

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.4)
  doc.line(margin + 3, totalsStartY + 7.5, midX - 5, totalsStartY + 7.5)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(50, 70, 60)
  doc.setFontSize(7.5)
  let by = totalsStartY + 12
  const bRow = (label: string, val: string) => {
    doc.setFont('helvetica', 'bold'); doc.text(`${label}:`, margin + 3, by)
    doc.setFont('helvetica', 'normal'); doc.text(val, margin + 28, by)
    by += 5
  }
  bRow('Bank', SGS.bank)
  bRow('Branch', SGS.branch)
  bRow('A/C No', `${SGS.accountType} - ${SGS.account}`)
  bRow('IFSC', SGS.ifsc)

  // Totals
  let ty = totalsStartY + 5
  const lineH = 6.5

  const tRow = (label: string, value: string, highlight = false) => {
    if (highlight) {
      doc.setFillColor(...GREEN)
      doc.rect(midX, ty - 4.5, W - margin - midX, lineH + 0.5, 'F')
      doc.setTextColor(...WHITE)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
    } else {
      doc.setTextColor(60, 80, 70)
      doc.setFont('helvetica', highlight ? 'bold' : 'normal')
      doc.setFontSize(8)
    }
    doc.text(label, totalsX + 2, ty)
    doc.text(value, W - margin - 3, ty, { align: 'right' })
    ty += lineH
  }

  tRow('Sub Total :', `₹${quote.sub_total.toFixed(2)}`)
  tRow(`IGST ${quote.igst_rate}% :`, `₹${quote.igst_amount.toFixed(2)}`)
  tRow(`CGST ${quote.cgst_rate}% :`, `₹${quote.cgst_amount.toFixed(2)}`)
  tRow(`SGST ${quote.sgst_rate}% :`, `₹${quote.sgst_amount.toFixed(2)}`)
  tRow('Grand Total :', `₹${quote.grand_total.toFixed(2)}`, true)

  // Vertical divider between bank + totals
  doc.setDrawColor(200, 220, 210)
  doc.setLineWidth(0.3)
  doc.line(midX, totalsStartY, midX, totalsStartY + 38)

  // ── AMOUNT IN WORDS ────────────────────────────────────────────────────────
  const wordsY = totalsStartY + 40
  doc.setFillColor(...GREEN)
  doc.rect(margin, wordsY, W - 2 * margin, 8, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const words = toWords(quote.grand_total)
  doc.text(`Amount in Words: ${words}`, margin + 3, wordsY + 5.5)

  // ── NOTES ─────────────────────────────────────────────────────────────────
  let sigY = wordsY + 14
  if (quote.notes) {
    doc.setFillColor(250, 253, 251)
    doc.rect(margin, wordsY + 10, W - 2 * margin, 10, 'F')
    doc.setDrawColor(200, 220, 210)
    doc.setLineWidth(0.2)
    doc.rect(margin, wordsY + 10, W - 2 * margin, 10)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...GREEN)
    doc.text('Notes:', margin + 3, wordsY + 16)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 80, 70)
    const noteLines = doc.splitTextToSize(quote.notes, W - 2 * margin - 20)
    doc.text(noteLines, margin + 18, wordsY + 16)
    sigY = wordsY + 26
  }

  // ── SIGNATURES ─────────────────────────────────────────────────────────────
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.6)
  doc.line(margin, sigY, W - margin, sigY)
  doc.line(midX, sigY, midX, sigY + 18)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...GREEN)
  doc.text(`For, ${SGS.name}`, midX + 3, sigY + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 120, 110)
  doc.text("Receiver's Signature & Stamp", margin + 3, sigY + 16)
  doc.text('Authorised Signatory', midX + 3, sigY + 16)

  // Gold bottom border
  doc.setFillColor(...GOLD)
  doc.rect(margin, sigY + 19, W - 2 * margin, 1.5, 'F')

  return doc.output('datauristring').split(',')[1]
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}
