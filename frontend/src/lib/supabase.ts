import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Customer = {
  id?: string
  company_name: string
  gst_number: string
  address: string
  city: string
  pin_code: string
  state: string
  state_code: string
  contact_person?: string
  contact_number?: string
  email?: string
  created_at?: string
}

export type QuoteItem = {
  id: string
  description: string
  hsn_sac: string
  quantity: number
  unit: string
  rate: number
  discount: number
  total: number
}

export type Quote = {
  id?: string
  quote_number: string
  customer_id: string
  customer?: Customer
  date: string
  expiry_date: string
  items: QuoteItem[]
  sub_total: number
  igst_rate: number
  cgst_rate: number
  sgst_rate: number
  igst_amount: number
  cgst_amount: number
  sgst_amount: number
  grand_total: number
  notes?: string
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
  created_at?: string
}
