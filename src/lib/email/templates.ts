import "server-only";
import { formatCep, formatPrice } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";

/**
 * Modelos de e-mail transacional. HTML em tabelas e estilos inline
 * (compatível com Gmail, Outlook e apps de celular). Toda variável
 * vinda do banco passa por esc() antes de entrar no HTML.
 */

export type EmailKind =
  | "order_created"
  | "payment_approved"
  | "payment_rejected"
  | "order_cancelled"
  | "shipped"
  | "delivered"
  | "refunded"
  | "new_sale";

export interface EmailContext {
  order: Order;
  items: OrderItem[];
  siteUrl: string;
  logoUrl: string;
  storeName: string;
  whatsapp: string | null;
  tracking?: { code: string | null; url: string | null; service: string | null } | null;
}

const C = { ink: "#0f0c13", muted: "#5e5866", lilac: "#a47dab", lilacSoft: "#f6f1f8", line: "#ece8f0", bg: "#f8f5fd" };

export function esc(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr><td style="border-radius:999px;background:${C.ink}">
    <a href="${esc(href)}" style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)}</a>
  </td></tr></table>`;
}

function itemsTable(ctx: EmailContext) {
  const o = ctx.order;
  const rows = ctx.items
    .map(
      (i) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:14px;color:${C.ink}">
          ${esc(i.product_name)}${i.variant_name ? `<br><span style="font-size:12px;color:${C.muted}">${esc(i.variant_name)}</span>` : ""}
          <br><span style="font-size:12px;color:${C.muted}">Qtd. ${i.quantity} × ${formatPrice(i.unit_price)}</span>
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:14px;color:${C.ink};white-space:nowrap">${formatPrice(i.total)}</td>
      </tr>`,
    )
    .join("");
  const line = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0;font-size:${bold ? 15 : 13}px;color:${bold ? C.ink : C.muted};${bold ? "font-weight:bold" : ""}">${label}</td><td align="right" style="padding:4px 0;font-size:${bold ? 15 : 13}px;color:${C.ink};${bold ? "font-weight:bold" : ""}">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">${rows}</table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
      ${line("Subtotal", formatPrice(o.subtotal))}
      ${Number(o.discount_total) > 0 ? line(`Desconto${o.coupon_code ? ` (${esc(o.coupon_code)})` : ""}`, `-${formatPrice(o.discount_total)}`) : ""}
      ${line(`Frete${o.shipping_service_name ? ` (${esc(o.shipping_service_name)})` : ""}`, Number(o.shipping_total) === 0 ? "Grátis" : formatPrice(o.shipping_total))}
      ${line("Total", formatPrice(o.total), true)}
    </table>`;
}

function addressBlock(o: Order) {
  const a = o.shipping_address;
  return `<div style="margin-top:24px;padding:16px;border-radius:14px;background:${C.lilacSoft};font-size:13px;line-height:1.6;color:${C.muted}">
    <strong style="color:${C.ink}">Entrega para</strong><br>
    ${esc(a.recipient_name)}<br>${esc(a.street)}, ${esc(a.number)}${a.complement ? ` - ${esc(a.complement)}` : ""}<br>
    ${esc(a.district)} · ${esc(a.city)}/${esc(a.state)} · CEP ${esc(formatCep(a.postal_code))}
  </div>`;
}

function layout(ctx: EmailContext, preheader: string, body: string) {
  const wa = ctx.whatsapp ? `https://wa.me/55${ctx.whatsapp.replace(/\D/g, "")}` : null;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ctx.storeName)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
  <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:22px;overflow:hidden">
      <tr><td align="center" style="padding:32px 32px 8px"><img src="${esc(ctx.logoUrl)}" width="150" alt="${esc(ctx.storeName)}" style="display:block;border:0;width:150px;height:auto"></td></tr>
      <tr><td style="padding:16px 32px 32px;font-family:Arial,Helvetica,sans-serif">${body}</td></tr>
      <tr><td style="padding:20px 32px;background:${C.ink};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#bdb6c6;text-align:center">
        Dúvidas? Responda este e-mail${wa ? ` ou fale no <a href="${esc(wa)}" style="color:#e2d3f2">WhatsApp</a>` : ""}.<br>
        <a href="${esc(ctx.siteUrl)}" style="color:#e2d3f2;text-decoration:none">${esc(ctx.siteUrl.replace(/^https?:\/\//, ""))}</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:28px;line-height:1.2;color:${C.ink}">${text}</h1>`;
}
function p(text: string) {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${C.muted}">${text}</p>`;
}

export function renderEmail(kind: EmailKind, ctx: EmailContext): { subject: string; html: string; text: string } {
  const o = ctx.order;
  const n = `#${o.order_number}`;
  const first = esc(o.customer_name.split(" ")[0]);
  const orderUrl = `${ctx.siteUrl}/conta/pedidos/${o.id}`;
  const payUrl = `${ctx.siteUrl}/checkout/pedido/${o.id}`;

  switch (kind) {
    case "order_created": {
      const pix = o.payment_method === "pix";
      return {
        subject: `Recebemos seu pedido ${n} 💜`,
        text: `Olá, ${o.customer_name}! Recebemos seu pedido ${n} no valor de ${formatPrice(o.total)}. Ele será confirmado após a aprovação do pagamento. Pagar: ${payUrl}`,
        html: layout(
          ctx,
          `Pedido ${n} recebido — falta só o pagamento.`,
          h1(`Recebemos seu pedido, ${first}!`) +
            p(`O pedido <strong style="color:${C.ink}">${n}</strong> foi registrado e está <strong style="color:${C.ink}">aguardando pagamento</strong>. Assim que o Mercado Pago confirmar, você recebe outro e-mail.`) +
            (pix ? p("O código Pix vale por 30 minutos. Se ele expirar, é só abrir o pedido e gerar um novo.") : "") +
            button(payUrl, pix ? "Pagar com Pix" : "Concluir pagamento") +
            itemsTable(ctx) +
            addressBlock(o),
        ),
      };
    }
    case "payment_approved":
      return {
        subject: `Pagamento aprovado! Pedido ${n} confirmado`,
        text: `Olá, ${o.customer_name}! O pagamento do pedido ${n} (${formatPrice(o.total)}) foi aprovado. Agora vamos preparar seu pedido. Acompanhe: ${orderUrl}`,
        html: layout(
          ctx,
          `Pedido ${n} confirmado. Já estamos preparando tudo.`,
          h1("Pagamento aprovado! ✨") +
            p(`Oba, ${first}! O pagamento do pedido <strong style="color:${C.ink}">${n}</strong> foi aprovado e já começamos a preparar tudo com carinho.`) +
            p("Você receberá o código de rastreio por e-mail assim que o pedido for postado.") +
            button(orderUrl, "Acompanhar pedido") +
            itemsTable(ctx) +
            addressBlock(o),
        ),
      };
    case "payment_rejected":
      return {
        subject: `Não conseguimos aprovar o pagamento do pedido ${n}`,
        text: `Olá, ${o.customer_name}. O pagamento do pedido ${n} não foi aprovado. Você pode tentar novamente com outro cartão ou com Pix: ${payUrl}`,
        html: layout(
          ctx,
          `Seu pedido ${n} continua reservado — tente outro meio de pagamento.`,
          h1("Pagamento não aprovado") +
            p(`${first}, o pagamento do pedido <strong style="color:${C.ink}">${n}</strong> não foi aprovado pela operadora. Seus produtos continuam reservados por enquanto.`) +
            p("Você pode tentar novamente com outro cartão ou pagar com Pix, que é aprovado na hora.") +
            button(payUrl, "Tentar novamente"),
        ),
      };
    case "order_cancelled":
      return {
        subject: `Pedido ${n} cancelado`,
        text: `Olá, ${o.customer_name}. O pedido ${n} foi cancelado porque o pagamento não foi confirmado no prazo. Nenhum valor foi cobrado.`,
        html: layout(
          ctx,
          `O pedido ${n} foi cancelado. Nenhum valor foi cobrado.`,
          h1("Pedido cancelado") +
            p(`${first}, o pedido <strong style="color:${C.ink}">${n}</strong> foi cancelado porque o pagamento não foi confirmado dentro do prazo. Nenhum valor foi cobrado.`) +
            p("Se ainda quiser os produtos, é só fazer um novo pedido — será um prazer te atender!") +
            button(`${ctx.siteUrl}/carrinho`, "Voltar para a loja"),
        ),
      };
    case "shipped": {
      const t = ctx.tracking;
      return {
        subject: t?.code ? `Seu pedido ${n} já tem código de rastreio 📦` : `Seu pedido ${n} foi enviado! 📦`,
        text: `Olá, ${o.customer_name}! O pedido ${n} foi postado${t?.service ? ` via ${t.service}` : ""}.${t?.code ? ` Código de rastreio: ${t.code}.` : ""} ${t?.url ?? orderUrl}`,
        html: layout(
          ctx,
          `Pedido ${n} postado${t?.code ? ` — rastreio ${t.code}` : ""}.`,
          h1("Seu pedido está a caminho! 📦") +
            p(`${first}, o pedido <strong style="color:${C.ink}">${n}</strong> foi embalado e despachado${t?.service ? ` via <strong style="color:${C.ink}">${esc(t.service)}</strong>` : ""}.${o.shipping_days ? ` O prazo estimado é de até ${o.shipping_days} dias úteis após a postagem.` : ""}`) +
            p("O rastreio começa a mostrar as movimentações assim que os Correios registrarem o pacote — pode levar algumas horas.") +
            (t?.code
              ? `<div style="margin:20px 0 4px;padding:18px;border-radius:14px;background:${C.lilacSoft};text-align:center">
                  <div style="font-size:12px;letter-spacing:2px;color:${C.muted}">CÓDIGO DE RASTREIO</div>
                  <div style="margin-top:6px;font-family:'Courier New',monospace;font-size:22px;font-weight:bold;color:${C.ink}">${esc(t.code)}</div>
                </div>`
              : "") +
            button(t?.url ?? orderUrl, "Rastrear pedido") +
            addressBlock(o),
        ),
      };
    }
    case "delivered":
      return {
        subject: `Pedido ${n} entregue 💜`,
        text: `Olá, ${o.customer_name}! O pedido ${n} foi entregue. Esperamos que você ame seus produtos!`,
        html: layout(
          ctx,
          `Seu pedido ${n} chegou!`,
          h1("Seu pedido chegou! 💜") +
            p(`${first}, os Correios confirmaram a entrega do pedido <strong style="color:${C.ink}">${n}</strong>. Esperamos que você ame cada produto!`) +
            p("Marque a gente nas suas makes — adoramos ver o resultado.") +
            button(`${ctx.siteUrl}/produtos`, "Ver novidades"),
        ),
      };
    case "refunded":
      return {
        subject: `Reembolso do pedido ${n}`,
        text: `Olá, ${o.customer_name}. O reembolso de ${formatPrice(o.total)} do pedido ${n} foi solicitado ao Mercado Pago e será devolvido pelo mesmo meio de pagamento.`,
        html: layout(
          ctx,
          `Reembolso do pedido ${n} solicitado.`,
          h1("Reembolso solicitado") +
            p(`${first}, o reembolso de <strong style="color:${C.ink}">${formatPrice(o.total)}</strong> referente ao pedido <strong style="color:${C.ink}">${n}</strong> foi processado pelo Mercado Pago.`) +
            p("No Pix, o valor volta para a conta de origem em instantes. No cartão, o estorno aparece em até duas faturas, conforme o banco emissor."),
        ),
      };
    case "new_sale":
      return {
        subject: `Nova venda: pedido ${n} — ${formatPrice(o.total)}`,
        text: `Nova venda aprovada! Pedido ${n} de ${o.customer_name} (${o.customer_email}), total ${formatPrice(o.total)}. Painel: ${ctx.siteUrl}/admin/pedidos/${o.id}`,
        html: layout(
          ctx,
          `${o.customer_name} — ${formatPrice(o.total)}`,
          h1(`Nova venda! ${n}`) +
            p(`Pagamento aprovado via <strong style="color:${C.ink}">${o.payment_method === "pix" ? "Pix" : "cartão de crédito"}</strong>.`) +
            p(`Cliente: <strong style="color:${C.ink}">${esc(o.customer_name)}</strong> · ${esc(o.customer_email)}${o.customer_phone ? ` · ${esc(o.customer_phone)}` : ""}`) +
            button(`${ctx.siteUrl}/admin/pedidos/${o.id}`, "Abrir no painel") +
            itemsTable(ctx) +
            addressBlock(o),
        ),
      };
  }
}
