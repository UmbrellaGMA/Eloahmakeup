import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/errors";
import { cancelShipment, emitLabel, labelPrintUrl, payLabel, refreshShipment } from "@/lib/shipments";
import { getAccountInfo } from "@/lib/integrations/superfrete";
import { firstIssue } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("emit"),
    order_id: z.uuid(),
    package: z
      .object({ height: z.number().positive(), width: z.number().positive(), length: z.number().positive(), weight: z.number().positive() })
      .partial()
      .optional(),
  }),
  z.object({ action: z.literal("pay"), shipment_id: z.uuid() }),
  z.object({ action: z.literal("refresh"), shipment_id: z.uuid() }),
  z.object({ action: z.literal("print"), shipment_id: z.uuid() }),
  z.object({ action: z.literal("cancel"), shipment_id: z.uuid(), reason: z.string().max(200).optional() }),
]);

/** Operações de etiqueta SuperFrete — somente administradores. */
export async function POST(req: NextRequest) {
  try {
    await assertAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError(firstIssue(parsed.error), 400, "INVALID");
    const d = parsed.data;
    let result: unknown;
    switch (d.action) {
      case "emit":
        result = await emitLabel(d.order_id, d.package);
        break;
      case "pay":
        result = await payLabel(d.shipment_id);
        break;
      case "refresh":
        result = await refreshShipment(d.shipment_id);
        break;
      case "print":
        result = { url: await labelPrintUrl(d.shipment_id) };
        break;
      case "cancel":
        await cancelShipment(d.shipment_id, d.reason ?? "Cancelado pela loja");
        result = { ok: true };
        break;
    }
    revalidatePath("/admin/pedidos", "layout");
    return Response.json(result ?? { ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Saldo e limites da conta SuperFrete. */
export async function GET() {
  try {
    await assertAdmin();
    const info = await getAccountInfo();
    return Response.json({ balance: info.balance ?? 0, limits: info.limits ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}
