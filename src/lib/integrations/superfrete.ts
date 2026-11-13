import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/server-env";
import { AppError } from "@/lib/errors";
import { onlyDigits } from "@/lib/format";
import type { ShippingOption, ShippingPackage } from "@/lib/types";

/**
 * Cliente da API oficial SuperFrete — https://superfrete.readme.io
 * Toda chamada acontece no servidor; o token nunca chega ao navegador.
 */

const BASE_URL = () =>
  serverEnv.superFreteEnv === "sandbox" ? "https://sandbox.superfrete.com" : "https://api.superfrete.com";

/** PAC, SEDEX e Mini Envios (Correios). Jadlog/J&T exigem ponto de postagem próximo. */
export const DEFAULT_SERVICES = "1,2,17";

export const SERVICE_NAMES: Record<number, string> = {
  1: "PAC",
  2: "SEDEX",
  3: "Jadlog",
  17: "Mini Envios",
  31: "Loggi",
  33: "J&T",
};

export class SuperFreteError extends AppError {
  constructor(
    message: string,
    status: number,
    public details?: unknown,
    code = "SUPERFRETE_ERROR",
  ) {
    super(message, status, code);
  }
}

export function isSuperFreteConfigured() {
  return Boolean(serverEnv.superFreteToken);
}

function assertConfigured() {
  if (!isSuperFreteConfigured()) {
    throw new SuperFreteError(
      "Cálculo de frete indisponível no momento: integração com a SuperFrete aguardando configuração.",
      503,
      undefined,
      "SUPERFRETE_NOT_CONFIGURED",
    );
  }
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  assertConfigured();
  const contact = serverEnv.superFreteContactEmail || "contato@eloahmakeup.com.br";
  let res: Response;
  try {
    res = await fetch(`${BASE_URL()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${serverEnv.superFreteToken}`,
        "User-Agent": `EloahMakeUp/1.0 (${contact})`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    throw new SuperFreteError("A SuperFrete não respondeu. Tente novamente em instantes.", 502, String(e), "SUPERFRETE_UNAVAILABLE");
  }

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const msg = extractMessage(json) ?? `Erro ${res.status} na SuperFrete.`;
    const insufficient = /saldo|balance|insuficiente/i.test(msg);
    throw new SuperFreteError(
      insufficient ? `Saldo insuficiente na SuperFrete. ${msg}` : msg,
      res.status === 401 || res.status === 403 ? 502 : res.status >= 500 ? 502 : 422,
      json,
      insufficient ? "SUPERFRETE_INSUFFICIENT_BALANCE" : res.status === 401 ? "SUPERFRETE_UNAUTHORIZED" : "SUPERFRETE_ERROR",
    );
  }
  return json as T;
}

function extractMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return typeof json === "string" && json.length < 300 ? json : null;
  const o = json as Record<string, unknown>;
  // Os detalhes em "errors" são mais úteis que a mensagem genérica ("Ocorreu um ou mais erros.")
  if (o.errors && typeof o.errors === "object") {
    const entries = Object.entries(o.errors as Record<string, unknown>);
    const [field, value] = entries[0] ?? [];
    if (field && /destination_postcode|to\.postal_code/i.test(field)) {
      return "CEP de destino não encontrado nos Correios. Confira o CEP digitado.";
    }
    if (field && /origin_postcode|from\.postal_code/i.test(field)) {
      return "CEP de origem da loja inválido. Revise em Admin → Configurações.";
    }
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") return first.replace(/^\([^)]*\)\s*/, "");
  }
  if (typeof o.message === "string") return o.message;
  if (typeof o.error === "string") return o.error;
  return null;
}

// ---------------------------------------------------------------------------
// Cotação
// ---------------------------------------------------------------------------
export interface QuoteProduct {
  quantity: number;
  height: number;
  width: number;
  length: number;
  weight: number; // kg
}

interface RawQuote {
  id: number;
  name: string;
  price?: number | string;
  delivery_time?: number;
  delivery_range?: { min: number; max: number };
  packages?: { dimensions?: { height: number | string; width: number | string; length: number | string }; weight?: number | string }[];
  company?: { name?: string; picture?: string };
  has_error?: boolean;
  error?: string;
}

