import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { integrations } from "@/lib/server-env";

/** Registra eventos de integração em integration_logs (nunca grava segredos). */
export async function logIntegration(entry: {
  provider: "mercadopago" | "superfrete" | "system";
  operation: string;
  level?: "info" | "warn" | "error";
  message?: string;
  orderId?: string | null;
  details?: unknown;
}) {
  const level = entry.level ?? "info";
  const line = `[${entry.provider}] ${entry.operation}: ${entry.message ?? ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);

  if (!integrations.supabaseAdmin) return;
  try {
    await createAdminClient()
      .from("integration_logs")
      .insert({
        provider: entry.provider,
        operation: entry.operation,
        level,
        message: entry.message?.slice(0, 2000),
        order_id: entry.orderId ?? null,
        details: entry.details ? JSON.parse(JSON.stringify(entry.details)) : null,
      });
  } catch (e) {
    console.error("[logger] falha ao gravar log", e);
  }
}
