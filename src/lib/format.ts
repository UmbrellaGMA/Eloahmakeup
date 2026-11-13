import type { OrderStatus, PaymentStatus, ShipmentStatus } from "./types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatPrice(value: number | string | null | undefined) {
  return brl.format(Number(value ?? 0));
}

export function formatDate(value: string | Date | null | undefined, withTime = false) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "America/Sao_Paulo",
  });
}

export function onlyDigits(v: string | null | undefined) {
  return (v ?? "").replace(/\D/g, "");
}

export function formatCep(v: string | null | undefined) {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function formatCpf(v: string | null | undefined) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatPhone(v: string | null | undefined) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[%_,()]/g, " ")
    .trim()
    .slice(0, 80);
}

/** Preço efetivo (mesma regra da função SQL effective_unit_price) */
export function effectivePrice(
  product: { price: number; promo_price: number | null },
  variant?: { price: number | null; promo_price: number | null } | null,
) {
  const regular = Number(variant?.price ?? product.price);
  const promoRaw = variant ? (variant.promo_price ?? product.promo_price) : product.promo_price;
  const promo = promoRaw != null ? Number(promoRaw) : null;
  const final = promo != null && promo < regular ? promo : regular;
  return { regular, final, onSale: final < regular, discountPercent: final < regular ? Math.round((1 - final / regular) * 100) : 0 };
}

export function installmentInfo(total: number, maxInstallments = 6, minValue = 20) {
  const n = Math.max(1, Math.min(maxInstallments, Math.floor(total / Math.max(minValue, 1))));
  return { count: n, value: total / n };
}

export const orderStatusLabel: Record<OrderStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  preparing: "Em preparação",
  ready_to_ship: "Pronto para envio",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Recusado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

export const shipmentStatusLabel: Record<ShipmentStatus, string> = {
  pending: "Aguardando etiqueta",
  in_cart: "Etiqueta criada (aguardando pagamento)",
  released: "Etiqueta emitida",
  posted: "Postado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  error: "Erro",
};

export const orderStatusTone: Record<OrderStatus, "neutral" | "lilac" | "success" | "warning" | "danger" | "dark"> = {
  awaiting_payment: "warning",
  paid: "lilac",
  preparing: "lilac",
  ready_to_ship: "lilac",
  shipped: "dark",
  delivered: "success",
  cancelled: "danger",
};

export const paymentStatusTone: Record<PaymentStatus, "neutral" | "lilac" | "success" | "warning" | "danger" | "dark"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
  refunded: "neutral",
};

export const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR",
  "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
