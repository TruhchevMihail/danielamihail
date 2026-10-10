# Даниела & Михаил

Сватбена покана за 29 август 2027 г. — Mansion Plovdiv.

Production: https://daniela-mihail-wedding.vercel.app

## Development

Node.js 24. Run `npm install`, then `npm run build` or `npm run dev` (after `node scripts/assets.mjs`).

- `src/`: current React invitation and pearl-white design.
- `public/admin/`, `lib/`, `api/`: existing private RSVP storage, owner login and CSV export.
- `assets-manifest.json`: approved images/fonts pinned to their exact SHA-256 checksums. `scripts/assets.mjs` restores them from the retained production deployment before every build. To replace an asset, update its manifest entry. The original couple photograph is never edited.
- `public/index.html` and the legacy guest scripts remain for existing backend contract tests; Vite writes the current invitation over the build's root page.

## Deployment

Connected Vercel project: `daniela-mihail-wedding`. Pushes to `main` publish production. Other branches create Preview deployments.

Runtime secrets stay in Vercel: `BLOB_READ_WRITE_TOKEN`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `ALLOWED_ORIGINS`. None are stored in this repository. The existing project's environment and RSVP records are retained.

`npm test` checks RSVP validation, deadline, private storage, sessions, origin checks, CSV export and rate limits.
