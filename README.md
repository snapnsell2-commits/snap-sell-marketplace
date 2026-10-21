# Snap & Sell Marketplace

A secondhand marketplace: listings with photos, offers and counter-offers, real-time chat
(photos, voice notes, read receipts, typing and online status), notifications, wishlist and
seller profiles.

**Stack:** TypeScript · React 19 · TanStack Start/Router/Query · Tailwind 4 · shadcn/Radix · Supabase

## Get it running

Follow **[SETUP.md](SETUP.md)** — run `supabase/schema.sql`, add your Supabase URL + publishable
key to `.env`, and configure sign-in. Then:

```bash
bun install      # or: npm install
bun run dev      # or: npm run dev
```

Without Supabase keys the app runs in demo mode with sample listings.

## Project map

- `supabase/schema.sql` — tables, row-level security, triggers, storage (re-runnable)
- `src/lib/` — Supabase client, auth, and data access (`marketplace`, `offers`, `chat`, …)
- `src/routes/` — pages (file-based routing)
- `src/components/` — header, offer panel, notification bell, realtime bridge, …
