import { SQL } from "bun";
import { writeFileSync } from "node:fs";

const [project, outFile] = process.argv.slice(2);

if (!project || !outFile) {
  console.error("usage: bun --env-file=<api .env.production> rotate-analytics-secret.ts <project-id> <out-file>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set; pass --env-file");
  process.exit(1);
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return hex(new Uint8Array(digest));
}

const sql = new SQL(process.env.DATABASE_URL);
const secret = `sk_live_${hex(crypto.getRandomValues(new Uint8Array(16)))}`;
const hash = await sha256(secret);

const publicKey = await sql.begin(async (tx) => {
  const rows = await tx`
    UPDATE projects
    SET secret_key_hash = ${hash},
        secret_key_created_at = now(),
        secret_key_used_at = NULL,
        secret_key_used_origin = NULL,
        key_check = NULL,
        updated_at = now()
    WHERE id = ${project}
    RETURNING public_key`;

  if (rows.length !== 1 || !rows[0].public_key) {
    throw new Error(`expected one project with id ${project} and a public key, found ${rows.length} rows`);
  }

  const config = JSON.stringify({ project, key: rows[0].public_key, endpoint: "/_ra" });
  writeFileSync(outFile, `NEXT_PUBLIC_RA_CONFIG='${config}'\nRA_SECRET=${secret}\n`, { mode: 0o600, flag: "wx" });
  return rows[0].public_key as string;
}).catch((error: Error) => {
  console.error(`${error.message}; nothing rotated`);
  process.exit(1);
}).finally(() => sql.close());

console.log(`rotated ${project}; public key length ${publicKey.length}; wrote ${outFile}`);
