-- =============================================================================
-- Eloah Make Up — Funções, triggers e regras de negócio
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permissões administrativas
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_roles ar where ar.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_roles ar
    where ar.user_id = (select auth.uid()) and ar.role = 'owner'
  );
$$;

-- Indica se a sessão atual é privilegiada (service_role/postgres), ou seja,
-- código de servidor confiável — nunca o navegador.
create or replace function public.is_privileged_session()
returns boolean
language sql
stable
set search_path = ''
as $$
  -- current_user reflete o papel efetivo: 'authenticated'/'anon' para requisições
  -- do navegador; 'service_role' para o servidor; 'postgres' dentro de funções
  -- SECURITY DEFINER e migrations.
  select current_user in ('postgres', 'service_role', 'supabase_admin');
$$;

-- -----------------------------------------------------------------------------
-- Perfil criado automaticamente a cada novo usuário do Supabase Auth
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone, accepts_marketing)
  values (
    new.id,
    new.email,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 160), ''),
    case when coalesce(new.raw_user_meta_data ->> 'phone', '') ~ '^[0-9]{10,13}$'
         then new.raw_user_meta_data ->> 'phone' end,
    coalesce((new.raw_user_meta_data ->> 'accepts_marketing')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Busca: texto normalizado (sem acentos, minúsculo)
-- -----------------------------------------------------------------------------
create or replace function public.products_set_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text := lower(extensions.unaccent(
    coalesce(new.name, '') || ' ' || coalesce(new.brand, '') || ' ' ||
    coalesce(new.sku, '') || ' ' || coalesce(array_to_string(new.tags, ' '), '')
  ));
  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists products_search_text on public.products;
create trigger products_search_text
  before insert or update of name, brand, sku, tags, status on public.products
  for each row execute function public.products_set_search_text();

-- -----------------------------------------------------------------------------
-- Estoque: linha de inventário criada automaticamente
-- -----------------------------------------------------------------------------
create or replace function public.products_create_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory (product_id, variant_id, quantity)
  values (new.id, null, 0)
  on conflict on constraint inventory_product_variant_unique do nothing;
  return new;
end;
$$;

drop trigger if exists products_create_inventory on public.products;
create trigger products_create_inventory
  after insert on public.products
  for each row execute function public.products_create_inventory();

create or replace function public.variants_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  if tg_op = 'INSERT' then
    insert into public.inventory (product_id, variant_id, quantity)
    values (new.product_id, new.id, 0)
    on conflict on constraint inventory_product_variant_unique do nothing;
  end if;

  update public.products p
     set has_variants = exists (
       select 1 from public.product_variants v where v.product_id = v_product
     )
   where p.id = v_product;

  return coalesce(new, old);
end;
$$;

drop trigger if exists variants_after_change on public.product_variants;
create trigger variants_after_change
  after insert or delete on public.product_variants
  for each row execute function public.variants_after_change();

-- -----------------------------------------------------------------------------
-- Endereço padrão: ao marcar um, desmarca os demais
-- -----------------------------------------------------------------------------
create or replace function public.addresses_single_default()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_default then
    update public.addresses
       set is_default = false
     where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end;
$$;

drop trigger if exists addresses_single_default on public.addresses;
create trigger addresses_single_default
  before insert or update of is_default on public.addresses
  for each row when (new.is_default)
  execute function public.addresses_single_default();

-- -----------------------------------------------------------------------------
-- Preço efetivo de um item (produto ou variação)
-- -----------------------------------------------------------------------------
create or replace function public.effective_unit_price(p_product_id uuid, p_variant_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case
    when v.id is not null then
      case
        when coalesce(v.promo_price, p.promo_price) is not null
         and coalesce(v.promo_price, p.promo_price) < coalesce(v.price, p.price)
        then coalesce(v.promo_price, p.promo_price)
        else coalesce(v.price, p.price)
      end
    else coalesce(p.promo_price, p.price)
  end
  from public.products p
  left join public.product_variants v on v.id = p_variant_id and v.product_id = p.id
  where p.id = p_product_id;
$$;

-- -----------------------------------------------------------------------------
-- Cupom: avalia validade e desconto (lança exceção com motivo)
-- -----------------------------------------------------------------------------
create or replace function public.evaluate_coupon(p_code text, p_user_id uuid, p_subtotal numeric)
returns table (coupon_id uuid, code text, discount numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.coupons%rowtype;
  v_user_uses integer;
  v_discount numeric;
begin
  select * into c from public.coupons where public.coupons.code = upper(trim(p_code));
  if not found or not c.is_active then
    raise exception 'COUPON_INVALID: Cupom inválido ou inativo.';
  end if;
  if c.starts_at is not null and now() < c.starts_at then
    raise exception 'COUPON_INVALID: Este cupom ainda não está disponível.';
  end if;
  if c.expires_at is not null and now() > c.expires_at then
    raise exception 'COUPON_INVALID: Este cupom expirou.';
  end if;
  if c.max_uses is not null and c.uses_count >= c.max_uses then
    raise exception 'COUPON_INVALID: Este cupom atingiu o limite de utilizações.';
  end if;
  if p_subtotal < c.min_order_value then
    raise exception 'COUPON_INVALID: Pedido mínimo de R$ % para este cupom.',
      to_char(c.min_order_value, 'FM999G990D00');
  end if;
  if p_user_id is not null and c.max_uses_per_user is not null then
    select count(*) into v_user_uses
      from public.coupon_usages u where u.coupon_id = c.id and u.user_id = p_user_id;
    if v_user_uses >= c.max_uses_per_user then
      raise exception 'COUPON_INVALID: Você já utilizou este cupom.';
    end if;
  end if;

  if c.type = 'percentage' then
    v_discount := round(p_subtotal * c.value / 100, 2);
  else
    v_discount := c.value;
  end if;
  v_discount := least(v_discount, p_subtotal);

  return query select c.id, c.code, v_discount;
end;
$$;

-- -----------------------------------------------------------------------------
-- Criação atômica do pedido
--   * valida carrinho, produtos, variações e estoque (com lock de linha)
--   * recalcula preços a partir do banco (nunca do navegador)
--   * valida cupom e aplica desconto
--   * reserva (debita) estoque
--   * limpa o carrinho
-- O frete (p_shipping) é cotado novamente pelo servidor na SuperFrete antes da
-- chamada; esta função só é executável pelo service_role.
-- -----------------------------------------------------------------------------
create or replace function public.place_order(
  p_user_id        uuid,
  p_cart_id        uuid,
  p_customer       jsonb,
  p_address        jsonb,
  p_shipping       jsonb,
  p_coupon_code    text default null,
  p_payment_method text default null,
  p_notes          text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cart        public.carts%rowtype;
  v_item        record;
  v_stock       integer;
  v_unit        numeric;
  v_subtotal    numeric := 0;
  v_discount    numeric := 0;
  v_shipping    numeric;
  v_coupon_id   uuid;
  v_coupon_code text;
  v_free_min    numeric;
  v_order       public.orders%rowtype;
  v_items       jsonb := '[]'::jsonb;
  v_count       integer := 0;
begin
  select * into v_cart from public.carts
   where id = p_cart_id and user_id = p_user_id
   for update;
  if not found then
    raise exception 'CART_NOT_FOUND: Carrinho não encontrado.';
  end if;

  for v_item in
    select ci.product_id, ci.variant_id, ci.quantity,
           p.name as product_name, p.sku as product_sku, p.status, p.has_variants,
           v.name as variant_name, v.sku as variant_sku, v.is_active as variant_active,
           (select pi.url from public.product_images pi
             where pi.product_id = p.id order by pi.position, pi.created_at limit 1) as image_url
      from public.cart_items ci
      join public.products p on p.id = ci.product_id
      left join public.product_variants v on v.id = ci.variant_id
     where ci.cart_id = v_cart.id
     order by ci.created_at
  loop
    if v_item.status <> 'active' then
      raise exception 'PRODUCT_UNAVAILABLE: O produto "%" não está mais disponível.', v_item.product_name;
    end if;
    if v_item.has_variants and v_item.variant_id is null then
      raise exception 'VARIANT_REQUIRED: Selecione uma variação para "%".', v_item.product_name;
    end if;
    if v_item.variant_id is not null and not coalesce(v_item.variant_active, false) then
      raise exception 'PRODUCT_UNAVAILABLE: A variação "%" de "%" não está disponível.',
        v_item.variant_name, v_item.product_name;
    end if;

    select i.quantity into v_stock from public.inventory i
     where i.product_id = v_item.product_id
       and i.variant_id is not distinct from v_item.variant_id
     for update;

    if coalesce(v_stock, 0) < v_item.quantity then
      raise exception 'OUT_OF_STOCK: Estoque insuficiente para "%" (disponível: %).',
        v_item.product_name || coalesce(' — ' || v_item.variant_name, ''), coalesce(v_stock, 0);
    end if;

    v_unit := public.effective_unit_price(v_item.product_id, v_item.variant_id);
    v_subtotal := v_subtotal + v_unit * v_item.quantity;
    v_count := v_count + 1;

    v_items := v_items || jsonb_build_object(
      'product_id', v_item.product_id,
      'variant_id', v_item.variant_id,
      'product_name', v_item.product_name,
      'variant_name', v_item.variant_name,
      'sku', coalesce(v_item.variant_sku, v_item.product_sku),
      'image_url', v_item.image_url,
      'unit_price', v_unit,
      'quantity', v_item.quantity
    );
  end loop;

  if v_count = 0 then
    raise exception 'CART_EMPTY: Seu carrinho está vazio.';
  end if;

  -- Cupom
  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    perform 1 from public.coupons where code = upper(trim(p_coupon_code)) for update;
    select e.coupon_id, e.code, e.discount into v_coupon_id, v_coupon_code, v_discount
      from public.evaluate_coupon(p_coupon_code, p_user_id, v_subtotal) e;
  end if;

  -- Frete (cotado pelo servidor)
  v_shipping := coalesce((p_shipping ->> 'price')::numeric, -1);
  if v_shipping < 0 or (p_shipping ->> 'service_id') is null then
    raise exception 'SHIPPING_REQUIRED: Selecione uma modalidade de frete.';
  end if;
  select free_shipping_min into v_free_min from public.store_settings where id = 1;
  if v_free_min is not null and (v_subtotal - v_discount) >= v_free_min then
    v_shipping := 0;
  end if;

  if (v_subtotal - v_discount + v_shipping) <= 0 then
    raise exception 'TOTAL_INVALID: O total do pedido deve ser maior que zero.';
  end if;

  insert into public.orders (
    user_id, customer_name, customer_email, customer_phone, customer_cpf,
    shipping_address, subtotal, discount_total, shipping_total, total,
    coupon_id, coupon_code, shipping_service_id, shipping_service_name,
    shipping_carrier, shipping_days, shipping_package, payment_method, notes
  ) values (
    p_user_id,
    p_customer ->> 'name',
    p_customer ->> 'email',
    nullif(p_customer ->> 'phone', ''),
    nullif(p_customer ->> 'cpf', ''),
    p_address,
    round(v_subtotal, 2),
    round(v_discount, 2),
    round(v_shipping, 2),
    round(v_subtotal - v_discount + v_shipping, 2),
    v_coupon_id,
    v_coupon_code,
    (p_shipping ->> 'service_id')::integer,
    p_shipping ->> 'service_name',
    p_shipping ->> 'carrier',
    nullif(p_shipping ->> 'delivery_days', '')::integer,
    p_shipping -> 'package',
    p_payment_method,
    nullif(left(coalesce(p_notes, ''), 500), '')
  )
  returning * into v_order;

  insert into public.order_items (
    order_id, product_id, variant_id, product_name, variant_name, sku, image_url,
    unit_price, quantity, total
  )
  select v_order.id,
         (x ->> 'product_id')::uuid,
         nullif(x ->> 'variant_id', '')::uuid,
         x ->> 'product_name',
         x ->> 'variant_name',
         x ->> 'sku',
         x ->> 'image_url',
         (x ->> 'unit_price')::numeric,
         (x ->> 'quantity')::integer,
         round((x ->> 'unit_price')::numeric * (x ->> 'quantity')::integer, 2)
    from jsonb_array_elements(v_items) x;

  -- Reserva de estoque
  update public.inventory i
     set quantity = i.quantity - oi.quantity
    from public.order_items oi
   where oi.order_id = v_order.id
     and i.product_id = oi.product_id
     and i.variant_id is not distinct from oi.variant_id;

  if v_coupon_id is not null then
    insert into public.coupon_usages (coupon_id, order_id, user_id, discount_amount)
    values (v_coupon_id, v_order.id, p_user_id, v_discount);
    update public.coupons set uses_count = uses_count + 1 where id = v_coupon_id;
  end if;

  delete from public.cart_items where cart_id = v_cart.id;
  update public.carts set coupon_code = null where id = v_cart.id;

  insert into public.order_status_history (order_id, to_status, to_payment, source, note, changed_by)
  values (v_order.id, v_order.status, v_order.payment_status, 'checkout', 'Pedido criado', p_user_id);

  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- Devolve o estoque reservado (idempotente) e libera o uso do cupom
-- -----------------------------------------------------------------------------
create or replace function public.release_order_stock(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.stock_released then
    return false;
  end if;

  update public.inventory i
     set quantity = i.quantity + oi.quantity
    from public.order_items oi
   where oi.order_id = p_order_id
     and i.product_id = oi.product_id
     and i.variant_id is not distinct from oi.variant_id;

  if v_order.coupon_id is not null then
    delete from public.coupon_usages where order_id = p_order_id;
    update public.coupons set uses_count = greatest(uses_count - 1, 0) where id = v_order.coupon_id;
  end if;

  update public.orders set stock_released = true where id = p_order_id;
  return true;
end;
$$;

-- Debita novamente o estoque (pagamento aprovado após cancelamento por expiração)
create or replace function public.reserve_order_stock(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_short integer;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not v_order.stock_released then
    return true;
  end if;

  perform 1 from public.inventory i
    join public.order_items oi
      on i.product_id = oi.product_id and i.variant_id is not distinct from oi.variant_id
   where oi.order_id = p_order_id
   for update of i;

  select count(*) into v_short
    from public.order_items oi
    join public.inventory i
      on i.product_id = oi.product_id and i.variant_id is not distinct from oi.variant_id
   where oi.order_id = p_order_id and i.quantity < oi.quantity;

  if v_short > 0 then
    return false;
  end if;

  update public.inventory i
     set quantity = i.quantity - oi.quantity
    from public.order_items oi
   where oi.order_id = p_order_id
     and i.product_id = oi.product_id
     and i.variant_id is not distinct from oi.variant_id;

  update public.orders set stock_released = false where id = p_order_id;
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Sincroniza o pedido com o status financeiro confirmado pelo Mercado Pago.
-- Só pode ser chamada pelo servidor (service_role) após consultar a API.
-- -----------------------------------------------------------------------------
create or replace function public.apply_payment_status(
  p_order_id uuid,
  p_status   public.payment_status,
  p_note     text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_ok boolean;
  v_first_approval boolean;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  -- Um pedido já aprovado só sai de "approved" por reembolso/cancelamento do provedor
  -- (um pagamento aprovado só pode ser revertido por reembolso/chargeback; o
  --  cancelamento/recusa de OUTRA tentativa não afeta um pedido já pago)
  if v_order.payment_status = 'approved' and p_status in ('pending', 'rejected', 'cancelled') then
    return v_order;
  end if;
  if v_order.payment_status = 'refunded' then
    return v_order;
  end if;

  if p_status = 'approved' then
    v_first_approval := v_order.paid_at is null;
    if v_order.stock_released then
      v_ok := public.reserve_order_stock(p_order_id);
      if not v_ok then
        update public.orders
           set admin_notes = concat_ws(E'\n', admin_notes,
                 '[' || to_char(now(), 'DD/MM/YYYY HH24:MI') || '] ATENÇÃO: pagamento aprovado após cancelamento e sem estoque suficiente. Avaliar reembolso.')
         where id = p_order_id;
      end if;
    end if;

    update public.orders
       set payment_status = 'approved',
           status = case when status in ('awaiting_payment', 'cancelled') then 'paid'::public.order_status else status end,
           paid_at = coalesce(paid_at, now()),
           cancelled_at = null
     where id = p_order_id
     returning * into v_order;

    if v_first_approval then
      update public.products p
         set sales_count = p.sales_count + oi.quantity
        from public.order_items oi
       where oi.order_id = p_order_id and oi.product_id = p.id;
    end if;

  elsif p_status = 'rejected' then
    -- Cliente pode tentar novamente com outro meio; o pedido segue aguardando.
    update public.orders set payment_status = 'rejected'
     where id = p_order_id returning * into v_order;

  elsif p_status = 'pending' then
    update public.orders set payment_status = 'pending'
     where id = p_order_id and status = 'awaiting_payment' returning * into v_order;

  elsif p_status in ('cancelled', 'refunded') then
    update public.orders
       set payment_status = p_status,
           status = case when status in ('shipped', 'delivered') then status else 'cancelled'::public.order_status end,
           cancelled_at = case when status in ('shipped', 'delivered') then cancelled_at else now() end
     where id = p_order_id
     returning * into v_order;
    if v_order.status = 'cancelled' then
      perform public.release_order_stock(p_order_id);
    end if;
  end if;

  if p_note is not null then
    insert into public.order_status_history (order_id, to_status, to_payment, source, note)
    values (p_order_id, v_order.status, v_order.payment_status, 'mercadopago', p_note);
  end if;

  select * into v_order from public.orders where id = p_order_id;
  return v_order;
end;
$$;

-- Cancela pedido aguardando pagamento (expiração ou solicitação) e devolve estoque
create or replace function public.cancel_unpaid_order(p_order_id uuid, p_reason text default null)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.payment_status = 'approved' or v_order.status <> 'awaiting_payment' then
    raise exception 'ORDER_NOT_CANCELLABLE: Apenas pedidos aguardando pagamento podem ser cancelados.';
  end if;

  update public.orders
     set status = 'cancelled',
         payment_status = case when payment_status = 'pending' then 'cancelled'::public.payment_status else payment_status end,
         cancelled_at = now()
   where id = p_order_id
  returning * into v_order;

  perform public.release_order_stock(p_order_id);

  insert into public.order_status_history (order_id, to_status, to_payment, source, note)
  values (p_order_id, 'cancelled', v_order.payment_status, 'system', coalesce(p_reason, 'Pedido cancelado'));

  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- Guarda de integridade dos pedidos
--   * Sessões não privilegiadas (inclusive administradores via navegador) só
--     podem alterar status operacional e notas internas, seguindo transições
--     permitidas. Valores e status financeiro são imutáveis para elas.
--   * Nenhuma sessão pode marcar "pago" sem pagamento aprovado, nem "enviado"
--     sem postagem confirmada pela SuperFrete.
-- -----------------------------------------------------------------------------
create or replace function public.orders_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ignored text[] := array['status', 'admin_notes', 'updated_at', 'delivered_at'];
begin
  if not public.is_privileged_session() then
    if (to_jsonb(new) - v_ignored) is distinct from (to_jsonb(old) - v_ignored) then
      raise exception 'ORDER_FIELD_LOCKED: Apenas o status operacional e as notas internas podem ser alterados.'
        using errcode = '42501';
    end if;

    if new.status is distinct from old.status and not (
         (old.status = 'paid'          and new.status = 'preparing')
      or (old.status = 'preparing'     and new.status in ('ready_to_ship', 'paid'))
      or (old.status = 'ready_to_ship' and new.status = 'preparing')
      or (old.status = 'shipped'       and new.status = 'delivered')
    ) then
      raise exception 'ORDER_TRANSITION_NOT_ALLOWED: Transição de "%" para "%" não permitida.', old.status, new.status
        using errcode = '42501';
    end if;
  end if;

  if new.status in ('paid', 'preparing', 'ready_to_ship')
     and new.status is distinct from old.status
     and new.payment_status <> 'approved' then
    raise exception 'PAYMENT_NOT_APPROVED: O pedido só pode avançar após pagamento aprovado pelo Mercado Pago.'
      using errcode = '42501';
  end if;

  if new.status = 'shipped' and old.status is distinct from 'shipped' then
    if not exists (
      select 1 from public.shipments s
       where s.order_id = new.id and s.status in ('posted', 'delivered')
    ) then
      raise exception 'SHIPMENT_NOT_POSTED: O pedido só pode ser marcado como enviado após a postagem confirmada.'
        using errcode = '42501';
    end if;
    new.shipped_at := coalesce(new.shipped_at, now());
  end if;

  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists orders_guard_update on public.orders;
create trigger orders_guard_update
  before update on public.orders
  for each row execute function public.orders_guard_update();

-- Histórico automático de mudanças de status
create or replace function public.orders_log_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status or new.payment_status is distinct from old.payment_status then
    insert into public.order_status_history (
      order_id, from_status, to_status, from_payment, to_payment, changed_by, source
    ) values (
      new.id, old.status, new.status, old.payment_status, new.payment_status,
      (select auth.uid()),
      case when (select auth.uid()) is not null then 'admin' else 'system' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_log_status on public.orders;
create trigger orders_log_status
  after update on public.orders
  for each row execute function public.orders_log_status();

-- Pagamentos e envios só podem ser gravados por código de servidor confiável
create or replace function public.require_privileged_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_privileged_session() then
    raise exception 'PRIVILEGED_WRITE_ONLY: Esta tabela só pode ser alterada pelo servidor.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['payments', 'shipments', 'shipment_tracking', 'webhook_events', 'admin_roles', 'coupon_usages'] loop
    execute format('drop trigger if exists require_privileged_write on public.%I', t);
    execute format('create trigger require_privileged_write before insert or update or delete on public.%I
                    for each row execute function public.require_privileged_write()', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Dashboard administrativo
-- -----------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_since timestamptz := date_trunc('day', now()) - make_interval(days => greatest(p_days, 1) - 1);
begin
  -- SECURITY DEFINER: current_user é o dono da função; validar pelo JWT.
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'revenue_total',     coalesce((select sum(total) from public.orders where payment_status = 'approved'), 0),
    'revenue_period',    coalesce((select sum(total) from public.orders where payment_status = 'approved' and paid_at >= v_since), 0),
    'sales_count',       (select count(*) from public.orders where payment_status = 'approved'),
    'orders_total',      (select count(*) from public.orders),
    'orders_pending',    (select count(*) from public.orders where status = 'awaiting_payment'),
    'orders_paid',       (select count(*) from public.orders where status in ('paid', 'preparing', 'ready_to_ship')),
    'orders_shipped',    (select count(*) from public.orders where status in ('shipped', 'delivered')),
    'products_total',    (select count(*) from public.products),
    'products_active',   (select count(*) from public.products where status = 'active'),
    'customers_total',   (select count(*) from public.profiles),
    'low_stock',         (select count(*) from public.inventory i
                            join public.products p on p.id = i.product_id
                           where p.status = 'active'
                             and i.quantity <= i.low_stock_threshold
                             and ((p.has_variants and i.variant_id is not null) or (not p.has_variants and i.variant_id is null))),
    'average_ticket',    coalesce((select round(avg(total), 2) from public.orders where payment_status = 'approved'), 0),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'revenue', d.revenue, 'orders', d.orders) order by d.day)
      from (
        select gs::date as day,
               coalesce(sum(o.total) filter (where o.payment_status = 'approved'), 0) as revenue,
               count(o.id) as orders
          from generate_series(v_since, date_trunc('day', now()), interval '1 day') gs
          left join public.orders o on date_trunc('day', o.created_at) = gs
         group by gs
      ) d
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Execução de funções sensíveis: somente service_role
-- -----------------------------------------------------------------------------
revoke all on function public.place_order(uuid, uuid, jsonb, jsonb, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.release_order_stock(uuid) from public, anon, authenticated;
revoke all on function public.reserve_order_stock(uuid) from public, anon, authenticated;
revoke all on function public.apply_payment_status(uuid, public.payment_status, text) from public, anon, authenticated;
revoke all on function public.cancel_unpaid_order(uuid, text) from public, anon, authenticated;
revoke all on function public.evaluate_coupon(text, uuid, numeric) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;

grant execute on function public.place_order(uuid, uuid, jsonb, jsonb, jsonb, text, text, text) to service_role;
grant execute on function public.release_order_stock(uuid) to service_role;
grant execute on function public.reserve_order_stock(uuid) to service_role;
grant execute on function public.apply_payment_status(uuid, public.payment_status, text) to service_role;
grant execute on function public.cancel_unpaid_order(uuid, text) to service_role;
grant execute on function public.evaluate_coupon(text, uuid, numeric) to service_role;

revoke all on function public.admin_dashboard_stats(integer) from public, anon;
grant execute on function public.admin_dashboard_stats(integer) to authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_owner() to authenticated, service_role;
