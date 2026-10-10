-- Run in the Supabase SQL editor. The app uses the service-role key server-side only.
create table if not exists public.enquiries (
  call_id text primary key,                 -- idempotency key (Vaani call id)
  phone text,
  caller_name text,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_sec int,
  outcome text not null check (outcome in ('forward','decline','clarify','escalate')),
  reason text not null default '',
  facts jsonb not null,
  criteria jsonb not null default '[]',
  handoff_note text not null default '',
  transcript text not null default '',
  recording_url text,
  booked_slot text,
  pricing_violation boolean not null default false,
  voice_cost_usd numeric not null default 0,
  llm_cost_usd numeric not null default 0,
  handoff_seconds int,
  telegram_message_id bigint,
  claimed_by text,
  hubspot_contact_id text,
  hubspot_deal_id text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists enquiries_started_idx on public.enquiries (started_at desc);

-- Contains personal data: no public access. Only the service role (bypasses RLS) reads/writes.
alter table public.enquiries enable row level security;

-- room_name -> caller phone (Vaani only sends the number in call_started)
create table if not exists public.call_meta (
  room_name text primary key,
  phone text not null,
  created_at timestamptz not null default now()
);
alter table public.call_meta enable row level security;
