"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { InstagramPost, StoreSettings, Testimonial } from "@/lib/types";
import { BR_STATES, formatCep } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { saveSettings } from "../actions";
import { UploadButton } from "../ImageUpload";
import { FormMessage, Panel, notify } from "../ui";

export function SettingsForm({ settings: s }: { settings: StoreSettings }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  const [logo, setLogo] = useState(s.logo_url ?? "");
  const [cep, setCep] = useState(s.origin_postal_code ?? "");
  const [testimonials, setTestimonials] = useState<Testimonial[]>(s.testimonials ?? []);
  const [posts, setPosts] = useState<InstagramPost[]>(s.instagram_posts ?? []);

  useEffect(() => {
    if (state?.ok) notify(state.message ?? "Salvo!");
  }, [state]);

  const f = (name: keyof StoreSettings, label: string, props: Record<string, unknown> = {}) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="field" defaultValue={(s[name] as string | number | null) ?? ""} {...props} />
    </div>
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="logo_url" value={logo} />
      <input type="hidden" name="testimonials" value={JSON.stringify(testimonials)} />
      <input type="hidden" name="instagram_posts" value={JSON.stringify(posts)} />
      <FormMessage state={state?.error ? state : undefined} />

      <Panel title="Loja">
        <div className="grid gap-4 sm:grid-cols-2">
          {f("store_name", "Nome da loja", { required: true })}
          {f("tagline", "Slogan")}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="announcement">Faixa de avisos (separe mensagens com |)</label>
            <input id="announcement" name="announcement" className="field" defaultValue={s.announcement ?? ""} placeholder="Frete grátis acima de R$ 199 | 6x sem juros" />
          </div>
          <div className="sm:col-span-2">
            <p className="label">Logotipo (arquivo para uso em e-mails e redes)</p>
            <div className="flex items-center gap-4">
              {logo && <span className="relative h-16 w-16 overflow-hidden rounded-xl border border-line bg-white"><Image src={logo} alt="" fill sizes="64px" className="object-contain" /></span>}
              <UploadButton bucket="branding" folder="logo" label={logo ? "Trocar logotipo" : "Enviar logotipo"} onUploaded={({ url }) => setLogo(url)} />
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Contato e redes sociais">
        <div className="grid gap-4 sm:grid-cols-3">
          {f("whatsapp", "WhatsApp (com DDD)", { inputMode: "tel" })}
          {f("phone", "Telefone")}
          {f("email", "E-mail de atendimento", { type: "email" })}
          {f("instagram_url", "Instagram (URL)", { placeholder: "https://instagram.com/eloahmakeup" })}
          {f("tiktok_url", "TikTok (URL)")}
          {f("facebook_url", "Facebook (URL)")}
        </div>
      </Panel>

      <Panel title="Dados comerciais">
        <div className="grid gap-4 sm:grid-cols-2">
          {f("company_name", "Razão social")}
          {f("cnpj", "CNPJ")}
        </div>
      </Panel>

      <Panel title="Origem dos envios (remetente SuperFrete)">
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="sm:col-span-3">{f("origin_name", "Nome do remetente")}</div>
          <div className="sm:col-span-3">{f("origin_document", "CPF/CNPJ do remetente")}</div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="origin_postal_code">CEP de origem</label>
            <input id="origin_postal_code" name="origin_postal_code" className="field" value={formatCep(cep)} onChange={(e) => setCep(e.target.value)} inputMode="numeric" />
          </div>
          <div className="sm:col-span-4">{f("origin_street", "Endereço")}</div>
          <div className="sm:col-span-1">{f("origin_number", "Número")}</div>
          <div className="sm:col-span-2">{f("origin_complement", "Complemento")}</div>
          <div className="sm:col-span-3">{f("origin_district", "Bairro")}</div>
          <div className="sm:col-span-4">{f("origin_city", "Cidade")}</div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="origin_state">UF</label>
            <select id="origin_state" name="origin_state" className="field" defaultValue={s.origin_state ?? ""}>
              <option value="">--</option>
              {BR_STATES.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </Panel>

      <Panel title="Vendas">
        <div className="grid gap-4 sm:grid-cols-3">
          {f("max_installments", "Parcelas máximas no cartão", { type: "number", min: 1, max: 12 })}
          {f("min_installment_value", "Parcela mínima (R$)", { inputMode: "decimal" })}
          {f("free_shipping_min", "Frete grátis a partir de (R$)", { inputMode: "decimal", placeholder: "desativado" })}
        </div>
        <p className="mt-2 text-xs text-ink-muted">O frete grátis é aplicado no servidor ao criar o pedido; a loja arca com o custo da etiqueta.</p>
      </Panel>

      <Panel title="Depoimentos de clientes (home)">
        <p className="mb-3 text-xs text-ink-muted">Use apenas depoimentos reais, com autorização das clientes. A seção fica oculta se a lista estiver vazia.</p>
        <div className="space-y-3">
          {testimonials.map((t, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-cream p-3 sm:grid-cols-[1fr_1fr_80px_auto]">
              <input className="field !py-2" placeholder="Nome" value={t.name} onChange={(e) => setTestimonials(testimonials.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input className="field !py-2" placeholder="Cidade" value={t.city ?? ""} onChange={(e) => setTestimonials(testimonials.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)))} />
              <select className="field !py-2" value={t.rating ?? 5} onChange={(e) => setTestimonials(testimonials.map((x, j) => (j === i ? { ...x, rating: Number(e.target.value) } : x)))}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}★</option>)}
              </select>
              <button type="button" onClick={() => setTestimonials(testimonials.filter((_, j) => j !== i))} className="p-2 text-danger" aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
              <textarea className="field sm:col-span-4" placeholder="Depoimento" value={t.text} onChange={(e) => setTestimonials(testimonials.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            </div>
          ))}
        </div>
        {testimonials.length < 12 && <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setTestimonials([...testimonials, { name: "", text: "", rating: 5 }])}>+ Depoimento</Button>}
      </Panel>

      <Panel title="Instagram (vitrine na home)">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {posts.map((p, i) => (
            <div key={i} className="space-y-1">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-cream"><Image src={p.image_url} alt="" fill sizes="120px" className="object-cover" /></div>
              <input className="field !px-2 !py-1.5 text-xs" placeholder="Link do post" value={p.link_url} onChange={(e) => setPosts(posts.map((x, j) => (j === i ? { ...x, link_url: e.target.value } : x)))} />
              <button type="button" onClick={() => setPosts(posts.filter((_, j) => j !== i))} className="text-xs text-danger">Remover</button>
            </div>
          ))}
        </div>
        {posts.length < 12 && (
          <div className="mt-3">
            <UploadButton bucket="store-content" folder="instagram" label="Adicionar foto" onUploaded={({ url }) => setPosts((p) => [...p, { image_url: url, link_url: s.instagram_url ?? "" }])} />
          </div>
        )}
      </Panel>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" size="lg" loading={pending} className="shadow-lift">Salvar configurações</Button>
      </div>
    </form>
  );
}
