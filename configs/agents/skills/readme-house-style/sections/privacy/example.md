From skriuw:

```markdown
## Privacy

**Nothing syncs unless you sign in.** Sync is off until you create an account
and turn it on, on desktop and in the browser alike. Until then your notes
never leave the machine they were written on: the desktop app keeps them in
local SQLite, and the browser app keeps them in your browser's own storage.

A fresh install performs no network requests, and there is no analytics or
telemetry of any kind. The only network code in the app is the sync Worker,
which runs only while you are signed in, and the updater's version check.

Sync is encrypted in transit but not yet end-to-end
([details](docs/specs/cloud-sync-master.md)), so the server can read what it
stores for you. If that boundary matters, stay local-only.
```

From Papertrail:

```markdown
## Privacy

Papertrail is usable without an account, and **nothing leaves your browser until you sign in**.
Drafts live in `localStorage` behind a storage seam; signing in syncs them to Cloudflare D1, merged
by timestamp so a guest draft is never lost by signing in. The PDF is written in the page, so your
resume is never uploaded to export it.

The one runtime dependency is a cookie-free analytics tracker, loaded lazily and absent from the
portable build entirely. It reports pageviews, web vitals and named product events. **No resume
content is ever sent**, and the share viewer reports its path as `/s` rather than `/s/<token>`, so
a share token never reaches the analytics database. [Privacy](https://papertrail.cv/privacy) lists
what is collected and carries a switch to turn it off; `Do Not Track` turns it off with no action.
```
