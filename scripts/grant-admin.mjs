/**
 * Concede (ou revoga) acesso administrativo a um usuário já cadastrado.
 * Executado apenas localmente com a SERVICE ROLE KEY — nunca pelo navegador.
 *
 * Uso:
 *   npm run admin:grant -- email@dominio.com            (papel: admin)
 *   npm run admin:grant -- email@dominio.com owner      (papel: owner)
 *   npm run admin:grant -- email@dominio.com --revoke
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const [email, roleOrFlag] = process.argv.slice(2);
if (!email) {
  console.error("Informe o e-mail: npm run admin:grant -- email@dominio.com [owner|admin|editor|--revoke]");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: profile, error } = await supabase
  .from("profiles")
  .select("id, email, full_name")
  .ilike("email", email.trim())
  .maybeSingle();

if (error) {
  console.error(error.message);
  process.exit(1);
}
if (!profile) {
  console.error(`Nenhum usuário com o e-mail ${email}. Crie a conta pelo site (/cadastro) primeiro.`);
  process.exit(1);
}

if (roleOrFlag === "--revoke") {
  const { error: e } = await supabase.from("admin_roles").delete().eq("user_id", profile.id);
  if (e) throw e;
  console.log(`Acesso administrativo revogado de ${profile.email}.`);
} else {
  const role = ["owner", "admin", "editor"].includes(roleOrFlag) ? roleOrFlag : "admin";
  const { error: e } = await supabase.from("admin_roles").upsert({ user_id: profile.id, role });
  if (e) throw e;
  console.log(`${profile.full_name ?? profile.email} agora é ${role}.`);
}
