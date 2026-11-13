"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/**
 * Envia a imagem direto ao Supabase Storage com a sessão do administrador.
 * As políticas do bucket só permitem escrita para quem está em admin_roles.
 */
export async function uploadToStorage(bucket: "products" | "banners" | "branding" | "store-content", folder: string, file: File) {
  if (!ACCEPT.split(",").includes(file.type) && !(bucket === "branding" && file.type === "image/svg+xml")) {
    throw new Error("Formato não suportado. Use JPG, PNG, WEBP ou AVIF.");
  }
  if (file.size > 8 * 1024 * 1024) throw new Error("Arquivo muito grande (máx. 8 MB).");
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
  if (error) throw new Error(error.message.includes("row-level security") ? "Sem permissão para enviar arquivos." : error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export function UploadButton({
  bucket,
  folder,
  onUploaded,
  label = "Enviar imagem",
  multiple,
}: {
  bucket: "products" | "banners" | "branding" | "store-content";
  folder: string;
  onUploaded: (r: { url: string; path: string }) => void | Promise<void>;
  label?: string;
  multiple?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept={bucket === "branding" ? `${ACCEPT},image/svg+xml` : ACCEPT}
        multiple={multiple}
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length) return;
          setBusy(true);
          setError(null);
          try {
            for (const f of files) await onUploaded(await uploadToStorage(bucket, folder, f));
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
            if (ref.current) ref.current.value = "";
          }
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="flex items-center gap-2 rounded-xl border border-dashed border-lilac-300 bg-lilac-50 px-4 py-3 text-sm font-semibold text-lilac-800 transition hover:bg-lilac-100 disabled:opacity-50"
      >
        <Upload className="h-4 w-4" /> {busy ? "Enviando..." : label}
      </button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
