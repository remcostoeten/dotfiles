---
name: vercel-to-cloudflare
description: Migrate any of Remco's Next.js sites from Vercel to a Cloudflare Worker built with vinext and the cf CLI, attach its domains, carry secrets over without reading them, and restore spoar analytics when the site uses it. Written for this machine's toolchain (cf CLI, vinext, Bun, Brave on KDE Wayland, 8 GB RAM). Use whenever the user wants a site hosted on Cloudflare instead of Vercel, when a Vercel deployment returns 402 DEPLOYMENT_DISABLED, when redeploying a vinext Worker, when attaching or swapping custom domains on a Worker, when Worker secrets need to come from a local .env or from Vercel, or when a spoar `/_ra` analytics proxy has no secret.
---

# Vercel to Cloudflare Workers

Moves one Next.js repo from Vercel to a Cloudflare Worker. Follow the phases in order; each ends with a check that must pass before the next. For a plain redeploy of a site that is already on Cloudflare, run phases 3, 4, the spoar data check from phase 7 when the site uses spoar, and 8.

Placeholders: `<repo>` is the site's checkout, `<name>` the Worker name, `<zone>` each apex domain, `<host>` each hostname that serves the site.

## Ground rules

- The user allows everything except payments, logging in, creating API tokens and viewing env or secret values. Rotating an app key, reading a Sensitive Vercel var or changing nameservers needs an explicit yes first.
- Never print a secret. Inspect env files by key name only (`cut -d= -f1`), test values by length or by a boolean `grep -c`, write keys to `umask 077` temp files and `shred -u` them at the end.
- Never type into the user's desktop with `ydotool` or `xdotool`: focus is usually on their own window.
- Never kill the user's apps, Brave included.
- Build the committed `HEAD` in a worktree, never the working tree, so the user's uncommitted edits are not shipped.
- 8 GB RAM: run builds one at a time with `NODE_OPTIONS=--max-old-space-size=3072` and `run_in_background: true`, so an OOM or a harness restart does not take the build with it (exit 137 means it was killed; rerun).

## Toolchain facts

- `cf` is the Cloudflare CLI, installed per repo as a devDependency (`npx cf ...`), not wrangler. It logs in through OAuth (`npx cf auth whoami`); if it is not logged in, ask the user to run the login. Discover commands with `npx cf cli search "<description>"`, not nested `--help`. Pass flags where help says so: `npx cf workers secrets list --worker <name>`.
- Config lives in `cloudflare.config.ts` (`defineWorker` from `cf/config`), not `wrangler.toml`. Secrets are declared as `bindings.secret()`, custom domains as `domains: ['example.nl', 'www.example.nl']`.
- vinext builds the Next.js app with Vite: `build:vinext` writes `.cloudflare/output`, `npx cf deploy --prebuilt` uploads it, `npx cf workers triggers deploy` applies domains and cron triggers (it rebuilds first). `vite preview` serves the built Worker locally.
- `NEXT_PUBLIC_*` values are inlined at build time, so they must be in the build's `.env`, not only in Worker secrets.
- `dig` is missing; use DNS over HTTPS: `curl -s "https://cloudflare-dns.com/dns-query?name=<host>&type=A" -H 'accept: application/dns-json'`.
- The machine has no IPv6, so IPv6 curls fail. Port 4173 is taken by another local app; preview on a fixed free port with `--strictPort`.
- `vercel` CLI is logged in. `.vercel/project.json` in the repo names the linked project.

## Phase 1: assess

