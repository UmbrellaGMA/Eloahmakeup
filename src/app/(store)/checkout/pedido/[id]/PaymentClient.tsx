"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { Check, Copy, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PixIcon } from "@/components/ui/SocialIcons";
import { formatPrice } from "@/lib/format";
import { publicEnv } from "@/lib/env";

type Pix = { qr_code: string | null; qr_code_base64: string | null; ticket_url: string | null; expires_at: string | null; status: string };

let mpInitialized = false;

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, new Date(until).getTime() - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return <span className="tabular-nums">{ms === 0 ? "expirado" : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`}</span>;
}

export function PaymentClient({
  orderId,
  total,
  email,
  initialMethod,
  maxInstallments,
  lastRejected,
}: {
  orderId: string;
  total: number;
  email: string;
  initialMethod: "pix" | "credit_card";
  maxInstallments: number;
  lastRejected?: string | null;
}) {
  const router = useRouter();
  const [method, setMethod] = useState(initialMethod);
  const [pix, setPix] = useState<Pix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(lastRejected ?? null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const polls = useRef(0);

  const generatePix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/pix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: orderId }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Não foi possível gerar o Pix.");
      setPix(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const checkStatus = useCallback(
    async (reconcile: boolean) => {
      const res = await fetch(`/api/orders/${orderId}/status${reconcile ? "?reconcile=1" : ""}`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      if (j.payment_status === "approved" || j.status !== "awaiting_payment") router.refresh();
    },
    [orderId, router],
  );

  useEffect(() => {
    // Gera o Pix automaticamente ao abrir a tela com Pix selecionado
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (method === "pix" && !pix && !loading && !error) void generatePix();
  }, [method, pix, loading, error, generatePix]);

  // Polling do status (a confirmação vem do webhook/consulta à API no servidor)
  useEffect(() => {
    if (method !== "pix" || !pix) return;
    const t = setInterval(() => {
      polls.current++;
      void checkStatus(polls.current % 6 === 0);
    }, 5000);
    return () => clearInterval(t);
  }, [method, pix, checkStatus]);

  useEffect(() => {
    if (method === "credit_card" && !mpInitialized && publicEnv.mercadoPagoPublicKey) {
      initMercadoPago(publicEnv.mercadoPagoPublicKey, { locale: "pt-BR" });
      mpInitialized = true;
    }
  }, [method]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 rounded-full bg-cream p-1">
        {(["pix", "credit_card"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMethod(m);
              setError(null);
            }}
            className={`flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${method === m ? "bg-white shadow-soft" : "text-ink-muted"}`}
          >
            {m === "pix" ? <PixIcon className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
            {m === "pix" ? "Pix" : "Cartão de crédito"}
          </button>
        ))}
      </div>

      {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>}

      {method === "pix" && (
        <div className="mt-6 text-center">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-ink-muted">
              <Loader2 className="h-6 w-6 animate-spin text-lilac-600" /> Gerando seu Pix...
            </div>
          )}
          {!loading && !pix && error && (
            <Button onClick={generatePix} variant="outline">
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </Button>
          )}
          {pix && (
            <div className="animate-fade-in">
              <p className="text-sm text-ink-muted">Escaneie o QR Code no app do seu banco ou use o Pix copia e cola.</p>
              {pix.qr_code_base64 && (
                <div className="mx-auto mt-5 w-fit rounded-2xl border border-line bg-white p-3">
                  <Image src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR Code Pix" width={220} height={220} unoptimized />
                </div>
              )}
              {pix.expires_at && (
                <p className="mt-3 text-xs text-ink-muted">
                  Expira em <strong className="text-ink"><Countdown until={pix.expires_at} /></strong>
                </p>
              )}
              {pix.qr_code && (
                <div className="mt-5">
                  <div className="truncate rounded-xl bg-cream px-4 py-3 text-left font-mono text-xs text-ink-muted">{pix.qr_code}</div>
                  <Button
                    className="mt-3 w-full"
                    variant={copied ? "lilac" : "primary"}
                    onClick={async () => {
                      await navigator.clipboard.writeText(pix.qr_code!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Código copiado!" : "Copiar código Pix"}
                  </Button>
                </div>
              )}
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-muted">
                <span className="h-2 w-2 animate-pulse rounded-full bg-lilac-500" /> Aguardando confirmação do pagamento...
              </div>
              <button
                onClick={async () => {
                  setChecking(true);
                  await checkStatus(true);
                  setChecking(false);
                }}
                className="mt-3 text-xs font-semibold text-lilac-700 underline"
              >
                {checking ? "Verificando..." : "Já paguei — verificar agora"}
              </button>
            </div>
          )}
        </div>
      )}

      {method === "credit_card" && (
        <div className="mt-6">
          {!publicEnv.mercadoPagoPublicKey ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Pagamento com cartão em configuração.</p>
          ) : (
            <CardPayment
              locale="pt-BR"
              initialization={{ amount: total, payer: { email } }}
              customization={{ paymentMethods: { maxInstallments, types: { included: ["credit_card"] } } }}
              onSubmit={async (form) => {
                setError(null);
                const res = await fetch("/api/payments/card", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    order_id: orderId,
                    token: form.token,
                    installments: Number(form.installments),
                    payment_method_id: form.payment_method_id,
                    issuer_id: form.issuer_id,
                    payer: { email: form.payer?.email || email, identification: form.payer?.identification ?? null },
                  }),
                });
                const j = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setError(j.error ?? "Não foi possível processar o pagamento.");
                  throw new Error(j.error);
                }
                if (j.status === "approved" || j.status === "pending") {
                  router.refresh();
                  return;
                }
                setError(j.message ?? "Pagamento recusado. Verifique os dados ou tente outro cartão.");
                throw new Error("rejected");
              }}
              onError={() => setError("Erro ao carregar o formulário de cartão. Recarregue a página.")}
            />
          )}
          <p className="mt-3 text-center text-xs text-ink-muted">Total: {formatPrice(total)} · Os dados do cartão são enviados diretamente ao Mercado Pago.</p>
        </div>
      )}
    </div>
  );
}
