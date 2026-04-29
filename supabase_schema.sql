-- ============================================================
-- 100Radar — Schema Supabase
-- Execute no SQL Editor do projeto Supabase
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

do $$ begin
  create type verification_status as enum ('REGULAR', 'VENCIDO', 'INDETERMINADO');
exception when duplicate_object then null; end $$;

create table if not exists radar_sites (
  id              uuid primary key default gen_random_uuid(),
  uf              char(2) not null,
  numero_inmetro  text,
  numero_serie    text,
  municipio       text,
  local_text      text,
  latitude        double precision,
  longitude       double precision,
  source_url      text,
  raw_hash        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_radar_sites_uf             on radar_sites (uf);
create index if not exists idx_radar_sites_numero_inmetro on radar_sites (numero_inmetro);
create index if not exists idx_radar_sites_numero_serie   on radar_sites (numero_serie);

create table if not exists radar_lanes (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references radar_sites(id) on delete cascade,
  lane_code  text,
  direction  text,
  created_at timestamptz not null default now()
);
create index if not exists idx_radar_lanes_site_id on radar_lanes (site_id);

create table if not exists site_verifications (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references radar_sites(id) on delete cascade,
  valid_from  date not null,
  valid_until date,
  status      verification_status not null default 'INDETERMINADO',
  source_doc  text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_site_verifications_site_id    on site_verifications (site_id);
create index if not exists idx_site_verifications_valid_from on site_verifications (valid_from);

create table if not exists queries (
  id                    uuid primary key default gen_random_uuid(),
  uf                    char(2) not null,
  numero_inmetro        text,
  numero_serie          text,
  data_infracao         date not null,
  site_id               uuid references radar_sites(id),
  lane_id               uuid references radar_lanes(id),
  status_na_data        verification_status not null default 'INDETERMINADO',
  paid                  boolean not null default false,
  amount_brl_centavos   int not null default 500,
  payment_provider      text,
  payment_id            text,
  identifier_type       text,
  result_code           text,
  source_url            text,
  client_ref            text,
  created_at            timestamptz not null default now()
);
create index if not exists idx_queries_uf         on queries (uf);
create index if not exists idx_queries_paid        on queries (paid);
create index if not exists idx_queries_created_at  on queries (created_at);
create index if not exists idx_queries_site_id     on queries (site_id);

create table if not exists payments (
  id                    uuid primary key default gen_random_uuid(),
  query_id              uuid not null references queries(id),
  provider              text not null,
  provider_payment_id   text,
  external_reference    text not null,
  amount_brl_centavos   int not null,
  currency              text not null default 'BRL',
  payment_method        text not null,
  status                text not null,
  provider_status_detail text,
  qr_code               text,
  qr_code_base64        text,
  ticket_url            text,
  raw_create_payload    jsonb,
  raw_webhook_payload   jsonb,
  raw_payment_payload   jsonb,
  paid_at               timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create index if not exists idx_payments_query_id           on payments (query_id);
create index if not exists idx_payments_external_reference on payments (external_reference);
create index if not exists idx_payments_status             on payments (status);

create table if not exists sync_jobs (
  id              uuid primary key default gen_random_uuid(),
  uf              char(2) not null,
  status          text not null default 'pending',
  triggered_by    text not null default 'manual',
  started_at      timestamptz,
  finished_at     timestamptz,
  records_added   int default 0,
  records_updated int default 0,
  records_removed int default 0,
  error_message   text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_sync_jobs_uf         on sync_jobs (uf);
create index if not exists idx_sync_jobs_created_at on sync_jobs (created_at desc);

create table if not exists dataset_sources (
  id              uuid primary key default gen_random_uuid(),
  uf              char(2) not null unique,
  source_url      text not null,
  last_synced_at  timestamptz,
  last_hash       text,
  record_count    int default 0,
  status          text not null default 'never_synced',
  updated_at      timestamptz not null default now()
);

create table if not exists admin_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  query_id    uuid references queries(id),
  source_url  text,
  raw_hash    text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_admin_audit_logs_created_at on admin_audit_logs (created_at desc);
create index if not exists idx_admin_audit_logs_action     on admin_audit_logs (action);

-- RLS
alter table radar_sites        enable row level security;
alter table radar_lanes        enable row level security;
alter table site_verifications enable row level security;
alter table queries            enable row level security;
alter table payments           enable row level security;
alter table sync_jobs          enable row level security;
alter table dataset_sources    enable row level security;
alter table admin_audit_logs   enable row level security;

create policy "service_role_only" on radar_sites        using (auth.role() = 'service_role');
create policy "service_role_only" on radar_lanes        using (auth.role() = 'service_role');
create policy "service_role_only" on site_verifications using (auth.role() = 'service_role');
create policy "service_role_only" on queries            using (auth.role() = 'service_role');
create policy "service_role_only" on payments           using (auth.role() = 'service_role');
create policy "service_role_only" on sync_jobs          using (auth.role() = 'service_role');
create policy "service_role_only" on dataset_sources    using (auth.role() = 'service_role');
create policy "service_role_only" on admin_audit_logs   using (auth.role() = 'service_role');
