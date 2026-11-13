import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/server-env";
import { AppError } from "@/lib/errors";
import type { PaymentStatus } from "@/lib/types";

/**
 * Cliente da API oficial do Mercado Pago (v1/payments).
 * https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
 */
const API = "https://api.mercadopago.com";

export class MercadoPagoError extends AppError {
  constructor(
    message: string,
    status: number,
    public details?: unknown,
    code = "MERCADOPAGO_ERROR",
  ) {
    super(message, status, code);
  }
}

export function isMercadoPagoConfigured() {
  return Boolean(serverEnv.mercadoPagoAccessToken);
}

async function request<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  if (!isMercadoPagoConfigured()) {
    throw new MercadoPagoError(
      "Pagamentos indisponíveis no momento: integração com o Mercado Pago aguardando configuração.",
      503,
      undefined,
      "MERCADOPAGO_NOT_CONFIGURED",
    );
  }
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${serverEnv.mercadoPagoAccessToken}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
  } catch (e) {
    throw new MercadoPagoError("O Mercado Pago não respondeu. Tente novamente.", 502, String(e), "MERCADOPAGO_UNAVAILABLE");
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const message =
      (json?.message as string) ||
      ((json?.cause as { description?: string }[] | undefined)?.[0]?.description ?? `Erro ${res.status} no Mercado Pago.`);
    throw new MercadoPagoError(message, res.status >= 500 ? 502 : 422, json);
  }
  return json as T;
}

export interface MPPayment {
  id: number;
  status: "pending" | "approved" | "authorized" | "in_process" | "in_mediation" | "rejected" | "cancelled" | "refunded" | "charged_back";
  status_detail: string;
  transaction_amount: number;
  transaction_amount_refunded?: number;
  installments: number;
  payment_method_id: string;
  payment_type_id: string;
  external_reference: string | null;
  date_approved: string | null;
  date_last_updated: string;
  date_of_expiration: string | null;
  live_mode: boolean;
  card?: { last_four_digits?: string | null };
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
  };
  metadata?: Record<string, unknown>;
}

export function mapPaymentStatus(status: MPPayment["status"]): PaymentStatus {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    case "refunded":
    case "charged_back":
      return "refunded";
    default:
      // pending, authorized, in_process, in_mediation
      return "pending";
  }
}

export const STATUS_DETAIL_MESSAGES: Record<string, string> = {
  cc_rejected_insufficient_amount: "Saldo/limite insuficiente no cartão.",
  cc_rejected_bad_filled_security_code: "Código de segurança inválido.",
  cc_rejected_bad_filled_date: "Data de validade inválida.",
  cc_rejected_bad_filled_other: "Confira os dados do cartão.",
  cc_rejected_bad_filled_card_number: "Número do cartão inválido.",
  cc_rejected_call_for_authorize: "Autorize o pagamento junto ao banco emissor.",
  cc_rejected_card_disabled: "Cartão desabilitado. Contate o emissor.",
  cc_rejected_duplicated_payment: "Pagamento duplicado. Você já realizou um pagamento com esse valor.",
  cc_rejected_high_risk: "Pagamento recusado por segurança. Tente outro meio de pagamento.",
  cc_rejected_max_attempts: "Limite de tentativas atingido. Use outro cartão.",
  cc_rejected_other_reason: "O emissor recusou o pagamento.",
  pending_contingency: "Estamos processando o pagamento.",
  pending_review_manual: "Pagamento em análise.",
  pending_waiting_transfer: "Aguardando o pagamento do Pix.",
  accredited: "Pagamento aprovado!",
};

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { first_name: parts[0] ?? "", last_name: parts.slice(1).join(" ") || parts[0] || "" };
}

function notificationUrl(siteUrl: string) {
  // O Mercado Pago só aceita URLs públicas HTTPS.
  return siteUrl.startsWith("https://") ? `${siteUrl}/api/webhooks/mercadopago?source_news=webhooks` : undefined;
}

