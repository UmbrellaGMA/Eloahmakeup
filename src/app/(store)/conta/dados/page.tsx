import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { ProfileForm } from "../AccountForms";

export const metadata: Metadata = { title: "Dados pessoais", robots: { index: false } };

export default async function ProfilePage() {
  const user = await requireUser("/conta/dados");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (
    <div>
      <h1 className="heading-display mb-8 text-4xl">Dados pessoais</h1>
      <ProfileForm profile={(data as Profile) ?? null} email={user.email ?? ""} />
      <p className="mt-10 text-sm text-ink-muted">
        Quer trocar sua senha? <Link href="/recuperar-senha" className="font-semibold text-lilac-700 underline">Enviar link de redefinição</Link>
      </p>
    </div>
  );
}
