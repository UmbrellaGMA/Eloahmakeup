-- =============================================================================
-- Eloah Make Up — Row Level Security
-- Regra geral:
--   * visitantes (anon): somente leitura de catálogo/conteúdo público
--   * clientes (authenticated): apenas os próprios dados
--   * administradores (admin_roles): leitura ampla e escrita no catálogo/conteúdo
--   * service_role (servidor): ignora RLS — usado só em rotas de servidor
-- =============================================================================

alter table public.profiles              enable row level security;
alter table public.admin_roles           enable row level security;
alter table public.addresses             enable row level security;
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.product_images        enable row level security;
alter table public.product_variants      enable row level security;
alter table public.inventory             enable row level security;
alter table public.carts                 enable row level security;
alter table public.cart_items            enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_status_history  enable row level security;
alter table public.payments              enable row level security;
alter table public.shipments             enable row level security;
alter table public.shipment_tracking     enable row level security;
alter table public.coupons               enable row level security;
alter table public.coupon_usages         enable row level security;
alter table public.favorites             enable row level security;
alter table public.banners               enable row level security;
alter table public.store_settings        enable row level security;
alter table public.webhook_events        enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.integration_logs      enable row level security;

-- Remove políticas anteriores com os mesmos nomes (reexecução segura)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
     where schemaname = 'public' and policyname like 'eloah_%'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- profiles --------------------------------------------------------------------
create policy eloah_profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy eloah_profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- admin_roles: somente leitura (a própria linha, ou todas para administradores).
-- Não existe política de escrita: só service_role/SQL pode conceder permissões.
create policy eloah_admin_roles_select on public.admin_roles
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

-- addresses -------------------------------------------------------------------
create policy eloah_addresses_select on public.addresses
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy eloah_addresses_insert on public.addresses
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy eloah_addresses_update on public.addresses
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy eloah_addresses_delete on public.addresses
  for delete to authenticated using (user_id = (select auth.uid()));

-- Catálogo: leitura pública do que está publicado; escrita administrativa -------
create policy eloah_categories_public_read on public.categories
  for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy eloah_categories_admin_write on public.categories
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy eloah_products_public_read on public.products
  for select to anon, authenticated using (status = 'active' or (select public.is_admin()));
create policy eloah_products_admin_write on public.products
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy eloah_product_images_public_read on public.product_images
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
    or (select public.is_admin())
  );
create policy eloah_product_images_admin_write on public.product_images
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy eloah_product_variants_public_read on public.product_variants
  for select to anon, authenticated using (
    (is_active and exists (select 1 from public.products p where p.id = product_id and p.status = 'active'))
    or (select public.is_admin())
  );
create policy eloah_product_variants_admin_write on public.product_variants
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy eloah_inventory_public_read on public.inventory
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
    or (select public.is_admin())
  );
create policy eloah_inventory_admin_write on public.inventory
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Carrinho: o cliente lê o próprio carrinho; escritas passam pelo servidor ----
create policy eloah_carts_select_own on public.carts
  for select to authenticated using (user_id = (select auth.uid()));
create policy eloah_cart_items_select_own on public.cart_items
  for select to authenticated using (
    exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid()))
  );

-- Pedidos ---------------------------------------------------------------------
create policy eloah_orders_select on public.orders
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
-- Atualização administrativa limitada ao status operacional (ver orders_guard_update)
create policy eloah_orders_admin_update on public.orders
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy eloah_order_items_select on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select public.is_admin())
  );

create policy eloah_order_history_select on public.order_status_history
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select public.is_admin())
  );

-- Pagamentos: leitura do próprio pedido; sem escrita via navegador ------------
create policy eloah_payments_select on public.payments
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select public.is_admin())
  );

-- Envios / rastreamento ---------------------------------------------------------
create policy eloah_shipments_select on public.shipments
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select public.is_admin())
  );
create policy eloah_shipment_tracking_select on public.shipment_tracking
  for select to authenticated using (
    exists (
      select 1 from public.shipments s join public.orders o on o.id = s.order_id
       where s.id = shipment_id and o.user_id = (select auth.uid())
    )
    or (select public.is_admin())
  );

-- Cupons: invisíveis ao público (validados no servidor) ----------------------
create policy eloah_coupons_admin_all on public.coupons
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy eloah_coupon_usages_select on public.coupon_usages
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Favoritos -------------------------------------------------------------------
create policy eloah_favorites_select on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy eloah_favorites_insert on public.favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy eloah_favorites_delete on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));

-- Banners -----------------------------------------------------------------------
create policy eloah_banners_public_read on public.banners
  for select to anon, authenticated using (
    (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
    or (select public.is_admin())
  );
create policy eloah_banners_admin_write on public.banners
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Configurações da loja -------------------------------------------------------
create policy eloah_store_settings_public_read on public.store_settings
  for select to anon, authenticated using (true);
create policy eloah_store_settings_admin_update on public.store_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Logs e eventos: somente administradores (leitura) ---------------------------
create policy eloah_webhook_events_admin_read on public.webhook_events
  for select to authenticated using ((select public.is_admin()));
create policy eloah_integration_logs_admin_read on public.integration_logs
  for select to authenticated using ((select public.is_admin()));
create policy eloah_newsletter_admin_read on public.newsletter_subscribers
  for select to authenticated using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Privilégios de coluna: dados brutos de provedores nunca chegam ao navegador
-- -----------------------------------------------------------------------------
revoke select on public.payments from anon, authenticated;
grant select (
  id, order_id, provider, provider_payment_id, method, status, status_detail, amount,
  installments, card_brand, card_last_four, pix_qr_code, pix_qr_code_base64, pix_ticket_url,
  expires_at, approved_at, refunded_amount, created_at, updated_at
) on public.payments to authenticated;

revoke select on public.shipments from anon, authenticated;
grant select (
  id, order_id, provider, service_id, service_name, superfrete_order_id, status, provider_status,
  tracking_code, tracking_url, label_url, price, package, error_message,
  released_at, posted_at, delivered_at, cancelled_at, created_at, updated_at
) on public.shipments to authenticated;

revoke select on public.webhook_events from anon, authenticated;
grant select (
  id, provider, event_key, event_type, resource_id, signature_valid, status, attempts, error,
  processed_at, created_at
) on public.webhook_events to authenticated;

-- Visitantes não escrevem em nada
revoke insert, update, delete on all tables in schema public from anon;
