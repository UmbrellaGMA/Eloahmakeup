/**
 * Aplica as migrations de supabase/migrations no banco Supabase remoto.
 * Registra cada versão em supabase_migrations.schema_migrations (mesmo formato
 * usado pela Supabase CLI), portanto é compatível com `supabase db push`.
 *
 * Requer SUPABASE_DB_URL no .env.local (Project Settings → Database →
 * Connection string → URI, de preferência a "Session pooler").
 *
 * Uso:
 *   npm run db:migrate            aplica pendentes
 *   npm run db:migrate -- --status lista o estado
 */
import { config } from "dotenv";
import pg from "pg";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local" });
config();

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL não definido em .env.local");
  process.exit(1);
}

const statusOnly = process.argv.includes("--status");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

await client.connect();
try {
  await client.query(`create schema if not exists supabase_migrations`);
  await client.query(`create table if not exists supabase_migrations.schema_migrations (
    version text primary key, statements text[], name text
  )`);
  const applied = new Set(
    (await client.query(`select version from supabase_migrations.schema_migrations`)).rows.map((r) => r.version),
  );

  for (const f of files) {
    const [version, ...rest] = f.replace(/\.sql$/, "").split("_");
    const name = rest.join("_");
    if (applied.has(version)) {
      console.log(`  = ${f} (já aplicada)`);
      continue;
    }
    if (statusOnly) {
      console.log(`  ! ${f} (pendente)`);
      continue;
    }
    const sql = readFileSync(join(dir, f), "utf8");
    process.stdout.write(`  > ${f} ... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        `insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)`,
        [version, [sql], name],
      );
      await client.query("commit");
      console.log("ok");
    } catch (e) {
      await client.query("rollback");
      console.log("FALHOU");
      console.error(e.message);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await client.end();
}
