-- =============================================================================
-- Eloah Make Up — Notificações por e-mail (pedido, pagamento, envio)
-- Cada aviso é registrado uma única vez por pedido/tipo/destinatário: webhooks
-- repetidos ou reprocessamentos nunca geram e-mails duplicados.
-- =============================================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references public.orders(id) on delete cascade,
  kind         text not null check (kind in (
                 'order_created', 'payment_approved', 'payment_rejected', 'order_cancelled',
                 'shipped', 'delivered', 'refunded', 'new_sale')),
  channel      text not null default 'email',
  recipient    text not null,
  status       text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_id  text,
  error        text,
  attempts     int not null default 0,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  unique (order_id, kind, recipient)
);

create index if not exists notifications_order_idx on public.notifications (order_id);
create index if not exists notifications_created_idx on public.notifications (created_at desc);

alter table public.notifications enable row level security;

-- Somente leitura para administradores (o servidor grava com a service role)
drop policy if exists eloah_notifications_admin_read on public.notifications;
create policy eloah_notifications_admin_read on public.notifications
  for select to authenticated using (public.is_admin());

revoke insert, update, delete on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
