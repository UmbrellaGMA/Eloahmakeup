import type { Metadata } from "next";
import { AuthShell } from "../AuthShell";
import { ForgotForm } from "../AuthForms";

export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false } };

export default function ForgotPage() {
  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link seguro para você criar uma nova senha.">
      <ForgotForm />
    </AuthShell>
  );
}
