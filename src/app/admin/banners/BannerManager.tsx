"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import type { Banner } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { deleteBanner, saveBanner, type ActionResult } from "../actions";
import { UploadButton } from "../ImageUpload";
import { FormMessage, Panel, notify } from "../ui";

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

function BannerForm({ banner, nextPosition, onDone }: { banner?: Banner; nextPosition: number; onDone: () => void }) {
  const [img, setImg] = useState({ url: banner?.image_url ?? "", path: banner?.image_path ?? "" });
  const [mob, setMob] = useState({ url: banner?.mobile_image_url ?? "", path: banner?.mobile_image_path ?? "" });
  const [state, action, pending] = useActionState(async (p: ActionResult, fd: FormData) => {
    const r = await saveBanner(p, fd);
    if (r?.ok) onDone();
    return r;
  }, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {banner && <input type="hidden" name="id" value={banner.id} />}
      <input type="hidden" name="image_url" value={img.url} />
      <input type="hidden" name="image_path" value={img.path} />
      <input type="hidden" name="mobile_image_url" value={mob.url} />
      <input type="hidden" name="mobile_image_path" value={mob.path} />
      <div className="sm:col-span-2"><FormMessage state={state?.error ? state : undefined} /></div>
      <div>
        <p className="label">Imagem desktop (1920×800 px)</p>
        {img.url && <div className="relative mb-2 aspect-[12/5] overflow-hidden rounded-xl bg-cream"><Image src={img.url} alt="" fill sizes="400px" className="object-cover" /></div>}
        <UploadButton bucket="banners" folder="desktop" label={img.url ? "Trocar imagem" : "Enviar imagem"} onUploaded={(r) => setImg(r)} />
      </div>
      <div>
        <p className="label">Imagem celular (opcional, 900×1200 px)</p>
        {mob.url && <div className="relative mb-2 aspect-[3/4] w-32 overflow-hidden rounded-xl bg-cream"><Image src={mob.url} alt="" fill sizes="128px" className="object-cover" /></div>}
        <UploadButton bucket="banners" folder="mobile" label={mob.url ? "Trocar imagem" : "Enviar imagem"} onUploaded={(r) => setMob(r)} />
      </div>
      <div><label className="label">Nome do banner (descrição da imagem)</label><input name="title" required className="field" defaultValue={banner?.title} placeholder="Ex.: Coleção de verão" /></div>
      <div><label className="label">Link ao clicar (opcional)</label><input name="link_url" className="field" defaultValue={banner?.link_url ?? ""} placeholder="/categoria/maquiagens" /></div>
      <p className="text-xs text-ink-muted sm:col-span-2">A imagem é exibida inteira, sem texto por cima — coloque título e chamada na própria arte. O nome serve para acessibilidade e SEO.</p>
      <div><label className="label">Ordem</label><input name="position" type="number" className="field" defaultValue={banner?.position ?? nextPosition} /></div>
      <div><label className="label">Exibir a partir de</label><input name="starts_at" type="datetime-local" className="field" defaultValue={toLocal(banner?.starts_at ?? null)} /></div>
      <div><label className="label">Exibir até</label><input name="ends_at" type="datetime-local" className="field" defaultValue={toLocal(banner?.ends_at ?? null)} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={banner?.is_active ?? true} className="accent-lilac-600" /> Ativo</label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={pending}>Salvar banner</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}

export function BannerManager({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [, start] = useTransition();
  const done = () => {
    setEditing(null);
    notify("Banner salvo!");
    router.refresh();
  };
  const next = banners.length ? Math.max(...banners.map((b) => b.position)) + 1 : 0;
  return (
    <div className="space-y-4">
      {editing === "new" ? <Panel title="Novo banner"><BannerForm nextPosition={next} onDone={done} /></Panel> : <Button onClick={() => setEditing("new")}>+ Novo banner</Button>}
      {banners.map((b) =>
        editing === b.id ? (
          <Panel key={b.id} title="Editar banner"><BannerForm banner={b} nextPosition={next} onDone={done} /></Panel>
        ) : (
          <div key={b.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white p-4">
            <div className="relative aspect-[12/5] w-48 shrink-0 overflow-hidden rounded-xl bg-ink">{b.image_url && <Image src={b.image_url} alt="" fill sizes="192px" className="object-cover" />}</div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{b.title} {b.is_active ? <Badge tone="success">Ativo</Badge> : <Badge>Inativo</Badge>}</p>
              <p className="text-xs text-ink-muted">Ordem {b.position} · {b.link_url ?? "sem link"}</p>
            </div>
            <div className="flex gap-3 text-xs font-semibold">
              <button onClick={() => setEditing(b.id)} className="text-lilac-700">Editar</button>
              <button className="text-danger" onClick={() => confirm("Excluir este banner?") && start(async () => { await deleteBanner(b.id); router.refresh(); })}>Excluir</button>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
