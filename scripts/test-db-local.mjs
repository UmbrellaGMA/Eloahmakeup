/**
 * Teste local das migrations usando PGlite (PostgreSQL em WASM).
 * Cria um "stub" mínimo dos schemas auth/storage e dos papéis do Supabase,
 * aplica todas as migrations e executa testes de regras de negócio e RLS.
 *
 * Uso: node scripts/test-db-local.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const db = new PGlite({ extensions: { pg_trgm, unaccent, pgcrypto } });

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

let passed = 0;
let failed = 0;
const ok = (name) => {
  passed++;
  console.log(`  ✓ ${name}`);
};
const fail = (name, err) => {
  failed++;
  console.log(`  ✗ ${name}\n      ${err}`);
};

async function as(role, sub, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false);`);
  if (role) await db.exec(`set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role;`);
  }
}

async function expectOk(name, fn) {
  try {
    const r = await fn();
    ok(name);
    return r;
  } catch (e) {
    fail(name, e.message);
  }
}
async function expectError(name, fn, match) {
  try {
    await fn();
    fail(name, "esperava erro, mas a operação foi aceita");
  } catch (e) {
    if (match && !String(e.message).includes(match)) fail(name, `erro inesperado: ${e.message}`);
    else ok(name);
  }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

async function main() {
  console.log("\n> Preparando stub Supabase");
  await db.exec(SUPABASE_STUB);

  console.log("> Aplicando migrations");
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(dir, f), "utf8"));
      ok(`migration ${f}`);
    } catch (e) {
      fail(`migration ${f}`, e.message);
      throw e;
    }
  }
  // Reaplicação (idempotência)
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await expectOk(`reexecução idempotente ${f}`, () => db.exec(readFileSync(join(dir, f), "utf8")));
  }

  const tables = (
    await db.query(`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`)
  ).rows.map((r) => r.table_name);
  console.log(`\n> ${tables.length} tabelas: ${tables.join(", ")}`);
  const required = [
    "profiles", "addresses", "categories", "products", "product_images", "product_variants", "inventory",
    "carts", "cart_items", "orders", "order_items", "payments", "shipments", "shipment_tracking", "coupons",
    "coupon_usages", "favorites", "banners", "store_settings", "webhook_events", "admin_roles",
  ];
  const missing = required.filter((t) => !tables.includes(t));
  missing.length ? fail("21 tabelas obrigatórias", `faltando: ${missing}`) : ok("21 tabelas obrigatórias presentes");
  const noRls = (
    await db.query(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`)
  ).rows;
  noRls.length ? fail("RLS em todas as tabelas", JSON.stringify(noRls)) : ok("RLS habilitado em todas as tabelas");

  console.log("\n> Auth e perfis");
  const admin = await one(`insert into auth.users (email, raw_user_meta_data) values ('admin@teste.local', '{"full_name":"Admin Teste"}') returning id`);
  const cli = await one(`insert into auth.users (email, raw_user_meta_data) values ('cliente@teste.local', '{"full_name":"Cliente Teste","phone":"11999998888"}') returning id`);
  const cli2 = await one(`insert into auth.users (email) values ('outra@teste.local') returning id`);
  const prof = await one(`select * from public.profiles where id=$1`, [cli.id]);
  prof?.full_name === "Cliente Teste" && prof.phone === "11999998888"
    ? ok("perfil criado automaticamente pelo trigger")
    : fail("perfil criado automaticamente", JSON.stringify(prof));

  await db.query(`insert into public.admin_roles (user_id, role) values ($1, 'owner')`, [admin.id]);
  ok("administrador concedido por sessão privilegiada");

  await expectError("cliente NÃO consegue se tornar administrador", () =>
    as("authenticated", cli.id, () => db.query(`insert into public.admin_roles (user_id, role) values ($1,'owner')`, [cli.id])),
  );
  const isAdm = await as("authenticated", cli.id, () => one(`select public.is_admin() as v`));
  !isAdm.v ? ok("is_admin() falso para cliente") : fail("is_admin() cliente", "retornou true");
  const isAdm2 = await as("authenticated", admin.id, () => one(`select public.is_admin() as v`));
  isAdm2.v ? ok("is_admin() verdadeiro para administrador") : fail("is_admin() admin", "retornou false");

  await expectOk("cliente atualiza o próprio perfil", () =>
    as("authenticated", cli.id, () => db.query(`update public.profiles set cpf='12345678909' where id=$1`, [cli.id])),
  );
  const other = await as("authenticated", cli.id, () => db.query(`select * from public.profiles where id=$1`, [cli2.id]));
  other.rows.length === 0 ? ok("cliente não lê perfil de outro cliente") : fail("isolamento de perfis", "vazou");

  console.log("\n> Catálogo (escrita administrativa)");
  const cat = await one(`select id from public.categories where slug='labios'`);
  await expectError("cliente NÃO cria produto", () =>
    as("authenticated", cli.id, () =>
      db.query(`insert into public.products (name, slug, sku, price, category_id) values ('X','x','X1',10,$1)`, [cat.id]),
    ),
  );
  await expectError("visitante NÃO cria produto", () =>
    as("anon", null, () => db.query(`insert into public.products (name, slug, sku, price) values ('X','x','X1',10)`)),
  );
  const prod = await as("authenticated", admin.id, () =>
    one(
      `insert into public.products (name, slug, sku, price, promo_price, category_id, status, brand, tags)
       values ('Batom Matte Lilás Ãurea','batom-matte-lilas','BAT-001',59.90,49.90,$1,'active','Eloah', '{batom,matte}') returning *`,
      [cat.id],
    ),
  );
  prod?.search_text?.includes("aurea") ? ok("admin cria produto (busca sem acentos gerada)") : fail("admin cria produto", JSON.stringify(prod));
  const inv = await one(`select * from public.inventory where product_id=$1 and variant_id is null`, [prod.id]);
  inv ? ok("linha de estoque criada automaticamente") : fail("estoque automático", "não criado");
  await as("authenticated", admin.id, () => db.query(`update public.inventory set quantity=10 where id=$1`, [inv.id]));
  const draft = await as("authenticated", admin.id, () =>
    one(`insert into public.products (name, slug, sku, price, status) values ('Rascunho','rascunho','RAS-1',10,'draft') returning id`),
  );
  const anonList = await as("anon", null, () => db.query(`select id from public.products`));
  anonList.rows.length === 1 && anonList.rows[0].id === prod.id
    ? ok("visitante vê apenas produtos publicados")
    : fail("visibilidade pública", JSON.stringify(anonList.rows));
  await expectError("preço promocional maior que o preço é rejeitado", () =>
    db.query(`update public.products set promo_price=99 where id=$1`, [prod.id]),
  );

  // produto com variações
  const pv = await as("authenticated", admin.id, () =>
    one(`insert into public.products (name, slug, sku, price, status) values ('Paleta','paleta','PAL-1',120,'active') returning id`),
  );
  const v1 = await as("authenticated", admin.id, () =>
    one(`insert into public.product_variants (product_id, name, sku, color_hex) values ($1,'Nude','PAL-1-NUDE','#D9B8A3') returning id`, [pv.id]),
  );
  const hv = await one(`select has_variants from public.products where id=$1`, [pv.id]);
  hv.has_variants ? ok("has_variants sincronizado por trigger") : fail("has_variants", "false");
  await db.query(`update public.inventory set quantity=3 where variant_id=$1`, [v1.id]);

  console.log("\n> Cupom, carrinho e pedido");
  await as("authenticated", admin.id, () =>
    db.query(`insert into public.coupons (code, type, value, min_order_value, max_uses_per_user) values ('BEMVINDA10','percentage',10,50,1)`),
  );
  const cpAnon = await as("anon", null, () => db.query(`select * from public.coupons`));
  cpAnon.rows.length === 0 ? ok("cupons invisíveis para visitantes") : fail("cupons", "visíveis");

  const cart = await one(`insert into public.carts (user_id) values ($1) returning id`, [cli.id]);
  await db.query(`insert into public.cart_items (cart_id, product_id, quantity) values ($1,$2,2)`, [cart.id, prod.id]);
  await db.query(`insert into public.cart_items (cart_id, product_id, variant_id, quantity) values ($1,$2,$3,1)`, [cart.id, pv.id, v1.id]);
  await expectError("cliente NÃO executa place_order diretamente", () =>
    as("authenticated", cli.id, () =>
      db.query(`select public.place_order($1,$2,'{}','{}','{"price":10,"service_id":1}')`, [cli.id, cart.id]),
    ),
  );

  const order = await as("service_role", null, () =>
    one(
      `select * from public.place_order($1,$2,
        '{"name":"Cliente Teste","email":"cliente@teste.local","phone":"11999998888","cpf":"12345678909"}',
        '{"postal_code":"01001000","street":"Praça da Sé","number":"1","district":"Sé","city":"São Paulo","state":"SP"}',
        '{"price":18.50,"service_id":1,"service_name":"PAC","carrier":"Correios","delivery_days":6}',
        'bemvinda10','pix')`,
      [cli.id, cart.id],
    ),
  );
  // subtotal = 2*49.90 + 120 = 219.80 ; desconto 21.98 ; frete 18.50 ; total = 216.32
  order && Number(order.subtotal) === 219.8 && Number(order.discount_total) === 21.98 && Number(order.total) === 216.32
    ? ok(`pedido #${order.order_number} criado com totais recalculados no banco (R$ ${order.total})`)
    : fail("totais do pedido", JSON.stringify(order));
  const invAfter = await one(`select quantity from public.inventory where id=$1`, [inv.id]);
  invAfter.quantity === 8 ? ok("estoque reservado (10 → 8)") : fail("reserva de estoque", invAfter.quantity);
  const cartLeft = await one(`select count(*)::int c from public.cart_items where cart_id=$1`, [cart.id]);
  cartLeft.c === 0 ? ok("carrinho esvaziado após pedido") : fail("carrinho", cartLeft.c);

  // Estoque insuficiente
  await db.query(`insert into public.cart_items (cart_id, product_id, variant_id, quantity) values ($1,$2,$3,5)`, [cart.id, pv.id, v1.id]);
  await expectError(
    "pedido bloqueado por estoque insuficiente",
    () =>
      as("service_role", null, () =>
        db.query(`select public.place_order($1,$2,'{"name":"a","email":"a@a.com"}','{}','{"price":10,"service_id":1}')`, [cli.id, cart.id]),
      ),
    "OUT_OF_STOCK",
  );
  await db.query(`delete from public.cart_items where cart_id=$1`, [cart.id]);
  // Cupom reutilizado
  await db.query(`insert into public.cart_items (cart_id, product_id, quantity) values ($1,$2,2)`, [cart.id, prod.id]);
  await expectError(
    "cupom com limite por cliente não pode ser reutilizado",
    () =>
      as("service_role", null, () =>
        db.query(`select public.place_order($1,$2,'{"name":"a","email":"a@a.com"}','{}','{"price":10,"service_id":1}','BEMVINDA10')`, [cli.id, cart.id]),
      ),
    "COUPON_INVALID",
  );

  console.log("\n> Isolamento de pedidos e integridade financeira");
  const seeOther = await as("authenticated", cli2.id, () => db.query(`select id from public.orders`));
  seeOther.rows.length === 0 ? ok("cliente não vê pedidos de outros clientes") : fail("isolamento pedidos", "vazou");
  const seeOwn = await as("authenticated", cli.id, () => db.query(`select id from public.orders`));
  seeOwn.rows.length === 1 ? ok("cliente vê o próprio pedido") : fail("pedido próprio", seeOwn.rows.length);

  const upd = await as("authenticated", cli.id, () =>
    db.query(`update public.orders set payment_status='approved', status='paid' where id=$1`, [order.id]),
  );
  const stillPending = await one(`select payment_status from public.orders where id=$1`, [order.id]);
  upd.affectedRows === 0 && stillPending.payment_status === "pending"
    ? ok("cliente NÃO altera status do próprio pedido")
    : fail("cliente altera pedido", JSON.stringify(stillPending));

  await expectError(
    "admin NÃO simula aprovação financeira (payment_status)",
    () => as("authenticated", admin.id, () => db.query(`update public.orders set payment_status='approved' where id=$1`, [order.id])),
    "ORDER_FIELD_LOCKED",
  );
  await expectError(
    "admin NÃO marca pedido como pago manualmente",
    () => as("authenticated", admin.id, () => db.query(`update public.orders set status='paid' where id=$1`, [order.id])),
  );
  await expectError(
    "admin NÃO altera valores do pedido",
    () => as("authenticated", admin.id, () => db.query(`update public.orders set total=1, subtotal=1, discount_total=0, shipping_total=0 where id=$1`, [order.id])),
    "ORDER_FIELD_LOCKED",
  );
  await expectError("cliente NÃO insere pagamento", () =>
    as("authenticated", cli.id, () =>
      db.query(`insert into public.payments (order_id, idempotency_key, method, amount, status) values ($1,'k1','pix',1,'approved')`, [order.id]),
    ),
  );
  await expectError("admin NÃO insere pagamento pelo navegador", () =>
    as("authenticated", admin.id, () =>
      db.query(`insert into public.payments (order_id, idempotency_key, method, amount, status) values ($1,'k1','pix',1,'approved')`, [order.id]),
    ),
  );

  // Servidor registra pagamento confirmado
  await as("service_role", null, async () => {
    await db.query(
      `insert into public.payments (order_id, idempotency_key, method, amount, status, provider_payment_id, raw) values ($1,'k-ok','pix',$2,'approved','123','{"secret":1}')`,
      [order.id, order.total],
    );
    await db.query(`select public.apply_payment_status($1,'approved','Pix aprovado')`, [order.id]);
  });
  const paid = await one(`select status, payment_status, paid_at from public.orders where id=$1`, [order.id]);
  paid.status === "paid" && paid.payment_status === "approved" && paid.paid_at
    ? ok("servidor aprova pagamento → pedido Pago")
    : fail("aprovação servidor", JSON.stringify(paid));
  const sc = await one(`select sales_count from public.products where id=$1`, [prod.id]);
  sc.sales_count === 2 ? ok("contador de vendas atualizado") : fail("sales_count", sc.sales_count);
  await as("service_role", null, () => db.query(`select public.apply_payment_status($1,'approved','duplicado')`, [order.id]));
  const sc2 = await one(`select sales_count from public.products where id=$1`, [prod.id]);
  sc2.sales_count === 2 ? ok("notificação duplicada não conta venda 2x") : fail("idempotência", sc2.sales_count);
  await expectError("segundo pagamento aprovado no mesmo pedido é bloqueado", () =>
    as("service_role", null, () =>
      db.query(`insert into public.payments (order_id, idempotency_key, method, amount, status) values ($1,'k-dup','pix',1,'approved')`, [order.id]),
    ),
  );
  await expectError("cliente NÃO lê coluna raw de pagamentos", () =>
    as("authenticated", cli.id, () => db.query(`select raw from public.payments`)),
  );
  const payOwn = await as("authenticated", cli.id, () => db.query(`select id, status from public.payments`));
  payOwn.rows.length === 1 ? ok("cliente lê status do próprio pagamento") : fail("pagamento próprio", payOwn.rows.length);

  await expectOk("admin avança: Pago → Em preparação", () =>
    as("authenticated", admin.id, () => db.query(`update public.orders set status='preparing' where id=$1`, [order.id])),
  );
  await expectOk("admin avança: Em preparação → Pronto para envio", () =>
    as("authenticated", admin.id, () => db.query(`update public.orders set status='ready_to_ship' where id=$1`, [order.id])),
  );
  await expectError(
    "admin NÃO marca como Enviado sem postagem",
    () => as("authenticated", admin.id, () => db.query(`update public.orders set status='shipped' where id=$1`, [order.id])),
  );
  await expectError(
    "nem o servidor marca Enviado sem postagem confirmada",
    () => as("service_role", null, () => db.query(`update public.orders set status='shipped' where id=$1`, [order.id])),
    "SHIPMENT_NOT_POSTED",
  );
  await as("service_role", null, async () => {
    const s = await one(
      `insert into public.shipments (order_id, service_id, status, superfrete_order_id, tracking_code) values ($1,1,'posted','sf1','AA123BR') returning id`,
      [order.id],
    );
    await db.query(`insert into public.shipment_tracking (shipment_id, status, description) values ($1,'posted','Objeto postado')`, [s.id]);
    await db.query(`update public.orders set status='shipped' where id=$1`, [order.id]);
  });
  const shipped = await one(`select status, shipped_at from public.orders where id=$1`, [order.id]);
  shipped.status === "shipped" && shipped.shipped_at ? ok("pedido Enviado após postagem confirmada") : fail("envio", JSON.stringify(shipped));
  const trk = await as("authenticated", cli.id, () => db.query(`select status from public.shipment_tracking`));
  trk.rows.length === 1 ? ok("cliente vê o rastreamento do próprio pedido") : fail("rastreamento", trk.rows.length);
  const trk2 = await as("authenticated", cli2.id, () => db.query(`select status from public.shipment_tracking`));
  trk2.rows.length === 0 ? ok("outro cliente não vê o rastreamento") : fail("rastreamento isolado", "vazou");
  const hist = await one(`select count(*)::int c from public.order_status_history where order_id=$1`, [order.id]);
  hist.c >= 5 ? ok(`histórico de status registrado (${hist.c} eventos)`) : fail("histórico", hist.c);

  console.log("\n> Cancelamento e devolução de estoque");
  await db.query(`delete from public.cart_items where cart_id=$1`, [cart.id]);
  await db.query(`insert into public.cart_items (cart_id, product_id, quantity) values ($1,$2,3)`, [cart.id, prod.id]);
  const o2 = await as("service_role", null, () =>
    one(`select * from public.place_order($1,$2,'{"name":"a","email":"a@a.com"}','{}','{"price":10,"service_id":2}')`, [cli.id, cart.id]),
  );
  const before = await one(`select quantity from public.inventory where id=$1`, [inv.id]);
  await as("service_role", null, () => db.query(`select public.cancel_unpaid_order($1,'Pix expirado')`, [o2.id]));
  const after = await one(`select quantity from public.inventory where id=$1`, [inv.id]);
  after.quantity === before.quantity + 3 ? ok(`estoque devolvido no cancelamento (${before.quantity} → ${after.quantity})`) : fail("devolução", `${before.quantity}→${after.quantity}`);
  await as("service_role", null, () => db.query(`select public.release_order_stock($1)`, [o2.id]));
  const after2 = await one(`select quantity from public.inventory where id=$1`, [inv.id]);
  after2.quantity === after.quantity ? ok("devolução de estoque é idempotente") : fail("idempotência devolução", after2.quantity);
  await as("service_role", null, () => db.query(`select public.apply_payment_status($1,'approved','Pix pago após expiração')`, [o2.id]));
  const late = await one(`select o.status, i.quantity from public.orders o, public.inventory i where o.id=$1 and i.id=$2`, [o2.id, inv.id]);
  late.status === "paid" && late.quantity === after.quantity - 3
    ? ok("pagamento tardio reativa o pedido e reserva o estoque novamente")
    : fail("pagamento tardio", JSON.stringify(late));

  console.log("\n> Webhooks (deduplicação)");
  await as("service_role", null, () =>
    db.query(`insert into public.webhook_events (provider, event_key, signature_valid) values ('mercadopago','payment:123:approved',true)`),
  );
  await expectError("evento duplicado rejeitado pela restrição única", () =>
    as("service_role", null, () =>
      db.query(`insert into public.webhook_events (provider, event_key) values ('mercadopago','payment:123:approved')`),
    ),
  );

  console.log("\n> Favoritos, endereços e banners");
  await expectOk("cliente favorita produto", () =>
    as("authenticated", cli.id, () => db.query(`insert into public.favorites (user_id, product_id) values ($1,$2)`, [cli.id, prod.id])),
  );
  await expectError("cliente NÃO favorita em nome de outro", () =>
    as("authenticated", cli.id, () => db.query(`insert into public.favorites (user_id, product_id) values ($1,$2)`, [cli2.id, prod.id])),
  );
  await as("authenticated", cli.id, async () => {
    await db.query(
      `insert into public.addresses (user_id, recipient_name, postal_code, street, number, district, city, state, is_default) values ($1,'Casa','01001000','Rua A','1','Centro','São Paulo','SP',true)`,
      [cli.id],
    );
    await db.query(
      `insert into public.addresses (user_id, recipient_name, postal_code, street, number, district, city, state, is_default) values ($1,'Trabalho','01001000','Rua B','2','Centro','São Paulo','SP',true)`,
      [cli.id],
    );
  });
  const defs = await one(`select count(*)::int c from public.addresses where user_id=$1 and is_default`, [cli.id]);
  defs.c === 1 ? ok("apenas um endereço padrão por cliente") : fail("endereço padrão", defs.c);
  await as("authenticated", admin.id, () =>
    db.query(`insert into public.banners (title, is_active) values ('Ativo', true), ('Inativo', false)`),
  );
  const bn = await as("anon", null, () => db.query(`select title from public.banners`));
  bn.rows.length === 1 ? ok("visitante vê apenas banners ativos") : fail("banners", bn.rows.length);
  await expectError("visitante NÃO assina newsletter direto no banco", () =>
    as("anon", null, () => db.query(`insert into public.newsletter_subscribers (email) values ('a@a.com')`)),
  );

  console.log("\n> Storage");
  const buckets = (await db.query(`select id, public from storage.buckets order by id`)).rows;
  buckets.length === 4 ? ok(`buckets: ${buckets.map((b) => b.id).join(", ")}`) : fail("buckets", JSON.stringify(buckets));
  await expectError("cliente NÃO envia arquivo ao bucket products", () =>
    as("authenticated", cli.id, () => db.query(`insert into storage.objects (bucket_id, name) values ('products','x.png')`)),
  );
  await expectOk("admin envia arquivo ao bucket products", () =>
    as("authenticated", admin.id, () => db.query(`insert into storage.objects (bucket_id, name) values ('products','x.png')`)),
  );
  const del = await as("authenticated", cli.id, () => db.query(`delete from storage.objects where name='x.png'`));
  del.affectedRows === 0 ? ok("cliente NÃO exclui arquivo") : fail("exclusão storage", "permitida");
  const pub = await as("anon", null, () => db.query(`select name from storage.objects`));
  pub.rows.length === 1 ? ok("leitura pública de imagens") : fail("leitura pública", pub.rows.length);

  console.log("\n> Dashboard");
  await expectError("cliente NÃO acessa estatísticas", () =>
    as("authenticated", cli.id, () => db.query(`select public.admin_dashboard_stats(30)`)),
  );
  const stats = await as("authenticated", admin.id, () => one(`select public.admin_dashboard_stats(30) as s`));
  stats?.s?.sales_count === 2 ? ok(`admin lê estatísticas (faturamento R$ ${stats.s.revenue_total})`) : fail("dashboard", JSON.stringify(stats));

  console.log(`\nResultado: ${passed} aprovados, ${failed} falharam\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
