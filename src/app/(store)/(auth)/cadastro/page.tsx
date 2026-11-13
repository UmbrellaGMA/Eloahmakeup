import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AuthShell } from "../AuthShell";
import { SignUpForm } from "../AuthForms";
import { safeNextPath } from "@/lib/safe";

export const metadata: Metadata = { title: "Criar conta", robots: { index: false } };

export default async function SignUpPage({ searchParams }: PageProps<"/cadastro">) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  if (await getUser()) redirect(next);
  return (
    <AuthShell title="Crie sua conta" subtitle="Leva menos de um minuto.">
      <SignUpForm next={next} />
    </AuthShell>
  );
}
