# Eloah Make Up — Loja virtual

E-commerce de maquiagens e acessórios: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Storage, RLS) · Mercado Pago (Pix e cartão) · SuperFrete (cotação, etiquetas e rastreamento).

---

## 1. Instalação

```bash
npm install
cp .env.example .env.local   # preencha as variáveis (ver seção 2)
npm run db:migrate           # cria tabelas, funções, RLS e buckets no Supabase
npm run db:test:remote       # testa Auth, RLS, Storage e regras de pedido no projeto real
npm run dev                  # http://localhost:3000
```

Criar o primeiro administrador (a conta precisa existir — cadastre-se em `/cadastro`):

```bash
npm run admin:grant -- email@dominio.com owner
```

Não há como um cliente se tornar administrador pelo site: `admin_roles` não tem política de escrita e um trigger bloqueia gravações que não venham do servidor.

## 2. Variáveis de ambiente

| Variável | Onde obter | Exposta ao navegador? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | sim (protegidas por RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | **não** |
| `SUPABASE_DB_URL` | Supabase → Database → Connection string (URI) — só para `db:migrate` | **não** |
| `MERCADOPAGO_ACCESS_TOKEN` | Mercado Pago → Suas integrações → Credenciais de produção | **não** |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | idem (Public Key) | sim |
| `MERCADOPAGO_WEBHOOK_SECRET` | Suas integrações → Webhooks → Assinatura secreta | **não** |
| `SUPERFRETE_TOKEN` | SuperFrete → Integrações → Gerar token | **não** |
| `SUPERFRETE_ENV` | `production` ou `sandbox` | não |
| `SUPERFRETE_WEBHOOK_SECRET` | o `secret_token` que você define ao criar o webhook app | **não** |
| `SUPERFRETE_CONTACT_EMAIL` | e-mail técnico enviado no User-Agent (exigência da SuperFrete) | não |
| `NEXT_PUBLIC_SITE_URL` | URL pública (ex.: `https://eloahmakeup.com.br`) | sim |
| `CRON_SECRET` | string aleatória longa | **não** |

Sem as credenciais de pagamento/frete a loja funciona (catálogo, conta, carrinho, painel), mas o checkout informa que pagamentos/frete estão em configuração — nenhum valor é simulado.

## 3. Supabase

### Migrations (`supabase/migrations`)

| Arquivo | Conteúdo |
|---|---|
| `…01_core_schema.sql` | extensões, enums e as 21 tabelas pedidas + `order_status_history`, `newsletter_subscribers`, `integration_logs`; chaves, índices, restrições |
| `…02_functions_triggers.sql` | `is_admin`, criação automática de perfil, estoque automático, `place_order` (pedido atômico), `apply_payment_status`, `cancel_unpaid_order`, `release/reserve_order_stock`, guarda de integridade de pedidos, histórico, dashboard |
| `…03_rls_policies.sql` | RLS em **todas** as tabelas + privilégios por coluna (dados brutos de pagamento nunca vão ao navegador) |
| `…04_storage.sql` | buckets `products`, `banners`, `branding`, `store-content` (leitura pública, escrita só admin) |
| `…05_base_data.sql` | configuração da loja e árvore de categorias (Maquiagens/Acessórios) |
| `…06_harden_function_grants.sql` | fecha funções de trigger ao acesso via RPC (Supabase Security Advisor) |
| `…07_notifications.sql` | registro dos e-mails enviados (sem duplicidade) |

`npm run db:migrate` registra as versões em `supabase_migrations.schema_migrations` (compatível com `supabase db push`). Todas as migrations são idempotentes.

`npm run db:test:local` aplica as migrations num PostgreSQL embarcado (PGlite) e executa 71 testes de regras e RLS — não precisa de credenciais.

### Auth (configurar no painel do Supabase)

- Authentication → URL Configuration: **Site URL** = `NEXT_PUBLIC_SITE_URL`; **Redirect URLs**: `https://SEU-DOMINIO/auth/callback` (e `http://localhost:3000/auth/callback` para desenvolvimento).
- Authentication → Providers → Email: habilitado, "Confirm email" ligado (recomendado).
- Opcional: SMTP próprio (Authentication → Emails) para remetente com o domínio da loja.

### Regras de segurança implementadas no banco

- Clientes só leem/alteram os próprios dados, pedidos, endereços e favoritos.
- Visitantes só leem catálogo publicado, banners ativos e configurações públicas.
- `payments`, `shipments`, `shipment_tracking`, `webhook_events`, `admin_roles` e `coupon_usages` só aceitam escrita do servidor (service role).
- Administradores pelo navegador só alteram o **status operacional** de pedidos, com transições permitidas (Pago → Em preparação → Pronto para envio; Enviado → Entregue). Valores e status financeiro são imutáveis para eles.
- Nenhuma sessão marca "Pago" sem pagamento aprovado, nem "Enviado" sem postagem confirmada pela SuperFrete.
- Um único pagamento aprovado por pedido (índice único); pagamento duplicado aprovado é estornado automaticamente.

## 4. Mercado Pago

Fluxo: checkout cria o pedido (preços, cupom, estoque e frete recalculados no servidor) → tela de pagamento:

- **Pix**: `POST /api/payments/pix` cria o pagamento (valor do banco, idempotência) e devolve QR Code + copia e cola; expira em 30 min.
- **Cartão**: Card Payment Brick tokeniza o cartão no navegador (dados do cartão não passam pelo servidor); `POST /api/payments/card` cria o pagamento com o valor do banco e parcelamento limitado ao configurado.
- **Webhook** `POST /api/webhooks/mercadopago`: valida `x-signature` (HMAC SHA-256), **consulta o pagamento na API**, deduplica em `webhook_events`, confere o valor com o total do pedido e só então atualiza o pedido.
- O retorno do navegador nunca aprova nada: a tela de pagamento apenas consulta o status no servidor.
- Reembolso e cancelamento: botões no painel (`/admin/pedidos/[id]`) chamam a API do MP.

**Configurar (amanhã):** preencher as 3 variáveis; em Suas integrações → Webhooks, URL `https://SEU-DOMINIO/api/webhooks/mercadopago`, evento **Pagamentos**; copiar a assinatura secreta para `MERCADOPAGO_WEBHOOK_SECRET`. Testar com credenciais de teste e [usuários de teste](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/accounts) antes das de produção.

## 5. SuperFrete

- **Cotação** (`POST /api/shipping/quote`): PAC, SEDEX e Mini Envios a partir do CEP de origem (Admin → Configurações) e das dimensões/peso cadastrados. No checkout o frete é **cotado novamente no servidor** no momento do pedido.
- **Etiqueta** (Admin → Pedido): "Emitir etiqueta" verifica o saldo, cria o frete (`/api/v0/cart`) e paga com o saldo (`/api/v0/checkout`). Saldo insuficiente deixa o envio em "aguardando pagamento" com aviso, e o botão "Pagar etiqueta" tenta de novo após a recarga.
- **Impressão** (`/api/v0/tag/print`), **cancelamento** (`/api/v0/order/cancel`) e **rastreamento** (`/api/v0/order/info`).
- O pedido só vira **Enviado** quando a SuperFrete informa `posted`; **Entregue** quando informa `delivered` (webhook, cron ou botão "Atualizar rastreio").
- Webhook `POST /api/webhooks/superfrete`: valida `X-ME-Signature` e consulta a API antes de atualizar.

**Configurar (amanhã):** `SUPERFRETE_TOKEN`, `SUPERFRETE_CONTACT_EMAIL`; completar o endereço de origem em Admin → Configurações; criar o webhook app na SuperFrete apontando para `https://SEU-DOMINIO/api/webhooks/superfrete` com um `secret_token` igual a `SUPERFRETE_WEBHOOK_SECRET`.

## 6. E-mails automáticos (Resend)

Avisos enviados uma única vez por pedido/tipo (tabela `notifications`): pedido recebido, pagamento aprovado, pagamento recusado, pedido cancelado, pedido enviado (com rastreio), entregue, reembolso — e **nova venda** para `STORE_NOTIFY_EMAIL`.

**Configurar:** criar conta em resend.com → Domains → adicionar `eloahmakeup.com` → cadastrar os registros DNS mostrados (SPF/DKIM) no provedor do domínio → API Keys → criar chave e colocar em `RESEND_API_KEY`. Prévia dos modelos: Admin → Integrações. Sem a chave, nenhum e-mail é enviado (e nada quebra).

## 7. Rotinas agendadas

`vercel.json` agenda (com `Authorization: Bearer CRON_SECRET`):

- `/api/cron/expire-orders` a cada 15 min — reconcilia e cancela pedidos não pagos após 60 min, devolvendo o estoque.
- `/api/cron/sync-tracking` a cada hora — atualiza rastreamentos.

No plano Hobby da Vercel os crons rodam no máximo 1×/dia; use o plano Pro ou um agendador externo chamando as mesmas URLs.

## 8. Estrutura

```
src/
  app/(store)/        loja: home, catálogo, produto, carrinho, checkout, conta, auth, institucional
  app/admin/          painel: dashboard, produtos, categorias, estoque, pedidos, clientes, cupons, banners, configurações, integrações
  app/api/            carrinho, frete, checkout, pagamentos, webhooks, cron, admin
  components/         marca (logo), UI, componentes da loja
  lib/                supabase, auth, catálogo, carrinho, pedidos, pagamentos, envios, integrações, validação
  proxy.ts            renovação de sessão e proteção de /conta, /checkout e /admin
supabase/migrations/  schema completo
scripts/              migrate, testes de banco (local e remoto), concessão de admin
```

## 9. Scripts

| Comando | Função |
|---|---|
| `npm run dev` / `build` / `start` | desenvolvimento / build / produção |
| `npm run lint` / `typecheck` | qualidade |
| `npm run db:migrate` / `db:status` | aplicar / listar migrations |
| `npm run db:test:local` | testes de banco offline (PGlite) |
| `npm run db:test:remote` | testes no Supabase real (cria e remove dados de teste) |
| `npm run admin:grant -- email [owner\|admin\|editor\|--revoke]` | permissões administrativas |
| `node scripts/demo-products.mjs [--remove]` | cria / remove o catálogo de demonstração (SKUs `DEMO-*`, ilustrações próprias) |
