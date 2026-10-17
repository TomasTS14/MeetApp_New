# MeetApp

Find events near you, say yes, and talk about them under a per-event alias. One TypeScript codebase for iOS, Android and the web, backed by Supabase.

## Repository layout

| Path | What it is |
| --- | --- |
| `mobile/` | The Expo (React Native) app: iOS, Android and web. Routes live in `mobile/app/`. |
| `supabase/migrations/` | The database: tables, privacy rules and the functions the app calls. |
| `supabase/functions/` | Edge functions: `spotify-song` (adds a song to a profile), `delete-account` and `ban-user` (admins only). |
| `supabase/tests/` | pgTAP tests for the privacy rules, the waitlist, onboarding, photo uploads, friends, songs and data export. |
| `e2e/` | Browser tests (Playwright) that run the exported web app against the local stack. |
| `supabase/seed.sql` | Local test data: two organizers and six events in Valencia. |
| `docs/privacy.md` | The privacy rules and where each one is enforced. |
| `docs/screen-map.md` | Every screen, what it shows and which data it uses. |

## Running it locally

You need Node 22, Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
# Database: starts Postgres with PostGIS and applies the migrations
supabase start
supabase test db

# App
cd mobile
cp .env.example .env   # paste the publishable key printed by `supabase status`
npm install
npm run web            # or: npx expo start, then scan the QR code with Expo Go
```

Signing in locally: enter any email address, then open Mailpit at http://127.0.0.1:54324 to read the 6-digit code. The local database comes with six upcoming events around Valencia (`supabase/seed.sql`); if your browser has no location, Nearby uses Valencia's centre.

Edge functions run with `supabase start`. While editing them, `supabase functions serve` reloads them on save. On the hosted project, deploy them with `supabase functions deploy spotify-song delete-account ban-user`.

To make someone an admin who reviews reports (Settings > Reports to review), run in the SQL editor: `insert into private.admins select id from auth.users where email = 'them@example.com';`

After changing a migration, regenerate the app's database types with `npm run db:types` in `mobile/`.

Sign-in emails use `supabase/templates/sign_in_code.html`. The hosted project needs the same template for the "Magic link" and "Confirm signup" emails (Authentication > Emails), so they show the code instead of a link.

## Checks

CI runs on every pull request: `npm run lint` and `npm run typecheck` in `mobile/`, `supabase test db` for the database, and the browser tests in `e2e/`. They cover private events and invite links, reporting and banning, spam limits, songs, sharing, data export and account deletion. When they fail, the run keeps a screenshot and a trace of each failing test.

Running the browser tests locally, with `supabase start` running:

```bash
echo "SPOTIFY_OEMBED_URL=http://host.docker.internal:8787/oembed" > /tmp/functions.env
supabase functions serve --env-file /tmp/functions.env &   # songs use a stand-in for Spotify
supabase db reset                                           # tests expect the seed data
(cd mobile && npx expo export --platform web)
cd e2e && npm install && npx playwright install chromium && npx playwright test
```

## Plan

The approach, decisions and phases are in the [MeetApp technical approach](https://claude.ai/code/artifact/f1c2e3c4-2f35-4aa4-ac48-1529d3e174cf) doc.
