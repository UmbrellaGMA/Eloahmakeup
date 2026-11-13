import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { AdminNav } from "./AdminNav";
import { AdminToaster } from "./ui";

export const metadata: Metadata = { title: { default: "Painel", template: "%s | Painel Eloah" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Painel independente da loja. A permissão é verificada no servidor a cada request. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user, role } = await requireAdminPage();
  return (
    <div className="min-h-dvh bg-[#f6f4f9]">
      <AdminNav email={user.email ?? ""} role={role} />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-10">{children}</main>
      </div>
      <AdminToaster />
    </div>
  );
}
