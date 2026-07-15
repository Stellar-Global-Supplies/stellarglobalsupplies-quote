const API_BASE = import.meta.env.VITE_API_URL as string

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data as T
}

export const api = {
  customers: {
    // Search existing customers for autocomplete in quote form
    list: (search = '') =>
      apiFetch<any[]>(`/api/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    // Used by import page only — quote form uses api.quotes.save which upserts customer internally
    save: (customer: any) =>
      apiFetch<{ success: boolean; customer: any }>('/api/customers', {
        method: 'POST',
        body: JSON.stringify(customer),
      }),
  },
  quotes: {
    list: (search = '') =>
      apiFetch<any[]>(`/api/quotes${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    // Payload includes full customer object — Lambda upserts customer automatically
    save: (payload: {
      customer: any; quote_number?: string; date: string; expiry_date: string
      items: any[]; sub_total: number; igst_rate: number; cgst_rate: number; sgst_rate: number
      igst_amount: number; cgst_amount: number; sgst_amount: number
      grand_total: number; notes?: string; status: string
    }) =>
      apiFetch<{ success: boolean; quote: any; customer_id: string }>('/api/quotes', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
  skus: {
    search: (query: string) =>
      apiFetch<any[]>(`/api/skus?search=${encodeURIComponent(query)}`),
  },
  email: {
    send: (payload: {
      to: string; cc?: string[]; subject: string
      bodyHtml: string; pdfBase64: string; filename: string
    }) =>
      apiFetch<{ success: boolean; messageId: string }>('/api/email/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
}
