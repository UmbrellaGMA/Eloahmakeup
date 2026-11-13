-- =============================================================================
-- Eloah Make Up — Core schema
-- Tabelas, relacionamentos, restrições e índices.
-- =============================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.order_status as enum (
    'awaiting_payment', 'paid', 'preparing', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.product_status as enum ('draft', 'active', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.coupon_type as enum ('percentage', 'fixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.shipment_status as enum (
    'pending',      -- etiqueta ainda não criada na SuperFrete
    'in_cart',      -- frete criado no carrinho SuperFrete (aguardando pagamento da etiqueta)
    'released',     -- etiqueta paga/emitida (status "released" da SuperFrete)
    'posted',       -- postagem confirmada
    'delivered',    -- entregue
    'cancelled',
    'error'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.admin_role as enum ('owner', 'admin', 'editor');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Função utilitária: updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. profiles
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (char_length(full_name) <= 160),
  email       text,
  phone       text check (phone is null or phone ~ '^[0-9]{10,13}$'),
  cpf         text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  birth_date  date,
  accepts_marketing boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (lower(email));

-- -----------------------------------------------------------------------------
-- 21. admin_roles
-- -----------------------------------------------------------------------------
create table if not exists public.admin_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       public.admin_role not null default 'admin',
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. addresses
-- -----------------------------------------------------------------------------
create table if not exists public.addresses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  label          text check (char_length(label) <= 40),
  recipient_name text not null check (char_length(recipient_name) between 3 and 160),
  phone          text check (phone is null or phone ~ '^[0-9]{10,13}$'),
  postal_code    text not null check (postal_code ~ '^[0-9]{8}$'),
  street         text not null check (char_length(street) between 2 and 200),
  number         text not null check (char_length(number) between 1 and 20),
  complement     text check (char_length(complement) <= 120),
  district       text not null check (char_length(district) between 2 and 120),
  city           text not null check (char_length(city) between 2 and 120),
  state          char(2) not null check (state ~ '^[A-Z]{2}$'),
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses (user_id);
create unique index if not exists addresses_one_default_per_user
  on public.addresses (user_id) where is_default;

-- -----------------------------------------------------------------------------
-- 3. categories
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.categories (id) on delete set null,
  name        text not null check (char_length(name) between 2 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  image_url   text,
  position    integer not null default 0,
  is_active   boolean not null default true,
  show_in_menu boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create index if not exists categories_parent_idx on public.categories (parent_id);

-- -----------------------------------------------------------------------------
-- 4. products
-- -----------------------------------------------------------------------------
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid references public.categories (id) on delete set null,
  name              text not null check (char_length(name) between 2 and 160),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sku               text not null unique check (char_length(sku) between 1 and 64),
  brand             text,
  short_description text check (char_length(short_description) <= 300),
  description       text,
  price             numeric(10, 2) not null check (price > 0),
  promo_price       numeric(10, 2) check (promo_price is null or (promo_price > 0)),
  weight_grams      integer not null default 100 check (weight_grams between 1 and 30000),
  height_cm         numeric(6, 1) not null default 2 check (height_cm between 0.4 and 100),
  width_cm          numeric(6, 1) not null default 11 check (width_cm between 8 and 100),
  length_cm         numeric(6, 1) not null default 16 check (length_cm between 13 and 100),
  status            public.product_status not null default 'draft',
  is_featured       boolean not null default false,
  is_new            boolean not null default false,
  has_variants      boolean not null default false,
  sales_count       integer not null default 0 check (sales_count >= 0),
  tags              text[] not null default '{}',
  search_text       text,
  seo_title         text check (char_length(seo_title) <= 70),
  seo_description   text check (char_length(seo_description) <= 170),
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint products_promo_lt_price check (promo_price is null or promo_price < price)
);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_status_idx on public.products (status);
create index if not exists products_featured_idx on public.products (is_featured) where status = 'active';
create index if not exists products_new_idx on public.products (is_new, created_at desc) where status = 'active';
create index if not exists products_sales_idx on public.products (sales_count desc) where status = 'active';
create index if not exists products_promo_idx on public.products (promo_price) where promo_price is not null;
create index if not exists products_name_trgm_idx on public.products using gin (search_text extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- 5. product_images
-- -----------------------------------------------------------------------------
create table if not exists public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  url          text not null,
  storage_path text,
  alt          text,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images (product_id, position);

-- -----------------------------------------------------------------------------
-- 6. product_variants
-- -----------------------------------------------------------------------------
create table if not exists public.product_variants (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  sku          text not null unique check (char_length(sku) between 1 and 64),
  color_hex    text check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  price        numeric(10, 2) check (price is null or price > 0),
  promo_price  numeric(10, 2) check (promo_price is null or promo_price > 0),
  image_url    text,
  position     integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (product_id, name)
);
create index if not exists product_variants_product_idx on public.product_variants (product_id, position);

-- -----------------------------------------------------------------------------
-- 7. inventory  (uma linha por produto sem variação, ou por variação)
-- -----------------------------------------------------------------------------
create table if not exists public.inventory (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references public.products (id) on delete cascade,
  variant_id          uuid references public.product_variants (id) on delete cascade,
  quantity            integer not null default 0 check (quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  updated_at          timestamptz not null default now(),
  constraint inventory_product_variant_unique unique nulls not distinct (product_id, variant_id)
);
create index if not exists inventory_low_stock_idx on public.inventory (quantity);

-- -----------------------------------------------------------------------------
-- 8 / 9. carts e cart_items
-- -----------------------------------------------------------------------------
create table if not exists public.carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references public.profiles (id) on delete cascade,
  guest_token text unique check (guest_token is null or char_length(guest_token) >= 32),
  coupon_code text,
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{8}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint carts_owner_check check (user_id is not null or guest_token is not null)
);

create table if not exists public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  quantity   integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_unique unique nulls not distinct (cart_id, product_id, variant_id)
);
create index if not exists cart_items_cart_idx on public.cart_items (cart_id);

-- -----------------------------------------------------------------------------
-- 15. coupons
-- -----------------------------------------------------------------------------
create table if not exists public.coupons (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  description       text,
  type              public.coupon_type not null,
  value             numeric(10, 2) not null check (value > 0),
  min_order_value   numeric(10, 2) not null default 0 check (min_order_value >= 0),
  max_uses          integer check (max_uses is null or max_uses > 0),
  max_uses_per_user integer check (max_uses_per_user is null or max_uses_per_user > 0),
  uses_count        integer not null default 0 check (uses_count >= 0),
  starts_at         timestamptz,
  expires_at        timestamptz,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint coupons_percentage_range check (type <> 'percentage' or value <= 100),
  constraint coupons_dates check (starts_at is null or expires_at is null or starts_at < expires_at)
);

-- -----------------------------------------------------------------------------
-- 10. orders
-- -----------------------------------------------------------------------------
create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          bigint generated always as identity (start with 1001) unique,
  user_id               uuid not null references public.profiles (id) on delete restrict,
  status                public.order_status not null default 'awaiting_payment',
  payment_status        public.payment_status not null default 'pending',
  customer_name         text not null,
  customer_email        text not null,
  customer_phone        text,
  customer_cpf          text check (customer_cpf is null or customer_cpf ~ '^[0-9]{11}$'),
  shipping_address      jsonb not null,
  subtotal              numeric(10, 2) not null check (subtotal >= 0),
  discount_total        numeric(10, 2) not null default 0 check (discount_total >= 0),
  shipping_total        numeric(10, 2) not null default 0 check (shipping_total >= 0),
  total                 numeric(10, 2) not null check (total > 0),
  coupon_id             uuid references public.coupons (id) on delete set null,
  coupon_code           text,
  shipping_service_id   integer,
  shipping_service_name text,
  shipping_carrier      text,
  shipping_days         integer,
  shipping_package      jsonb,
  payment_method        text check (payment_method is null or payment_method in ('pix', 'credit_card')),
  notes                 text,
  admin_notes           text,
  stock_released        boolean not null default false,
  paid_at               timestamptz,
  shipped_at            timestamptz,
  delivered_at          timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint orders_total_consistency check (total = subtotal - discount_total + shipping_total)
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- -----------------------------------------------------------------------------
-- 11. order_items
-- -----------------------------------------------------------------------------
create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  variant_id   uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  variant_name text,
  sku          text not null,
  image_url    text,
  unit_price   numeric(10, 2) not null check (unit_price >= 0),
  quantity     integer not null check (quantity > 0),
  total        numeric(10, 2) not null check (total >= 0),
  created_at   timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

-- Histórico de status do pedido
create table if not exists public.order_status_history (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  from_status    public.order_status,
  to_status      public.order_status,
  from_payment   public.payment_status,
  to_payment     public.payment_status,
  note           text,
  changed_by     uuid references auth.users (id) on delete set null,
  source         text not null default 'system',
  created_at     timestamptz not null default now()
);
create index if not exists order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- -----------------------------------------------------------------------------
-- 12. payments
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete restrict,
  provider            text not null default 'mercadopago',
  provider_payment_id text unique,
  idempotency_key     text not null unique,
  method              text not null check (method in ('pix', 'credit_card')),
  status              public.payment_status not null default 'pending',
  provider_status     text,
  status_detail       text,
  amount              numeric(10, 2) not null check (amount > 0),
  installments        integer not null default 1 check (installments between 1 and 24),
  card_brand          text,
  card_last_four      text check (card_last_four is null or card_last_four ~ '^[0-9]{4}$'),
  pix_qr_code         text,
  pix_qr_code_base64  text,
  pix_ticket_url      text,
  expires_at          timestamptz,
  approved_at         timestamptz,
  refunded_amount     numeric(10, 2) not null default 0,
  raw                 jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists payments_order_idx on public.payments (order_id, created_at desc);
create index if not exists payments_status_idx on public.payments (status);
-- Impede mais de um pagamento aprovado por pedido (prevenção de cobrança duplicada)
create unique index if not exists payments_one_approved_per_order
  on public.payments (order_id) where status = 'approved';

-- -----------------------------------------------------------------------------
-- 13. shipments
-- -----------------------------------------------------------------------------
create table if not exists public.shipments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete restrict,
  provider            text not null default 'superfrete',
  service_id          integer not null,
  service_name        text,
  superfrete_order_id text unique,
  status              public.shipment_status not null default 'pending',
  provider_status     text,
  tracking_code       text,
  tracking_url        text,
  label_url           text,
  price               numeric(10, 2),
  package             jsonb,
  error_message       text,
  raw                 jsonb,
  released_at         timestamptz,
  posted_at           timestamptz,
  delivered_at        timestamptz,
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists shipments_order_idx on public.shipments (order_id);
create index if not exists shipments_status_idx on public.shipments (status);
-- Apenas um envio ativo (não cancelado/erro) por pedido
create unique index if not exists shipments_one_active_per_order
  on public.shipments (order_id) where status not in ('cancelled', 'error');

-- -----------------------------------------------------------------------------
-- 14. shipment_tracking
-- -----------------------------------------------------------------------------
create table if not exists public.shipment_tracking (
  id          uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  status      text not null,
  description text,
  location    text,
  occurred_at timestamptz not null default now(),
  raw         jsonb,
  created_at  timestamptz not null default now(),
  constraint shipment_tracking_dedupe unique (shipment_id, status, occurred_at)
);
create index if not exists shipment_tracking_shipment_idx on public.shipment_tracking (shipment_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- 16. coupon_usages
-- -----------------------------------------------------------------------------
create table if not exists public.coupon_usages (
  id              uuid primary key default gen_random_uuid(),
  coupon_id       uuid not null references public.coupons (id) on delete cascade,
  order_id        uuid not null unique references public.orders (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  discount_amount numeric(10, 2) not null check (discount_amount >= 0),
  created_at      timestamptz not null default now()
);
create index if not exists coupon_usages_coupon_user_idx on public.coupon_usages (coupon_id, user_id);

-- -----------------------------------------------------------------------------
-- 17. favorites
-- -----------------------------------------------------------------------------
create table if not exists public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists favorites_product_idx on public.favorites (product_id);

-- -----------------------------------------------------------------------------
-- 18. banners
-- -----------------------------------------------------------------------------
create table if not exists public.banners (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (char_length(title) between 1 and 120),
  subtitle            text check (char_length(subtitle) <= 240),
  eyebrow             text check (char_length(eyebrow) <= 60),
  cta_label           text check (char_length(cta_label) <= 40),
  link_url            text,
  image_url           text,
  image_path          text,
  mobile_image_url    text,
  mobile_image_path   text,
  theme               text not null default 'dark' check (theme in ('dark', 'light')),
  position            integer not null default 0,
  is_active           boolean not null default true,
  starts_at           timestamptz,
  ends_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists banners_active_idx on public.banners (is_active, position);

-- -----------------------------------------------------------------------------
-- 19. store_settings (linha única)
-- -----------------------------------------------------------------------------
create table if not exists public.store_settings (
  id                  smallint primary key default 1 check (id = 1),
  store_name          text not null default 'Eloah Make Up',
  tagline             text,
  logo_url            text,
  whatsapp            text,
  email               text,
  phone               text,
  instagram_url       text,
  facebook_url        text,
  tiktok_url          text,
  company_name        text,
  cnpj                text,
  origin_name         text,
  origin_postal_code  text check (origin_postal_code is null or origin_postal_code ~ '^[0-9]{8}$'),
  origin_street       text,
  origin_number       text,
  origin_complement   text,
  origin_district     text,
  origin_city         text,
  origin_state        char(2),
  origin_document     text,
  max_installments    integer not null default 6 check (max_installments between 1 and 12),
  min_installment_value numeric(10, 2) not null default 20,
  free_shipping_min   numeric(10, 2),
  announcement        text,
  testimonials        jsonb not null default '[]'::jsonb,
  instagram_posts     jsonb not null default '[]'::jsonb,
  updated_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 20. webhook_events
-- -----------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null check (provider in ('mercadopago', 'superfrete')),
  event_key       text not null,
  event_type      text,
  resource_id     text,
  signature_valid boolean not null default false,
  status          text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  attempts        integer not null default 1,
  error           text,
  payload         jsonb,
  processed_at    timestamptz,
  created_at      timestamptz not null default now(),
  constraint webhook_events_dedupe unique (provider, event_key)
);
create index if not exists webhook_events_created_idx on public.webhook_events (created_at desc);

-- Newsletter
create table if not exists public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source     text default 'site',
  created_at timestamptz not null default now()
);

-- Log de integrações (chamadas externas, falhas)
create table if not exists public.integration_logs (
  id         uuid primary key default gen_random_uuid(),
  provider   text not null,
  operation  text not null,
  level      text not null default 'info' check (level in ('info', 'warn', 'error')),
  order_id   uuid references public.orders (id) on delete set null,
  message    text,
  details    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists integration_logs_created_idx on public.integration_logs (created_at desc);
create index if not exists integration_logs_order_idx on public.integration_logs (order_id);

-- -----------------------------------------------------------------------------
-- Triggers de updated_at
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','addresses','categories','products','product_variants','carts','cart_items',
    'coupons','orders','payments','shipments','banners','store_settings'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

drop trigger if exists set_updated_at on public.inventory;
create trigger set_updated_at before update on public.inventory
  for each row execute function public.set_updated_at();
