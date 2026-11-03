import { SQL } from "bun";

const [project, since] = process.argv.slice(2);

if (!project || !since) {
  console.error("usage: bun --env-file=<api .env.production> check-analytics-ingest.ts <project-id> <mark | timestamp from mark>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set; pass --env-file");
  process.exit(1);
}

const sql = new SQL(process.env.DATABASE_URL);

if (since === "mark") {
  const [{ now }] = await sql`SELECT now() AS now`;
  await sql.close();
  console.log(now.toISOString());
  process.exit(0);
}

async function countSince() {
  const [row] = await sql`
    SELECT count(*)::int AS events,
           count(*) FILTER (WHERE bot_detected)::int AS "botFlagged",
           max(received_at) AS "lastReceivedAt",
           coalesce(array_agg(DISTINCT host) FILTER (WHERE host IS NOT NULL), '{}') AS hosts
    FROM events
    WHERE project_id = ${project} AND received_at > ${since}::timestamptz`;
  return row;
}

let result = await countSince();
for (let attempt = 0; attempt < 10 && result.events === 0; attempt++) {
  await Bun.sleep(3000);
  result = await countSince();
}

await sql.close();

console.log(JSON.stringify({ project, since, ...result }));
process.exit(result.events > 0 ? 0 : 2);
