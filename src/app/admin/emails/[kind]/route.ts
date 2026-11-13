import { assertAdmin } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { getStoreSettings } from "@/lib/catalog";
import { publicEnv } from "@/lib/env";
import { renderEmail, type EmailKind } from "@/lib/email/templates";
import { sampleOrder } from "@/lib/email/sample";

export const dynamic = "force-dynamic";

const KINDS: EmailKind[] = ["order_created", "payment_approved", "payment_rejected", "order_cancelled", "shipped", "delivered", "refunded", "new_sale"];

/** Prévia de um modelo de e-mail com um pedido fictício (somente administradores). */
export async function GET(_req: Request, ctx: RouteContext<"/admin/emails/[kind]">) {
  try {
    await assertAdmin();
    const { kind } = await ctx.params;
    if (!KINDS.includes(kind as EmailKind)) return new Response("Modelo inexistente", { status: 404 });
    const settings = await getStoreSettings();
    const { order, items } = sampleOrder();
    const email = renderEmail(kind as EmailKind, {
      order,
      items,
      siteUrl: publicEnv.siteUrl,
      logoUrl: `${publicEnv.supabaseUrl}/storage/v1/object/public/branding/email/logo-lilas.png`,
      storeName: settings.store_name,
      whatsapp: settings.whatsapp,
      tracking: { code: "AA123456789BR", url: "https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR", service: "PAC" },
    });
    return new Response(email.html, { headers: { "Content-Type": "text/html; charset=utf-8", "X-Email-Subject": encodeURIComponent(email.subject) } });
  } catch (e) {
    return errorResponse(e);
  }
}
