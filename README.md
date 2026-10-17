# MeetApp

Find events near you, say yes, and talk about them under a per-event alias. One TypeScript codebase for iOS, Android and the web, backed by Supabase.

## Repository layout

| Path | What it is |
| --- | --- |
| `mobile/` | The Expo (React Native) app: iOS, Android and web. Routes live in `mobile/app/`. |
| `supabase/migrations/` | The database: tables, privacy rules and the functions the app calls. |
| `supabase/tests/` | pgTAP tests for the privacy rules and the waitlist. |
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

## Checks

CI runs on every pull request: `npm run lint` and `npm run typecheck` in `mobile/`, and `supabase test db` for the database.

## Plan

The approach, decisions and phases are in the [MeetApp technical approach](https://claude.ai/code/artifact/f1c2e3c4-2f35-4aa4-ac48-1529d3e174cf) doc.
