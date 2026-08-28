# AGENTS.md

## Cursor Cloud specific instructions

CuePoint Planning is a single React 18 + Vite SPA (`src/App.jsx` is the whole app) for DJs,
plus Vercel-style serverless functions in `api/`. Data/auth is Supabase; billing is Stripe,
AI is Anthropic, email is Resend, music search is Spotify. Package manager is npm.

### Services and how to run them

- **Frontend dev server**: `npm run dev` (Vite, http://localhost:5173). This is the primary
  dev workflow. Scripts live in `package.json` (`dev`, `build`); there are **no lint or test
  scripts/configs** in this repo, so there is nothing to lint or unit-test. `npm run build`
  (Vite build) works and is the only "check" available.
- **API functions (`api/*`)**: these are Vercel serverless handlers. `npm run dev` (plain Vite)
  does **not** serve them — `/api/*` will 404. Run `vercel dev` (needs the `vercel` CLI + real
  cloud credentials) to exercise AI/billing/email/Spotify/portal/iCal. Not required for the
  core planning UI, which works against Supabase directly from the browser.

### Local Supabase backend (required for the app to render past sign-in)

`src/supabase.js` calls `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` at import
time, so the app white-screens without those env vars. A self-contained local Supabase stack is
pre-provisioned on this VM (no external accounts needed):

- Config/migrations live in `/home/ubuntu/local-supabase/supabase/` (outside the repo on
  purpose — production uses a hosted Supabase project via env vars).
- `/workspace/.env.local` (gitignored) points Vite at the local stack.

Start order after a fresh boot (these are **not** in the update script — they are service
startup and must be run manually):

1. `sudo dockerd > /tmp/dockerd.log 2>&1 &` then `sudo chmod 666 /var/run/docker.sock`
   (Docker 29 is configured with the `fuse-overlayfs` storage driver and
   `containerd-snapshotter` disabled in `/etc/docker/daemon.json` — required for this VM).
2. `cd /home/ubuntu/local-supabase && supabase start` (brings up Postgres/Auth/etc. and
   applies the schema migration).
3. `cd /workspace && npm run dev`.

If you need the local Supabase keys/URLs again, run `supabase status` in
`/home/ubuntu/local-supabase`.

### Test account and gotchas

- Test DJ login: `dj@cuepoint.test` / `CuePoint123!`.
- **Plan gating**: a `trial`/`free` user is shown a Stripe paywall instead of the dashboard;
  only `plan: "solo"` (or `role: "superadmin"`, which routes to the admin panel) reaches the
  DJ dashboard. The test user was created with `user_metadata.plan = "solo"` via the Supabase
  admin API. New signups through the UI default to `trial` and try to redirect to Stripe.
- App data is stored as JSON blobs in the `user_data` table (`user_id`, `key`, `value`),
  written fire-and-forget from `useLocalStorage`. The schema migration must `GRANT` table
  privileges to `anon`/`authenticated` in addition to RLS policies, or writes fail with
  `42501 permission denied` (RLS alone is not enough).
- Email confirmation is disabled in the local Supabase config, so signups/admin-created users
  are immediately active.
