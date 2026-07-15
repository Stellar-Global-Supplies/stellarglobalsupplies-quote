-- ============================================================
-- SGS Quote App — Supabase Database Schema
-- Table: quote_customers (separate from your existing customers table)
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── QUOTE CUSTOMERS ──────────────────────────────────────────
-- Intentionally named quote_customers to avoid collision with
-- your existing public.customers table.

create table if not exists public.quote_customers (
  id               uuid primary key default uuid_generate_v4(),
  company_name     text not null,
  gst_number       text not null unique,
  address          text not null,
  city             text,
  pin_code         text,
  state            text not null,
  state_code       text not null,
  contact_person   text,
  contact_number   text,
  email            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists quote_customers_name_gin_idx
  on public.quote_customers
  using gin(to_tsvector('english', company_name));

create index if not exists quote_customers_name_ilike_idx
  on public.quote_customers (lower(company_name));

-- ── QUOTES ───────────────────────────────────────────────────

create table if not exists public.quotes (
  id               uuid primary key default uuid_generate_v4(),
  quote_number     text not null unique,
  customer_id      uuid not null references public.quote_customers(id) on delete restrict,
  date             date not null default current_date,
  expiry_date      date,
  items            jsonb not null default '[]'::jsonb,
  sub_total        numeric(12, 2) not null default 0,
  igst_rate        numeric(5, 2) not null default 0,
  cgst_rate        numeric(5, 2) not null default 9,
  sgst_rate        numeric(5, 2) not null default 9,
  igst_amount      numeric(12, 2) not null default 0,
  cgst_amount      numeric(12, 2) not null default 0,
  sgst_amount      numeric(12, 2) not null default 0,
  grand_total      numeric(12, 2) not null default 0,
  notes            text,
  status           text not null default 'draft'
                     check (status in ('draft', 'sent', 'accepted', 'rejected')),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists quotes_quote_number_idx on public.quotes (quote_number);
create index if not exists quotes_customer_id_idx  on public.quotes (customer_id);
create index if not exists quotes_created_at_idx   on public.quotes (created_at desc);

-- ── AUTO-UPDATE updated_at ────────────────────────────────────

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists quote_customers_updated_at on public.quote_customers;
create trigger quote_customers_updated_at
  before update on public.quote_customers
  for each row execute function public.handle_updated_at();

drop trigger if exists quotes_updated_at on public.quotes;
create trigger quotes_updated_at
  before update on public.quotes
  for each row execute function public.handle_updated_at();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────

alter table public.quote_customers enable row level security;
alter table public.quotes          enable row level security;

create policy "Auth: read quote_customers"
  on public.quote_customers for select to authenticated using (true);

create policy "Auth: insert quote_customers"
  on public.quote_customers for insert to authenticated with check (true);

create policy "Auth: update quote_customers"
  on public.quote_customers for update to authenticated using (true);

create policy "Auth: read quotes"
  on public.quotes for select to authenticated using (true);

create policy "Auth: insert quotes"
  on public.quotes for insert to authenticated with check (true);

create policy "Auth: update quotes"
  on public.quotes for update to authenticated using (true);

-- ── top_sku view — add hsn_sac column ────────────────────────
-- Your existing view already has: sku, material_type
-- Add hsn_sac to the underlying table, then recreate the view.

-- Option A — top_sku is a TABLE:
alter table public.top_sku
  add column if not exists hsn_sac text;

-- Option B — top_sku is a VIEW (replace body with your actual query):
-- create or replace view public.top_sku as
--   select sku, material_type, hsn_sac
--   from your_products_table
--   order by sku;

alter table public.top_sku enable row level security;

create policy "Auth: read top_sku"
  on public.top_sku for select to authenticated using (true);
