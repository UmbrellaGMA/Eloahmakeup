/**
 * Teste de ponta a ponta no projeto Supabase REAL (Auth + PostgREST + RLS + Storage).
 * Cria somente registros de teste (prefixo "eloah-teste-") e remove tudo ao final.
 *
 * Requer em .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY.   Uso: npm run db:test:remote
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

config({ path: ".env.local" });
config();

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !ANON || !SERVICE) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(SB_URL, SERVICE, opts);
const anon = createClient(SB_URL, ANON, opts);

let passed = 0;
let failed = 0;
const ok = (n) => (passed++, console.log(`  ✓ ${n}`));
const ko = (n, e) => (failed++, console.log(`  ✗ ${n}\n      ${e}`));
const check = (n, cond, detail = "") => (cond ? ok(n) : ko(n, detail));

const tag = `eloah-teste-${randomBytes(3).toString("hex")}`;
const password = `Teste${randomBytes(6).toString("hex")}1`;
const created = { users: [], products: [], categories: [], orders: [], files: [], coupons: [] };

async function makeUser(label) {
  const email = `${tag}-${label}@example.com`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Teste ${label}` } });
  if (error) throw error;
  created.users.push(data.user.id);
  const client = createClient(SB_URL, ANON, opts);
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, email, client };
}

async function main() {
  console.log(`\n> Conexão (${new URL(SB_URL).host})`);
  const tables = [
    "profiles", "addresses", "categories", "products", "product_images", "product_variants", "inventory", "carts", "cart_items",
    "orders", "order_items", "payments", "shipments", "shipment_tracking", "coupons", "coupon_usages", "favorites", "banners",
    "store_settings", "webhook_events", "admin_roles",
  ];
  for (const t of tables) {
    const { error } = await service.from(t).select("*", { count: "exact", head: true });
    if (error) ko(`tabela ${t}`, error.message);
  }
  check("21 tabelas acessíveis via API", failed === 0);
  const { data: buckets } = await service.storage.listBuckets();
  const names = (buckets ?? []).map((b) => b.id);
  check("buckets products, banners, branding, store-content", ["products", "banners", "branding", "store-content"].every((b) => names.includes(b)), names.join(","));

  console.log("\n> Auth e perfis");
  const admin = await makeUser("admin");
  const cli = await makeUser("cliente");
  const other = await makeUser("outra");
  const { data: prof } = await cli.client.from("profiles").select("full_name").eq("id", cli.id).single();
  check("perfil criado automaticamente no cadastro", prof?.full_name === "Teste cliente", JSON.stringify(prof));
  const { error: selfAdmin } = await cli.client.from("admin_roles").insert({ user_id: cli.id, role: "owner" });
  check("cliente NÃO se torna administrador", Boolean(selfAdmin));
  await service.from("admin_roles").insert({ user_id: admin.id, role: "admin" });
  const { data: isAdm } = await admin.client.rpc("is_admin");
  check("administrador reconhecido (is_admin)", isAdm === true);
  const { data: otherProf } = await cli.client.from("profiles").select("id").eq("id", other.id);
  check("cliente não lê perfil de outro", (otherProf ?? []).length === 0);

  console.log("\n> Catálogo e RLS");
  const { data: cat, error: catErr } = await admin.client.from("categories").insert({ name: `Cat ${tag}`, slug: tag }).select("id").single();
  check("admin cria categoria", !catErr, catErr?.message);
  if (cat) created.categories.push(cat.id);
  const { error: cliProd } = await cli.client.from("products").insert({ name: "x", slug: `${tag}-x`, sku: `${tag}-x`, price: 1 });
  check("cliente NÃO cria produto", Boolean(cliProd));
  const { data: prod, error: pErr } = await admin.client
    .from("products")
    .insert({ name: `Produto ${tag}`, slug: `${tag}-p`, sku: `${tag}-P`.toUpperCase(), price: 50, category_id: cat?.id, status: "active" })
    .select("id")
    .single();
  check("admin cria produto", !pErr, pErr?.message);
  if (prod) created.products.push(prod.id);
  const { data: draft } = await admin.client.from("products").insert({ name: `Rasc ${tag}`, slug: `${tag}-d`, sku: `${tag}-D`.toUpperCase(), price: 10 }).select("id").single();
  if (draft) created.products.push(draft.id);
  await admin.client.from("inventory").update({ quantity: 5 }).eq("product_id", prod.id);
  const { data: pub } = await anon.from("products").select("id").in("id", [prod.id, draft.id]);
  check("visitante vê apenas produto publicado", pub?.length === 1 && pub[0].id === prod.id, JSON.stringify(pub));
  const { error: anonCoupon } = await anon.from("coupons").select("id").limit(1);
  const { data: anonCoupons } = await anon.from("coupons").select("id").limit(1);
  check("cupons invisíveis para visitantes", !anonCoupon && (anonCoupons ?? []).length === 0);

  console.log("\n> Storage");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const path = `${tag}/teste.png`;
  const { error: upCli } = await cli.client.storage.from("products").upload(path, png, { contentType: "image/png" });
  check("cliente NÃO envia imagem", Boolean(upCli));
  const { error: upAdm } = await admin.client.storage.from("products").upload(path, png, { contentType: "image/png" });
  check("admin envia imagem", !upAdm, upAdm?.message);
  if (!upAdm) created.files.push(path);
  const publicUrl = service.storage.from("products").getPublicUrl(path).data.publicUrl;
  const res = await fetch(publicUrl);
  check("imagem pública acessível", res.ok, String(res.status));
  const { data: delCli } = await cli.client.storage.from("products").remove([path]);
  check("cliente NÃO exclui imagem", (delCli ?? []).length === 0);

  console.log("\n> Pedido, pagamento e integridade");
  const { data: cart } = await service.from("carts").insert({ user_id: cli.id }).select("id").single();
  await service.from("cart_items").insert({ cart_id: cart.id, product_id: prod.id, quantity: 2 });
  const { error: cliRpc } = await cli.client.rpc("place_order", {
    p_user_id: cli.id, p_cart_id: cart.id, p_customer: {}, p_address: {}, p_shipping: { price: 1, service_id: 1 },
  });
  check("cliente NÃO executa place_order", Boolean(cliRpc));
  const { data: order, error: oErr } = await service.rpc("place_order", {
    p_user_id: cli.id,
    p_cart_id: cart.id,
    p_customer: { name: "Teste Cliente", email: cli.email, cpf: "12345678909", phone: "11999998888" },
    p_address: { recipient_name: "Teste", postal_code: "01001000", street: "Praça da Sé", number: "1", district: "Sé", city: "São Paulo", state: "SP" },
    p_shipping: { price: 15, service_id: 1, service_name: "PAC", carrier: "Correios", delivery_days: 5 },
    p_payment_method: "pix",
  });
  check("pedido criado pelo servidor (total recalculado = 115)", !oErr && Number(order?.total) === 115, oErr?.message ?? JSON.stringify(order));
  if (order) created.orders.push(order.id);
  const { data: inv } = await service.from("inventory").select("quantity").eq("product_id", prod.id).is("variant_id", null).single();
  check("estoque reservado (5 → 3)", inv?.quantity === 3, String(inv?.quantity));
  const { data: otherOrders } = await other.client.from("orders").select("id").eq("id", order.id);
  check("outro cliente não vê o pedido", (otherOrders ?? []).length === 0);
  const { error: admPay } = await admin.client.from("orders").update({ payment_status: "approved" }).eq("id", order.id);
  check("admin NÃO aprova pagamento manualmente", Boolean(admPay), "atualização aceita!");
  const { error: admPaid } = await admin.client.from("orders").update({ status: "paid" }).eq("id", order.id);
  check("admin NÃO marca pedido como pago", Boolean(admPaid));
  const { error: cliPayIns } = await cli.client.from("payments").insert({ order_id: order.id, idempotency_key: tag, method: "pix", amount: 1, status: "approved" });
  check("cliente NÃO registra pagamento", Boolean(cliPayIns));
  const { error: cancelErr } = await service.rpc("cancel_unpaid_order", { p_order_id: order.id, p_reason: "teste" });
  const { data: inv2 } = await service.from("inventory").select("quantity").eq("product_id", prod.id).is("variant_id", null).single();
  check("cancelamento devolve estoque (3 → 5)", !cancelErr && inv2?.quantity === 5, cancelErr?.message ?? String(inv2?.quantity));
  const { data: stats, error: sErr } = await admin.client.rpc("admin_dashboard_stats", { p_days: 7 });
  check("dashboard disponível para admin", !sErr && stats?.daily?.length === 7, sErr?.message);
  const { error: sCli } = await cli.client.rpc("admin_dashboard_stats", { p_days: 7 });
  check("dashboard bloqueado para cliente", Boolean(sCli));
}

async function cleanup() {
  console.log("\n> Limpando dados de teste");
  if (created.files.length) await service.storage.from("products").remove(created.files);
  for (const id of created.orders) {
    await service.from("order_status_history").delete().eq("order_id", id);
    await service.from("orders").delete().eq("id", id);
  }
  if (created.products.length) await service.from("products").delete().in("id", created.products);
  if (created.categories.length) await service.from("categories").delete().in("id", created.categories);
  for (const id of created.users) await service.auth.admin.deleteUser(id);
  console.log("  dados de teste removidos");
}

try {
  await main();
} catch (e) {
  ko("execução", e?.message ?? e);
} finally {
  await cleanup().catch((e) => console.error("Falha na limpeza:", e?.message));
  console.log(`\nResultado: ${passed} aprovados, ${failed} falharam\n`);
  process.exit(failed ? 1 : 0);
}
