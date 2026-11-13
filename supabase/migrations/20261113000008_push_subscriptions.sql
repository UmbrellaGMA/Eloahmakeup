-- =============================================================================
-- Eloah Make Up — App do painel (PWA) com notificações push
-- Cada aparelho de administrador registra uma inscrição Web Push.
-- Gravação somente pelo servidor (service role) após validar o administrador.
-- =============================================================================

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  device_name  text,
  user_agent   text,
  -- tipos de aviso que este aparelho quer receber
  preferences  jsonb not null default '{"order_created":true,"new_sale":true,"order_cancelled":true,"shipped":true,"delivered":true,"refunded":true}'::jsonb,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  failures     int not null default 0
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists eloah_push_admin_read on public.push_subscriptions;
create policy eloah_push_admin_read on public.push_subscriptions
  for select to authenticated using (public.is_admin() and user_id = auth.uid());

revoke insert, update, delete on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;
