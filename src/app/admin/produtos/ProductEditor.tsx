"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { Category, InventoryRow, ProductImage, ProductVariant, ProductWithRelations } from "@/lib/types";
import { slugify } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { addProductImage, deleteVariant, removeProductImage, reorderProductImages, saveProduct, saveVariant, type ActionResult } from "../actions";
import { UploadButton } from "../ImageUpload";
import { FormMessage, Panel, notify } from "../ui";

const brl = (v: number | null | undefined) => (v == null ? "" : Number(v).toFixed(2).replace(".", ","));

export function ProductEditor({ product, categories }: { product?: ProductWithRelations; categories: Category[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveProduct, undefined);
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));

  useEffect(() => {
    if (state?.ok) {
      notify(state.message ?? "Salvo!");
      if (!product && state.id) router.replace(`/admin/produtos/${state.id}`);
      else router.refresh();
    }
  }, [state, product, router]);

  const baseInv = product?.inventory.find((i) => i.variant_id === null);
  const roots = categories.filter((c) => !c.parent_id);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <form id="product-form" action={action} className="space-y-6">
        {product && <input type="hidden" name="id" value={product.id} />}
        <FormMessage state={state?.error ? state : undefined} />

        <Panel title="Informações">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Nome</label>
              <input
                name="name"
                required
                className="field"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            </div>
            <div>
              <label className="label">URL amigável (slug)</label>
              <input name="slug" className="field font-mono text-xs" value={slug} onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }} />
              <p className="mt-1 text-[11px] text-ink-muted">/produto/{slug || "..."}</p>
            </div>
            <div>
              <label className="label">SKU</label>
              <input name="sku" required className="field uppercase" defaultValue={product?.sku} />
            </div>
            <div>
              <label className="label">Marca</label>
              <input name="brand" className="field" defaultValue={product?.brand ?? ""} />
            </div>
            <div>
              <label className="label">Categoria</label>
              <select name="category_id" className="field" defaultValue={product?.category_id ?? ""}>
                <option value="">Sem categoria</option>
                {roots.map((r) => (
                  <optgroup key={r.id} label={r.name}>
                    <option value={r.id}>{r.name} (geral)</option>
                    {categories.filter((c) => c.parent_id === r.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Resumo (aparece perto do preço)</label>
              <textarea name="short_description" maxLength={300} className="field min-h-20" defaultValue={product?.short_description ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Descrição completa</label>
              <textarea name="description" className="field min-h-40" defaultValue={product?.description ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Tags (separadas por vírgula)</label>
              <input name="tags" className="field" defaultValue={product?.tags?.join(", ")} placeholder="batom, matte, longa duração" />
            </div>
          </div>
        </Panel>

        <Panel title="Preço e estoque">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="label">Preço (R$)</label>
              <input name="price" required inputMode="decimal" className="field" defaultValue={brl(product?.price)} placeholder="59,90" />
            </div>
            <div>
              <label className="label">Preço promocional</label>
              <input name="promo_price" inputMode="decimal" className="field" defaultValue={brl(product?.promo_price)} placeholder="opcional" />
            </div>
            <div>
              <label className="label">Estoque {product?.has_variants && <span className="normal-case">(por variação)</span>}</label>
              <input name="stock" type="number" min={0} className="field" defaultValue={baseInv?.quantity ?? 0} disabled={product?.has_variants} />
            </div>
            <div>
              <label className="label">Alerta estoque baixo</label>
              <input name="low_stock_threshold" type="number" min={0} className="field" defaultValue={baseInv?.low_stock_threshold ?? 5} />
            </div>
          </div>
        </Panel>

        <Panel title="Embalagem para frete (SuperFrete)">
          <div className="grid gap-4 sm:grid-cols-4">
            <div><label className="label">Peso (g)</label><input name="weight_grams" type="number" min={1} required className="field" defaultValue={product?.weight_grams ?? 100} /></div>
            <div><label className="label">Altura (cm)</label><input name="height_cm" inputMode="decimal" required className="field" defaultValue={product?.height_cm ?? 2} /></div>
            <div><label className="label">Largura (cm)</label><input name="width_cm" inputMode="decimal" required className="field" defaultValue={product?.width_cm ?? 11} /></div>
            <div><label className="label">Comprimento (cm)</label><input name="length_cm" inputMode="decimal" required className="field" defaultValue={product?.length_cm ?? 16} /></div>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Mínimos dos Correios: largura 8 cm e comprimento 13 cm. Use as medidas do produto embalado.</p>
        </Panel>

        <Panel title="SEO">
          <div className="grid gap-4">
            <div><label className="label">Título (máx. 70)</label><input name="seo_title" maxLength={70} className="field" defaultValue={product?.seo_title ?? ""} /></div>
            <div><label className="label">Descrição (máx. 170)</label><textarea name="seo_description" maxLength={170} className="field min-h-16" defaultValue={product?.seo_description ?? ""} /></div>
          </div>
        </Panel>

        <Panel title="Publicação">
          <div className="flex flex-wrap items-center gap-6">
            <select name="status" className="field max-w-[200px]" defaultValue={product?.status ?? "draft"}>
              <option value="draft">Rascunho</option>
              <option value="active">Ativo (publicado)</option>
              <option value="archived">Arquivado</option>
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_featured" defaultChecked={product?.is_featured} className="h-4 w-4 accent-lilac-600" /> Destaque na home</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_new" defaultChecked={product?.is_new} className="h-4 w-4 accent-lilac-600" /> Lançamento</label>
          </div>
        </Panel>

        <div className="sticky bottom-4 z-10 flex justify-end">
          <Button type="submit" size="lg" loading={pending} className="shadow-lift">{product ? "Salvar alterações" : "Criar produto"}</Button>
        </div>
      </form>

      <div className="space-y-6">
        {product ? (
          <>
            <ImagesPanel productId={product.id} images={product.images} />
            <VariantsPanel productId={product.id} variants={product.variants} inventory={product.inventory} />
          </>
        ) : (
          <>
            <PendingImagesPanel />
            <Panel title="Variações (cor, tamanho...)">
              <p className="text-sm text-ink-muted">As variações podem ser cadastradas logo depois de criar o produto.</p>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}

/** Imagens do produto novo: enviadas já agora e vinculadas ao clicar em "Criar produto". */
function PendingImagesPanel() {
  const [folder] = useState(() => `novos/${crypto.randomUUID()}`);
  const [images, setImages] = useState<{ url: string; path: string }[]>([]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    setImages(next);
  };
  const remove = async (i: number) => {
    const img = images[i];
    setImages(images.filter((_, k) => k !== i));
    await createClient().storage.from("products").remove([img.path]).catch(() => undefined);
  };
  return (
    <Panel title="Imagens">
      {/* vai junto com o formulário principal */}
      <input type="hidden" name="pending_images" form="product-form" value={JSON.stringify(images)} />
      {images.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          {images.map((img, i) => (
            <div key={img.path} className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-cream">
              <Image src={img.url} alt="" fill sizes="120px" className="object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold text-white">CAPA</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink/70 p-1">
                <button type="button" onClick={() => move(i, -1)} className="p-1 text-white" aria-label="Mover para a esquerda"><ArrowUp className="h-3.5 w-3.5 -rotate-90" /></button>
                <button type="button" onClick={() => remove(i)} className="p-1 text-red-300" aria-label="Remover imagem"><Trash2 className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} className="p-1 text-white" aria-label="Mover para a direita"><ArrowDown className="h-3.5 w-3.5 -rotate-90" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <UploadButton bucket="products" folder={folder} multiple label={images.length ? "Enviar mais imagens" : "Enviar imagens"} onUploaded={(r) => setImages((cur) => [...cur, r])} />
      <p className="mt-2 text-[11px] text-ink-muted">Recomendado: 1200×1500 px (4:5), JPG ou WEBP. A primeira imagem é a capa. As imagens são salvas junto com o produto ao clicar em “Criar produto”.</p>
    </Panel>
  );
}

function ImagesPanel({ productId, images }: { productId: string; images: ProductImage[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const sorted = [...images].sort((a, b) => a.position - b.position);
  const move = (i: number, dir: -1 | 1) => {
    const ids = sorted.map((x) => x.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    start(async () => {
      await reorderProductImages(ids);
      router.refresh();
    });
  };
  return (
    <Panel title="Imagens">
      <div className={`grid grid-cols-3 gap-3 ${pending ? "opacity-50" : ""}`}>
        {sorted.map((img, i) => (
          <div key={img.id} className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-cream">
            <Image src={img.url} alt={img.alt ?? ""} fill sizes="120px" className="object-cover" />
            {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold text-white">CAPA</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink/70 p-1 opacity-0 transition group-hover:opacity-100">
              <button type="button" onClick={() => move(i, -1)} className="p-1 text-white" aria-label="Mover para a esquerda"><ArrowUp className="h-3.5 w-3.5 -rotate-90" /></button>
              <button
                type="button"
                onClick={() => start(async () => { await removeProductImage(img.id); router.refresh(); })}
                className="p-1 text-red-300"
                aria-label="Remover imagem"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} className="p-1 text-white" aria-label="Mover para a direita"><ArrowDown className="h-3.5 w-3.5 -rotate-90" /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <UploadButton
          bucket="products"
          folder={productId}
          multiple
          label="Enviar imagens"
          onUploaded={async ({ url, path }) => {
            const r = await addProductImage(productId, url, path, null);
            if (r?.error) notify(r.error, "error");
            router.refresh();
          }}
        />
        <p className="mt-2 text-[11px] text-ink-muted">Recomendado: 1200×1500 px (4:5), JPG ou WEBP. A primeira imagem é a capa.</p>
      </div>
    </Panel>
  );
}

function VariantForm({ productId, variant, stock, onDone }: { productId: string; variant?: ProductVariant; stock?: number; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (p: ActionResult, fd: FormData) => {
    const r = await saveVariant(p, fd);
    if (r?.ok) onDone();
    return r;
  }, undefined);
  return (
    <form action={action} className="space-y-3 rounded-xl bg-cream p-4">
      <input type="hidden" name="product_id" value={productId} />
      {variant && <input type="hidden" name="id" value={variant.id} />}
      <FormMessage state={state?.error ? state : undefined} />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="label">Nome (ex.: Nude 02)</label><input name="name" required className="field !py-2" defaultValue={variant?.name} /></div>
        <div><label className="label">SKU</label><input name="sku" required className="field !py-2 uppercase" defaultValue={variant?.sku} /></div>
        <div><label className="label">Estoque</label><input name="stock" type="number" min={0} required className="field !py-2" defaultValue={stock ?? 0} /></div>
        <div><label className="label">Cor (opcional)</label><input name="color_hex" type="color" className="h-10 w-full rounded-xl border border-line" defaultValue={variant?.color_hex ?? "#d9b8a3"} /></div>
        <div><label className="label">Preço próprio</label><input name="price" inputMode="decimal" className="field !py-2" defaultValue={brl(variant?.price)} placeholder="herda" /></div>
        <div className="col-span-2"><label className="label">Promo própria</label><input name="promo_price" inputMode="decimal" className="field !py-2" defaultValue={brl(variant?.promo_price)} placeholder="herda do produto" /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={variant?.is_active ?? true} className="accent-lilac-600" /> Ativa</label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>Salvar</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}

function VariantsPanel({ productId, variants, inventory }: { productId: string; variants: ProductVariant[]; inventory: InventoryRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [, start] = useTransition();
  const done = () => {
    setEditing(null);
    notify("Variação salva!");
    router.refresh();
  };
  return (
    <Panel title="Variações (cor, tamanho...)">
      <ul className="space-y-2">
        {variants.map((v) => {
          const stock = inventory.find((i) => i.variant_id === v.id)?.quantity ?? 0;
          return editing === v.id ? (
            <li key={v.id}><VariantForm productId={productId} variant={v} stock={stock} onDone={done} /></li>
          ) : (
            <li key={v.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                {v.color_hex && <span className="h-5 w-5 rounded-full ring-1 ring-line" style={{ backgroundColor: v.color_hex }} />}
                <span className={v.is_active ? "" : "text-ink-muted line-through"}>{v.name}</span>
                <span className="text-xs text-ink-muted">{stock} un.</span>
              </span>
              <span className="flex gap-2 text-xs font-semibold">
                <button onClick={() => setEditing(v.id)} className="text-lilac-700">Editar</button>
                <button
                  className="text-danger"
                  onClick={() => {
                    if (!confirm(`Excluir a variação ${v.name}?`)) return;
                    start(async () => { const r = await deleteVariant(v.id); if (r?.error) notify(r.error, "error"); router.refresh(); });
                  }}
                >
                  Excluir
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {editing === "new" ? (
        <div className="mt-3"><VariantForm productId={productId} onDone={done} /></div>
      ) : (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditing("new")}>+ Adicionar variação</Button>
      )}
      {variants.length > 0 && <p className="mt-3 text-[11px] text-ink-muted">Com variações, o estoque é controlado por variação e o cliente precisa escolher uma opção.</p>}
    </Panel>
  );
}
