"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, Share, SquarePlus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { notify } from "../ui";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Registra o service worker do app do painel (somente notificações, sem cache). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    }
  }, []);
  return null;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function api(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? "Falha na operação.");
  return j;
}

type Env = { ios: boolean; standalone: boolean; supported: boolean };

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Navegador";
}

export function PushSettings({ events, initialPrefs }: { events: Record<string, string>; initialPrefs: Record<string, Record<string, boolean>> }) {
  const [env, setEnv] = useState<Env | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  const refresh = useCallback(async () => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setEnv({ ios, standalone, supported });
    setPermission(supported ? Notification.permission : "unsupported");
    if (!supported) return;
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    const sub = await reg.pushManager.getSubscription();
    setSubscription(sub);
    if (sub) setPrefs(initialPrefs[sub.endpoint] ?? null);
  }, [initialPrefs]);

  useEffect(() => {
    // Detecta o ambiente (iPhone instalado, navegador, suporte a push)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") throw new Error("Permissão negada. Ative em Ajustes → Notificações → Eloah Admin.");
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }));
      const json = sub.toJSON();
      const r = await api({ action: "subscribe", subscription: { endpoint: json.endpoint, keys: json.keys }, device_name: deviceName() });
      setSubscription(sub);
      setPrefs(r.preferences);
      await api({ action: "test", endpoint: sub.endpoint });
      notify("Notificações ativadas! Enviamos um teste.");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!subscription) return;
    setBusy(true);
    try {
      await api({ action: "unsubscribe", endpoint: subscription.endpoint }).catch(() => undefined);
      await subscription.unsubscribe();
      setSubscription(null);
      setPrefs(null);
      notify("Notificações desativadas neste aparelho.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (key: string, value: boolean) => {
    if (!subscription || !prefs) return;
    setPrefs({ ...prefs, [key]: value });
    try {
      const r = await api({ action: "preferences", endpoint: subscription.endpoint, preferences: { [key]: value } });
      setPrefs(r.preferences);
    } catch (e) {
      setPrefs(prefs);
      notify((e as Error).message, "error");
    }
  };

  if (!env) return <div className="skeleton h-40" />;

  // iPhone fora do app instalado: só é possível ativar push depois de adicionar à Tela de Início
  if (env.ios && !env.standalone) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-ink-muted">No iPhone, as notificações funcionam somente pelo app instalado na Tela de Início (iOS 16.4 ou mais recente). Faça assim, <strong className="text-ink">pelo Safari</strong>:</p>
        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">1</span><span>Toque em <Share className="mx-0.5 inline h-4 w-4 text-[#007aff]" /> <strong>Compartilhar</strong> (barra inferior do Safari).</span></li>
          <li className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">2</span><span>Role e toque em <SquarePlus className="mx-0.5 inline h-4 w-4" /> <strong>Adicionar à Tela de Início</strong> e depois em <strong>Adicionar</strong>.</span></li>
          <li className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">3</span><span>Abra o app <strong>Eloah Admin</strong> pela Tela de Início, entre com seu e-mail e senha, venha até esta página e toque em <strong>Ativar notificações</strong>.</span></li>
        </ol>
      </div>
    );
  }

  if (!env.supported || !VAPID) {
    return <p className="text-sm text-ink-muted">Este navegador não suporta notificações push. No iPhone, use o Safari e instale o app na Tela de Início.</p>;
  }

  return (
    <div className="space-y-6">
      {subscription ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="h-5 w-5" /> Notificações ativas neste aparelho</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" loading={busy} onClick={() => api({ action: "test", endpoint: subscription.endpoint }).then(() => notify("Teste enviado!")).catch((e) => notify(e.message, "error"))}>
              Enviar teste
            </Button>
            <Button size="sm" variant="ghost" loading={busy} onClick={disable}><BellOff className="h-4 w-4" /> Desativar</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {permission === "denied" && <p className="rounded-xl bg-red-50 p-3 text-sm text-danger">As notificações foram bloqueadas. No iPhone: Ajustes → Notificações → Eloah Admin → Permitir Notificações. Depois volte aqui.</p>}
          <Button size="lg" loading={busy} onClick={enable}><Bell className="h-5 w-5" /> Ativar notificações</Button>
        </div>
      )}

      {subscription && prefs && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Avisar neste aparelho quando houver</p>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {Object.entries(events).map(([key, label]) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 text-sm">
                  {label}
                  <input type="checkbox" className="h-5 w-5 accent-lilac-600" checked={prefs[key] !== false} onChange={(e) => toggle(key, e.target.checked)} />
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!env.standalone && (
        <p className="flex items-start gap-2 text-xs text-ink-muted">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" /> Para receber no iPhone, abra este endereço no Safari do celular e adicione à Tela de Início. As notificações deste computador continuam funcionando separadamente.
        </p>
      )}
    </div>
  );
}