export async function quoteShipping(params: {
  fromPostalCode: string;
  toPostalCode: string;
  products: QuoteProduct[];
  insuranceValue?: number;
  services?: string;
}): Promise<ShippingOption[]> {
  const to = onlyDigits(params.toPostalCode);
  if (to.length !== 8) throw new AppError("CEP inválido.", 400, "INVALID_CEP");
  const from = onlyDigits(params.fromPostalCode);
  if (from.length !== 8) {
    throw new AppError("CEP de origem da loja não configurado. Configure em Admin → Configurações.", 503, "ORIGIN_NOT_CONFIGURED");
  }
  const raw = await request<RawQuote[]>("POST", "/api/v0/calculator", {
    from: { postal_code: from },
    to: { postal_code: to },
    services: params.services ?? DEFAULT_SERVICES,
    options: {
      own_hand: false,
      receipt: false,
      insurance_value: params.insuranceValue ?? 0,
      use_insurance_value: false,
    },
    products: params.products,
  });

  return (Array.isArray(raw) ? raw : [])
    .filter((q) => !q.has_error && !q.error && q.price != null && Number(q.price) > 0)
    .map((q) => {
      const pkg = q.packages?.[0];
      return {
        service_id: Number(q.id),
        name: q.name ?? SERVICE_NAMES[q.id] ?? `Serviço ${q.id}`,
        carrier: q.company?.name ?? "Correios",
        carrier_logo: q.company?.picture ?? null,
        price: Math.round(Number(q.price) * 100) / 100,
        delivery_days: Number(q.delivery_time ?? q.delivery_range?.max ?? 0),
        delivery_min: q.delivery_range?.min ?? null,
        delivery_max: q.delivery_range?.max ?? null,
        package: pkg?.dimensions
          ? {
              height: Number(pkg.dimensions.height),
              width: Number(pkg.dimensions.width),
              length: Number(pkg.dimensions.length),
              weight: Number(pkg.weight ?? 0),
            }
          : null,
      } satisfies ShippingOption;
    })
    .sort((a, b) => a.price - b.price);
}

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------
export interface LabelParty {
  name: string;
  address: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state_abbr: string;
  postal_code: string;
  document?: string;
  email?: string;
  phone?: string;
}

export async function createLabelInCart(input: {
  from: LabelParty;
  to: LabelParty;
  service: number;
  products: { name: string; quantity: number; unitary_value: number }[];
  volumes: ShippingPackage;
  insuranceValue: number;
  tag: string;
  tagUrl?: string;
}) {
  return request<{ id: string; price?: number; status?: string }>("POST", "/api/v0/cart", {
    from: input.from,
    to: input.to,
    service: input.service,
    products: input.products.map((p) => ({
      name: p.name.slice(0, 100),
      quantity: String(p.quantity),
      unitary_value: p.unitary_value.toFixed(2),
    })),
    volumes: input.volumes,
    options: {
      insurance_value: input.insuranceValue,
      receipt: false,
      own_hand: false,
      non_commercial: true,
      tags: [{ tag: input.tag, url: input.tagUrl ?? "" }],
    },
    platform: "Eloah Make Up",
  });
}

export interface CheckoutResult {
  success?: boolean;
  purchase?: {
    status?: string;
    orders?: { id: string; price?: number; tracking?: string; print?: { url?: string } }[];
  };
}

/** Paga a etiqueta com o saldo da carteira SuperFrete (status → released). */
export async function checkoutLabels(orderIds: string[]) {
  return request<CheckoutResult>("POST", "/api/v0/checkout", { orders: orderIds });
}

export interface SuperFreteOrderInfo {
  id: string;
  status: "pending" | "released" | "posted" | "delivered" | "canceled" | string;
  tracking: string | null;
  price?: number;
  service_id?: number;
  print?: { url?: string };
  generated_at?: string | null;
  posted_at?: string | null;
  delivered_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function getOrderInfo(superfreteOrderId: string) {
  return request<SuperFreteOrderInfo>("GET", `/api/v0/order/info/${encodeURIComponent(superfreteOrderId)}`);
}

export async function getPrintUrl(orderIds: string[]) {
  return request<{ url: string }>("POST", "/api/v0/tag/print", { orders: orderIds });
}

export async function cancelLabel(superfreteOrderId: string, description = "Cancelado pela loja") {
  return request<Record<string, { canceled?: boolean }>>("POST", "/api/v0/order/cancel", {
    order: { id: superfreteOrderId, description },
  });
}

export async function getAccountInfo() {
  return request<{ firstname?: string; lastname?: string; email?: string; balance?: number; limits?: { shipments?: number; shipments_available?: number } }>(
    "GET",
    "/api/v0/user",
  );
}

/** Valida o header X-ME-Signature (HMAC-SHA256 do corpo bruto). Aceita hex ou base64. */
export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (!serverEnv.superFreteWebhookSecret || !signature) return false;
  const mac = createHmac("sha256", serverEnv.superFreteWebhookSecret).update(rawBody, "utf8");
  const digest = mac.digest();
  const candidates = [digest.toString("hex"), digest.toString("base64")];
  const provided = signature.trim().replace(/^sha256=/i, "");
  return candidates.some((c) => c.length === provided.length && timingSafeEqual(Buffer.from(c), Buffer.from(provided)));
}

/** Traduz o status da SuperFrete para o status interno do envio. */
export function mapSuperFreteStatus(status: string | undefined | null) {
  switch ((status ?? "").toLowerCase()) {
    case "pending":
      return "in_cart" as const;
    case "released":
    case "generated":
      return "released" as const;
    case "posted":
      return "posted" as const;
    case "delivered":
      return "delivered" as const;
    case "canceled":
    case "cancelled":
      return "cancelled" as const;
    default:
      return null;
  }
}
