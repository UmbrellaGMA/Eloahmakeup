import { CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { integrations, serverEnv } from "@/lib/server-env";
import { getAccountInfo } from "@/lib/integrations/superfrete";
import { formatDate, formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { PageHeader, Panel } from "../ui";

export const metadata = { title: "Integrações" };

function Row({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className="flex items-start gap-3 py-2 text-sm">
      {ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <XCircle className="h-5 w-5 shrink-0 text-danger" />}
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </span>
    </li>
  );
}

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const [{ data: events }, { data: logs }] = await Promise.all([
    supabase.from("webhook_events").select("id, provider, event_type, resource_id, signature_valid, status, attempts, error, created_at").order("created_at", { ascending: false }).limit(15),
    supabase.from("integration_logs").select("id, provider, operation, level, message, created_at").order("created_at", { ascending: false }).limit(25),
  ]);
  const { data: notes } = await supabase
    .from("notifications")
    .select("id, kind, recipient, status, error, created_at, order:orders(order_number)")
    .order("created_at", { ascending: false })
    .limit(20);

  let sf: { balance?: number; email?: string; limits?: { shipments_available?: number } } | null = null;
  let sfError: string | null = null;
  if (integrations.superFrete) {
    try {
      sf = await getAccountInfo();
    } catch (e) {
      sfError = (e as Error).message;
    }
  }
  const site = publicEnv.siteUrl;

  return (
    <>
      <PageHeader title="Integrações" description="Estado das credenciais (as chaves nunca são exibidas) e últimos eventos." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Supabase">
          <ul>
            <Row ok={Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey)} label="URL e chave pública" />
            <Row ok={integrations.supabaseAdmin} label="Service role (servidor)" hint="Necessária para carrinho, checkout e webhooks" />
          </ul>
        </Panel>
        <Panel title="Mercado Pago">
          <ul>
            <Row ok={Boolean(serverEnv.mercadoPagoAccessToken)} label="Access Token" />
            <Row ok={Boolean(publicEnv.mercadoPagoPublicKey)} label="Public Key" />
            <Row ok={Boolean(serverEnv.mercadoPagoWebhookSecret)} label="Assinatura secreta do webhook" hint="Sem ela, as notificações não são aceitas como autênticas" />
            <Row ok={site.startsWith("https://")} label="Site em HTTPS" hint="O MP só envia notificações para URLs públicas HTTPS" />
          </ul>
          <p className="mt-3 break-all rounded-xl bg-cream p-3 text-xs">Webhook: <strong>{site}/api/webhooks/mercadopago</strong> (evento: Pagamentos)</p>
        </Panel>
        <Panel title="SuperFrete">
          <ul>
            <Row ok={integrations.superFrete} label={`Token (${serverEnv.superFreteEnv})`} />
            <Row ok={Boolean(serverEnv.superFreteWebhookSecret)} label="Segredo do webhook" />
            <Row ok={Boolean(serverEnv.superFreteContactEmail)} label="E-mail técnico (User-Agent)" />
          </ul>
          {sf && (
            <p className="mt-3 rounded-xl bg-lilac-50 p-3 text-sm">
              Saldo: <strong>{formatPrice(sf.balance ?? 0)}</strong>
              {sf.limits?.shipments_available != null && <span className="block text-xs text-ink-muted">{sf.limits.shipments_available} etiquetas disponíveis para postagem</span>}
            </p>
          )}
          {sfError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-danger">{sfError}</p>}
          <p className="mt-3 break-all rounded-xl bg-cream p-3 text-xs">Webhook: <strong>{site}/api/webhooks/superfrete</strong></p>
        </Panel>
      </div>

      <Panel title="E-mails automáticos (Resend)" className="mt-6">
        <ul>
          <Row ok={Boolean(serverEnv.resendApiKey)} label="RESEND_API_KEY" hint="Domínio eloahmakeup.com precisa estar verificado no Resend (registros DNS)" />
          <Row ok={Boolean(serverEnv.storeNotifyEmail)} label={`Aviso de nova venda: ${serverEnv.storeNotifyEmail || "não configurado"}`} />
        </ul>
        <p className="mt-2 text-xs text-ink-muted">Remetente: {serverEnv.emailFrom}</p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink-muted">Prévia dos modelos</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {[
            ["order_created", "Pedido recebido"],
            ["payment_approved", "Pagamento aprovado"],
            ["payment_rejected", "Pagamento recusado"],
            ["order_cancelled", "Pedido cancelado"],
            ["shipped", "Pedido enviado"],
            ["delivered", "Pedido entregue"],
            ["refunded", "Reembolso"],
            ["new_sale", "Nova venda (loja)"],
          ].map(([k, label]) => (
            <a key={k} href={`/admin/emails/${k}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-3 py-1.5 font-semibold hover:border-lilac-400 hover:text-lilac-700">
              {label}
            </a>
          ))}
        </div>
        {!!notes?.length && (
          <ul className="mt-5 divide-y divide-line text-xs">
            {notes.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-2 py-2">
                <Badge tone={n.status === "sent" ? "success" : n.status === "failed" ? "danger" : "neutral"}>{n.status === "sent" ? "enviado" : n.status === "failed" ? "falhou" : "pendente"}</Badge>
                <span className="font-semibold">{n.kind}</span>
                <span className="text-ink-muted">#{(n.order as unknown as { order_number: number } | null)?.order_number} · {n.recipient} · {formatDate(n.created_at, true)}</span>
                {n.error && <span className="w-full text-danger">{n.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Rotinas agendadas" className="mt-6">
        <ul className="space-y-1 text-sm">
          <Row ok={Boolean(serverEnv.cronSecret)} label="CRON_SECRET configurado" hint="Protege /api/cron/expire-orders (a cada 15 min) e /api/cron/sync-tracking (a cada hora) — ver vercel.json" />
        </ul>
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Webhooks recebidos">
          <ul className="divide-y divide-line text-xs">
            {(events ?? []).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
                <Badge tone={e.status === "processed" ? "success" : e.status === "failed" ? "danger" : "neutral"}>{e.status}</Badge>
                <span className="font-semibold">{e.provider}</span>
                <span className="text-ink-muted">{e.event_type} · {e.resource_id} · {e.signature_valid ? "assinatura ok" : "sem assinatura"} · {formatDate(e.created_at, true)}</span>
                {e.error && <span className="w-full text-danger">{e.error}</span>}
              </li>
            ))}
            {!events?.length && <li className="py-4 text-ink-muted">Nenhum evento ainda.</li>}
          </ul>
        </Panel>
        <Panel title="Logs de integração">
          <ul className="space-y-1.5 text-xs">
            {(logs ?? []).map((l) => (
              <li key={l.id} className={l.level === "error" ? "text-danger" : l.level === "warn" ? "text-amber-700" : "text-ink-muted"}>
                <strong>{formatDate(l.created_at, true)}</strong> [{l.provider}] {l.operation}: {l.message}
              </li>
            ))}
            {!logs?.length && <li className="text-ink-muted">Sem registros.</li>}
          </ul>
        </Panel>
      </div>
    </>
  );
}
