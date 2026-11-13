import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { requireAdminPage } from "@/lib/auth";
import { PUSH_EVENTS } from "@/lib/push";
import { integrations } from "@/lib/server-env";
import { formatDate } from "@/lib/format";
import { PageHeader, Panel } from "../ui";
import { PushSettings } from "./pwa";

export const metadata = { title: "App no celular" };

export default async function AdminAppPage() {
  const { user } = await requireAdminPage();
  const supabase = await createClient();
  const { data: devices } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, device_name, preferences, created_at, last_used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const prefsByEndpoint = Object.fromEntries((devices ?? []).map((d) => [d.endpoint, d.preferences as Record<string, boolean>]));

  return (
    <>
      <PageHeader title="App no celular" description="Instale o painel no iPhone e receba avisos de pedidos e vendas na hora." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Notificações">
          {integrations.push ? (
            <PushSettings events={PUSH_EVENTS} initialPrefs={prefsByEndpoint} />
          ) : (
            <p className="text-sm text-danger">As chaves de notificação (VAPID) não estão configuradas no servidor.</p>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title="O app">
            <div className="flex items-center gap-4">
              <Image src="/brand/app/icon-192.png" alt="Ícone Eloah Admin" width={64} height={64} className="rounded-2xl shadow-soft" />
              <div>
                <p className="font-semibold">Eloah Admin</p>
                <p className="text-xs text-ink-muted">Abre direto no painel, em tela cheia, como um aplicativo.</p>
              </div>
            </div>
          </Panel>
          <Panel title={`Seus aparelhos (${devices?.length ?? 0})`}>
            {!devices?.length ? (
              <p className="text-sm text-ink-muted">Nenhum aparelho com notificações ativas.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {devices.map((d) => (
                  <li key={d.id} className="py-2.5">
                    <p className="font-medium">{d.device_name ?? "Aparelho"}</p>
                    <p className="text-xs text-ink-muted">
                      Ativado em {formatDate(d.created_at, true)}
                      {d.last_used_at ? ` · último aviso ${formatDate(d.last_used_at, true)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
