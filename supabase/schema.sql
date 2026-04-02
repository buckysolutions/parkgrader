create table if not exists public.parkgrader_companies (
  domain text primary key,
  company_name text not null,
  website_url text not null,
  last_report_id text,
  last_audit_score integer,
  last_audit_at timestamptz,
  primary_challenge text,
  property_type text,
  updated_at timestamptz not null default now()
);

create table if not exists public.parkgrader_audits (
  id bigserial primary key,
  report_id text not null unique,
  domain text not null references public.parkgrader_companies(domain) on update cascade on delete cascade,
  company_name text not null,
  website_url text not null,
  email text,
  score integer not null,
  property_type text,
  primary_challenge text,
  property_size text,
  top_fails jsonb not null default '[]'::jsonb,
  estimated_lost_revenue numeric,
  benchmark_percentile numeric,
  scan_date timestamptz not null,
  report_snapshot jsonb,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.parkgrader_audits
  add column if not exists report_snapshot jsonb;

create index if not exists parkgrader_audits_domain_idx
  on public.parkgrader_audits (domain);

create index if not exists parkgrader_audits_scan_date_idx
  on public.parkgrader_audits (scan_date desc);

create index if not exists parkgrader_audits_is_test_idx
  on public.parkgrader_audits (is_test);
