-- Lumo core schema.
--
-- Data minimisation is a hard rule: no table holds ID numbers, ID images, bank account
-- numbers or transactions. Verification rows store a result band, a provider reference and
-- dates only. tests/schema.test.ts fails the build if a column with a sensitive name appears.
--
-- Row-level security: the app runs every user request as the NOLOGIN role lumo_app with
-- app.user_id set for the transaction (see lib/db.ts). Policies below decide what each user
-- can see. Background jobs, auth and webhooks use the owner connection, which bypasses RLS,
-- and live only in server modules that never take a user id from the client.

create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'lumo_app') then
    create role lumo_app nologin;
  end if;
end $$;

-- ---------- helpers ----------
create or replace function app_uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- ---------- core tables ----------
create table users (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('renter', 'investor', 'agent', 'admin')),
  name text,
  email text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- What a renter or investor tells agents. Only fields the NSW reform allows: no photos,
-- social media, children's details, appearance or any protected attribute.
create table profiles (
  user_id uuid primary key references users(id) on delete cascade,
  move_in_date date,
  occupants int check (occupants between 1 and 12),
  pets text check (pets in ('none', 'cat', 'dog', 'other')),
  max_rent_weekly int,
  max_price int,
  commute_place text,          -- a label such as "UNSW Kensington"
  commute_lat double precision,
  commute_lng double precision,
  investor_strategy text check (investor_strategy in ('growth', 'cashflow')),
  min_yield numeric(4,2),
  no_risk_overlay boolean not null default false,
  property_kind text check (property_kind in ('any', 'house', 'unit')) default 'any',
  consented_collection_at timestamptz,
  onboarded_at timestamptz
);

create table verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('id', 'income', 'bond', 'reference', 'finance')),
  status text not null check (status in ('pending', 'passed', 'failed')),
  result_band text,            -- e.g. '3x', '2.5x', 'yes', '2 documents', 'up_to_900k'
  provider text not null,
  provider_ref text,           -- the provider's session id, never a document number
  checked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index on verifications (user_id, type, created_at desc);

-- A referee confirms a past tenancy with one click. The referee email is stored encrypted
-- (field-level, AES-256-GCM in lib/crypto.ts) and dropped once they answer.
create table reference_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  referee_email_enc text,
  past_address text not null,
  status text not null default 'sent' check (status in ('sent', 'confirmed', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create table agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  licence_no text not null unique,
  licence_status text not null,
  licence_checked_at timestamptz not null,
  leasing_email text not null,
  plan text not null default 'pilot' check (plan in ('pilot', 'agency', 'none')),
  billing_status text not null default 'trial' check (billing_status in ('trial', 'active', 'past_due', 'cancelled')),
  billing_customer_ref text,
  created_at timestamptz not null default now()
);

create table agents (
  user_id uuid primary key references users(id) on delete cascade,
  agency_id uuid not null references agencies(id) on delete cascade,
  licence_no text,
  role text not null check (role in ('owner', 'agent')),
  totp_secret_enc text,        -- encrypted; set once 2FA is enrolled
  totp_enabled_at timestamptz,
  removed_at timestamptz
);
create index on agents (agency_id);

create table listings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  assigned_agent_email text,
  address text not null,
  suburb text not null,
  postcode text,
  lat double precision,
  lng double precision,
  type text not null check (type in ('rent', 'sale')),
  kind text not null default 'unit' check (kind in ('house', 'unit', 'townhouse')),
  price int not null,          -- weekly rent for 'rent', asking price for 'sale'
  beds int not null,
  baths int not null,
  parking int not null default 0,
  pets_considered boolean not null default false,
  photos jsonb not null default '[]',
  photos_edited_disclosed boolean not null default false,
  description text,
  microburbs_property_id text, -- GNAF PID
  boosted_until timestamptz,
  status text not null default 'active' check (status in ('active', 'leased', 'sold', 'withdrawn')),
  created_at timestamptz not null default now()
);
create index on listings (type, status, suburb);

