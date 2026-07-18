import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Quote, Customer } from '@/lib/supabase'
import { LOGO_BASE64 } from '@/utils/logoBase64'
import { QR_BASE64 } from '@/utils/qrBase64'

const SGS = {
  name:        'STELLAR GLOBAL SUPPLIES',
  address:     'Survey No. 169, Gala No. - 3, Pandurang Industrial Complex,',
  address2:    'Rupeenagar, Talawade, Pune - 411062. MAHARASHTRA (INDIA)',
  mobile:      'Mob. : 9637655556',
  email:       'Email : stellarglobalsupplies@gmail.com',
  stateCode:   'State Code : 27',
  gst:         'GST No. : 27CLMPG9051Q1ZA',
  bank:        'IDFC First Bank',
  branch:      'Pimpri',
  account:     '75618555569',
  ifsc:        'IDFB0041356',
  accountType: 'Current Account',
}

// Brand colors
const GREEN: [number,number,number] = [26, 92, 58]
const GOLD:  [number,number,number] = [201, 168, 76]
const WHITE: [number,number,number] = [255, 255, 255]

// jsPDF's built-in helvetica doesn't support ₹ glyph — use "Rs." prefix instead
// This avoids the superscript-1 rendering bug seen in the PDF
function rs(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function toWords(amount: number): string {
  const a = ['','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE',
    'TEN','ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN','EIGHTEEN','NINETEEN']
  const b = ['','','TWENTY','THIRTY','FORTY','FIFTY','SIXTY','SEVENTY','EIGHTY','NINETY']

  function inWords(n: number): string {
    if (n < 20)       return a[n]
    if (n < 100)      return b[Math.floor(n/10)] + (n%10 ? ' '+a[n%10] : '')
    if (n < 1000)     return a[Math.floor(n/100)] + ' HUNDRED' + (n%100 ? ' '+inWords(n%100) : '')
    if (n < 100000)   return inWords(Math.floor(n/1000)) + ' THOUSAND' + (n%1000 ? ' '+inWords(n%1000) : '')
    if (n < 10000000) return inWords(Math.floor(n/100000)) + ' LAKH' + (n%100000 ? ' '+inWords(n%100000) : '')
    return inWords(Math.floor(n/10000000)) + ' CRORE' + (n%10000000 ? ' '+inWords(n%10000000) : '')
  }

  const rupees = Math.floor(amount)
  const paise  = Math.round((amount - rupees) * 100)
  let w = 'RUPEES ' + inWords(rupees)
  if (paise > 0) w += ' AND ' + inWords(paise) + ' PAISE'
  return w + ' ONLY'
}

function fmtDate(d: string): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export function generateQuotePDF(quote: Quote, customer: Customer): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W   = 210
  const M   = 10   // margin

  // ── Title bar ───────────────────────────────────────────────────────────────
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, W, 13, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('QUOTATION', W / 2, 9, { align: 'center' })

  // ── Header: logo + company info ─────────────────────────────────────────────
  try {
    doc.addImage(LOGO_BASE64, 'PNG', M, 15, 42, 15)
  } catch {
    doc.setTextColor(...GREEN)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('STELLAR GLOBAL SUPPLIES', M, 24)
  }

  // Company details right-aligned
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(50, 50, 50)
  const rx = W - M
  doc.text(SGS.address,  rx, 17, { align: 'right' })
  doc.text(SGS.address2, rx, 21, { align: 'right' })
  doc.text(SGS.mobile,   rx, 25, { align: 'right' })
  doc.text(SGS.email,    rx, 29, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GREEN)
  doc.setFontSize(7)
  doc.text(`${SGS.stateCode}   |   ${SGS.gst}`, rx, 33, { align: 'right' })

  // Gold rule under header
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.7)
  doc.line(M, 35, W - M, 35)

  // ── Customer + Quote info band ───────────────────────────────────────────────
  const midX    = W / 2
  const bandTop = 36
  const bandH   = 52

  doc.setFillColor(243, 249, 245)
  doc.rect(M, bandTop, W - 2*M, bandH, 'F')
  doc.line(midX, bandTop, midX, bandTop + bandH)

  // Left heading
  doc.setFillColor(...GREEN)
  doc.rect(M, bandTop, midX - M, 7, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('CUSTOMER DETAILS', M + 3, bandTop + 5)

  // Customer data
  let cy = bandTop + 13
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(20, 40, 30)
  doc.text(customer.company_name, M + 3, cy); cy += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(60, 80, 70)
  const addrLines = doc.splitTextToSize(customer.address, 86)
  addrLines.forEach((l: string) => { doc.text(l, M + 3, cy); cy += 4 })
  if (customer.city)     { doc.text(customer.city, M + 3, cy); cy += 4 }
  if (customer.pin_code) { doc.text(customer.pin_code, M + 3, cy); cy += 4 }
  if (customer.state)    { doc.text(customer.state, M + 3, cy); cy += 4 }
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GREEN)
  doc.setFontSize(7.5)
  doc.text(`GST: ${customer.gst_number.startsWith('IMPORT_') ? '-' : customer.gst_number}`, M + 3, cy)
  if (customer.contact_number) { cy += 4; doc.text(`Contact: ${customer.contact_number}`, M + 3, cy) }

  // Right heading
  doc.setFillColor(...GREEN)
  doc.rect(midX, bandTop, W - M - midX, 7, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('QUOTATION DETAILS', midX + 3, bandTop + 5)

  // Quote data rows
  const qLabel = midX + 3
  const qValue = W - M - 3
  let qy = bandTop + 13

  const qRow = (lbl: string, val: string) => {
    doc.setFont('helvetica', 'bold');   doc.setFontSize(7.5); doc.setTextColor(80, 110, 90)
    doc.text(lbl, qLabel, qy)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 40, 30)
    doc.text(val, qValue, qy, { align: 'right' })
    qy += 6
  }
  qRow('Quotation No. :', quote.quote_number)
  qRow('Date :', fmtDate(quote.date))
  qRow('Expiry Date :', fmtDate(quote.expiry_date))
  qRow('Mobile :', SGS.mobile)

  // Gold rule before table
  const tableTop = bandTop + bandH + 1
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.5)
  doc.line(M, tableTop, W - M, tableTop)

  // ── Items table ──────────────────────────────────────────────────────────────
  const tableBody = quote.items.map((item, idx) => [
    String(idx + 1),
    item.description,
    item.hsn_sac || '',
    `${Number(item.quantity).toFixed(2)} ${item.unit}`,
    rs(Number(item.rate)),
    `${item.discount}%`,
    rs(Number(item.total)),
  ])

  autoTable(doc, {
    startY: tableTop,
    head: [['S.N.', 'Item Name / Description', 'HSN/SAC', 'Quantity', 'Rate', 'Dis%', 'Total']],
    body: tableBody,
    margin: { left: M, right: M },
    tableWidth: W - 2 * M,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [215, 230, 220],
      lineWidth: 0.2,
      textColor: [25, 45, 35],
      font: 'helvetica',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: GREEN,
      textColor: WHITE,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: [248, 253, 250] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 74 },              // description — widest
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'right',  cellWidth: 24 },
      5: { halign: 'center', cellWidth: 10 },
      6: { halign: 'right',  cellWidth: 24 },  // total column
    },
    theme: 'grid',
  })

  const afterTable = (doc as any).lastAutoTable.finalY || 200

  // ── Bank + Totals ────────────────────────────────────────────────────────────
  const secTop = afterTable + 3
  const secH   = 40

  doc.setFillColor(243, 249, 245)
  doc.rect(M, secTop, midX - M, secH, 'F')
  doc.setFillColor(249, 253, 251)
  doc.rect(midX, secTop, W - M - midX, secH, 'F')
  doc.setDrawColor(200, 220, 210)
  doc.setLineWidth(0.2)
  doc.line(midX, secTop, midX, secTop + secH)

  // Bank heading
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...GREEN)
  doc.text('BANK DETAILS', M + 3, secTop + 6)
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.3)
  doc.line(M + 3, secTop + 7.5, midX - 5, secTop + 7.5)

  // Bank rows
  let by = secTop + 13
  const bRow = (lbl: string, val: string) => {
    doc.setFont('helvetica', 'bold');   doc.setFontSize(7.5); doc.setTextColor(50, 80, 60)
    doc.text(`${lbl}:`, M + 3, by)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(25, 45, 35)
    doc.text(val, M + 24, by)
    by += 5
  }
  bRow('Bank',   SGS.bank)
  bRow('Branch', SGS.branch)
  bRow('A/C No', `${SGS.accountType} - ${SGS.account}`)
  bRow('IFSC',   SGS.ifsc)

  // QR code — place to the right of bank text, below golden line
  try {
    doc.addImage(QR_BASE64, 'PNG', midX - 28, secTop + 13, 22, 22)
  } catch {
    // silently skip if QR image fails
  }

  // Totals
  let ty = secTop + 5
  const lh = 6.5
  const tv = W - M - 3

  const tRow = (lbl: string, val: string, grand = false) => {
    if (grand) {
      doc.setFillColor(...GREEN)
      doc.rect(midX, ty - 4.5, W - M - midX, lh + 0.5, 'F')
      doc.setTextColor(...WHITE)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
    } else {
      doc.setTextColor(60, 85, 70)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
    }
    doc.text(lbl, midX + 3, ty)
    doc.text(val, tv, ty, { align: 'right' })
    ty += lh
  }

  tRow('Sub Total :', rs(quote.sub_total))
  tRow(`IGST ${quote.igst_rate}% :`, rs(quote.igst_amount))
  tRow(`CGST ${quote.cgst_rate}% :`, rs(quote.cgst_amount))
  tRow(`SGST ${quote.sgst_rate}% :`, rs(quote.sgst_amount))
  tRow('Grand Total :', rs(quote.grand_total), true)

  // ── Amount in words ──────────────────────────────────────────────────────────
  const wY = secTop + secH + 2
  doc.setFillColor(...GREEN)
  doc.rect(M, wY, W - 2*M, 9, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  const wordsText = `Amount in Words: ${toWords(quote.grand_total)}`
  const wordsLines = doc.splitTextToSize(wordsText, W - 2*M - 6)
  doc.text(wordsLines, M + 3, wY + 5.5)

  // Notes — dynamic height box
  let sigY = wY + 14
  if (quote.notes?.trim()) {
    const notesLines = doc.splitTextToSize(quote.notes.trim(), W - 2*M - 22)
    const notesH = Math.max(10, notesLines.length * 4 + 6)  // pad for header
    doc.setFillColor(250, 253, 251)
    doc.setDrawColor(200, 220, 210)
    doc.setLineWidth(0.2)
    doc.rect(M, wY + 11, W - 2*M, notesH)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...GREEN)
    doc.text('Notes:', M + 3, wY + 17)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 80, 70)
    doc.text(notesLines, M + 18, wY + 17)
    sigY = wY + 11 + notesH + 4
  }

  // ── Signatures ───────────────────────────────────────────────────────────────
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.6)
  doc.line(M, sigY, W - M, sigY)
  doc.line(midX, sigY, midX, sigY + 18)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...GREEN)
  doc.text(`For, ${SGS.name}`, midX + 3, sigY + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(110, 130, 120)
  doc.text("Receiver's Signature & Stamp", M + 3, sigY + 15)
  doc.text('Authorised Signatory',         midX + 3, sigY + 15)

  // Gold bottom strip
  doc.setFillColor(...GOLD)
  doc.rect(M, sigY + 19, W - 2*M, 1.5, 'F')

  return doc.output('datauristring').split(',')[1]
}
