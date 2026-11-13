"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Eye, Pencil, Power, Trash2 } from "lucide-react";
import { deleteProduct, setProductStatus } from "../actions";
import { notify } from "../ui";

export function ProductRowActions({ id, slug, status }: { id: string; slug: string; status: "draft" | "active" | "archived" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={`inline-flex gap-1 ${pending ? "opacity-50" : ""}`}>
      {status === "active" && (
        <Link href={`/produto/${slug}`} target="_blank" className="rounded-lg p-2 hover:bg-lilac-50" title="Ver na loja"><Eye className="h-4 w-4" /></Link>
      )}
      <Link href={`/admin/produtos/${id}`} className="rounded-lg p-2 hover:bg-lilac-50" title="Editar"><Pencil className="h-4 w-4" /></Link>
      <button
        title={status === "active" ? "Desativar" : "Ativar"}
        className="rounded-lg p-2 hover:bg-lilac-50"
        onClick={() =>
          start(async () => {
            const r = await setProductStatus(id, status === "active" ? "draft" : "active");
            notify(r?.error ?? (status === "active" ? "Produto desativado" : "Produto publicado"), r?.error ? "error" : "success");
            router.refresh();
          })
        }
      >
        <Power className={`h-4 w-4 ${status === "active" ? "text-success" : "text-ink-muted"}`} />
      </button>
      <button
        title="Excluir"
        className="rounded-lg p-2 text-danger hover:bg-red-50"
        onClick={() => {
          if (!confirm("Excluir este produto? Produtos com vendas serão arquivados.")) return;
          start(async () => {
            const r = await deleteProduct(id);
            notify(r?.error ?? r?.message ?? "Excluído", r?.error ? "error" : "success");
            router.refresh();
          });
        }}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
