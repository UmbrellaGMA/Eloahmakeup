import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AuthShell } from "../AuthShell";
import { LoginForm } from "../AuthForms";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/conta";
  if (await getUser()) redirect(next);
  return (
    <AuthShell title="Bem-vinda de volta" subtitle="Entre com seu e-mail e senha.">
      <LoginForm next={next} linkError={sp.erro === "link"} />
    </AuthShell>
  );
}