create table house_cards (
  listing_id uuid primary key references listings(id) on delete cascade,
  card_json jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Suburb-level Microburbs answers, shared across listings (30 day cache).
create table suburb_cache (
  suburb text primary key,
  data_json jsonb not null,
  fetched_at timestamptz not null default now()
);

create table swipes (
  user_id uuid not null references users(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  direction text not null check (direction in ('right', 'left', 'save')),
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index on swipes (listing_id, direction);

create table agent_swipes (
  agent_id uuid not null references users(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  direction text not null check (direction in ('right', 'left')),
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  agent_email text not null,
  status text not null default 'new'
    check (status in ('new', 'inspection', 'applied', 'approved', 'declined', 'waitlisted', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create table inspection_slots (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  starts_at timestamptz not null,
  minutes int not null default 15,
  capacity int not null default 6
);

create table inspections (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  slot_id uuid not null references inspection_slots(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (match_id)
);

create table emails (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete set null,
  "to" text not null,
  template text not null,
  provider_ref text,
  sent_at timestamptz not null default now(),
  opened_at timestamptz
);

-- Development-only copy of sent emails, so the pilot runs without an email provider.
-- Empty in production (lib/providers/email.ts only writes it when EMAIL_PROVIDER=outbox).
create table dev_outbox (
  id uuid primary key default gen_random_uuid(),
  "to" text not null,
  subject text not null,
  html text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table billing_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  kind text not null check (kind in ('plan', 'boost', 'investor_lead')),
  amount_cents int not null,
  listing_id uuid references listings(id) on delete set null,
  match_id uuid references matches(id) on delete set null,
  provider_ref text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'waived')),
  created_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id) on delete set null,
  listing_id uuid references listings(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------- auth ----------
create table login_tokens (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  mfa_ok boolean not null default false,
  bot_checked_at timestamptz,  -- last passed Turnstile check; swiping needs one in the last hour
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index on sessions (user_id);

-- Signed, single-use links in emails (book inspection, send application, reroute, referee).
create table action_tokens (
  token_hash text primary key,
  action text not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- ---------- audit log (append-only) ----------
create table audit_log (
  id bigserial primary key,
  actor text not null,
  action text not null,
  target text,
  at timestamptz not null default now()
);
create or replace function audit_log_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function audit_log_immutable();

-- ---------- access helpers (security definer so policies don't recurse) ----------
create or replace function app_agency_id() returns uuid language sql stable security definer set search_path = public as $$
  select agency_id from agents where user_id = app_uid() and removed_at is null
$$;

-- True when the current user is an active agent whose agency has a listing the target user
-- swiped right on. This is the only way an agent ever sees a renter.
create or replace function agent_can_see_user(target uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from swipes s join listings l on l.id = s.listing_id
    where s.user_id = target and s.direction = 'right' and l.agency_id = app_agency_id()
  )
$$;

create or replace function app_is_owner() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from agents where user_id = app_uid() and role = 'owner' and removed_at is null)
$$;

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from users where id = app_uid() and role = 'admin')
$$;

-- ---------- grants ----------
grant usage on schema public to lumo_app;
grant select, insert, update, delete on users, profiles, verifications, reference_requests, agencies, agents,
  listings, swipes, agent_swipes, matches, inspection_slots, inspections, reports to lumo_app;
grant select on house_cards, emails, billing_events to lumo_app;
grant insert on audit_log to lumo_app;
grant usage on sequence audit_log_id_seq to lumo_app;
grant execute on function app_uid(), app_agency_id(), agent_can_see_user(uuid), app_is_owner(), is_admin() to lumo_app;

-- ---------- row-level security ----------
alter table users enable row level security;
alter table profiles enable row level security;
alter table verifications enable row level security;
alter table reference_requests enable row level security;
alter table agencies enable row level security;
alter table agents enable row level security;
alter table listings enable row level security;
alter table house_cards enable row level security;
alter table swipes enable row level security;
alter table agent_swipes enable row level security;
alter table matches enable row level security;
alter table inspection_slots enable row level security;
alter table inspections enable row level security;
alter table emails enable row level security;
alter table billing_events enable row level security;
alter table reports enable row level security;
alter table audit_log enable row level security;

-- users: yourself, or (agents) people who liked your agency's listings, or teammates.
create policy users_self on users for all using (id = app_uid()) with check (id = app_uid());
create policy users_agent_leads on users for select using (agent_can_see_user(id));
create policy users_team on users for select using (
  exists (select 1 from agents a where a.user_id = users.id and a.agency_id = app_agency_id()));

create policy profiles_self on profiles for all using (user_id = app_uid()) with check (user_id = app_uid());
create policy profiles_agent_leads on profiles for select using (agent_can_see_user(user_id));

-- Verifications are written only by the server after a provider webhook (owner connection),
-- so users can read their own but not insert or edit them.
create policy verifications_self on verifications for select using (user_id = app_uid());
create policy verifications_agent_leads on verifications for select using (agent_can_see_user(user_id));
create policy verifications_self_delete on verifications for delete using (user_id = app_uid());

create policy refs_self on reference_requests for all using (user_id = app_uid()) with check (user_id = app_uid());

create policy agencies_member on agencies for select using (id = app_agency_id());
create policy agencies_owner_update on agencies for update using (id = app_agency_id() and app_is_owner());

create policy agents_team on agents for select using (agency_id = app_agency_id());
create policy agents_owner_manage on agents for update using (agency_id = app_agency_id() and app_is_owner());

-- Listings: anyone signed in sees active listings; agents manage their agency's.
create policy listings_read on listings for select using (status = 'active' or agency_id = app_agency_id());
create policy listings_agency_write on listings for insert with check (agency_id = app_agency_id());
create policy listings_agency_update on listings for update using (agency_id = app_agency_id());
create policy listings_agency_delete on listings for delete using (agency_id = app_agency_id());

create policy house_cards_read on house_cards for select using (true);

create policy swipes_self on swipes for all using (user_id = app_uid()) with check (user_id = app_uid());
create policy swipes_agency on swipes for select using (
  exists (select 1 from listings l where l.id = swipes.listing_id and l.agency_id = app_agency_id()));

create policy agent_swipes_agency on agent_swipes for all
  using (exists (select 1 from listings l where l.id = agent_swipes.listing_id and l.agency_id = app_agency_id()))
  with check (agent_id = app_uid() and agent_can_see_user(user_id)
    and exists (select 1 from listings l where l.id = agent_swipes.listing_id and l.agency_id = app_agency_id()));

create policy matches_self on matches for select using (user_id = app_uid());
create policy matches_agency on matches for select using (
  exists (select 1 from listings l where l.id = matches.listing_id and l.agency_id = app_agency_id()));
create policy matches_agency_update on matches for update using (
  exists (select 1 from listings l where l.id = matches.listing_id and l.agency_id = app_agency_id()));

create policy slots_read on inspection_slots for select using (true);
create policy slots_agency on inspection_slots for all
  using (exists (select 1 from listings l where l.id = inspection_slots.listing_id and l.agency_id = app_agency_id()))
  with check (exists (select 1 from listings l where l.id = inspection_slots.listing_id and l.agency_id = app_agency_id()));

create policy inspections_party on inspections for select using (
  exists (select 1 from matches m join listings l on l.id = m.listing_id
          where m.id = inspections.match_id and (m.user_id = app_uid() or l.agency_id = app_agency_id())));
create policy inspections_renter_book on inspections for insert with check (
  exists (select 1 from matches m where m.id = inspections.match_id and m.user_id = app_uid()));

create policy emails_agency on emails for select using (
  exists (select 1 from matches m join listings l on l.id = m.listing_id
          where m.id = emails.match_id and l.agency_id = app_agency_id()));

create policy billing_agency on billing_events for select using (agency_id = app_agency_id());

create policy reports_insert on reports for insert with check (reporter_id = app_uid());
create policy reports_admin on reports for select using (is_admin());

create policy audit_insert on audit_log for insert with check (true);
create policy audit_admin_read on audit_log for select using (is_admin());