/** Data no formato aceito pelo MP: yyyy-MM-dd'T'HH:mm:ss.SSS-03:00 */
function mpDate(d: Date) {
  const local = new Date(d.getTime() - 3 * 3600 * 1000);
  return local.toISOString().replace("Z", "-03:00");
}

export async function createPixPayment(input: {
  orderId: string;
  orderNumber: number;
  amount: number;
  payer: { email: string; name: string; cpf?: string | null };
  siteUrl: string;
  idempotencyKey: string;
  expiresInMinutes?: number;
}) {
  const expires = new Date(Date.now() + (input.expiresInMinutes ?? 30) * 60 * 1000);
  return request<MPPayment>(
    "POST",
    "/v1/payments",
    {
      transaction_amount: input.amount,
      description: `Pedido #${input.orderNumber} - Eloah Make Up`,
      payment_method_id: "pix",
      external_reference: input.orderId,
      notification_url: notificationUrl(input.siteUrl),
      date_of_expiration: mpDate(expires),
      metadata: { order_id: input.orderId, order_number: input.orderNumber },
      payer: {
        email: input.payer.email,
        ...splitName(input.payer.name),
        ...(input.payer.cpf ? { identification: { type: "CPF", number: input.payer.cpf } } : {}),
      },
    },
    input.idempotencyKey,
  );
}

export async function createCardPayment(input: {
  orderId: string;
  orderNumber: number;
  amount: number;
  token: string;
  installments: number;
  paymentMethodId: string;
  issuerId?: string | number | null;
  payer: { email: string; identification?: { type: string; number: string } | null };
  siteUrl: string;
  idempotencyKey: string;
}) {
  return request<MPPayment>(
    "POST",
    "/v1/payments",
    {
      transaction_amount: input.amount,
      token: input.token,
      description: `Pedido #${input.orderNumber} - Eloah Make Up`,
      installments: input.installments,
      payment_method_id: input.paymentMethodId,
      ...(input.issuerId ? { issuer_id: Number(input.issuerId) } : {}),
      external_reference: input.orderId,
      notification_url: notificationUrl(input.siteUrl),
      statement_descriptor: "ELOAHMAKEUP",
      metadata: { order_id: input.orderId, order_number: input.orderNumber },
      payer: {
        email: input.payer.email,
        ...(input.payer.identification ? { identification: input.payer.identification } : {}),
      },
    },
    input.idempotencyKey,
  );
}

export async function getPayment(paymentId: string | number) {
  return request<MPPayment>("GET", `/v1/payments/${encodeURIComponent(String(paymentId))}`);
}

export async function cancelPayment(paymentId: string | number) {
  return request<MPPayment>("PUT", `/v1/payments/${encodeURIComponent(String(paymentId))}`, { status: "cancelled" });
}

export async function refundPayment(paymentId: string | number, idempotencyKey: string, amount?: number) {
  return request<{ id: number; status: string; amount: number }>(
    "POST",
    `/v1/payments/${encodeURIComponent(String(paymentId))}/refunds`,
    amount ? { amount } : {},
    idempotencyKey,
  );
}

/**
 * Valida a assinatura do webhook (header x-signature: "ts=...,v1=...").
 * Manifesto: id:[data.id];request-id:[x-request-id];ts:[ts];
 */
export function verifyWebhookSignature(params: { xSignature: string | null; xRequestId: string | null; dataId: string | null }) {
  const secret = serverEnv.mercadoPagoWebhookSecret;
  if (!secret || !params.xSignature) return false;
  const parts = Object.fromEntries(
    params.xSignature.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  // Obs.: reenvios do MP podem chegar horas depois; replays são inofensivos porque
  // o status é sempre consultado na API e os eventos são deduplicados.
  const id = params.dataId && /^[a-z0-9]+$/i.test(params.dataId) ? params.dataId.toLowerCase() : params.dataId;
  let manifest = "";
  if (id) manifest += `id:${id};`;
  if (params.xRequestId) manifest += `request-id:${params.xRequestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return expected.length === v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
