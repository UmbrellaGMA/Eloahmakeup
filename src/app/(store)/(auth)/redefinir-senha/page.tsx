import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AuthShell } from "../AuthShell";
import { ResetForm } from "../AuthForms";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ResetPage() {
  if (!(await getUser())) redirect("/recuperar-senha");
  return (
    <AuthShell title="Crie uma nova senha" subtitle="Escolha uma senha forte que você não use em outros sites.">
      <ResetForm />
    </AuthShell>
  );
}
