"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import type { Category } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { deleteCategory, saveCategory, type ActionResult } from "../actions";
import { UploadButton } from "../ImageUpload";
import { FormMessage, Panel, notify } from "../ui";

function CategoryForm({ category, categories, onDone }: { category?: Category; categories: Category[]; onDone: () => void }) {
  const [image, setImage] = useState(category?.image_url ?? "");
  const [state, action, pending] = useActionState(async (p: ActionResult, fd: FormData) => {
    const r = await saveCategory(p, fd);
    if (r?.ok) onDone();
    return r;
  }, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {category && <input type="hidden" name="id" value={category.id} />}
      <input type="hidden" name="image_url" value={image} />
      <div className="sm:col-span-2"><FormMessage state={state?.error ? state : undefined} /></div>
      <div><label className="label">Nome</label><input name="name" required className="field" defaultValue={category?.name} /></div>
      <div><label className="label">Slug</label><input name="slug" className="field font-mono text-xs" defaultValue={category?.slug} placeholder="gerado do nome" /></div>
      <div>
        <label className="label">Categoria mãe</label>
        <select name="parent_id" className="field" defaultValue={category?.parent_id ?? ""}>
          <option value="">— Nenhuma (principal) —</option>
          {categories.filter((c) => !c.parent_id && c.id !== category?.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div><label className="label">Ordem</label><input name="position" type="number" className="field" defaultValue={category?.position ?? 0} /></div>
      <div className="sm:col-span-2"><label className="label">Descrição</label><textarea name="description" className="field min-h-16" defaultValue={category?.description ?? ""} /></div>
      <div className="sm:col-span-2 flex items-center gap-4">
        {image && <span className="relative h-16 w-16 overflow-hidden rounded-xl bg-cream"><Image src={image} alt="" fill sizes="64px" className="object-cover" /></span>}
        <UploadButton bucket="store-content" folder="categories" label={image ? "Trocar imagem" : "Imagem da vitrine (opcional)"} onUploaded={({ url }) => setImage(url)} />
        {image && <button type="button" className="text-xs text-danger" onClick={() => setImage("")}>Remover</button>}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={category?.is_active ?? true} className="accent-lilac-600" /> Ativa</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="show_in_menu" defaultChecked={category?.show_in_menu ?? true} className="accent-lilac-600" /> Exibir no menu</label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={pending}>Salvar</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}

export function CategoryManager({ categories, counts }: { categories: Category[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [, start] = useTransition();
  const done = () => {
    setEditing(null);
    router.refresh();
  };
  const roots = categories.filter((c) => !c.parent_id);
  const ordered = roots.flatMap((r) => [r, ...categories.filter((c) => c.parent_id === r.id)]);

  return (
    <div className="space-y-4">
      {editing === "new" ? (
        <Panel title="Nova categoria"><CategoryForm categories={categories} onDone={done} /></Panel>
      ) : (
        <Button onClick={() => setEditing("new")}>+ Nova categoria</Button>
      )}
      <div className="divide-y divide-line rounded-2xl border border-line bg-white">
        {ordered.map((c) =>
          editing === c.id ? (
            <div key={c.id} className="p-5"><CategoryForm category={c} categories={categories} onDone={done} /></div>
          ) : (
            <div key={c.id} className={`flex items-center justify-between gap-4 p-4 ${c.parent_id ? "pl-10" : ""}`}>
              <div>
                <p className={`font-semibold ${!c.is_active ? "text-ink-muted line-through" : ""}`}>{c.parent_id ? "↳ " : ""}{c.name}</p>
                <p className="text-xs text-ink-muted">/categoria/{c.slug} · {counts[c.id] ?? 0} produtos{!c.show_in_menu ? " · fora do menu" : ""}</p>
              </div>
              <div className="flex gap-3 text-xs font-semibold">
                <button onClick={() => setEditing(c.id)} className="text-lilac-700">Editar</button>
                <button
                  className="text-danger"
                  onClick={() => {
                    if (!confirm(`Excluir "${c.name}"? Os produtos ficarão sem categoria.`)) return;
                    start(async () => {
                      const r = await deleteCategory(c.id);
                      notify(r?.error ?? "Categoria excluída", r?.error ? "error" : "success");
                      router.refresh();
                    });
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
