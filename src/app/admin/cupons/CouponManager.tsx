"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import type { Coupon } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatPrice } from "@/lib/format";
import { deleteCoupon, saveCoupon, toggleCoupon, type ActionResult } from "../actions";
import { FormMessage, Panel, notify } from "../ui";

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

function CouponForm({ coupon, onDone }: { coupon?: Coupon; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (p: ActionResult, fd: FormData) => {
    const r = await saveCoupon(p, fd);
    if (r?.ok) onDone();
    return r;
  }, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      {coupon && <input type="hidden" name="id" value={coupon.id} />}
      <div className="sm:col-span-4"><FormMessage state={state?.error ? state : undefined} /></div>
      <div><label className="label">Código</label><input name="code" required className="field uppercase" defaultValue={coupon?.code} placeholder="BEMVINDA10" /></div>
      <div>
        <label className="label">Tipo</label>
        <select name="type" className="field" defaultValue={coupon?.type ?? "percentage"}>
          <option value="percentage">Percentual (%)</option>
          <option value="fixed">Valor fixo (R$)</option>
        </select>
      </div>
      <div><label className="label">Valor</label><input name="value" required inputMode="decimal" className="field" defaultValue={coupon?.value} /></div>
      <div><label className="label">Pedido mínimo (R$)</label><input name="min_order_value" inputMode="decimal" className="field" defaultValue={coupon?.min_order_value ?? 0} /></div>
      <div><label className="label">Limite total de usos</label><input name="max_uses" type="number" min={1} className="field" defaultValue={coupon?.max_uses ?? ""} placeholder="ilimitado" /></div>
      <div><label className="label">Usos por cliente</label><input name="max_uses_per_user" type="number" min={1} className="field" defaultValue={coupon?.max_uses_per_user ?? ""} placeholder="ilimitado" /></div>
      <div><label className="label">Início</label><input name="starts_at" type="datetime-local" className="field" defaultValue={toLocal(coupon?.starts_at ?? null)} /></div>
      <div><label className="label">Validade</label><input name="expires_at" type="datetime-local" className="field" defaultValue={toLocal(coupon?.expires_at ?? null)} /></div>
      <div className="sm:col-span-3"><label className="label">Descrição interna</label><input name="description" className="field" defaultValue={coupon?.description ?? ""} /></div>
      <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" name="is_active" defaultChecked={coupon?.is_active ?? true} className="accent-lilac-600" /> Ativo</label>
      <div className="flex gap-2 sm:col-span-4">
        <Button type="submit" loading={pending}>Salvar cupom</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}

export function CouponManager({ coupons, now }: { coupons: Coupon[]; now: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [, start] = useTransition();
  const done = () => {
    setEditing(null);
    router.refresh();
  };
  return (
    <div className="space-y-4">
      {editing === "new" ? <Panel title="Novo cupom"><CouponForm onDone={done} /></Panel> : <Button onClick={() => setEditing("new")}>+ Novo cupom</Button>}
      <div className="divide-y divide-line rounded-2xl border border-line bg-white">
        {coupons.map((c) => {
          const expired = c.expires_at && new Date(c.expires_at).getTime() < now;
          const exhausted = c.max_uses != null && c.uses_count >= c.max_uses;
          return editing === c.id ? (
            <div key={c.id} className="p-5"><CouponForm coupon={c} onDone={done} /></div>
          ) : (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <p className="flex items-center gap-2 font-mono font-bold">
                  {c.code}
                  {!c.is_active ? <Badge>Inativo</Badge> : expired ? <Badge tone="warning">Expirado</Badge> : exhausted ? <Badge tone="warning">Esgotado</Badge> : <Badge tone="success">Ativo</Badge>}
                </p>
                <p className="text-xs text-ink-muted">
                  {c.type === "percentage" ? `${Number(c.value)}% off` : `${formatPrice(c.value)} off`}
                  {Number(c.min_order_value) > 0 ? ` · mínimo ${formatPrice(c.min_order_value)}` : ""} · {c.uses_count}{c.max_uses ? `/${c.max_uses}` : ""} usos
                  {c.max_uses_per_user ? ` · ${c.max_uses_per_user}/cliente` : ""}
                  {c.expires_at ? ` · até ${formatDate(c.expires_at, true)}` : ""}
                </p>
              </div>
              <div className="flex gap-3 text-xs font-semibold">
                <button onClick={() => setEditing(c.id)} className="text-lilac-700">Editar</button>
                <button onClick={() => start(async () => { await toggleCoupon(c.id, !c.is_active); router.refresh(); })} className="text-ink-muted">{c.is_active ? "Desativar" : "Ativar"}</button>
                <button
                  className="text-danger"
                  onClick={() => confirm(`Excluir o cupom ${c.code}?`) && start(async () => { const r = await deleteCoupon(c.id); notify(r?.error ?? r?.message ?? "Cupom excluído", r?.error ? "error" : "success"); router.refresh(); })}
                >
                  Excluir
                </button>
              </div>
            </div>
          );
        })}
        {!coupons.length && <p className="p-8 text-center text-sm text-ink-muted">Nenhum cupom criado.</p>}
      </div>
    </div>
  );
}