1. `curl -sI https://<host>/` for every hostname. `x-vercel-error: DEPLOYMENT_DISABLED` with HTTP 402 means Vercel stopped serving: the site is down and speed matters more than polish.
2. Vercel side, names only: `vercel env ls production`, `vercel domains ls`, and `vercel.json` (crons, redirects, rewrites, headers, regions).
3. Find Vercel-only dependencies: `rg -l "@vercel/(analytics|speed-insights|og|blob|kv|edge-config|postgres)|export const runtime|unstable_cache|revalidate" src app`. Each needs a Cloudflare replacement or removal; list them before building. Vercel Analytics and Speed Insights are always removed, following phase 5, before the first build in phase 3.
4. Find host assumptions: canonical host redirects in `next.config.*`, auth base URLs (`BETTER_AUTH_URL`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`), OAuth redirect URIs, and `.github/workflows` that curl a production URL.
5. For each `<zone>`, check its nameservers with DoH (`type=NS`). If they are not Cloudflare's, the zone must be added to the account and the nameservers changed at the registrar, which is a user step. Do not start phase 6 until the zone is active.
6. List DNS records per zone: `npx cf dns records list -z <zone> | jq -c '.[] | {id,type,name,content,proxied}'`. Keep the output in the conversation: it is the rollback record.

## Phase 2: scaffold, if the repo has no Worker setup yet

Skip when `cloudflare.config.ts`, `vite.config.ts` and a `build:vinext` script exist.

1. Add `vinext` and `cf` as devDependencies with Bun, and a `build:vinext` script. Follow the `nextjs-on-cloudflare` skill for the Vite config and entrypoint (`vinext/server/fetch-handler`).
2. Write `cloudflare.config.ts` with `name: '<name>'` (the repo name in kebab case), today's `compatibilityDate`, `compatibilityFlags: ['nodejs_compat']`, an `ASSETS` binding, a `VINEXT_KV_CACHE` KV binding, and one `bindings.secret()` per server-side env var from phase 1. `NEXT_PUBLIC_*` vars are not secrets.
3. Port `vercel.json`: redirects and rewrites into `next.config.*`, headers into `public/_headers`, crons into Worker cron triggers or a scheduled GitHub workflow.
4. Commit the scaffold on a branch so phase 3 builds it; tell the user it is there.

## Phase 3: build from a clean checkout

```bash
git -C <repo> worktree add --detach /tmp/<name>-deploy HEAD
cd /tmp/<name>-deploy
ln -s <repo>/node_modules node_modules
cp <repo>/cloudflare.config.ts .
cp <repo>/.env .env
NODE_OPTIONS=--max-old-space-size=3072 bun run build:vinext > /tmp/<name>-build.log 2>&1
```

Before building, point every host-dependent var in the worktree `.env` at production, for example `sed -i -E 's#^BETTER_AUTH_URL=.*#BETTER_AUTH_URL="https://<canonical host>"#' .env`, appending the line when it is absent. List each override for the final report.

`.env` is the source of values. If the local one is missing keys that exist on Vercel, run `vercel env pull --environment=production /tmp/<name>-vercel.env` and check which keys came back empty (`grep -cE '^KEY=""?$'`): those are Sensitive and unreadable. Ask the user to supply them, or rotate them at their provider with approval.

Check: `cp .env .dev.vars && npx vite preview --port 4789 --strictPort`, then curl `/`, an API route and every top-level route from `app/` (or the paths in `/sitemap.xml`) for 200 and a real `<title>`.

## Phase 4: deploy with secrets

Build the secrets file from exactly the declared names, so nothing extra is uploaded:

```bash
umask 077
keys=$(grep -oE "[A-Z0-9_]+: bindings.secret" cloudflare.config.ts | cut -d: -f1)
grep -E "^($(echo $keys | tr ' ' '|'))=" .env > /tmp/<name>-secrets.env
for k in $keys; do grep -q "^$k=" /tmp/<name>-secrets.env || echo "missing: $k"; done
npx cf deploy --prebuilt --secrets-file /tmp/<name>-secrets.env --message "<what> @ <sha>" | grep -v "_next/static"
```

- A deploy fails while any declared secret is absent ("required secrets have not been set"). An empty `KEY=""` is acceptable for an optional feature; report it.
- Check: `npx cf workers secrets list --worker <name>` shows every key as `secret_text`, and the `*.workers.dev` URL serves the routes from phase 3. When the site uses spoar and is already on its domains, run the data check from phase 7.

## Phase 5: analytics

Vercel Analytics and Speed Insights only work on Vercel, so always remove them as part of the migration:

1. Find every use: `rg -n "@vercel/(analytics|speed-insights)|<Analytics|<SpeedInsights|track\(" <repo> -g '!node_modules'`.
2. Delete the `<Analytics />` and `<SpeedInsights />` elements and their imports (usually in the root `layout.tsx`), and any `track()` calls from `@vercel/analytics`.
3. `bun remove @vercel/analytics @vercel/speed-insights`.
4. Rerun the `rg` until it finds nothing, then type-check and commit the removal. If the site was already deployed with them, rerun phases 3 and 4.

If the site uses spoar (`@spoar/sdk`), follow phase 7 after the domains work.

## Phase 6: swap the domains

1. Delete only the apex and `www` records that point at Vercel (A records to `76.76.21.x`, `216.198.79.x` or `64.29.17.x`, CNAMEs to `*.vercel-dns*.com`): `npx cf dns records delete <id> -z <zone> -f`. Custom domains fail while a conflicting record exists. Leave wildcards, mail, DKIM and other subdomains alone.
2. Add the hostnames to `domains` in `cloudflare.config.ts`, copy it into the worktree, run `npx cf workers triggers deploy`.
3. Triggers deploy disables `workers.dev` unless the config enables it. That is fine once the domains work.
4. Remove the domains from the Vercel project (`vercel domains rm` needs confirmation; ask first) only after Cloudflare serves them.

Check: poll each host until 200. A host still answering `server: Vercel` is usually this machine's DNS cache; confirm the public answer with DoH and force Cloudflare with `curl --resolve <host>:443:188.114.96.0 https://<host>/`.

## Phase 7: spoar analytics

spoar sites send events through their own `/_ra` route (`createProxy` from `@spoar/sdk/proxy`) to `https://api.analytics.remcostoeten.nl`. They need `NEXT_PUBLIC_RA_CONFIG` at build time and `RA_SECRET` as a Worker secret. Without the secret the proxy answers 500 to every event. The project id is the `project` field of the existing `NEXT_PUBLIC_RA_CONFIG`, usually the site's domain.

Where the secret is not:

- Vercel: both vars are Sensitive, so `vercel env pull` writes them as `""`.
- The analytics API: it stores only `sha256(secret)`. The secret cannot be recovered, only rotated.
- Brave: the dashboard session is the `__Secure-ra.session_token` cookie on `.remcostoeten.nl`, but Brave on KDE encrypts cookies (`v11`) with a key from the xdg portal keyring. A copied profile under Playwright cannot decrypt them, and extracting the key from KWallet would expose every saved password. Do not try.

If the local `.env` has a non-empty `RA_SECRET`, verify it with the curl below and skip rotation. Otherwise, after the user approves rotation, run `scripts/rotate-analytics-secret.ts` from this skill against the production database with the env file at `~/dev/analytics/apps/api/.env.production`:

```bash
cd /tmp && umask 077 && bun --env-file=$HOME/dev/analytics/apps/api/.env.production \
  ~/.config/dotfiles/configs/agents/skills/vercel-to-cloudflare/scripts/rotate-analytics-secret.ts <project-id> /tmp/<name>-ra.env
```

It updates and writes inside one transaction, so a failed write rolls the rotation back, and it refuses to overwrite an existing output file. It prints only the project id and the public key length, and writes `NEXT_PUBLIC_RA_CONFIG` (with `endpoint: "/_ra"`) and `RA_SECRET`. Sites use the `RA_` names; the analytics dashboard's env block shows `SPOAR_` names for the same values.

Verify the secret before rebuilding. An empty `events` array fails validation before auth, so send one malformed event: the API rejects it per event, stores nothing, and the status shows whether auth passed.

```bash
set -a; . /tmp/<name>-ra.env; set +a
curl -s -X POST https://api.analytics.remcostoeten.nl/v2/events \
  -H "authorization: Bearer $RA_SECRET" -H 'content-type: application/json' \
  -d '{"v":1,"sentAt":"2026-01-01T00:00:00Z","events":[{"id":"x"}]}' -w ' [%{http_code}]\n' | sed -E 's/sk_live_[0-9a-f]+/sk_…/g'
```

202 with a `VALIDATION_FAILED` rejection means the secret works; 401 means it does not.

Then replace the `NEXT_PUBLIC_RA_CONFIG` and `RA_SECRET` lines in the worktree `.env` with the file's, and rerun phases 3 and 4.

Check on every host: the same malformed event posted to `https://<host>/_ra` with `origin: https://<host>` and `sec-fetch-site: same-origin` returns 202, and a deployed client chunk contains a `pk_live_` key (`rg -l pk_live_ .cloudflare/output`).

### Data check after every deployment

When the site uses spoar, every deployment ends with proof that real events still reach the database, not only a 202. Run it after phase 4, after phase 6 and after every redeploy, on the canonical host and every other hostname:

```bash
S=~/.config/dotfiles/configs/agents/skills/vercel-to-cloudflare/scripts
E=$HOME/dev/analytics/apps/api/.env.production
since=$(bun --env-file=$E $S/check-analytics-ingest.ts <project-id> mark)
python3 $S/visit.py https://<host>/ https://<host>/<another route>
bun --env-file=$E $S/check-analytics-ingest.ts <project-id> "$since"
```

- `visit.py` opens the pages in a headless browser and exits 0 only when the site's own `/_ra` answered 2xx. It needs the Python Playwright package; it runs the system Brave because the Playwright-bundled Chromium version does not match.
- `check-analytics-ingest.ts mark` prints the database clock. Always use it: this machine's clock runs about a minute ahead of the database, so a local `date` makes every new event look older than the start time.
- The check polls for up to 30 seconds and exits 0 when events newer than the mark exist, printing the count and the hosts they came from. Every host you visited must appear in `hosts`. It only reads.
- The events are flagged `bot_detected` because the browser is automated, so they stay out of the dashboard's human numbers. Mention in the report how many test events were sent.
- Exit 2 with a 202 from `/_ra` means the API accepted and then dropped the batch; exit 1 from `visit.py` with no statuses means the client sent nothing, usually because `NEXT_PUBLIC_RA_CONFIG` was missing at build time. Open the page with `?ra=debug` to see the SDK's `RA_DROP` reasons in the console.
- Brave sends Global Privacy Control, and spoar drops every event from a browser that does (`RA_DROP: dnt`). `visit.py` overrides it for the test only. Real Brave visitors, the user included, are never counted; mention that when the numbers look low.

## Phase 8: clean up and hand over

```bash
shred -u /tmp/<name>-secrets.env /tmp/<name>-ra.env /tmp/<name>-vercel.env 2>/dev/null
rm -f /tmp/<name>-deploy/.env /tmp/<name>-deploy/.dev.vars
git -C <repo> worktree remove --force /tmp/<name>-deploy
```

Leave config changes in `<repo>` uncommitted unless asked to commit. Report:

- which commit is live and on which hostnames
- secrets that were overridden for production or left empty
- the spoar data check per host (events stored, hosts seen), when the site uses spoar
- deleted DNS records (ids and old targets, for rollback)
- what still points at Vercel (wildcards, other subdomains, the Vercel project itself)
- that deploys are manual until the user creates a Cloudflare API token for CI (an agent must not create it)
- OAuth apps that need the production callback URL, untested without a login

Rollback: recreate the deleted records from the phase 1 listing with `npx cf dns records create` and remove the hostnames from `domains`. That only helps while the Vercel deployment still serves; a 402 one does not.

Save a project memory with the Worker name, hostnames, deploy command and any overrides, or update it if one exists.
