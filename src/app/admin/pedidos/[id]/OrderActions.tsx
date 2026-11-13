"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, ExternalLink, Printer, RefreshCw, Tag, Wallet, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatPrice, shipmentStatusLabel } from "@/lib/format";
import type { OrderStatus, PaymentStatus, Shipment, ShipmentTrackingEvent, ShippingPackage } from "@/lib/types";
import { saveOrderNotes, setOrderStatus } from "../../actions";
import { Panel, notify } from "../../ui";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? "Falha na operação.");
  return j;
}

export function OrderActions({
  order,
  hasActiveShipment,
  mercadoPagoReady,
}: {
  order: { id: string; status: OrderStatus; payment_status: PaymentStatus; admin_notes: string | null };
  hasActiveShipment: boolean;
  mercadoPagoReady: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState(order.admin_notes ?? "");

  const run = (fn: () => Promise<unknown>, ok: string) =>
    start(async () => {
      try {
        const r = (await fn()) as { error?: string } | undefined;
        if (r && typeof r === "object" && "error" in r && r.error) throw new Error(r.error);
        notify(ok);
      } catch (e) {
        notify((e as Error).message, "error");
      }
      router.refresh();
    });

  const transitions: { to: "preparing" | "ready_to_ship" | "paid" | "delivered"; label: string; show: boolean }[] = [
    { to: "preparing", label: "Iniciar preparação", show: order.status === "paid" },
    { to: "ready_to_ship", label: "Marcar pronto para envio", show: order.status === "preparing" },
    { to: "preparing", label: "Voltar para preparação", show: order.status === "ready_to_ship" && !hasActiveShipment },
    { to: "delivered", label: "Confirmar entrega", show: order.status === "shipped" },
  ];

  return (
    <Panel title="Operação">
      <div className="flex flex-wrap gap-2">
        {transitions.filter((t) => t.show).map((t) => (
          <Button key={t.label} size="sm" loading={pending} onClick={() => run(() => setOrderStatus(order.id, t.to), "Status atualizado")}>
            {t.label}
          </Button>
        ))}
        {order.status === "awaiting_payment" && mercadoPagoReady && (
          <>
            <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => post(`/api/admin/orders/${order.id}`, { action: "reconcile" }), "Status consultado no Mercado Pago")}>
              <RefreshCw className="h-3.5 w-3.5" /> Consultar pagamento
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={pending}
              onClick={() => confirm("Cancelar este pedido e devolver o estoque?") && run(() => post(`/api/admin/orders/${order.id}`, { action: "cancel_unpaid" }), "Pedido cancelado")}
            >
              <XCircle className="h-3.5 w-3.5" /> Cancelar pedido
            </Button>
          </>
        )}
        {order.payment_status === "approved" && !["shipped", "delivered"].includes(order.status) && mercadoPagoReady && (
          <Button
            size="sm"
            variant="danger"
            loading={pending}
            onClick={() =>
              confirm("Solicitar REEMBOLSO TOTAL ao Mercado Pago? O pedido será cancelado e o estoque devolvido após a confirmação.") &&
              run(() => post(`/api/admin/orders/${order.id}`, { action: "refund" }), "Reembolso solicitado")
            }
          >
            <Wallet className="h-3.5 w-3.5" /> Reembolsar
          </Button>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        O status financeiro é definido exclusivamente pelo Mercado Pago. &quot;Enviado&quot; é marcado automaticamente quando a SuperFrete confirma a postagem.
      </p>
      <div className="mt-5">
        <label className="label">Notas internas</label>
        <textarea className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button size="sm" variant="outline" className="mt-2" loading={pending} onClick={() => run(() => saveOrderNotes(order.id, notes), "Notas salvas")}>
          Salvar notas
        </Button>
      </div>
    </Panel>
  );
}

export function ShipmentPanel({
  orderId,
  canEmit,
  shipment,
  history,
  tracking,
  defaultPackage,
  serviceName,
  superFreteReady,
}: {
  orderId: string;
  canEmit: boolean;
  shipment: Shipment | null;
  history: Shipment[];
  tracking: ShipmentTrackingEvent[];
  defaultPackage: ShippingPackage | null;
  serviceName: string | null;
  superFreteReady: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pkg, setPkg] = useState<ShippingPackage>(defaultPackage ?? { height: 4, width: 12, length: 17, weight: 0.3 });
  const [error, setError] = useState<string | null>(shipment?.error_message ?? null);

  const act = (body: Record<string, unknown>, ok: string, after?: (r: { url?: string }) => void) =>
    start(async () => {
      setError(null);
      try {
        const r = await post("/api/admin/shipments", body);
        notify(ok);
        after?.(r);
      } catch (e) {
        setError((e as Error).message);
        notify((e as Error).message, "error");
      }
      router.refresh();
    });

  return (
    <Panel
      title="Envio (SuperFrete)"
      actions={shipment && <Badge tone={shipment.status === "posted" || shipment.status === "delivered" ? "success" : shipment.status === "released" ? "lilac" : "warning"}>{shipmentStatusLabel[shipment.status]}</Badge>}
    >
      {!superFreteReady && (
        <p className="mb-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Configure SUPERFRETE_TOKEN para emitir etiquetas.
        </p>
      )}
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-danger">{error}</p>}

      {!shipment ? (
        canEmit ? (
          <div>
            <p className="text-sm text-ink-muted">Modalidade escolhida pela cliente: <strong className="text-ink">{serviceName}</strong>. Confira o pacote antes de emitir:</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["height", "width", "length"] as const).map((k) => (
                <div key={k}>
                  <label className="label">{k === "height" ? "Altura" : k === "width" ? "Largura" : "Compr."} (cm)</label>
                  <input type="number" step="0.1" min={0.1} className="field !py-2" value={pkg[k]} onChange={(e) => setPkg({ ...pkg, [k]: Number(e.target.value) })} />
                </div>
              ))}
              <div>
                <label className="label">Peso (kg)</label>
                <input type="number" step="0.01" min={0.01} className="field !py-2" value={pkg.weight} onChange={(e) => setPkg({ ...pkg, weight: Number(e.target.value) })} />
              </div>
            </div>
            <Button
              className="mt-4"
              loading={pending}
              disabled={!superFreteReady}
              onClick={() => confirm("Emitir a etiqueta? O valor será debitado do saldo SuperFrete.") && act({ action: "emit", order_id: orderId, package: pkg }, "Etiqueta emitida")}
            >
              <Tag className="h-4 w-4" /> Emitir etiqueta
            </Button>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">A etiqueta fica disponível após a aprovação do pagamento.</p>
        )
      ) : (
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-3">
            <div><dt className="text-xs text-ink-muted">Serviço</dt><dd className="font-medium">{shipment.service_name}</dd></div>
            <div><dt className="text-xs text-ink-muted">Custo</dt><dd className="font-medium">{shipment.price != null ? formatPrice(shipment.price) : "—"}</dd></div>
            <div><dt className="text-xs text-ink-muted">ID SuperFrete</dt><dd className="font-mono text-xs">{shipment.superfrete_order_id ?? "—"}</dd></div>
            <div>
              <dt className="text-xs text-ink-muted">Rastreio</dt>
              <dd className="font-mono text-xs">
                {shipment.tracking_code ?? "—"}
                {shipment.tracking_url && <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex text-lilac-700"><ExternalLink className="h-3 w-3" /></a>}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {shipment.status === "in_cart" && (
              <Button size="sm" loading={pending} onClick={() => act({ action: "pay", shipment_id: shipment.id }, "Etiqueta paga e emitida")}>
                <Wallet className="h-3.5 w-3.5" /> Pagar etiqueta (saldo)
              </Button>
            )}
            {["released", "posted"].includes(shipment.status) && (
              <Button size="sm" loading={pending} onClick={() => act({ action: "print", shipment_id: shipment.id }, "Abrindo etiqueta", (r) => r.url && window.open(r.url, "_blank", "noopener"))}>
                <Printer className="h-3.5 w-3.5" /> Imprimir etiqueta
              </Button>
            )}
            <Button size="sm" variant="outline" loading={pending} onClick={() => act({ action: "refresh", shipment_id: shipment.id }, "Rastreamento atualizado")}>
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar rastreio
            </Button>
            {["in_cart", "released", "pending"].includes(shipment.status) && (
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                loading={pending}
                onClick={() => confirm("Cancelar esta etiqueta na SuperFrete?") && act({ action: "cancel", shipment_id: shipment.id, reason: "Cancelado pela loja" }, "Etiqueta cancelada")}
              >
                <XCircle className="h-3.5 w-3.5" /> Cancelar etiqueta
              </Button>
            )}
          </div>
          {tracking.length > 0 && (
            <ol className="space-y-2 border-l border-line pl-4">
              {tracking.map((t) => (
                <li key={t.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-lilac-500" />
                  <p className="font-medium">{t.description ?? t.status}</p>
                  <p className="text-xs text-ink-muted">{formatDate(t.occurred_at, true)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {history.length > 0 && (
        <details className="mt-4 text-xs text-ink-muted">
          <summary className="cursor-pointer">Tentativas anteriores ({history.length})</summary>
          <ul className="mt-2 space-y-1">
            {history.map((h) => <li key={h.id}>{formatDate(h.created_at, true)} · {shipmentStatusLabel[h.status]} {h.error_message ? `· ${h.error_message}` : ""}</li>)}
          </ul>
        </details>
      )}
    </Panel>
  );
}
