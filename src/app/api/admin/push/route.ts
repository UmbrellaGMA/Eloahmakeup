import { NextRequest } from "next/server";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUSH_EVENTS, sendPush } from "@/lib/push";
import { integrations } from "@/lib/server-env";
import { firstIssue } from "@/lib/validation";

export const dynamic = "force-dynamic";

const prefsSchema = z.object(Object.fromEntries(Object.keys(PUSH_EVENTS).map((k) => [k, z.boolean()]))).partial();

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("subscribe"),
    subscription: z.object({
      endpoint: z.url().max(1000),
      keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
    }),
    device_name: z.string().max(80).optional(),
  }),
  z.object({ action: z.literal("preferences"), endpoint: z.url(), preferences: prefsSchema }),
  z.object({ action: z.literal("unsubscribe"), endpoint: z.url() }),
  z.object({ action: z.literal("test"), endpoint: z.url() }),
]);

/** Inscrição do aparelho do administrador para notificações do app do painel. */
export async function POST(req: NextRequest) {
  try {
    const { user } = await assertAdmin();
    if (!integrations.push) throw new AppError("Notificações ainda não configuradas no servidor.", 503, "PUSH_NOT_CONFIGURED");
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError(firstIssue(parsed.error), 400, "INVALID");
    const d = parsed.data;
    const db = createAdminClient();

    if (d.action === "subscribe") {
      const { data, error } = await db
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint: d.subscription.endpoint,
            p256dh: d.subscription.keys.p256dh,
            auth: d.subscription.keys.auth,
            device_name: d.device_name ?? null,
            user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
            failures: 0,
          },
          { onConflict: "endpoint" },
        )
        .select("id, preferences")
        .single();
      if (error) throw error;
      return Response.json({ ok: true, id: data.id, preferences: data.preferences });
    }

    // As demais ações só valem para aparelhos do próprio administrador
    const { data: sub } = await db.from("push_subscriptions").select("id, preferences").eq("endpoint", d.endpoint).eq("user_id", user.id).maybeSingle();
    if (!sub) throw new AppError("Este aparelho não está inscrito.", 404, "NOT_FOUND");

    if (d.action === "preferences") {
      const preferences = { ...(sub.preferences as Record<string, boolean>), ...d.preferences };
      await db.from("push_subscriptions").update({ preferences }).eq("id", sub.id);
      return Response.json({ ok: true, preferences });
    }
    if (d.action === "unsubscribe") {
      await db.from("push_subscriptions").delete().eq("id", sub.id);
      return Response.json({ ok: true });
    }
    const r = await sendPush(
      { title: "Eloah Make Up 💜", body: "Notificações ativadas! Você será avisada sobre novos pedidos e vendas.", url: "/admin", tag: "teste" },
      { subscriptionIds: [sub.id] },
    );
    if (!r.sent) throw new AppError("Não foi possível entregar a notificação de teste neste aparelho.", 502, "PUSH_FAILED");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
