create table if not exists public.parkgrader_audits (
  id bigserial primary key,
  report_id text not null unique,
  domain text not null,
  company_name text not null,
  website_url text not null,
  email text,
  score integer not null,
  property_type text,
  primary_challenge text,
  property_size text,
  scan_date timestamptz not null,
  report_snapshot jsonb,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.parkgrader_audits
  add column if not exists report_snapshot jsonb;

alter table public.parkgrader_audits
  drop constraint if exists parkgrader_audits_domain_fkey;

alter table public.parkgrader_audits
  drop column if exists top_fails,
  drop column if exists estimated_lost_revenue,
  drop column if exists benchmark_percentile;

drop table if exists public.parkgrader_companies;

create index if not exists parkgrader_audits_domain_idx
  on public.parkgrader_audits (domain);

create index if not exists parkgrader_audits_scan_date_idx
  on public.parkgrader_audits (scan_date desc);

create index if not exists parkgrader_audits_is_test_idx
  on public.parkgrader_audits (is_test);

-- RLS hardening: deny browser roles by default, allow service_role for server APIs.
alter table public.parkgrader_audits enable row level security;
alter table public.parkgrader_audits force row level security;

revoke all on table public.parkgrader_audits from anon, authenticated;

drop policy if exists "service role full access" on public.parkgrader_audits;
create policy "service role full access"
  on public.parkgrader_audits
  as permissive
  for all
  to service_role
  using (true)
  with check (true);
