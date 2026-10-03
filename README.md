# EdgePilot — Discover Your Trading Edge

A futures trading journal with AI-powered coaching, discipline tracking, and edge discovery. Built with React, TypeScript, Vite, Tailwind CSS v4, and Supabase.

## Features

- **Trade Journal** — Log futures trades with entry/exit prices, stop/target, emotions, mistakes, notes, and chart screenshots.
- **CSV Import** — Import trades from Tradovate, NinjaTrader, Rithmic, and TradingView. Direct Tradovate API sync also supported.
- **AI Coach** — Ask questions about your trading and get answers grounded in your real trade data, rules, and discovered patterns. Conversation memory persists across sessions.
- **Trade Analysis** — Automated AI analysis of individual trades with risk ratings, strengths, weaknesses, and recommendations.
- **Analytics** — Performance breakdowns by instrument, session, day of week, and direction.
- **Strategy Explorer** — Analyze performance by strategy tag, time of day, and day of week.
- **Edge Discovery** — Automatically discovers patterns in your trading history (strengths, weaknesses, behavioral leaks, risk patterns) and tracks their confidence over time.
- **Discipline Score** — Track rule compliance and unlock achievement badges.
- **Tomorrow's Plan** — AI-generated trading plan based on your recent performance and discovered edges.
- **Demo Data** — Try the app with realistic sample trades before entering your own.
- **Optional Donations** — Support development via Stripe checkout.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI**: Server-side edge functions with deterministic analysis (no external LLM API costs)
- **Payments**: Stripe Checkout via edge function
- **Icons**: lucide-react

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (created automatically when building on Bolt)

### Installation

```bash
npm install
npm run dev
```

### Environment Variables

The following are pre-configured in `.env` for Bolt projects:

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key (safe for client-side use)

Server-side secrets (never exposed to the browser):

- `STRIPE_SECRET_KEY` — Stripe API secret key (for donation checkout)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (for edge functions)

### Build

```bash
npm run build
```

## Security

- **Row Level Security** enabled on all database tables with owner-scoped policies (`auth.uid() = user_id`).
- **Edge functions** verify JWTs via `auth.getUser()` — the anon key alone is not sufficient.
- **Stripe payments** processed server-side; the secret key never reaches the browser.
- **File storage** is private with time-limited signed URLs.
- **Per-account rate limiting** on donation checkout creation.

## Project Structure

```
src/
  components/    UI components (pages, modals, forms)
  lib/           Business logic, types, utilities, Supabase client
supabase/
  functions/     Edge functions (coach-chat, analyze-trade, sync-tradovate, create-donation-checkout)
  migrations/    Database migrations (schema, RLS policies, constraints)
  config.toml    Supabase project configuration
```

## License

Proprietary. All rights reserved.
